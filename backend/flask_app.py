"""
Flask Native Backend for Gold SaaS on PythonAnywhere / WSGI
Matches FastAPI API routes and JSON contracts 1:1.
"""
import os
import re
import uuid
import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from sqlalchemy import func
from dotenv import load_dotenv

load_dotenv()

from database import (
    engine, SessionLocal, init_db, Shop, User, GoldPrice, Invoice, InvoiceItem,
    Customer, JewelryType, InventoryItem, CashTransaction, TrustItem,
)
from services.gold_math import convert_to_equivalent
from services.gemini_vision import analyze_image_with_gemini
from services.inventory_logic import (
    get_latest_prices, buy_price_for_karat, fetch_live_prices,
    upsert_customer, apply_invoice_inventory_effects,
    capital_summary, cash_balance, inventory_item_to_dict,
    customer_with_stats, ensure_default_types, reconcile_past_invoices, _sum,
    cash_purchases_paid,
)
from auth import (
    hash_password, verify_password, is_weak_password, password_problem,
    issue_token, read_token, token_matches_user,
    unauthorized, forbidden, is_admin, is_super_admin,
)

# Initialize database & reconcile inventory
init_db()
try:
    _db_startup = SessionLocal()
    reconcile_past_invoices(_db_startup)
    _db_startup.close()
except Exception as _e:
    print(f"[startup] reconcile error: {_e}")

app = Flask(__name__)
# الواجهة بتبعت التوكن في هيدر Authorization (مش كوكيز)، فمفيش داعي لـ credentials
CORS(app, resources={r"/api/*": {"origins": "*"}})

def get_db():
    return SessionLocal()

# ---------- Authentication guard ----------
PUBLIC_PATHS = {"/", "/api/health", "/api/auth/login", "/api/prices/live"}
# مسارات مسموحة لحساب لازم يغيّر كلمة المرور قبل أي حاجة تانية
MUST_CHANGE_ALLOWED = {"/api/user/password"}
LAST_SEEN_EVERY_SECONDS = 5 * 60
# المسارات المسموحة للسوبر أدمن: إدارة المنصة وحسابه هو بس
SUPER_ADMIN_PATHS = ("/api/admin/", "/api/user/password", "/api/user/credentials")

@app.before_request
def require_auth():
    if request.method == "OPTIONS" or request.path in PUBLIC_PATHS:
        return None
    if not request.path.startswith("/api/"):
        return None

    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    payload = read_token(token) if token else None
    if not payload:
        return unauthorized()

    db = get_db()
    try:
        user = db.query(User).filter(User.id == payload.get("uid")).first()
        if not user or not user.is_active or not token_matches_user(payload, user):
            return unauthorized()
        g.user_id = user.id
        g.user_role = user.role
        g.user_shop_id = user.shop_id

        # متابعة الاستخدام للوحة المشتركين: نحدّث "آخر نشاط" مرة كل 5 دقايق بالكتير
        now = datetime.datetime.utcnow()
        if not user.last_seen_at or (now - user.last_seen_at).total_seconds() > LAST_SEEN_EVERY_SECONDS:
            try:
                user.last_seen_at = now
                db.commit()
            except Exception as exc:
                db.rollback()
                print(f"[auth] last_seen update skipped: {exc}")
    finally:
        db.close()

    if payload.get("mc") and request.path not in MUST_CHANGE_ALLOWED:
        return forbidden("لازم تغيّر كلمة المرور الأول")

    # صاحب المنصة مش صاحب محل: ما يفتحش ولا يعدّل بيانات أي محل (فواتير، مخزن، أسعار، خزينة...)
    if g.user_role == "super_admin" and not request.path.startswith(SUPER_ADMIN_PATHS):
        return forbidden("حساب السوبر أدمن لإدارة المنصة بس، مش لشاشات المحل")
    return None

def _requested_shop_id():
    raw = request.args.get("shop_id") or request.headers.get("X-Shop-Id")
    if not raw and request.is_json:
        body = request.get_json(silent=True) or {}
        if isinstance(body, dict):
            raw = body.get("shop_id") or body.get("id")
    return raw

def current_shop_id():
    """المحل الخاص بالمستخدم من التوكن. السوبر أدمن بس يقدر يحدد محل تاني."""
    if is_super_admin():
        try:
            raw = _requested_shop_id()
            return int(raw) if raw else 1
        except (ValueError, TypeError):
            return 1
    return g.user_shop_id or 1

def owns(obj_shop_id):
    return is_super_admin() or obj_shop_id == current_shop_id()

def admin_only():
    """يرجّع رد 403 لو المستخدم مش صاحب محل أو سوبر أدمن"""
    return None if is_admin() else forbidden()

def _user_json(user, shop=None):
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
        "shop_id": user.shop_id,
        "shop_name": shop.name if shop else "منصة الصاغة السحابية",
        "is_active": user.is_active,
    }

# --- Health check ---
@app.route("/", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "Gold Jewelry SaaS API (Flask)"})

# --- Unified Login ---
TAHA_ALIASES = [
    "taha", "admin", "taharagab", "طاهرجب", "طهرجب", "طه",
    "الهدي", "الهدى", "محلالهدي", "محلالهدى", "مجوهراتالهدى", "مجوهراتالهدي"
]

def _find_login_user(db, raw_username):
    u_lower = raw_username.lower().replace(" ", "")
    # 1. Exact DB match
    user = db.query(User).filter(User.username == raw_username).first()
    # 2. Case-insensitive / trimmed match
    if not user:
        for u in db.query(User).all():
            if u.username and u.username.lower().strip() == u_lower:
                user = u
                break
    # 3. أسماء بديلة لحساب صاحب محل الهدى (لازم كلمة المرور الحقيقية برضه)
    if not user and (u_lower in TAHA_ALIASES or "طه" in raw_username or "هدى" in raw_username or "هدي" in raw_username):
        user = db.query(User).filter(User.username == "taha").first()
        if not user:
            user = db.query(User).filter(User.username == "admin").first()
    return user

@app.route("/api/auth/login", methods=["POST"])
def login():
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        raw_username = str(data.get("username", "")).strip()
        raw_password = str(data.get("password", "")).strip()

        user = _find_login_user(db, raw_username) if raw_username else None
        if not user or not user.is_active or not verify_password(user, raw_password):
            return jsonify({"success": False, "detail": "اسم المستخدم أو كلمة المرور غير صحيحة"}), 401

        now = datetime.datetime.utcnow()
        user.last_login_at = now
        user.last_seen_at = now
        db.commit()  # يحفظ ترقية كلمة المرور القديمة لصيغة مشفرة + وقت الدخول
        must_change = is_weak_password(raw_password)
        shop = db.query(Shop).filter(Shop.id == user.shop_id).first() if user.shop_id else None
        user_data = _user_json(user, shop)
        if shop and user.role == "shop_admin" and not user.name:
            user_data["name"] = f"{shop.owner_name} (صاحب المحل)"
        user_data["token"] = issue_token(user, must_change=must_change)
        user_data["must_change_password"] = must_change
        return jsonify({"success": True, "user": user_data})
    finally:
        db.close()

def _can_manage_user(target):
    """المستخدم نفسه، أو صاحب المحل لموظفي محله، أو السوبر أدمن"""
    if target.id == g.user_id or is_super_admin():
        return True
    return g.user_role == "shop_admin" and target.shop_id == g.user_shop_id and target.role != "super_admin"

