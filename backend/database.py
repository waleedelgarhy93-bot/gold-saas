"""
Database models and connection for Gold SaaS
Supports Multi-tenant shops, real-time prices, sales, buybacks, and inventory balances.
"""
import os
import shutil
import time
import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

_APP_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DB_URL = os.environ.get("DATABASE_URL")

if RAW_DB_URL:
    # دعم قواعد البيانات السحابية (PostgreSQL / Supabase)
    if RAW_DB_URL.startswith("postgres://"):
        RAW_DB_URL = RAW_DB_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif RAW_DB_URL.startswith("postgresql://") and not RAW_DB_URL.startswith("postgresql+"):
        RAW_DB_URL = RAW_DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    DATABASE_URL = RAW_DB_URL
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # دعم SQLite المحلي أو المجلد المثبت في غيمة
    DATA_DIR = os.environ.get("GOLD_DATA_DIR") or _APP_DIR
    os.makedirs(DATA_DIR, exist_ok=True)
    DB_PATH = os.environ.get("GOLD_DB_PATH") or os.path.join(DATA_DIR, "gold_saas.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

    _LEGACY_DB = os.path.join(_APP_DIR, "gold_saas.db")
    if os.path.abspath(DB_PATH) != os.path.abspath(_LEGACY_DB) and not os.path.exists(DB_PATH) and os.path.exists(_LEGACY_DB):
        try:
            shutil.copy2(_LEGACY_DB, DB_PATH)
            print(f"[db] copied legacy database to {DB_PATH}")
        except Exception as exc:
            print(f"[db] legacy copy skipped: {exc}")

    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Shop(Base):
    __tablename__ = "shops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="مجوهرات الأمانة الذهبية")
    owner_name = Column(String(100), default="أ/ وليد المقدم")
    phone = Column(String(20), default="01012345678")
    address = Column(String(200), default="شارع الصاغة، سمالوط، المنيا")
    commercial_record = Column(String(50), default="45892")
    tax_number = Column(String(50), default="100-245-889")
    subscription_plan = Column(String(50), default="الباقة الماسية (سنوي)")
    is_active = Column(Boolean, default=True)
    opening_cash = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    users = relationship("User", back_populates="shop")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True) # Null for Super Admin
    name = Column(String(100))
    username = Column(String(50), unique=True, index=True)
    password = Column(String(100)) # plain or hash for demo
    role = Column(String(20), default="cashier") # "super_admin", "shop_admin", "cashier"
    pin_code = Column(String(6), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    shop = relationship("Shop", back_populates="users")

class GoldPrice(Base):
    __tablename__ = "gold_prices"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1)
    
    # Sell Prices (سعر بيع الجرام للزبون)
    sell_24k = Column(Float, default=4285.0)
    sell_21k = Column(Float, default=3750.0)
    sell_18k = Column(Float, default=3214.0)
    sell_14k = Column(Float, default=2500.0)
    sell_pound = Column(Float, default=30000.0)
    
    # Buy Prices (سعر شراء الكسر من الزبون)
    buy_24k = Column(Float, default=4260.0)
    buy_21k = Column(Float, default=3730.0)
    buy_18k = Column(Float, default=3195.0)
    buy_14k = Column(Float, default=2480.0)
    buy_pound = Column(Float, default=29840.0)
    
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1, index=True)
    name = Column(String(100), index=True)
    national_id = Column(String(14), index=True, nullable=True)
    phone = Column(String(20), index=True, nullable=True)
    address = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    invoice_number = Column(String(50), unique=True, index=True)
    invoice_type = Column(String(20), default="sale") # "sale" | "buyback"
    
    # Customer snapshot
    customer_name = Column(String(100), default="عميل نقدي")
    customer_national_id = Column(String(14), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    
    # Totals
    total_gross_weight = Column(Float, default=0.0)
    total_net_weight = Column(Float, default=0.0)
    equivalent_21k_weight = Column(Float, default=0.0)
    
    total_raw_gold_cost = Column(Float, default=0.0)
    total_workmanship = Column(Float, default=0.0)
    total_stamp_vat = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    final_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    remaining_amount = Column(Float, default=0.0)
    
    payment_method = Column(String(20), default="cash")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    
    item_name = Column(String(100))
    barcode = Column(String(50), nullable=True)
    karat = Column(Integer, default=21)
    
    gross_weight = Column(Float, default=0.0)
    stones_weight = Column(Float, default=0.0)
    net_weight = Column(Float, default=0.0)
    
    price_per_gram = Column(Float, default=0.0)
    workmanship_per_gram = Column(Float, default=0.0)
    stamp_vat_per_gram = Column(Float, default=0.0)
    
    total_item_price = Column(Float, default=0.0)
    
    brand = Column(String(50), nullable=True)
    serial_number = Column(String(50), nullable=True)
    
    invoice = relationship("Invoice", back_populates="items")

class JewelryType(Base):
    """نوع/تصنيف المجوهرات (غوايش، خواتم، سبائك...) قابل للإضافة من المحل"""
    __tablename__ = "jewelry_types"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1, index=True)
    name = Column(String(80), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class InventoryItem(Base):
    """قطعة مجوهرات في المخزن (جديد أو كسر) - تُخصم عند البيع وتُنقل للمباع"""
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1, index=True)
    type_id = Column(Integer, ForeignKey("jewelry_types.id"), nullable=True)
    type_name = Column(String(80), nullable=True)

    section = Column(String(10), default="new", index=True)   # "new" | "scrap"
    status = Column(String(12), default="in_stock", index=True)  # "in_stock" | "sold"
    name = Column(String(120))

    karat = Column(Integer, default=21)
    gross_weight = Column(Float, default=0.0)
    stones_weight = Column(Float, default=0.0)
    net_weight = Column(Float, default=0.0)

    purchase_price_per_gram = Column(Float, default=0.0)
    purchase_total = Column(Float, default=0.0)
    workmanship_per_gram = Column(Float, default=0.0)

    brand = Column(String(50), nullable=True)
    serial_number = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    source = Column(String(20), default="purchase")  # "purchase" | "buyback" | "opening"
    paid_from_cash = Column(Boolean, default=False)

    source_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    sold_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    sold_price = Column(Float, nullable=True)
    sold_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CashTransaction(Base):
    """حركة نقدية يدوية (إيداع/سحب/مصروف) بخلاف الفواتير"""
    __tablename__ = "cash_transactions"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), default=1, index=True)
    direction = Column(String(3), default="in")  # "in" | "out"
    amount = Column(Float, default=0.0)
    category = Column(String(30), default="adjustment")
    note = Column(String(200), nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

DEFAULT_JEWELRY_TYPES = [
    "غوايش", "خواتم", "سلاسل", "حلقان", "أسورة", "دبل",
    "سبائك", "جنيهات ذهب", "كسر ومستعمل",
]

def _column_exists(conn, table, column):
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)

