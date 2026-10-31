"""
FastAPI Backend for Gold SaaS
Provides APIs for:
- Authentication & Roles (Super Admin, Shop Admin, Cashier)
- Live Gold Pricing (24k, 21k, 18k, 14k, Pound)
- Real-time POS Invoicing (Sales & Buyback)
- AI Vision Recognition (Gemini 2.5 Flash for National IDs, Bullion Cards, Hallmarks)
- Periodic Gold Audit & Inventory Reports (Daily, Weekly, Monthly, Custom Range)
- Shop Settings & Profile Editing
- Super Admin Subscription & Password Management for Jewelry Shops
"""
import os
import uuid
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import (
    engine, SessionLocal, init_db, Shop, User, GoldPrice, Invoice, InvoiceItem,
    Customer, JewelryType, InventoryItem, CashTransaction,
)
from services.gold_math import convert_to_equivalent
from services.gemini_vision import analyze_image_with_gemini
from services.inventory_logic import (
    get_latest_prices, buy_price_for_karat, fetch_live_prices,
    upsert_customer, apply_invoice_inventory_effects,
    capital_summary, cash_balance, inventory_item_to_dict,
    customer_with_stats, ensure_default_types,
)

# Initialize Database
init_db()

app = FastAPI(
    title="Gold Jewelry SaaS API - نظام الصاغة الذكي",
    version="1.3.0",
    description="نظام إدارة محلات الذهب والصاغة بالذكاء الاصطناعي مع لوحة تحكم كاملة للاشتراكات والإعدادات"
)

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class LoginSchema(BaseModel):
    username: str
    password: str

class UserCreateSchema(BaseModel):
    name: str
    username: str
    password: str
    role: str = "cashier"
    pin_code: Optional[str] = "2222"

class ShopUpdateSchema(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str
    commercial_record: str
    tax_number: str

class PasswordUpdateSchema(BaseModel):
    user_id: int
    new_password: str

class AdminShopUpdateSchema(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str
    subscription_plan: str
    is_active: bool
    owner_new_password: Optional[str] = None

class AdminShopCreateSchema(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str
    subscription_plan: str = "الباقة الماسية (سنوي)"
    admin_username: str
    admin_password: str

class GoldPriceUpdate(BaseModel):
    sell_24k: float
    sell_21k: float
    sell_18k: float
    sell_14k: float
    sell_pound: float
    buy_24k: float
    buy_21k: float
    buy_18k: float
    buy_14k: float
    buy_pound: float

class InvoiceItemSchema(BaseModel):
    item_name: str
    karat: int
    gross_weight: float
    stones_weight: float = 0.0
    price_per_gram: float
    workmanship_per_gram: float = 0.0
    stamp_vat_per_gram: float = 0.0
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    inventory_item_id: Optional[int] = None
    type_id: Optional[int] = None
    type_name: Optional[str] = None

class CreateInvoiceSchema(BaseModel):
    invoice_type: str = "sale"
    shop_id: Optional[int] = 1
    customer_name: str = "عميل نقدي"
    customer_national_id: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    payment_method: str = "cash"
    paid_amount: Optional[float] = None
    discount: float = 0.0
    notes: Optional[str] = None
    created_by_user_id: Optional[int] = None
    items: List[InvoiceItemSchema]

class JewelryTypeCreate(BaseModel):
    name: str
    shop_id: Optional[int] = 1

class InventoryItemCreate(BaseModel):
    shop_id: Optional[int] = 1
    type_id: Optional[int] = None
    type_name: Optional[str] = None
    section: str = "new"
    name: Optional[str] = None
    karat: int = 21
    gross_weight: float = 0.0
    stones_weight: float = 0.0
    purchase_price_per_gram: float = 0.0
    purchase_total: Optional[float] = None
    workmanship_per_gram: float = 0.0
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    notes: Optional[str] = None
    source: str = "purchase"
    paid_from_cash: bool = False

class InventoryBatchCreate(BaseModel):
    shop_id: Optional[int] = 1
    items: List[InventoryItemCreate]

class OpeningCashUpdate(BaseModel):
    shop_id: Optional[int] = 1
    opening_cash: float = 0.0

class CashTransactionCreate(BaseModel):
    shop_id: Optional[int] = 1
    direction: str = "in"
    amount: float
    category: str = "adjustment"
    note: Optional[str] = None
    created_by_user_id: Optional[int] = None

class CustomerCreate(BaseModel):
    shop_id: Optional[int] = 1
    name: str
    phone: Optional[str] = None
    national_id: Optional[str] = None
    address: Optional[str] = None

class InvoicePaySchema(BaseModel):
    amount: float

# Unified Login Endpoint
@app.post("/api/auth/login")
def login(creds: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == creds.username).first()
    if not user or user.password != creds.password:
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="هذا الحساب معطل حالياً")

    shop = db.query(Shop).filter(Shop.id == user.shop_id).first() if user.shop_id else None
    
    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
            "shop_id": user.shop_id,
            "shop_name": shop.name if shop else "منصة الصاغة السحابية (النظام الرئيسي)"
        }
    }