# --- Quick Credentials & Password Management ---
@app.route("/api/user/credentials", methods=["PUT", "POST"])
def update_user_credentials():
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id") or g.user_id
        new_password = str(data.get("new_password") or data.get("password") or "").strip()
        new_username = str(data.get("new_username") or "").strip()
        new_name = str(data.get("name") or "").strip()

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not _can_manage_user(user):
            return jsonify({"detail": "المستخدم غير موجود"}), 404

        if new_username:
            existing = db.query(User).filter(User.username == new_username, User.id != user.id).first()
            if existing:
                return jsonify({"detail": "اسم المستخدم محجوز بالفعل"}), 400
            user.username = new_username

        if new_password:
            problem = password_problem(new_password)
            if problem:
                return jsonify({"detail": problem}), 400
            user.password = hash_password(new_password)

        if new_name:
            user.name = new_name

        db.commit()
        db.refresh(user)
        result = {
            "success": True,
            "message": "تم تحديث بيانات الحساب بنجاح دون المساس بالمخزن أو الفواتير",
            "user": {
                "id": user.id,
                "name": user.name,
                "username": user.username,
                "role": user.role,
                "shop_id": user.shop_id
            }
        }
        if user.id == g.user_id:
            result["token"] = issue_token(user)
        return jsonify(result)
    finally:
        db.close()

# --- Shop Settings (Jeweler Profile) ---
@app.route("/api/shop", methods=["GET", "PUT"])
def shop_settings():
    db = get_db()
    try:
        data = (request.get_json(force=True, silent=True) or {}) if request.method == "PUT" else {}
        if request.method == "PUT" and not is_admin():
            return forbidden()
        shop_id = current_shop_id()

        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            return jsonify({"detail": "المحل غير مسجل"}), 404

        if request.method == "GET":
            return jsonify({
                "id": shop.id,
                "name": shop.name,
                "owner_name": shop.owner_name,
                "phone": shop.phone,
                "address": shop.address,
                "commercial_record": shop.commercial_record,
                "tax_number": shop.tax_number,
                "subscription_plan": shop.subscription_plan,
                "is_active": shop.is_active,
                "opening_cash": shop.opening_cash or 0.0,
                "created_at": shop.created_at.isoformat() if shop.created_at else None
            })

        # PUT update
        shop.name = data.get("name", shop.name)
        shop.owner_name = data.get("owner_name", shop.owner_name)
        shop.phone = data.get("phone", shop.phone)
        shop.address = data.get("address", shop.address)
        shop.commercial_record = data.get("commercial_record", shop.commercial_record)
        shop.tax_number = data.get("tax_number", shop.tax_number)

        # Update owner user name as well
        owner_users = db.query(User).filter(User.shop_id == shop.id).all()
        for u in owner_users:
            if u.role == "shop_admin":
                u.name = f"{shop.owner_name} (صاحب المحل)"

        db.commit()
        db.refresh(shop)

        return jsonify({
            "message": "تم تحديث بيانات المحل بنجاح",
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "owner_name": shop.owner_name,
                "phone": shop.phone,
                "address": shop.address,
                "commercial_record": shop.commercial_record,
                "tax_number": shop.tax_number,
                "subscription_plan": shop.subscription_plan,
                "is_active": shop.is_active
            }
        })
    finally:
        db.close()

# --- Change User Password ---
@app.route("/api/user/password", methods=["PUT"])
def change_password():
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id") or g.user_id
        new_password = str(data.get("new_password") or "").strip()
        if not new_password:
            return jsonify({"detail": "بيانات غير مكتملة"}), 400
        problem = password_problem(new_password)
        if problem:
            return jsonify({"detail": problem}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not _can_manage_user(user):
            return jsonify({"detail": "المستخدم غير موجود"}), 404

        user.password = hash_password(new_password)
        db.commit()
        result = {"message": "تم تغيير كلمة المرور بنجاح"}
        if user.id == g.user_id:
            # كلمة المرور اتغيرت، فالتوكن القديم بطل: نرجّع توكن جديد للمستخدم نفسه
            result["token"] = issue_token(user)
        return jsonify(result)
    finally:
        db.close()

# --- Super Admin View & Subscription Management ---
@app.route("/api/admin/shops", methods=["GET", "POST"])
def admin_shops():
    if not is_super_admin():
        return forbidden()
    db = get_db()
    try:
        if request.method == "GET":
            shops = db.query(Shop).all()
            now = datetime.datetime.utcnow()
            utc_iso = lambda d: (d.isoformat() + "Z") if d else None  # كل الأوقات متخزنة UTC
            result = []
            for s in shops:
                invoices_count = db.query(Invoice).filter(Invoice.shop_id == s.id).count()
                users_count = db.query(User).filter(User.shop_id == s.id).count()
                owner_user = db.query(User).filter(User.shop_id == s.id, User.role == "shop_admin").first()

                # متابعة الاستخدام
                last_invoice_at = db.query(func.max(Invoice.created_at)).filter(Invoice.shop_id == s.id).scalar()
                inv_7d = db.query(Invoice).filter(
                    Invoice.shop_id == s.id, Invoice.created_at >= now - datetime.timedelta(days=7)
                ).count()
                inv_30d = db.query(Invoice).filter(
                    Invoice.shop_id == s.id, Invoice.created_at >= now - datetime.timedelta(days=30)
                ).count()
                last_login_at = db.query(func.max(User.last_login_at)).filter(User.shop_id == s.id).scalar()
                last_seen_at = db.query(func.max(User.last_seen_at)).filter(User.shop_id == s.id).scalar()
                last_activity = max([d for d in (last_seen_at, last_invoice_at) if d], default=None)
                result.append({
                    "id": s.id,
                    "name": s.name,
                    "owner_name": s.owner_name,
                    "phone": s.phone,
                    "address": s.address,
                    "commercial_record": s.commercial_record,
                    "tax_number": s.tax_number,
                    "subscription_plan": s.subscription_plan,
                    "is_active": s.is_active,
                    "total_invoices": invoices_count,
                    "total_staff": users_count,
                    "owner_username": owner_user.username if owner_user else "admin",
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "last_invoice_at": utc_iso(last_invoice_at),
                    "last_login_at": utc_iso(last_login_at),
                    "last_seen_at": utc_iso(last_seen_at),
                    "last_activity_at": utc_iso(last_activity),
                    "invoices_7d": inv_7d,
                    "invoices_30d": inv_30d,
                })
            return jsonify(result)

        # POST create shop
        data = request.get_json(force=True, silent=True) or {}
        admin_username = data.get("admin_username", "").strip()
        existing = db.query(User).filter(User.username == admin_username).first()
        if existing:
            return jsonify({"detail": "اسم المستخدم هذا مستخدم بالفعل، اختر اسماً آخر للمحل"}), 400

        new_shop = Shop(
            name=data.get("name", "محل جديد"),
            owner_name=data.get("owner_name", ""),
            phone=data.get("phone", ""),
            address=data.get("address", ""),
            subscription_plan=data.get("subscription_plan", "الباقة الماسية (سنوي)"),
            is_active=True
        )
        db.add(new_shop)
        db.commit()
        db.refresh(new_shop)

        # Create default prices
        new_prices = GoldPrice(
            shop_id=new_shop.id,
            sell_24k=4285.0,
            sell_21k=3750.0,
            sell_18k=3214.0,
            sell_14k=2500.0,
            sell_pound=30000.0,
            buy_24k=4260.0,
            buy_21k=3730.0,
            buy_18k=3195.0,
            buy_14k=2480.0,
            buy_pound=29840.0
        )
        db.add(new_prices)

        owner_user = User(
            shop_id=new_shop.id,
            name=f"{new_shop.owner_name} (صاحب المحل)",
            username=admin_username,
            # كلمة مرور ضعيفة/افتراضية تجبر صاحب المحل يغيّرها أول دخول
            password=hash_password(str(data.get("admin_password") or "123").strip()),
            role="shop_admin",
            pin_code="1111"
        )
        db.add(owner_user)
        db.commit()

        return jsonify({"message": "تم إضافة محل الصاغة وتفعيل حسابه بنجاح", "shop_id": new_shop.id})
    finally:
        db.close()

@app.route("/api/admin/shops/<int:shop_id>", methods=["PUT"])
def admin_update_shop(shop_id):
    if not is_super_admin():
        return forbidden()
    db = get_db()
    try:
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            return jsonify({"detail": "المحل غير موجود"}), 404

        data = request.get_json(force=True, silent=True) or {}
        shop.name = data.get("name", shop.name)
        shop.owner_name = data.get("owner_name", shop.owner_name)
        shop.phone = data.get("phone", shop.phone)
        shop.address = data.get("address", shop.address)
        shop.subscription_plan = data.get("subscription_plan", shop.subscription_plan)
        shop.is_active = data.get("is_active", shop.is_active)

        owner_new_password = data.get("owner_new_password")
        if owner_new_password:
            owner_user = db.query(User).filter(User.shop_id == shop.id, User.role == "shop_admin").first()
            if owner_user:
                owner_user.password = hash_password(str(owner_new_password).strip())
                owner_user.name = f"{shop.owner_name} (صاحب المحل)"

        db.commit()
        db.refresh(shop)
        return jsonify({
            "message": "تم تحديث بيانات واشتراك المحل بنجاح",
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "owner_name": shop.owner_name,
                "subscription_plan": shop.subscription_plan,
                "is_active": shop.is_active
            }
        })
    finally:
        db.close()