def _try_sql(conn, sql):
    """ينفّذ أمراً ويستمر حتى لو عمود مضاف بالفعل من عامل آخر"""
    try:
        conn.exec_driver_sql(sql)
    except Exception as exc:
        print(f"[db] migrate skipped ({exc}): {sql}")

def _migrate_existing_sqlite():
    """ترحيل آمن لقاعدة SQLite الموجودة بدون فقدان أي بيانات"""
    try:
        with engine.begin() as conn:
            tables = {r[0] for r in conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()}

            if "shops" in tables and not _column_exists(conn, "shops", "opening_cash"):
                _try_sql(conn, "ALTER TABLE shops ADD COLUMN opening_cash FLOAT DEFAULT 0")

            if "customers" in tables and not _column_exists(conn, "customers", "shop_id"):
                _try_sql(conn, "ALTER TABLE customers ADD COLUMN shop_id INTEGER DEFAULT 1")

            if "invoices" in tables:
                if not _column_exists(conn, "invoices", "paid_amount"):
                    _try_sql(conn, "ALTER TABLE invoices ADD COLUMN paid_amount FLOAT DEFAULT 0")
                    # كل الفواتير القديمة كانت بتتحصيل كامل
                    _try_sql(conn, "UPDATE invoices SET paid_amount = final_amount")
                if not _column_exists(conn, "invoices", "remaining_amount"):
                    _try_sql(conn, "ALTER TABLE invoices ADD COLUMN remaining_amount FLOAT DEFAULT 0")
                    _try_sql(conn, "UPDATE invoices SET remaining_amount = 0")
    except Exception as exc:
        print(f"[db] migration failed: {exc}")