# Shop Settings (For Jeweler / Shop Admin)
@app.get("/api/shop")
def get_shop_info(shop_id: Optional[int] = 1, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="المحل غير مسجل")
    return shop

@app.put("/api/shop")
def update_shop_info(data: ShopUpdateSchema, shop_id: Optional[int] = 1, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="المحل غير مسجل")
    
    shop.name = data.name
    shop.owner_name = data.owner_name
    shop.phone = data.phone
    shop.address = data.address
    shop.commercial_record = data.commercial_record
    shop.tax_number = data.tax_number

    # Update owner user name as well
    owner_user = db.query(User).filter(User.shop_id == shop.id, User.role == "shop_admin").first()
    if owner_user:
        owner_user.name = f"{shop.owner_name} (صاحب المحل)"

    db.commit()
    db.refresh(shop)
    return {"message": "تم تحديث بيانات المحل بنجاح", "shop": shop}

# Change User Password (For Jeweler / User Profile)
@app.put("/api/user/password")
def change_password(data: PasswordUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    user.password = data.new_password
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح"}

# Super Admin View & Subscription Management
@app.get("/api/admin/shops")
def get_all_subscriber_shops(db: Session = Depends(get_db)):
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
            "created_at": s.created_at.isoformat()
        })
    return result

@app.put("/api/admin/shops/{shop_id}")
def admin_update_shop(shop_id: int, data: AdminShopUpdateSchema, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="المحل غير موجود")
    
    shop.name = data.name
    shop.owner_name = data.owner_name
    shop.phone = data.phone
    shop.address = data.address
    shop.subscription_plan = data.subscription_plan
    shop.is_active = data.is_active

    # If Super Admin resets the shop owner's password
    if data.owner_new_password:
        owner_user = db.query(User).filter(User.shop_id == shop.id, User.role == "shop_admin").first()
        if owner_user:
            owner_user.password = data.owner_new_password
            owner_user.name = f"{data.owner_name} (صاحب المحل)"

    db.commit()
    db.refresh(shop)
    return {"message": "تم تحديث بيانات واشتراك المحل بنجاح", "shop": shop}

@app.post("/api/admin/shops")
def admin_create_shop(data: AdminShopCreateSchema, db: Session = Depends(get_db)):
    # Check if username exists
    existing = db.query(User).filter(User.username == data.admin_username).first()
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم هذا مستخدم بالفعل، اختر اسماً آخر للمحل")

    # Create new shop
    new_shop = Shop(
        name=data.name,
        owner_name=data.owner_name,
        phone=data.phone,
        address=data.address,
        subscription_plan=data.subscription_plan,
        is_active=True
    )
    db.add(new_shop)
    db.commit()
    db.refresh(new_shop)

    # Create default prices for new shop
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

    # Create shop owner admin user
    owner_user = User(
        shop_id=new_shop.id,
        name=f"{data.owner_name} (صاحب المحل)",
        username=data.admin_username,
        password=data.admin_password,
        role="shop_admin",
        pin_code="1111"
    )
    db.add(owner_user)
    db.commit()

    return {"message": "تم إضافة محل الصاغة وتفعيل حسابه بنجاح", "shop_id": new_shop.id}