# --- Staff Management ---
@app.route("/api/users", methods=["GET", "POST"])
def shop_users():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        if request.method == "GET":
            users = db.query(User).filter(User.shop_id == shop_id).all()
            return jsonify([{
                "id": u.id,
                "name": u.name,
                "username": u.username,
                "role": u.role,
                "pin_code": u.pin_code,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None
            } for u in users])

        # POST create assistant user
        data = request.get_json(force=True, silent=True) or {}
        username = data.get("username", "").strip()
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            return jsonify({"detail": "اسم المستخدم موجود بالفعل، اختر اسماً آخر"}), 400

        new_user = User(
            shop_id=shop_id,
            name=data.get("name", "مساعد كاشير"),
            username=username,
            password=hash_password(str(data.get("password") or "123").strip()),
            role=data.get("role") if data.get("role") in ("cashier", "shop_admin") else "cashier",
            pin_code=data.get("pin_code", "2222")
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return jsonify({
            "message": "تم إضافة المساعد بنجاح",
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "username": new_user.username,
                "role": new_user.role,
                "pin_code": new_user.pin_code
            }
        })
    finally:
        db.close()

@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_shop_user(user_id):
    db = get_db()
    try:
        if not is_admin():
            return forbidden()
        u = db.query(User).filter(User.id == user_id).first()
        if not u or not owns(u.shop_id):
            return jsonify({"detail": "المستخدم غير موجود"}), 404
        if u.id == g.user_id:
            return jsonify({"detail": "لا يمكنك حذف حسابك أنت"}), 400
        if u.role == "super_admin":
            return jsonify({"detail": "لا يمكن حذف حساب السوبر أدمن"}), 403
        db.delete(u)
        db.commit()
        return jsonify({"message": "تم حذف الحساب بنجاح"})
    finally:
        db.close()

# --- Live Gold Prices ---
PRICE_FIELDS = (
    "sell_24k", "sell_21k", "sell_18k", "sell_14k", "sell_pound",
    "buy_24k", "buy_21k", "buy_18k", "buy_14k", "buy_pound",
)

@app.route("/api/prices", methods=["GET", "POST"])
def gold_prices():
    db = get_db()
    try:
        shop_id = current_shop_id()
        if request.method == "GET":
            price = get_latest_prices(db, shop_id)
            if not price:
                return jsonify({"detail": "الأسعار غير مسجلة بعد"}), 404
            return jsonify({
                "id": price.id,
                "shop_id": price.shop_id,
                "sell_24k": price.sell_24k,
                "sell_21k": price.sell_21k,
                "sell_18k": price.sell_18k,
                "sell_14k": price.sell_14k,
                "sell_pound": price.sell_pound,
                "buy_24k": price.buy_24k,
                "buy_21k": price.buy_21k,
                "buy_18k": price.buy_18k,
                "buy_14k": price.buy_14k,
                "buy_pound": price.buy_pound,
                "updated_at": price.updated_at.isoformat() if price.updated_at else None
            })

        # POST update prices
        data = request.get_json(force=True, silent=True) or {}
        price = (
            db.query(GoldPrice)
            .filter(GoldPrice.shop_id == shop_id)
            .order_by(GoldPrice.id.desc())
            .first()
        )
        if not price:
            base = get_latest_prices(db, shop_id)
            price = GoldPrice(shop_id=shop_id)
            for k in PRICE_FIELDS:
                setattr(price, k, getattr(base, k, 0.0) if base else 0.0)
            db.add(price)

        price.sell_24k = float(data.get("sell_24k", price.sell_24k))
        price.sell_21k = float(data.get("sell_21k", price.sell_21k))
        price.sell_18k = float(data.get("sell_18k", price.sell_18k))
        price.sell_14k = float(data.get("sell_14k", price.sell_14k))
        price.sell_pound = float(data.get("sell_pound", price.sell_pound))
        price.buy_24k = float(data.get("buy_24k", price.buy_24k))
        price.buy_21k = float(data.get("buy_21k", price.buy_21k))
        price.buy_18k = float(data.get("buy_18k", price.buy_18k))
        price.buy_14k = float(data.get("buy_14k", price.buy_14k))
        price.buy_pound = float(data.get("buy_pound", price.buy_pound))
        price.updated_at = datetime.datetime.utcnow()

        db.commit()
        db.refresh(price)
        return jsonify({
            "message": "تم تحديث أسعار الذهب بنجاح",
            "prices": {
                "sell_24k": price.sell_24k,
                "sell_21k": price.sell_21k,
                "sell_18k": price.sell_18k,
                "sell_14k": price.sell_14k,
                "sell_pound": price.sell_pound,
                "buy_24k": price.buy_24k,
                "buy_21k": price.buy_21k,
                "buy_18k": price.buy_18k,
                "buy_14k": price.buy_14k,
                "buy_pound": price.buy_pound
            }
        })
    finally:
        db.close()