def init_db():
    last_exc = None
    for attempt in range(4):
        try:
            Base.metadata.create_all(bind=engine)
            if engine.dialect.name == 'sqlite':
                _migrate_existing_sqlite()
            _seed_defaults()
            return
        except Exception as exc:
            last_exc = exc
            print(f"[db] init attempt {attempt + 1} failed: {exc}")
            time.sleep(1.5)
    print(f"[db] init_db gave up: {last_exc}")

def _seed_defaults():
    db = SessionLocal()
    try:
        shop = db.query(Shop).first()
        if not shop:
            shop = Shop(
                name="مجوهرات الأمانة الذهبية",
                owner_name="أ/ وليد المقدم",
                phone="01012345678",
                address="المنيا - مصر",
                commercial_record="45892",
                tax_number="100-245-889"
            )
            db.add(shop)
            db.commit()
            db.refresh(shop)

        # Always ensure standard system users exist with correct credentials
        for u_data in [
            {
                "username": "superadmin",
                "password": "123",
                "name": "أ/ وليد المقدم (سوبر أدمن المنصة)",
                "role": "super_admin",
                "pin_code": "9999",
                "shop_id": None
            },
            {
                "username": "taha",
                "password": "123",
                "name": "أ/ طه رجب (صاحب محل الهدى)",
                "role": "shop_admin",
                "pin_code": "1111",
                "shop_id": shop.id if shop else 1
            },
            {
                "username": "admin",
                "password": "123",
                "name": "أ/ طه رجب (صاحب المحل)",
                "role": "shop_admin",
                "pin_code": "1111",
                "shop_id": shop.id if shop else 1
            },
            {
                "username": "cashier",
                "password": "123",
                "name": "محمود المصري (مساعد كاشير)",
                "role": "cashier",
                "pin_code": "2222",
                "shop_id": shop.id if shop else 1
            }
        ]:
            existing_u = db.query(User).filter(User.username == u_data["username"]).first()
            if not existing_u:
                new_u = User(
                    username=u_data["username"],
                    password=u_data["password"],
                    name=u_data["name"],
                    role=u_data["role"],
                    pin_code=u_data["pin_code"],
                    shop_id=u_data["shop_id"],
                    is_active=True
                )
                db.add(new_u)
            else:
                if not existing_u.password:
                    existing_u.password = u_data["password"]
                existing_u.is_active = True
                if u_data["username"] in ["taha", "admin"] and "وليد" in (existing_u.name or ""):
                    existing_u.name = u_data["name"]
        db.commit()

        price = db.query(GoldPrice).first()
        if not price:
            price = GoldPrice(
                shop_id=shop.id if shop else 1,
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
            db.add(price)
            db.commit()

        # Seed default jewelry types for each shop once
        for sh in db.query(Shop).all():
            if not db.query(JewelryType).filter(JewelryType.shop_id == sh.id).first():
                for type_name in DEFAULT_JEWELRY_TYPES:
                    db.add(JewelryType(shop_id=sh.id, name=type_name))
        db.commit()
    finally:
        db.close()
