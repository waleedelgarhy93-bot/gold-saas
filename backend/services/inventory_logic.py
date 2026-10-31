"""
Shared inventory / capital / customer / live-price logic for both
Flask (production) and FastAPI (local) backends.
"""
import datetime
import requests
from sqlalchemy import func

from database import (
    Shop, Customer, GoldPrice, Invoice, InventoryItem, CashTransaction,
    JewelryType, DEFAULT_JEWELRY_TYPES,
)
from services.gold_math import KARAT_PURITIES

OUNCE_GRAMS = 31.1034768
GOLD_SPOT_URL = "https://api.gold-api.com/price/XAU"
FX_URL = "https://open.er-api.com/v6/latest/USD"

_live_cache = {"at": None, "data": None}
LIVE_TTL_SECONDS = 300


# ---------- Prices ----------
def get_latest_prices(db, shop_id=1):
    price = (
        db.query(GoldPrice)
        .filter(GoldPrice.shop_id == shop_id)
        .order_by(GoldPrice.id.desc())
        .first()
    )
    if not price:
        price = db.query(GoldPrice).order_by(GoldPrice.id.desc()).first()
    return price


def _karat_from(prices, karat, prefix):
    if not prices:
        return 0.0
    base = {
        24: getattr(prices, f"{prefix}_24k", 0.0) or 0.0,
        21: getattr(prices, f"{prefix}_21k", 0.0) or 0.0,
        18: getattr(prices, f"{prefix}_18k", 0.0) or 0.0,
        14: getattr(prices, f"{prefix}_14k", 0.0) or 0.0,
    }
    if karat in base:
        return float(base[karat])
    purity = KARAT_PURITIES.get(karat, 0.875)
    return round(float(base[21]) * purity / 0.875, 2)


def buy_price_for_karat(prices, karat):
    return _karat_from(prices, karat, "buy")


def sell_price_for_karat(prices, karat):
    return _karat_from(prices, karat, "sell")


def fetch_live_prices():
    """Live international gold spot converted to EGP per gram, cached for 5 minutes."""
    now = datetime.datetime.utcnow()
    if _live_cache["at"] and (now - _live_cache["at"]).total_seconds() < LIVE_TTL_SECONDS:
        return {**_live_cache["data"], "cached": True}

    gold_res = requests.get(GOLD_SPOT_URL, timeout=10)
    gold_res.raise_for_status()
    usd_per_ounce = float(gold_res.json()["price"])

    fx_res = requests.get(FX_URL, timeout=10)
    fx_res.raise_for_status()
    usd_egp = float(fx_res.json()["rates"]["EGP"])

    gram_24 = usd_per_ounce / OUNCE_GRAMS * usd_egp
    market = {
        24: round(gram_24, 2),
        21: round(gram_24 * 0.875, 2),
        18: round(gram_24 * 0.750, 2),
        14: round(gram_24 * 0.5833, 2),
    }
    data = {
        "source": "international_spot",
        "usd_per_ounce": round(usd_per_ounce, 2),
        "usd_egp": round(usd_egp, 4),
        "market_per_gram": market,
        "fetched_at": now.isoformat(),
    }
    _live_cache["at"] = now
    _live_cache["data"] = data
    return {**data, "cached": False}


# ---------- Jewelry types ----------
def ensure_default_types(db, shop_id=1):
    if not db.query(JewelryType).filter(JewelryType.shop_id == shop_id).first():
        for name in DEFAULT_JEWELRY_TYPES:
            db.add(JewelryType(shop_id=shop_id, name=name))
        db.flush()