# --- Invoices (POS & Sales / Scrap Buyback) ---
@app.route("/api/invoices", methods=["GET", "POST"])
def invoices_handler():
    db = get_db()
    try:
        if request.method == "GET":
            limit = request.args.get("limit", 500, type=int)
            inv_type = request.args.get("invoice_type")
            search = (request.args.get("q") or request.args.get("search") or "").strip()
            q = db.query(Invoice).filter(Invoice.shop_id == current_shop_id()).order_by(Invoice.id.desc())
            if inv_type and inv_type != "all":
                q = q.filter(Invoice.invoice_type == inv_type)
            if search:
                q = q.filter(
                    (Invoice.invoice_number.ilike(f"%{search}%")) |
                    (Invoice.customer_name.ilike(f"%{search}%")) |
                    (Invoice.customer_phone.ilike(f"%{search}%")) |
                    (Invoice.customer_national_id.ilike(f"%{search}%"))
                )
            invoices = q.limit(limit).all()

            result = []
            for inv in invoices:
                items_data = [{
                    "id": it.id,
                    "item_name": it.item_name,
                    "karat": it.karat,
                    "gross_weight": it.gross_weight,
                    "stones_weight": it.stones_weight,
                    "net_weight": it.net_weight,
                    "price_per_gram": it.price_per_gram,
                    "workmanship_per_gram": it.workmanship_per_gram,
                    "stamp_vat_per_gram": it.stamp_vat_per_gram,
                    "total_item_price": it.total_item_price,
                    "brand": it.brand,
                    "serial_number": it.serial_number
                } for it in inv.items]

                result.append({
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "invoice_type": inv.invoice_type,
                    "customer_name": inv.customer_name,
                    "customer_national_id": inv.customer_national_id,
                    "customer_phone": inv.customer_phone,
                    "total_gross_weight": inv.total_gross_weight,
                    "total_net_weight": inv.total_net_weight,
                    "equivalent_21k_weight": inv.equivalent_21k_weight,
                    "total_raw_gold_cost": inv.total_raw_gold_cost,
                    "total_workmanship": inv.total_workmanship,
                    "total_stamp_vat": inv.total_stamp_vat,
                    "discount": inv.discount,
                    "final_amount": inv.final_amount,
                    "paid_amount": inv.paid_amount or 0.0,
                    "remaining_amount": inv.remaining_amount or 0.0,
                    "customer_id": inv.customer_id,
                    "payment_method": inv.payment_method,
                    "notes": inv.notes,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                    "items": items_data
                })
            return jsonify(result)

        # POST Create Invoice
        data = request.get_json(force=True, silent=True) or {}
        items_in = data.get("items", [])
        if not items_in:
            return jsonify({"detail": "يجب إضافة صنف واحد على الأقل في الفاتورة"}), 400

        invoice_type = data.get("invoice_type", "sale")

        # تحقق صريح قبل الحفظ: ما نسجلش فاتورة بوزن أو سعر صفر/غلط بصمت
        try:
            for idx, item in enumerate(items_in, start=1):
                label = (item.get("item_name") or f"الصنف رقم {idx}").strip()
                for key in ("gross_weight", "stones_weight", "price_per_gram",
                            "workmanship_per_gram", "stamp_vat_per_gram"):
                    item[key] = _num(item.get(key))
                if item["gross_weight"] <= 0:
                    return jsonify({"detail": f"وزن «{label}» صفر أو مش مكتوب. اكتب الوزن وحاول تاني"}), 400
                if item["gross_weight"] - item["stones_weight"] <= 0:
                    return jsonify({"detail": f"وزن الفصوص في «{label}» أكبر من أو يساوي الوزن القائم"}), 400
                if item["price_per_gram"] <= 0:
                    return jsonify({"detail": f"سعر الجرام في «{label}» صفر. راجع الأسعار وحاول تاني"}), 400
            data["discount"] = _num(data.get("discount"))
            if data.get("paid_amount") is not None:
                data["paid_amount"] = _num(data.get("paid_amount"))
        except ValueError:
            return jsonify({"detail": "فيه رقم مكتوب غلط في الفاتورة (وزن أو سعر). راجع الأرقام"}), 400

        now = datetime.datetime.now()
        prefix = "INV-S" if invoice_type == "sale" else "INV-B"
        code = f"{prefix}-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        total_gross = 0.0
        total_net = 0.0
        total_eq_21 = 0.0
        total_raw = 0.0
        total_workmanship = 0.0
        total_vat = 0.0
        total_items_price = 0.0

        db_items = []
        for item in items_in:
            gross_wt = float(item.get("gross_weight", 0.0))
            stones_wt = float(item.get("stones_weight", 0.0))
            karat = int(item.get("karat", 21))
            price_gram = float(item.get("price_per_gram", 0.0))
            work_gram = float(item.get("workmanship_per_gram", 0.0))
            vat_gram = float(item.get("stamp_vat_per_gram", 0.0))

            net_wt = max(0.0, round(gross_wt - stones_wt, 3))
            raw_cost = round(net_wt * price_gram, 2)

            if invoice_type == "sale":
                work_cost = round(net_wt * work_gram, 2)
                vat_cost = round(net_wt * vat_gram, 2)
                item_total = round(raw_cost + work_cost + vat_cost, 2)
            else:
                work_cost = 0.0
                vat_cost = 0.0
                item_total = raw_cost

            eq_21 = convert_to_equivalent(net_wt, karat, 21)

            total_gross += gross_wt
            total_net += net_wt
            total_eq_21 += eq_21
            total_raw += raw_cost
            total_workmanship += work_cost
            total_vat += vat_cost
            total_items_price += item_total

            db_items.append(InvoiceItem(
                item_name=item.get("item_name", "قطعة ذهب"),
                karat=karat,
                gross_weight=gross_wt,
                stones_weight=stones_wt,
                net_weight=net_wt,
                price_per_gram=price_gram,
                workmanship_per_gram=work_gram,
                stamp_vat_per_gram=vat_gram,
                total_item_price=item_total,
                brand=item.get("brand"),
                serial_number=item.get("serial_number")
            ))

        discount = float(data.get("discount", 0.0))
        final_amount = max(0.0, total_items_price - discount)

        shop_id = current_shop_id()
        customer_name = data.get("customer_name", "عميل نقدي")
        customer_phone = data.get("customer_phone")
        customer_national_id = data.get("customer_national_id")
        customer = upsert_customer(
            db, shop_id, customer_name, customer_phone, customer_national_id,
            data.get("customer_address"),
        )

        raw_paid = data.get("paid_amount")
        paid_amount = final_amount if raw_paid is None else float(raw_paid)
        paid_amount = round(max(0.0, min(paid_amount, final_amount)), 2)
        remaining_amount = round(final_amount - paid_amount, 2)

        invoice = Invoice(
            shop_id=shop_id,
            customer_id=customer.id if customer else None,
            invoice_number=code,
            invoice_type=invoice_type,
            customer_name=customer_name,
            customer_national_id=customer_national_id,
            customer_phone=customer_phone,
            created_by_user_id=g.user_id,
            total_gross_weight=round(total_gross, 3),
            total_net_weight=round(total_net, 3),
            equivalent_21k_weight=round(total_eq_21, 3),
            total_raw_gold_cost=round(total_raw, 2),
            total_workmanship=round(total_workmanship, 2),
            total_stamp_vat=round(total_vat, 2),
            discount=round(discount, 2),
            final_amount=round(final_amount, 2),
            paid_amount=paid_amount,
            remaining_amount=remaining_amount,
            payment_method=data.get("payment_method", "cash"),
            notes=data.get("notes"),
            items=db_items
        )

        db.add(invoice)
        db.flush()
        apply_invoice_inventory_effects(db, shop_id, invoice, items_in)
        db.commit()
        db.refresh(invoice)

        items_data = [{
            "id": it.id,
            "item_name": it.item_name,
            "karat": it.karat,
            "gross_weight": it.gross_weight,
            "stones_weight": it.stones_weight,
            "net_weight": it.net_weight,
            "price_per_gram": it.price_per_gram,
            "workmanship_per_gram": it.workmanship_per_gram,
            "stamp_vat_per_gram": it.stamp_vat_per_gram,
            "total_item_price": it.total_item_price,
            "brand": it.brand,
            "serial_number": it.serial_number
        } for it in invoice.items]

        return jsonify({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "invoice_type": invoice.invoice_type,
            "customer_id": invoice.customer_id,
            "customer_name": invoice.customer_name,
            "customer_national_id": invoice.customer_national_id,
            "customer_phone": invoice.customer_phone,
            "total_gross_weight": invoice.total_gross_weight,
            "total_net_weight": invoice.total_net_weight,
            "equivalent_21k_weight": invoice.equivalent_21k_weight,
            "total_raw_gold_cost": invoice.total_raw_gold_cost,
            "total_workmanship": invoice.total_workmanship,
            "total_stamp_vat": invoice.total_stamp_vat,
            "discount": invoice.discount,
            "final_amount": invoice.final_amount,
            "paid_amount": invoice.paid_amount,
            "remaining_amount": invoice.remaining_amount,
            "payment_method": invoice.payment_method,
            "notes": invoice.notes,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            "items": items_data
        })
    finally:
        db.close()

