"""
Flask Native Backend for Gold SaaS on PythonAnywhere / WSGI
Matches FastAPI API routes and JSON contracts 1:1.
"""
import os
import uuid
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from database import engine, SessionLocal, init_db, Shop, User, GoldPrice, Invoice, InvoiceItem, Customer
from services.gold_math import convert_to_equivalent
from services.gemini_vision import analyze_image_with_gemini

# Initialize SQLite database
init_db()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

def get_db():
    return SessionLocal()

# --- Health check ---
@app.route("/", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "Gold Jewelry SaaS API (Flask)"})

# --- Unified Login ---
@app.route("/api/auth/login", methods=["POST"])
def login():
    db = get_db()
    try:
        # Fallback hardcoded demo accounts to guarantee 100% login uptime even before DB sync
        data = request.get_json(force=True, silent=True) or {}
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()

        # Check DB first
        user = db.query(User).filter(User.username == username).first()
        if user and user.password == password and user.is_active:
            shop = db.query(Shop).filter(Shop.id == user.shop_id).first() if user.shop_id else None
            return jsonify({
                "success": True,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "username": user.username,
                    "role": user.role,
                    "shop_id": user.shop_id,
                    "shop_name": shop.name if shop else None,
                    "is_active": user.is_active
                }
            })

        # Built-in instant demo fallback credentials
        demo_accounts = {
            "superadmin": {
                "password": "123",
                "id": 1,
                "name": "أ/ وليد المقدم (سوبر أدمن المنصة)",
                "role": "super_admin",
                "shop_id": None,
                "shop_name": "منصة الصاغة السحابية",
            },
            "admin": {
                "password": "123",
                "id": 2,
                "name": "أ/ وليد المقدم (صاحب المحل)",
                "role": "shop_admin",
                "shop_id": 1,
                "shop_name": "مجوهرات الأمانة الذهبية",
            },
            "cashier": {
                "password": "123",
                "id": 3,
                "name": "محمود المصري (مساعد كاشير)",
                "role": "cashier",
                "shop_id": 1,
                "shop_name": "مجوهرات الأمانة الذهبية",
            }
        }

        if username in demo_accounts and demo_accounts[username]["password"] == password:
            acc = demo_accounts[username]
            # Ensure DB is seeded with this user
            if not user:
                new_u = User(
                    name=acc["name"],
                    username=username,
                    password=password,
                    role=acc["role"],
                    shop_id=acc["shop_id"],
                    is_active=True
                )
                db.add(new_u)
                db.commit()
            return jsonify({
                "success": True,
                "user": {
                    "id": acc["id"],
                    "name": acc["name"],
                    "username": username,
                    "role": acc["role"],
                    "shop_id": acc["shop_id"],
                    "shop_name": acc["shop_name"],
                    "is_active": True
                }
            })

        return jsonify({"success": False, "detail": "اسم المستخدم أو كلمة المرور غير صحيحة"}), 401

        return jsonify({
            "success": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "username": user.username,
                "role": user.role,
                "shop_id": user.shop_id,
                "shop_name": shop.name if shop else "منصة الصاغة السحابية (النظام الرئيسي)"
            }
        })
    finally:
        db.close()