# Staff Management
@app.get("/api/users")
def get_shop_users(shop_id: Optional[int] = 1, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.shop_id == shop_id).all()
    return [{
        "id": u.id,
        "name": u.name,
        "username": u.username,
        "role": u.role,
        "pin_code": u.pin_code,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat()
    } for u in users]

@app.post("/api/users")
def create_assistant_user(data: UserCreateSchema, shop_id: Optional[int] = 1, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود بالفعل، اختر اسماً آخر")
    
    new_user = User(
        shop_id=shop_id,
        name=data.name,
        username=data.username,
        password=data.password,
        role=data.role,
        pin_code=data.pin_code
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "تم إضافة المساعد بنجاح", "user": new_user}

@app.delete("/api/users/{user_id}")
def delete_assistant_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if u.role == "super_admin":
        raise HTTPException(status_code=403, detail="لا يمكن حذف حساب السوبر أدمن")
    db.delete(u)
    db.commit()
    return {"message": "تم حذف الحساب بنجاح"}

# Live Gold Prices
@app.get("/api/prices")
def get_gold_prices(db: Session = Depends(get_db)):
    price = db.query(GoldPrice).order_by(GoldPrice.id.desc()).first()
    if not price:
        raise HTTPException(status_code=404, detail="الأسعار غير مسجلة بعد")
    return price

@app.post("/api/prices")
def update_gold_prices(data: GoldPriceUpdate, db: Session = Depends(get_db)):
    price = db.query(GoldPrice).first()
    if not price:
        price = GoldPrice()
        db.add(price)
    
    price.sell_24k = data.sell_24k
    price.sell_21k = data.sell_21k
    price.sell_18k = data.sell_18k
    price.sell_14k = data.sell_14k
    price.sell_pound = data.sell_pound
    
    price.buy_24k = data.buy_24k
    price.buy_21k = data.buy_21k
    price.buy_18k = data.buy_18k
    price.buy_14k = data.buy_14k
    price.buy_pound = data.buy_pound
    price.updated_at = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(price)
    return {"message": "تم تحديث أسعار الذهب بنجاح", "prices": price}

# Invoicing
@app.post("/api/invoices")
def create_invoice(data: CreateInvoiceSchema, db: Session = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=400, detail="يجب إضافة صنف واحد على الأقل في الفاتورة")
    
    now = datetime.datetime.now()
    prefix = "INV-S" if data.invoice_type == "sale" else "INV-B"
    code = f"{prefix}-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    
    total_gross = 0.0
    total_net = 0.0
    total_eq_21 = 0.0
    total_raw = 0.0
    total_workmanship = 0.0
    total_vat = 0.0
    total_items_price = 0.0
    
    db_items = []
    
    for item in data.items:
        net_wt = max(0.0, round(item.gross_weight - item.stones_weight, 3))
        raw_cost = round(net_wt * item.price_per_gram, 2)
        
        if data.invoice_type == "sale":
            work_cost = round(net_wt * item.workmanship_per_gram, 2)
            vat_cost = round(net_wt * item.stamp_vat_per_gram, 2)
            item_total = round(raw_cost + work_cost + vat_cost, 2)
        else: # buyback
            work_cost = 0.0
            vat_cost = 0.0
            item_total = raw_cost
            
        eq_21 = convert_to_equivalent(net_wt, item.karat, 21)
        
        total_gross += item.gross_weight
        total_net += net_wt
        total_eq_21 += eq_21
        total_raw += raw_cost
        total_workmanship += work_cost
        total_vat += vat_cost
        total_items_price += item_total
        
        db_items.append(InvoiceItem(
            item_name=item.item_name,
            karat=item.karat,
            gross_weight=item.gross_weight,
            stones_weight=item.stones_weight,
            net_weight=net_wt,
            price_per_gram=item.price_per_gram,
            workmanship_per_gram=item.workmanship_per_gram,
            stamp_vat_per_gram=item.stamp_vat_per_gram,
            total_item_price=item_total,
            brand=item.brand,
            serial_number=item.serial_number
        ))
        
    final_amount = max(0.0, total_items_price - data.discount)

    shop_id = data.shop_id or 1
    customer = upsert_customer(
        db, shop_id, data.customer_name, data.customer_phone,
        data.customer_national_id, data.customer_address,
    )

    paid_amount = final_amount if data.paid_amount is None else float(data.paid_amount)
    paid_amount = round(max(0.0, min(paid_amount, final_amount)), 2)
    remaining_amount = round(final_amount - paid_amount, 2)

    invoice = Invoice(
        shop_id=shop_id,
        customer_id=customer.id if customer else None,
        invoice_number=code,
        invoice_type=data.invoice_type,
        customer_name=data.customer_name,
        customer_national_id=data.customer_national_id,
        customer_phone=data.customer_phone,
        created_by_user_id=data.created_by_user_id,
        total_gross_weight=round(total_gross, 3),
        total_net_weight=round(total_net, 3),
        equivalent_21k_weight=round(total_eq_21, 3),
        total_raw_gold_cost=round(total_raw, 2),
        total_workmanship=round(total_workmanship, 2),
        total_stamp_vat=round(total_vat, 2),
        discount=round(data.discount, 2),
        final_amount=round(final_amount, 2),
        paid_amount=paid_amount,
        remaining_amount=remaining_amount,
        payment_method=data.payment_method,
        notes=data.notes,
        items=db_items
    )

    db.add(invoice)
    db.flush()

    payload_items = [
        item.model_dump() if hasattr(item, "model_dump") else item.dict()
        for item in data.items
    ]
    apply_invoice_inventory_effects(db, shop_id, invoice, payload_items)

    db.commit()
    db.refresh(invoice)
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": invoice.invoice_type,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer_name,
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
        "items": db_items,
    }