PARTIAL_SALE_NOTE_RE = re.compile(r"مباع من رصيد #(\d+)")

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫،,", "01234567890123456789...")

def _num(value):
    """يحوّل رقم (حتى لو مكتوب بأرقام عربية أو فاصلة) لـ float. الفاضي = 0. الغلط = ValueError"""
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        result = float(value)
    else:
        result = float(str(value).strip().translate(_AR_DIGITS))
    if result != result or result in (float("inf"), float("-inf")):  # NaN / Infinity
        raise ValueError("not a finite number")
    return result

@app.route("/api/invoices/<int:invoice_id>", methods=["DELETE"])
def delete_invoice(invoice_id):
    if not is_admin():
        return forbidden("حذف الفواتير لصاحب المحل فقط")
    db = get_db()
    try:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv or not owns(inv.shop_id):
            return jsonify({"detail": "الفاتورة غير موجودة"}), 404

        # حذف قطع الكسر التي دخلت المخزن من هذه الفاتورة
        db.query(InventoryItem).filter(
            InventoryItem.source_invoice_id == invoice_id,
            InventoryItem.status == "in_stock"
        ).delete(synchronize_session=False)

        # استرجاع القطع المباعة في الفاتورة أو حذف سجلات البيع
        sold_logs = db.query(InventoryItem).filter(InventoryItem.sold_invoice_id == invoice_id).all()
        for s in sold_logs:
            if s.source == "sale":
                # جزء مخصوم من قطعة: نرجّع وزنه للقطعة الأصلية بدل ما يضيع من المخزن
                m = PARTIAL_SALE_NOTE_RE.search(s.notes or "")
                origin = None
                if m:
                    origin = db.query(InventoryItem).filter(
                        InventoryItem.id == int(m.group(1)),
                        InventoryItem.shop_id == s.shop_id,
                    ).first()
                if origin and origin.status == "in_stock":
                    origin.net_weight = round(float(origin.net_weight or 0.0) + float(s.net_weight or 0.0), 3)
                    origin.gross_weight = round(float(origin.gross_weight or 0.0) + float(s.gross_weight or 0.0), 3)
                    db.delete(s)
                else:
                    # القطعة الأصلية اتباعت أو اتحذفت: نرجّع الجزء كقطعة مستقلة في المخزن
                    s.status = "in_stock"
                    s.source = "returned"
                    s.name = (s.name or "").replace(" (مباع)", "")
                    s.sold_invoice_id = None
                    s.sold_at = None
                    s.sold_price = None
                    s.notes = f"{s.notes or ''} | مرتجع بعد حذف الفاتورة #{inv.invoice_number}".strip(" |")
            elif s.source == "direct_sale":
                db.delete(s)
            else:
                s.status = "in_stock"
                s.sold_invoice_id = None
                s.sold_at = None
                s.sold_price = None

        db.delete(inv)
        db.commit()
        return jsonify({"success": True, "message": "تم حذف الفاتورة بنجاح"})
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500
    finally:
        db.close()

# --- Inventory Periodic Audit Report ---
@app.route("/api/reports/audit", methods=["GET"])
def periodic_audit_report():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        period = request.args.get("period", "day")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        now = datetime.datetime.now()

        if period == "day":
            start = datetime.datetime(now.year, now.month, now.day, 0, 0, 0)
            end = datetime.datetime(now.year, now.month, now.day, 23, 59, 59)
            title = f"تقرير الجرد اليومي ({now.strftime('%Y-%m-%d')})"
        elif period == "week":
            start = now - datetime.timedelta(days=7)
            end = now
            title = f"تقرير الجرد الأسبوعي (آخر 7 أيام: من {start.strftime('%d-%m')} إلى {end.strftime('%d-%m')})"
        elif period == "month":
            start = datetime.datetime(now.year, now.month, 1, 0, 0, 0)
            end = now
            title = f"تقرير الجرد الشهري (شهر {now.strftime('%m-%Y')})"
        elif period == "custom" and start_date and end_date:
            start = datetime.datetime.fromisoformat(start_date)
            end = datetime.datetime.fromisoformat(end_date)
            title = f"تقرير الجرد للفترة من {start.strftime('%Y-%m-%d')} إلى {end.strftime('%Y-%m-%d')}"
        else:
            start = now - datetime.timedelta(days=30)
            end = now
            title = "تقرير الجرد الدوري"

        invoices = db.query(Invoice).filter(
            Invoice.shop_id == current_shop_id(),
            Invoice.created_at >= start, Invoice.created_at <= end,
        ).all()

        sales_count = 0
        buybacks_count = 0
        total_sales_egp = 0.0
        total_buybacks_egp = 0.0
        total_workmanship_egp = 0.0
        total_vat_egp = 0.0

        karat_breakdown = {
            24: {"sold_net_grams": 0.0, "bought_net_grams": 0.0},
            21: {"sold_net_grams": 0.0, "bought_net_grams": 0.0},
            18: {"sold_net_grams": 0.0, "bought_net_grams": 0.0},
            14: {"sold_net_grams": 0.0, "bought_net_grams": 0.0},
        }

        sold_gold_eq21 = 0.0
        bought_gold_eq21 = 0.0

        for inv in invoices:
            if inv.invoice_type == "sale":
                sales_count += 1
                total_sales_egp += inv.final_amount
                total_workmanship_egp += inv.total_workmanship
                total_vat_egp += inv.total_stamp_vat
                sold_gold_eq21 += inv.equivalent_21k_weight
                for item in inv.items:
                    k = item.karat if item.karat in karat_breakdown else 21
                    karat_breakdown[k]["sold_net_grams"] += item.net_weight
            else:
                buybacks_count += 1
                total_buybacks_egp += inv.final_amount
                bought_gold_eq21 += inv.equivalent_21k_weight
                for item in inv.items:
                    k = item.karat if item.karat in karat_breakdown else 21
                    karat_breakdown[k]["bought_net_grams"] += item.net_weight

        net_cash_flow = total_sales_egp - total_buybacks_egp
        net_gold_weight_change = bought_gold_eq21 - sold_gold_eq21

        for k in karat_breakdown:
            karat_breakdown[k]["sold_net_grams"] = round(karat_breakdown[k]["sold_net_grams"], 3)
            karat_breakdown[k]["bought_net_grams"] = round(karat_breakdown[k]["bought_net_grams"], 3)

        return jsonify({
            "title": title,
            "period": period,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "total_invoices": len(invoices),
            "sales_count": sales_count,
            "buybacks_count": buybacks_count,
            "financials": {
                "total_sales_egp": round(total_sales_egp, 2),
                "total_buybacks_egp": round(total_buybacks_egp, 2),
                "total_workmanship_collected_egp": round(total_workmanship_egp, 2),
                "total_vat_collected_egp": round(total_vat_egp, 2),
                "net_cash_flow_egp": round(net_cash_flow, 2),
            },
            "gold_ledger": {
                "sold_eq21_grams": round(sold_gold_eq21, 3),
                "bought_eq21_grams": round(bought_gold_eq21, 3),
                "net_weight_change_eq21_grams": round(net_gold_weight_change, 3),
                "karat_breakdown": karat_breakdown,
            }
        })
    finally:
        db.close()