# ---------- Inventory serialization ----------
def inventory_item_to_dict(item):
    return {
        "id": item.id,
        "shop_id": item.shop_id,
        "type_id": item.type_id,
        "type_name": item.type_name,
        "section": item.section,
        "status": item.status,
        "name": item.name,
        "karat": item.karat,
        "gross_weight": item.gross_weight,
        "stones_weight": item.stones_weight,
        "net_weight": item.net_weight,
        "purchase_price_per_gram": item.purchase_price_per_gram,
        "purchase_total": item.purchase_total,
        "workmanship_per_gram": item.workmanship_per_gram,
        "brand": item.brand,
        "serial_number": item.serial_number,
        "notes": item.notes,
        "source": item.source,
        "paid_from_cash": bool(item.paid_from_cash),
        "source_invoice_id": item.source_invoice_id,
        "sold_invoice_id": item.sold_invoice_id,
        "sold_price": item.sold_price,
        "sold_at": item.sold_at.isoformat() if item.sold_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


# ---------- Customers ----------
def upsert_customer(db, shop_id, name, phone=None, national_id=None, address=None):
    """Every invoiced person is stored automatically (skips anonymous cash customer)."""
    name = (name or "").strip()
    phone = (phone or "").strip() or None
    national_id = (national_id or "").strip() or None

    if name in ("", "عميل نقدي") and not phone and not national_id:
        return None

    query = db.query(Customer).filter(Customer.shop_id == shop_id)
    found = None
    if national_id:
        found = query.filter(Customer.national_id == national_id).first()
    if not found and phone:
        found = query.filter(Customer.phone == phone).first()
    if not found and name:
        found = query.filter(Customer.name == name).first()

    if found:
        if name and name != "عميل نقدي":
            found.name = name
        if phone:
            found.phone = phone
        if national_id:
            found.national_id = national_id
        if address:
            found.address = address
        return found

    customer = Customer(
        shop_id=shop_id,
        name=name or "عميل نقدي",
        phone=phone,
        national_id=national_id,
        address=address,
    )
    db.add(customer)
    db.flush()
    return customer


# ---------- Invoice side effects ----------
def apply_invoice_inventory_effects(db, shop_id, invoice, payload_items):
    """
    sale    -> linked stock pieces become sold and leave the warehouse
    buyback -> purchased pieces enter the scrap section automatically
    """
    moved = 0
    for payload, db_item in zip(payload_items, invoice.items):
        inventory_id = payload.get("inventory_item_id")

        if invoice.invoice_type == "sale":
            if not inventory_id:
                continue
            stock = (
                db.query(InventoryItem)
                .filter(InventoryItem.id == inventory_id, InventoryItem.shop_id == shop_id)
                .first()
            )
            if stock and stock.status == "in_stock":
                stock.status = "sold"
                stock.sold_invoice_id = invoice.id
                stock.sold_price = db_item.total_item_price
                stock.sold_at = datetime.datetime.utcnow()
                moved += 1

        else:  # buyback -> scrap in
            scrap = InventoryItem(
                shop_id=shop_id,
                type_id=payload.get("type_id"),
                type_name=payload.get("type_name") or "كسر ومستعمل",
                section="scrap",
                status="in_stock",
                name=db_item.item_name or "كسر",
                karat=db_item.karat,
                gross_weight=db_item.gross_weight,
                stones_weight=db_item.stones_weight,
                net_weight=db_item.net_weight,
                purchase_price_per_gram=db_item.price_per_gram,
                purchase_total=db_item.total_item_price,
                brand=db_item.brand,
                serial_number=db_item.serial_number,
                source="buyback",
                source_invoice_id=invoice.id,
                paid_from_cash=False,
            )
            db.add(scrap)
            moved += 1
    return moved


# ---------- Cash & capital ----------
def _sum(db, column, *criteria):
    value = db.query(func.coalesce(func.sum(column), 0.0)).filter(*criteria).scalar()
    return float(value or 0.0)


def cash_balance(db, shop_id=1):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    opening = float(shop.opening_cash or 0.0) if shop else 0.0

    sales_paid = _sum(db, Invoice.paid_amount, Invoice.shop_id == shop_id, Invoice.invoice_type == "sale")
    buybacks_paid = _sum(db, Invoice.paid_amount, Invoice.shop_id == shop_id, Invoice.invoice_type == "buyback")
    purchases_paid = _sum(db, InventoryItem.purchase_total, InventoryItem.shop_id == shop_id, InventoryItem.paid_from_cash.is_(True))

    tx_in = _sum(db, CashTransaction.amount, CashTransaction.shop_id == shop_id, CashTransaction.direction == "in")
    tx_out = _sum(db, CashTransaction.amount, CashTransaction.shop_id == shop_id, CashTransaction.direction == "out")

    balance = opening + sales_paid - buybacks_paid - purchases_paid + tx_in - tx_out
    return round(balance, 2)


def capital_summary(db, shop_id=1):
    prices = get_latest_prices(db, shop_id)
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.shop_id == shop_id, InventoryItem.status == "in_stock")
        .all()
    )

    sections = {
        "new": {"count": 0, "net_weight": 0.0, "value": 0.0, "karat_weights": {}},
        "scrap": {"count": 0, "net_weight": 0.0, "value": 0.0, "karat_weights": {}},
    }
    for item in items:
        bucket = sections.get(item.section, sections["new"])
        gram_price = buy_price_for_karat(prices, item.karat)
        value = round((item.net_weight or 0.0) * gram_price, 2)
        bucket["count"] += 1
        bucket["net_weight"] = round(bucket["net_weight"] + (item.net_weight or 0.0), 3)
        bucket["value"] = round(bucket["value"] + value, 2)
        bucket["karat_weights"][str(item.karat)] = round(
            bucket["karat_weights"].get(str(item.karat), 0.0) + (item.net_weight or 0.0), 3
        )

    receivables = _sum(
        db,
        Invoice.remaining_amount,
        Invoice.shop_id == shop_id,
        Invoice.invoice_type == "sale",
        Invoice.remaining_amount > 0,
    )
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    cash = cash_balance(db, shop_id)

    total = round(sections["new"]["value"] + sections["scrap"]["value"] + cash + receivables, 2)

    return {
        "shop_id": shop_id,
        "prices_used": {
            "karat_buy_prices": {str(k): buy_price_for_karat(prices, k) for k in (24, 21, 18, 14)},
            "updated_at": prices.updated_at.isoformat() if prices and prices.updated_at else None,
        },
        "new_gold": sections["new"],
        "scrap_gold": sections["scrap"],
        "cash": cash,
        "opening_cash": float(shop.opening_cash or 0.0) if shop else 0.0,
        "receivables": round(receivables, 2),
        "total_capital": total,
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }


def customer_with_stats(db, customer):
    invoices = db.query(Invoice).filter(Invoice.customer_id == customer.id).all()
    outstanding = sum(max(0.0, inv.remaining_amount or 0.0) for inv in invoices if inv.invoice_type == "sale")
    return {
        "id": customer.id,
        "shop_id": customer.shop_id,
        "name": customer.name,
        "phone": customer.phone,
        "national_id": customer.national_id,
        "address": customer.address,
        "notes": customer.notes,
        "invoices_count": len(invoices),
        "outstanding": round(outstanding, 2),
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
    }