@app.get("/api/invoices")
def list_invoices(limit: int = 50, invoice_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Invoice).order_by(Invoice.id.desc())
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    return query.limit(limit).all()

# ---------- Jewelry Types ----------
def _resolve_type(db, shop_id, type_id, type_name):
    if type_id:
        found = db.query(JewelryType).filter(JewelryType.id == int(type_id)).first()
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

@app.get("/api/jewelry-types")
def list_jewelry_types(shop_id: int = 1, db: Session = Depends(get_db)):
    ensure_default_types(db, shop_id)
    db.commit()
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
    return [{"id": t.id, "name": t.name, "items_count": counts.get(t.id, 0)} for t in types]

@app.post("/api/jewelry-types")
def create_jewelry_type(data: JewelryTypeCreate, db: Session = Depends(get_db)):
    shop_id = data.shop_id or 1
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="اكتب اسم النوع")
    existing = (
        db.query(JewelryType)
        .filter(JewelryType.shop_id == shop_id, JewelryType.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="هذا النوع موجود بالفعل")
    new_type = JewelryType(shop_id=shop_id, name=name)
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    return {"message": "تم إضافة النوع بنجاح", "type": {"id": new_type.id, "name": new_type.name}}

@app.delete("/api/jewelry-types/{type_id}")
def delete_jewelry_type(type_id: int, db: Session = Depends(get_db)):
    found = db.query(JewelryType).filter(JewelryType.id == type_id).first()
    if not found:
        raise HTTPException(status_code=404, detail="النوع غير موجود")
    db.query(InventoryItem).filter(InventoryItem.type_id == type_id).update(
        {InventoryItem.type_id: None}, synchronize_session=False
    )
    db.delete(found)
    db.commit()
    return {"message": "تم حذف النوع"}

# ---------- Inventory ----------
def _build_inventory_item(db, shop_id, raw: InventoryItemCreate):
    gross = float(raw.gross_weight or 0)
    stones = float(raw.stones_weight or 0)
    net = round(max(0.0, gross - stones), 3)
    price_g = float(raw.purchase_price_per_gram or 0)
    purchase_total = raw.purchase_total if raw.purchase_total is not None else round(net * price_g, 2)

    type_id, type_name = _resolve_type(db, shop_id, raw.type_id, (raw.type_name or "").strip() or None)
    section = raw.section if raw.section in ("new", "scrap") else "new"

    return InventoryItem(
        shop_id=shop_id,
        type_id=type_id,
        type_name=type_name,
        section=section,
        status="in_stock",
        name=(raw.name or type_name or "قطعة مجوهرات").strip(),
        karat=raw.karat or 21,
        gross_weight=gross,
        stones_weight=stones,
        net_weight=net,
        purchase_price_per_gram=price_g,
        purchase_total=purchase_total,
        workmanship_per_gram=raw.workmanship_per_gram or 0,
        brand=raw.brand,
        serial_number=raw.serial_number,
        notes=raw.notes,
        source=raw.source or "purchase",
        paid_from_cash=bool(raw.paid_from_cash),
    )

@app.get("/api/inventory")
def list_inventory(
    shop_id: int = 1,
    status: str = "in_stock",
    section: Optional[str] = None,
    type_id: Optional[int] = None,
    q: Optional[str] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    query = db.query(InventoryItem).filter(InventoryItem.shop_id == shop_id)
    if status and status != "all":
        query = query.filter(InventoryItem.status == status)
    if section and section != "all":
        query = query.filter(InventoryItem.section == section)
    if type_id:
        query = query.filter(InventoryItem.type_id == type_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (InventoryItem.name.like(like))
            | (InventoryItem.brand.like(like))
            | (InventoryItem.serial_number.like(like))
            | (InventoryItem.type_name.like(like))
        )
    items = query.order_by(InventoryItem.id.desc()).limit(limit).all()
    return [inventory_item_to_dict(i) for i in items]

@app.post("/api/inventory")
def add_inventory(data: InventoryBatchCreate, db: Session = Depends(get_db)):
    shop_id = data.shop_id or 1
    created = []
    for raw in data.items:
        item = _build_inventory_item(db, shop_id, raw)
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return {
        "message": f"تمت إضافة {len(created)} قطعة للمخزن",
        "items": [inventory_item_to_dict(i) for i in created],
    }

@app.put("/api/inventory/{item_id}")
def update_inventory(item_id: int, data: dict, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="القطعة غير موجودة")
    if item.status == "sold":
        raise HTTPException(status_code=400, detail="لا يمكن تعديل قطعة تم بيعها")

    for field in ("name", "brand", "serial_number", "notes"):
        if field in data:
            setattr(item, field, data[field])
    if "karat" in data:
        item.karat = int(data["karat"])
    if "gross_weight" in data:
        item.gross_weight = float(data["gross_weight"] or 0)
    if "stones_weight" in data:
        item.stones_weight = float(data["stones_weight"] or 0)
    if "purchase_price_per_gram" in data:
        item.purchase_price_per_gram = float(data["purchase_price_per_gram"] or 0)
    if "workmanship_per_gram" in data:
        item.workmanship_per_gram = float(data["workmanship_per_gram"] or 0)
    if data.get("section") in ("new", "scrap"):
        item.section = data["section"]
    if "type_id" in data or "type_name" in data:
        item.type_id, item.type_name = _resolve_type(
            db, item.shop_id, data.get("type_id"), data.get("type_name")
        )

    item.net_weight = round(max(0.0, item.gross_weight - item.stones_weight), 3)
    if data.get("purchase_total") not in (None, ""):
        item.purchase_total = float(data["purchase_total"])
    else:
        item.purchase_total = round(item.net_weight * item.purchase_price_per_gram, 2)

    db.commit()
    db.refresh(item)
    return {"message": "تم تحديث القطعة", "item": inventory_item_to_dict(item)}

@app.delete("/api/inventory/{item_id}")
def delete_inventory(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="القطعة غير موجودة")
    if item.status == "sold":
        raise HTTPException(status_code=400, detail="لا يمكن حذف قطعة تم بيعها")
    db.delete(item)
    db.commit()
    return {"message": "تم حذف القطعة من المخزن"}

@app.get("/api/inventory/summary")
def inventory_summary(shop_id: int = 1, db: Session = Depends(get_db)):
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
    return result

# ---------- Capital & Cash ----------
@app.get("/api/capital")
def get_capital(shop_id: int = 1, db: Session = Depends(get_db)):
    return capital_summary(db, shop_id)

@app.put("/api/shop/opening-cash")
def update_opening_cash(data: OpeningCashUpdate, db: Session = Depends(get_db)):
    shop_id = data.shop_id or 1
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="المحل غير موجود")
    shop.opening_cash = data.opening_cash
    db.commit()
    return {
        "message": "تم تحديث النقدية الافتتاحية",
        "opening_cash": shop.opening_cash,
        "cash_balance": cash_balance(db, shop_id),
    }

@app.get("/api/cash/transactions")
def list_cash_transactions(shop_id: int = 1, db: Session = Depends(get_db)):
    rows = (
        db.query(CashTransaction)
        .filter(CashTransaction.shop_id == shop_id)
        .order_by(CashTransaction.id.desc())
        .limit(200)
        .all()
    )
    return [{
        "id": t.id,
        "direction": t.direction,
        "amount": t.amount,
        "category": t.category,
        "note": t.note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in rows]

@app.post("/api/cash/transactions")
def add_cash_transaction(data: CashTransactionCreate, db: Session = Depends(get_db)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="المبلغ يجب أن يكون أكبر من صفر")
    direction = data.direction if data.direction in ("in", "out") else "in"
    tx = CashTransaction(
        shop_id=data.shop_id or 1,
        direction=direction,
        amount=data.amount,
        category=data.category,
        note=data.note,
        created_by_user_id=data.created_by_user_id,
    )
    db.add(tx)
    db.commit()
    return {"message": "تم تسجيل الحركة النقدية", "cash_balance": cash_balance(db, data.shop_id or 1)}

# ---------- Live Prices ----------
@app.get("/api/prices/live")
def live_gold_prices():
    try:
        return fetch_live_prices()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"تعذر جلب الأسعار اللحظية: {exc}")

# ---------- Customers ----------
@app.get("/api/customers")
def list_customers(shop_id: int = 1, q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Customer).filter(Customer.shop_id == shop_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (Customer.name.like(like)) | (Customer.phone.like(like)) | (Customer.national_id.like(like))
        )
    rows = query.order_by(Customer.id.desc()).limit(300).all()
    return [customer_with_stats(db, c) for c in rows]

@app.post("/api/customers")
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="اسم العميل مطلوب")
    customer = upsert_customer(
        db, data.shop_id or 1, name, data.phone, data.national_id, data.address
    )
    db.commit()
    db.refresh(customer)
    return {"message": "تم حفظ العميل", "customer": customer_with_stats(db, customer)}

# ---------- Collect invoice payment ----------
@app.post("/api/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: int, data: InvoicePaySchema, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="أدخل مبلغاً صحيحاً")

    remaining = float(invoice.remaining_amount or 0.0)
    applied = min(data.amount, remaining) if remaining > 0 else 0.0
    invoice.paid_amount = round(float(invoice.paid_amount or 0.0) + applied, 2)
    invoice.remaining_amount = round(max(0.0, remaining - applied), 2)
    db.commit()
    return {
        "message": "تم تسجيل الدفعة",
        "id": invoice.id,
        "paid_amount": invoice.paid_amount,
        "remaining_amount": invoice.remaining_amount,
    }

@app.post("/api/vision/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None)
):
    contents = await file.read()
    mime = file.content_type or "image/jpeg"
    result = await analyze_image_with_gemini(contents, mime_type=mime, api_key=api_key)
    return result

# Comprehensive Inventory Audit Endpoint
@app.get("/api/reports/audit")
def get_inventory_audit_report(
    period: str = Query("day", description="'day' | 'week' | 'month' | 'custom'"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
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

    return {
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
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