# --- Jewelry Types (تصنيفات المخزن) ---
def _resolve_type(db, shop_id, type_id, type_name):
    if type_id:
        found = db.query(JewelryType).filter(
            JewelryType.id == int(type_id), JewelryType.shop_id == shop_id
        ).first()
        if found:
            return found.id, found.name
    if type_name:
        found = (
            db.query(JewelryType)
            .filter(JewelryType.shop_id == shop_id, JewelryType.name == type_name)
            .first()
        )
        if not found:
            found = JewelryType(shop_id=shop_id, name=type_name)
            db.add(found)
            db.flush()
        return found.id, found.name
    return None, None

@app.route("/api/jewelry-types", methods=["GET", "POST"])
def jewelry_types():
    if request.method == "POST" and not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        ensure_default_types(db, shop_id)
        db.commit()

        if request.method == "GET":
            types = (
                db.query(JewelryType)
                .filter(JewelryType.shop_id == shop_id)
                .order_by(JewelryType.id.asc())
                .all()
            )
            counts = {}
            for item in db.query(InventoryItem).filter(
                InventoryItem.shop_id == shop_id, InventoryItem.status == "in_stock"
            ).all():
                if item.type_id:
                    counts[item.type_id] = counts.get(item.type_id, 0) + 1
            return jsonify([
                {"id": t.id, "name": t.name, "items_count": counts.get(t.id, 0)}
                for t in types
            ])

        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"detail": "اكتب اسم النوع"}), 400
        existing = (
            db.query(JewelryType)
            .filter(JewelryType.shop_id == shop_id, JewelryType.name == name)
            .first()
        )
        if existing:
            return jsonify({"detail": "هذا النوع موجود بالفعل"}), 400
        new_type = JewelryType(shop_id=shop_id, name=name)
        db.add(new_type)
        db.commit()
        db.refresh(new_type)
        return jsonify({"message": "تم إضافة النوع بنجاح", "type": {"id": new_type.id, "name": new_type.name}})
    finally:
        db.close()

@app.route("/api/jewelry-types/<int:type_id>", methods=["DELETE"])
def delete_jewelry_type(type_id):
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        found = db.query(JewelryType).filter(JewelryType.id == type_id).first()
        if not found or not owns(found.shop_id):
            return jsonify({"detail": "النوع غير موجود"}), 404
        name = found.name
        db.query(InventoryItem).filter(InventoryItem.type_id == type_id).update(
            {InventoryItem.type_id: None}, synchronize_session=False
        )
        db.delete(found)
        db.commit()
        return jsonify({"message": f"تم حذف النوع {name}"})
    finally:
        db.close()

# --- Inventory (المخزن: جديد / كسر / مباع) ---
def _build_inventory_item(db, shop_id, raw):
    gross = float(raw.get("gross_weight", 0) or 0)
    stones = float(raw.get("stones_weight", 0) or 0)
    net = round(max(0.0, gross - stones), 3)
    price_g = float(raw.get("purchase_price_per_gram", 0) or 0)
    raw_total = raw.get("purchase_total")
    purchase_total = float(raw_total) if raw_total not in (None, "") else round(net * price_g, 2)

    type_id, type_name = _resolve_type(
        db, shop_id, raw.get("type_id"), (raw.get("type_name") or "").strip() or None
    )
    section = raw.get("section", "new")
    if section not in ("new", "scrap"):
        section = "new"

    return InventoryItem(
        shop_id=shop_id,
        type_id=type_id,
        type_name=type_name,
        section=section,
        status="in_stock",
        name=(raw.get("name") or type_name or "قطعة مجوهرات").strip(),
        karat=int(raw.get("karat", 21) or 21),
        gross_weight=gross,
        stones_weight=stones,
        net_weight=net,
        purchase_price_per_gram=price_g,
        purchase_total=purchase_total,
        workmanship_per_gram=float(raw.get("workmanship_per_gram", 0) or 0),
        brand=raw.get("brand"),
        serial_number=raw.get("serial_number"),
        notes=raw.get("notes"),
        source=raw.get("source", "purchase"),
        paid_from_cash=bool(raw.get("paid_from_cash", False)),
    )

@app.route("/api/inventory", methods=["GET", "POST"])
def inventory_handler():
    db = get_db()
    try:
        if request.method == "GET":
            shop_id = current_shop_id()
            status = request.args.get("status", "in_stock")
            section = request.args.get("section")
            type_id = request.args.get("type_id", type=int)
            search = (request.args.get("q") or "").strip()
            limit = request.args.get("limit", 500, type=int)

            query = db.query(InventoryItem).filter(InventoryItem.shop_id == shop_id)
            if status and status != "all":
                query = query.filter(InventoryItem.status == status)
            if section and section != "all":
                query = query.filter(InventoryItem.section == section)
            if type_id:
                query = query.filter(InventoryItem.type_id == type_id)
            if search:
                like = f"%{search}%"
                query = query.filter(
                    (InventoryItem.name.like(like))
                    | (InventoryItem.brand.like(like))
                    | (InventoryItem.serial_number.like(like))
                    | (InventoryItem.type_name.like(like))
                )
            items = query.order_by(InventoryItem.id.desc()).limit(limit).all()
            return jsonify([inventory_item_to_dict(i) for i in items])

        if not is_admin():
            return forbidden()
        data = request.get_json(force=True, silent=True) or {}
        shop_id = current_shop_id()
        raw_items = data.get("items") if isinstance(data.get("items"), list) else [data]
        created = []
        for raw in raw_items:
            item = _build_inventory_item(db, shop_id, raw)
            db.add(item)
            created.append(item)
        db.commit()
        for item in created:
            db.refresh(item)
        return jsonify({
            "message": f"تمت إضافة {len(created)} قطعة للمخزن",
            "items": [inventory_item_to_dict(i) for i in created],
        })
    finally:
        db.close()