# --- Shop Settings (Jeweler Profile) ---
@app.route("/api/shop", methods=["GET", "PUT"])
def shop_settings():
    db = get_db()
    try:
        shop_id = request.args.get("shop_id", 1, type=int)
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
                "created_at": shop.created_at.isoformat() if shop.created_at else None
            })

        # PUT update
        data = request.get_json(force=True, silent=True) or {}
        shop.name = data.get("name", shop.name)
        shop.owner_name = data.get("owner_name", shop.owner_name)
        shop.phone = data.get("phone", shop.phone)
        shop.address = data.get("address", shop.address)
        shop.commercial_record = data.get("commercial_record", shop.commercial_record)
        shop.tax_number = data.get("tax_number", shop.tax_number)

        # Update owner user name as well
        owner_user = db.query(User).filter(User.shop_id == shop.id, User.role == "shop_admin").first()
        if owner_user:
            owner_user.name = f"{shop.owner_name} (صاحب المحل)"

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
        user_id = data.get("user_id")
        new_password = data.get("new_password")
        if not user_id or not new_password:
            return jsonify({"detail": "بيانات غير مكتملة"}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({"detail": "المستخدم غير موجود"}), 404

        user.password = new_password
        db.commit()
        return jsonify({"message": "تم تغيير كلمة المرور بنجاح"})
    finally:
        db.close()

# --- Super Admin View & Subscription Management ---
@app.route("/api/admin/shops", methods=["GET", "POST"])
def admin_shops():
    db = get_db()
    try:
        if request.method == "GET":
            shops = db.query(Shop).all()
            result = []
            for s in shops:
                invoices_count = db.query(Invoice).filter(Invoice.shop_id == s.id).count()
                users_count = db.query(User).filter(User.shop_id == s.id).count()
                owner_user = db.query(User).filter(User.shop_id == s.id, User.role == "shop_admin").first()
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
                    "created_at": s.created_at.isoformat() if s.created_at else None
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
            password=data.get("admin_password", "123"),
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
                owner_user.password = owner_new_password
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
    db = get_db()
    try:
        shop_id = request.args.get("shop_id", 1, type=int)
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
            password=data.get("password", "123"),
            role=data.get("role", "cashier"),
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
        u = db.query(User).filter(User.id == user_id).first()
        if not u:
            return jsonify({"detail": "المستخدم غير موجود"}), 404
        if u.role == "super_admin":
            return jsonify({"detail": "لا يمكن حذف حساب السوبر أدمن"}), 403
        db.delete(u)
        db.commit()
        return jsonify({"message": "تم حذف الحساب بنجاح"})
    finally:
        db.close()

# --- Live Gold Prices ---
@app.route("/api/prices", methods=["GET", "POST"])
def gold_prices():
    db = get_db()
    try:
        if request.method == "GET":
            price = db.query(GoldPrice).order_by(GoldPrice.id.desc()).first()
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
        price = db.query(GoldPrice).first()
        if not price:
            price = GoldPrice()
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
            limit = request.args.get("limit", 50, type=int)
            inv_type = request.args.get("invoice_type")
            q = db.query(Invoice).order_by(Invoice.id.desc())
            if inv_type:
                q = q.filter(Invoice.invoice_type == inv_type)
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

        invoice = Invoice(
            invoice_number=code,
            invoice_type=invoice_type,
            customer_name=data.get("customer_name", "عميل نقدي"),
            customer_national_id=data.get("customer_national_id"),
            customer_phone=data.get("customer_phone"),
            created_by_user_id=data.get("created_by_user_id"),
            total_gross_weight=round(total_gross, 3),
            total_net_weight=round(total_net, 3),
            equivalent_21k_weight=round(total_eq_21, 3),
            total_raw_gold_cost=round(total_raw, 2),
            total_workmanship=round(total_workmanship, 2),
            total_stamp_vat=round(total_vat, 2),
            discount=round(discount, 2),
            final_amount=round(final_amount, 2),
            payment_method=data.get("payment_method", "cash"),
            notes=data.get("notes"),
            items=db_items
        )

        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        return jsonify({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "invoice_type": invoice.invoice_type,
            "customer_name": invoice.customer_name,
            "total_gross_weight": invoice.total_gross_weight,
            "total_net_weight": invoice.total_net_weight,
            "equivalent_21k_weight": invoice.equivalent_21k_weight,
            "final_amount": invoice.final_amount,
            "payment_method": invoice.payment_method,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None
        })
    finally:
        db.close()

# --- Inventory Periodic Audit Report ---
@app.route("/api/reports/audit", methods=["GET"])
def periodic_audit_report():
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

        invoices = db.query(Invoice).filter(Invoice.created_at >= start, Invoice.created_at <= end).all()

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