@app.route("/api/inventory/<int:item_id>", methods=["PUT", "DELETE"])
def inventory_item_handler(item_id):
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if not item or not owns(item.shop_id):
            return jsonify({"detail": "القطعة غير موجودة"}), 404

        if request.method == "DELETE":
            if item.status == "sold":
                return jsonify({"detail": "لا يمكن حذف قطعة تم بيعها"}), 400
            db.delete(item)
            db.commit()
            return jsonify({"message": "تم حذف القطعة من المخزن"})

        data = request.get_json(force=True, silent=True) or {}
        if item.status == "sold":
            return jsonify({"detail": "لا يمكن تعديل قطعة تم بيعها"}), 400

        if "name" in data:
            item.name = data["name"]
        if "karat" in data:
            item.karat = int(data["karat"])
        if "gross_weight" in data:
            item.gross_weight = float(data["gross_weight"] or 0)
        if "stones_weight" in data:
            item.stones_weight = float(data["stones_weight"] or 0)
        if "section" in data and data["section"] in ("new", "scrap"):
            item.section = data["section"]
        if "purchase_price_per_gram" in data:
            item.purchase_price_per_gram = float(data["purchase_price_per_gram"] or 0)
        if "workmanship_per_gram" in data:
            item.workmanship_per_gram = float(data["workmanship_per_gram"] or 0)
        if "brand" in data:
            item.brand = data["brand"]
        if "serial_number" in data:
            item.serial_number = data["serial_number"]
        if "notes" in data:
            item.notes = data["notes"]
        if "type_id" in data or "type_name" in data:
            type_id, type_name = _resolve_type(db, item.shop_id, data.get("type_id"), data.get("type_name"))
            item.type_id, item.type_name = type_id, type_name

        item.net_weight = round(max(0.0, item.gross_weight - item.stones_weight), 3)
        if "purchase_total" in data and data["purchase_total"] not in (None, ""):
            item.purchase_total = float(data["purchase_total"])
        else:
            item.purchase_total = round(item.net_weight * item.purchase_price_per_gram, 2)

        db.commit()
        db.refresh(item)
        return jsonify({"message": "تم تحديث القطعة", "item": inventory_item_to_dict(item)})
    finally:
        db.close()

@app.route("/api/inventory/summary", methods=["GET"])
def inventory_summary():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        result = {}
        for section in ("new", "scrap"):
            items = db.query(InventoryItem).filter(
                InventoryItem.shop_id == shop_id,
                InventoryItem.section == section,
                InventoryItem.status == "in_stock",
            ).all()
            result[section] = {
                "count": len(items),
                "net_weight": round(sum(i.net_weight or 0 for i in items), 3),
                "karat_weights": {
                    str(k): round(sum(i.net_weight or 0 for i in items if i.karat == k), 3)
                    for k in (24, 21, 18, 14)
                },
            }
        sold = db.query(InventoryItem).filter(
            InventoryItem.shop_id == shop_id, InventoryItem.status == "sold"
        ).all()
        result["sold"] = {
            "count": len(sold),
            "net_weight": round(sum(i.net_weight or 0 for i in sold), 3),
            "sold_value": round(sum(i.sold_price or 0 for i in sold), 2),
        }
        return jsonify(result)
    finally:
        db.close()

@app.route("/api/inventory/reset", methods=["POST"])
def reset_inventory():
    """تصفير رصيد المخزن والنقدية بالكامل (تصفير شامل)"""
    if not is_admin():
        return forbidden("تصفير المخزن لصاحب المحل فقط")
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        shop_id = current_shop_id()
        scope = data.get("scope", "all")  # "in_stock" أو "all"

        # 1. تصفير قطع المخزن
        query = db.query(InventoryItem).filter(InventoryItem.shop_id == shop_id)
        if scope == "in_stock":
            deleted_count = query.filter(InventoryItem.status == "in_stock").delete(synchronize_session=False)
        else:
            deleted_count = query.delete(synchronize_session=False)

        # 2. تصفير الحركات النقدية اليدوية
        db.query(CashTransaction).filter(CashTransaction.shop_id == shop_id).delete(synchronize_session=False)

        # 3. في حالة التصفير الشامل: مسح فواتير المحل أيضاً
        invoices_deleted = 0
        if scope == "all":
            inv_ids = [inv.id for inv in db.query(Invoice.id).filter(Invoice.shop_id == shop_id).all()]
            if inv_ids:
                db.query(InvoiceItem).filter(InvoiceItem.invoice_id.in_(inv_ids)).delete(synchronize_session=False)
            invoices_deleted = db.query(Invoice).filter(Invoice.shop_id == shop_id).delete(synchronize_session=False)

        # 4. تصفير النقدية والخزينة = 0.00 ج.م تماماً
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if shop:
            if scope == "all":
                shop.opening_cash = 0.0
            else:
                sales_paid = _sum(db, Invoice.paid_amount, Invoice.shop_id == shop_id, Invoice.invoice_type == "sale")
                buybacks_paid = _sum(db, Invoice.paid_amount, Invoice.shop_id == shop_id, Invoice.invoice_type == "buyback")
                purchases_paid = cash_purchases_paid(db, shop_id)
                shop.opening_cash = round(-(sales_paid - buybacks_paid - purchases_paid), 2)

        db.commit()
        return jsonify({
            "success": True,
            "deleted_count": deleted_count,
            "invoices_deleted": invoices_deleted,
            "cash_balance": 0.0,
            "message": f"تم تصفير المخزن والنقدية بنجاح! تم تصفير القطع ({deleted_count}) وتصفير رصيد الخزينة بالكامل ليصبح 0.00 ج.م"
        })
    except Exception as e:
        db.rollback()
        return jsonify({"detail": f"فشل تصفير المخزن والنقدية: {str(e)}"}), 500
    finally:
        db.close()

# --- Capital (رأس المال) & Cash ---
@app.route("/api/capital", methods=["GET"])
def capital():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        return jsonify(capital_summary(db, shop_id))
    finally:
        db.close()

@app.route("/api/shop/opening-cash", methods=["PUT"])
def update_opening_cash():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        shop_id = current_shop_id()
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            return jsonify({"detail": "المحل غير موجود"}), 404
        shop.opening_cash = float(data.get("opening_cash", shop.opening_cash or 0) or 0)
        db.commit()
        return jsonify({"message": "تم تحديث النقدية الافتتاحية", "opening_cash": shop.opening_cash,
                        "cash_balance": cash_balance(db, shop_id)})
    finally:
        db.close()

@app.route("/api/cash/transactions", methods=["GET", "POST"])
def cash_transactions():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        if request.method == "GET":
            rows = (
                db.query(CashTransaction)
                .filter(CashTransaction.shop_id == shop_id)
                .order_by(CashTransaction.id.desc())
                .limit(200)
                .all()
            )
            return jsonify([{
                "id": t.id,
                "direction": t.direction,
                "amount": t.amount,
                "category": t.category,
                "note": t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            } for t in rows])

        data = request.get_json(force=True, silent=True) or {}
        amount = float(data.get("amount", 0) or 0)
        if amount <= 0:
            return jsonify({"detail": "المبلغ يجب أن يكون أكبر من صفر"}), 400
        direction = data.get("direction", "in")
        if direction not in ("in", "out"):
            direction = "in"
        tx = CashTransaction(
            shop_id=shop_id,
            direction=direction,
            amount=amount,
            category=data.get("category", "adjustment"),
            note=data.get("note"),
            created_by_user_id=g.user_id,
        )
        db.add(tx)
        db.commit()
        return jsonify({"message": "تم تسجيل الحركة النقدية",
                        "cash_balance": cash_balance(db, shop_id)})
    finally:
        db.close()

# --- Live Gold Prices (غرفة الذهب) ---
@app.route("/api/prices/live", methods=["GET"])
def live_gold_prices():
    try:
        return jsonify(fetch_live_prices())
    except Exception as exc:
        return jsonify({"detail": f"تعذر جلب الأسعار اللحظية: {exc}"}), 502

# --- Customers (سجل العملاء) ---
@app.route("/api/customers", methods=["GET", "POST"])
def customers_handler():
    db = get_db()
    try:
        shop_id = current_shop_id()
        if request.method == "GET":
            search = (request.args.get("q") or "").strip()
            query = db.query(Customer).filter(Customer.shop_id == shop_id)
            if search:
                like = f"%{search}%"
                query = query.filter(
                    (Customer.name.like(like))
                    | (Customer.phone.like(like))
                    | (Customer.national_id.like(like))
                )
            rows = query.order_by(Customer.id.desc()).limit(300).all()
            return jsonify([customer_with_stats(db, c) for c in rows])

        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"detail": "اسم العميل مطلوب"}), 400
        customer = upsert_customer(
            db, shop_id, name, data.get("phone"), data.get("national_id"), data.get("address")
        )
        db.commit()
        db.refresh(customer)
        return jsonify({"message": "تم حفظ العميل", "customer": customer_with_stats(db, customer)})
    finally:
        db.close()

# --- Collect remaining payment on an invoice ---
@app.route("/api/invoices/<int:invoice_id>/pay", methods=["POST"])
def pay_invoice(invoice_id):
    db = get_db()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice or not owns(invoice.shop_id):
            return jsonify({"detail": "الفاتورة غير موجودة"}), 404
        data = request.get_json(force=True, silent=True) or {}
        amount = float(data.get("amount", 0) or 0)
        if amount <= 0:
            return jsonify({"detail": "أدخل مبلغاً صحيحاً"}), 400

        remaining = float(invoice.remaining_amount or 0.0)
        applied = min(amount, remaining) if remaining > 0 else 0.0
        invoice.paid_amount = round(float(invoice.paid_amount or 0.0) + applied, 2)
        invoice.remaining_amount = round(max(0.0, remaining - applied), 2)
        db.commit()
        return jsonify({
            "message": "تم تسجيل الدفعة",
            "id": invoice.id,
            "paid_amount": invoice.paid_amount,
            "remaining_amount": invoice.remaining_amount,
        })
    finally:
        db.close()

# --- Gemini AI Vision ---
@app.route("/api/vision/analyze", methods=["POST"])
def vision_analyze():
    import asyncio
    if "file" not in request.files:
        return jsonify({"detail": "لم يتم إرسال ملف الصورة"}), 400

    file = request.files["file"]
    api_key = request.form.get("api_key")
    contents = file.read()
    mime = file.content_type or "image/jpeg"

    # Run async gemini call synchronously
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(analyze_image_with_gemini(contents, mime_type=mime, api_key=api_key))
    finally:
        loop.close()

    return jsonify(result)

# --- Trusts Warehouse (مخزن الأمانات والودائع: ذهب ونقدية) ---
def trust_item_to_dict(t):
    return {
        "id": t.id,
        "shop_id": t.shop_id,
        "trust_type": t.trust_type,
        "customer_name": t.customer_name,
        "customer_phone": t.customer_phone or "",
        "customer_national_id": t.customer_national_id or "",
        "item_description": t.item_description or "",
        "karat": t.karat or 21,
        "gross_weight": round(float(t.gross_weight or 0.0), 3),
        "net_weight": round(float(t.net_weight or 0.0), 3),
        "cash_amount": round(float(t.cash_amount or 0.0), 2),
        "status": t.status or "held",
        "expected_return_date": t.expected_return_date or "",
        "notes": t.notes or "",
        "settled_notes": t.settled_notes or "",
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "settled_at": t.settled_at.isoformat() if t.settled_at else None,
    }

@app.route("/api/trusts", methods=["GET"])
def get_trusts():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()
        trust_type = request.args.get("trust_type")  # 'gold' | 'cash' | None
        status = request.args.get("status")  # 'held' | 'all' | None

        q = db.query(TrustItem).filter(TrustItem.shop_id == shop_id)
        if trust_type:
            q = q.filter(TrustItem.trust_type == trust_type)
        if status and status != "all":
            q = q.filter(TrustItem.status == status)
        items = q.order_by(TrustItem.id.desc()).all()
        return jsonify([trust_item_to_dict(i) for i in items])
    finally:
        db.close()

@app.route("/api/trusts", methods=["POST"])
def create_trust():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        shop_id = current_shop_id()

        customer_name = (data.get("customer_name") or "").strip()
        if not customer_name:
            return jsonify({"detail": "اسم صاحب الأمانة مطلوب"}), 400

        trust_type = data.get("trust_type") or "gold"
        item = TrustItem(
            shop_id=shop_id,
            trust_type=trust_type,
            customer_name=customer_name,
            customer_phone=(data.get("customer_phone") or "").strip() or None,
            customer_national_id=(data.get("customer_national_id") or "").strip() or None,
            item_description=(data.get("item_description") or "").strip() or None,
            karat=int(data.get("karat", 21) or 21),
            gross_weight=float(data.get("gross_weight", 0.0) or 0.0),
            net_weight=float(data.get("net_weight", 0.0) or 0.0),
            cash_amount=float(data.get("cash_amount", 0.0) or 0.0),
            status="held",
            expected_return_date=(data.get("expected_return_date") or "").strip() or None,
            notes=(data.get("notes") or "").strip() or None,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return jsonify(trust_item_to_dict(item)), 201
    finally:
        db.close()

@app.route("/api/trusts/<int:item_id>/status", methods=["PUT"])
def update_trust_status(item_id):
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        item = db.query(TrustItem).filter(TrustItem.id == item_id).first()
        if not item or not owns(item.shop_id):
            return jsonify({"detail": "عنصر الأمانة غير موجود"}), 404

        data = request.get_json(force=True, silent=True) or {}
        new_status = data.get("status")
        if new_status:
            item.status = new_status
            if new_status in ("returned", "settled"):
                item.settled_at = datetime.datetime.utcnow()
        if "settled_notes" in data:
            item.settled_notes = data.get("settled_notes")
        if "notes" in data:
            item.notes = data.get("notes")

        db.commit()
        db.refresh(item)
        return jsonify(trust_item_to_dict(item))
    finally:
        db.close()

@app.route("/api/trusts/<int:item_id>", methods=["DELETE"])
def delete_trust(item_id):
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        item = db.query(TrustItem).filter(TrustItem.id == item_id).first()
        if not item or not owns(item.shop_id):
            return jsonify({"detail": "عنصر الأمانة غير موجود"}), 404
        db.delete(item)
        db.commit()
        return jsonify({"message": "تم حذف سجل الأمانة بنجاح"})
    finally:
        db.close()

@app.route("/api/trusts/summary", methods=["GET"])
def get_trusts_summary():
    if not is_admin():
        return forbidden()
    db = get_db()
    try:
        shop_id = current_shop_id()

        active_gold = db.query(TrustItem).filter(
            TrustItem.shop_id == shop_id,
            TrustItem.trust_type == "gold",
            TrustItem.status == "held",
        ).all()

        total_gold_weight = round(sum(float(i.net_weight or 0.0) for i in active_gold), 3)
        gold_by_karat = {}
        for i in active_gold:
            k = str(i.karat or 21)
            gold_by_karat[k] = round(gold_by_karat.get(k, 0.0) + float(i.net_weight or 0.0), 3)

        active_cash = db.query(TrustItem).filter(
            TrustItem.shop_id == shop_id,
            TrustItem.trust_type == "cash",
            TrustItem.status == "held",
        ).all()
        total_cash_amount = round(sum(float(i.cash_amount or 0.0) for i in active_cash), 2)

        return jsonify({
            "active_gold_count": len(active_gold),
            "total_gold_weight": total_gold_weight,
            "gold_by_karat": gold_by_karat,
            "active_cash_count": len(active_cash),
            "total_cash_amount": total_cash_amount,
        })
    finally:
        db.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
