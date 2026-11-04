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


JEWELRY_SYNONYMS = {
    "غوايش": ["غويش", "غوايش", "اسواره", "اساور", "اسوره", "معصم", "بنجره", "بناجر"],
    "خواتم": ["خاتم", "خواتم", "محبس", "محابس", "توينز", "سوليتير", "فص"],
    "سلاسل": ["سلسل", "سلاسل", "عقد", "كوليه", "مداليه", "دلايه", "شوكر"],
    "حلقان": ["حلق", "حلقان", "قرط", "بريمه"],
    "دبل": ["دبل", "دبله"],
    "سبائك": ["سبيك", "سبائك", "btc", "سبيكه", "سام", "لازوردي", "سويس", "سويسري"],
    "جنيهات ذهب": ["جنيه", "جنيهات", "نصف جنيه", "ربع جنيه", "جورج"],
    "كسر ومستعمل": ["كسر", "مستعمل", "قديم", "سقط"],
}

def normalize_ar(text: str) -> str:
    if not text:
        return ""
    text = str(text).strip().lower()
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    clean = [c for c in text if c.isalnum() or c.isspace()]
    return "".join(clean)

def get_synonym_group(text: str):
    norm = normalize_ar(text)
    matched_groups = set()
    for main_cat, syns in JEWELRY_SYNONYMS.items():
        if normalize_ar(main_cat) in norm:
            matched_groups.add(main_cat)
            continue
        for s in syns:
            if s in norm:
                matched_groups.add(main_cat)
                break
    return matched_groups

# ---------- Invoice side effects ----------
def apply_invoice_inventory_effects(db, shop_id, invoice, payload_items):
    """
    sale    -> deducts sold weight from stock piece / batch, or auto-matches by karat & category.
    buyback -> purchased pieces enter the scrap section automatically.
    """
    moved = 0
    for payload, db_item in zip(payload_items, invoice.items):
        inventory_id = payload.get("inventory_item_id")
        sold_net = float(db_item.net_weight or 0.0)
        sold_gross = float(db_item.gross_weight or sold_net)
        sold_karat = int(db_item.karat or 21)

        if invoice.invoice_type == "sale":
            remaining_net = sold_net
            remaining_gross = sold_gross

            # 1. إذا كان تم اختيار قطعة بعينها من المخزن
            if inventory_id:
                specific = (
                    db.query(InventoryItem)
                    .filter(
                        InventoryItem.id == inventory_id,
                        InventoryItem.shop_id == shop_id,
                        InventoryItem.status == "in_stock",
                    )
                    .first()
                )
                if specific:
                    cur_net = float(specific.net_weight or 0.0)
                    cur_gross = float(specific.gross_weight or cur_net)
                    if cur_net <= remaining_net + 0.005:
                        specific.status = "sold"
                        specific.sold_invoice_id = invoice.id
                        specific.sold_price = round(cur_net * (db_item.price_per_gram or 0.0), 2)
                        specific.sold_at = datetime.datetime.utcnow()
                        remaining_net = round(max(0.0, remaining_net - cur_net), 3)
                        remaining_gross = round(max(0.0, remaining_gross - cur_gross), 3)
                    else:
                        specific.net_weight = round(cur_net - remaining_net, 3)
                        specific.gross_weight = round(max(specific.net_weight, cur_gross - remaining_gross), 3)
                        sold_part = InventoryItem(
                            shop_id=shop_id,
                            type_id=specific.type_id,
                            type_name=specific.type_name,
                            section=specific.section,
                            status="sold",
                            name=f"{db_item.item_name or specific.name} (مباع)",
                            karat=specific.karat,
                            gross_weight=remaining_gross,
                            stones_weight=round(max(0.0, remaining_gross - remaining_net), 3),
                            net_weight=remaining_net,
                            purchase_price_per_gram=specific.purchase_price_per_gram,
                            purchase_total=round(remaining_net * (specific.purchase_price_per_gram or 0.0), 2),
                            workmanship_per_gram=db_item.workmanship_per_gram,
                            brand=specific.brand,
                            serial_number=specific.serial_number,
                            notes=f"مباع من رصيد #{specific.id} بالفاتورة #{invoice.invoice_number}",
                            source="sale",
                            sold_invoice_id=invoice.id,
                            sold_price=db_item.total_item_price,
                            sold_at=datetime.datetime.utcnow(),
                        )
                        db.add(sold_part)
                        remaining_net = 0.0
                        remaining_gross = 0.0

            # 2. إذا لم تحدد قطعة أو تبقى وزن للخصم، نبحث بذكاء في المخزن لنفس العيار
            if remaining_net > 0.001:
                item_name = db_item.item_name or ""
                target_groups = get_synonym_group(item_name)
                norm_item_name = normalize_ar(item_name)

                # كل قطع العيار المتاحة في المخزن
                all_stock = (
                    db.query(InventoryItem)
                    .filter(
                        InventoryItem.shop_id == shop_id,
                        InventoryItem.status == "in_stock",
                        InventoryItem.karat == sold_karat,
                        InventoryItem.net_weight > 0.001,
                    )
                    .all()
                )

                def item_score(stock_item):
                    score = 0
                    stock_type_norm = normalize_ar(stock_item.type_name or "")
                    stock_name_norm = normalize_ar(stock_item.name or "")
                    stock_groups = get_synonym_group(f"{stock_item.type_name} {stock_item.name}")

                    # تطابق تصنيف الصاغة (غوايش، خواتم، حلقان...)
                    if target_groups and (target_groups & stock_groups):
                        score += 50
                    # تطابق اسم أو كلمة
                    if norm_item_name and (norm_item_name in stock_name_norm or stock_name_norm in norm_item_name):
                        score += 30
                    if stock_type_norm and (stock_type_norm in norm_item_name or norm_item_name in stock_type_norm):
                        score += 20
                    # تفضيل الذهب الجديد على الكسر عند البيع
                    if stock_item.section == "new":
                        score += 10
                    return score

                sorted_candidates = sorted(all_stock, key=lambda s: (item_score(s), float(s.net_weight or 0.0)), reverse=True)

                for stock in sorted_candidates:
                    if remaining_net <= 0.001:
                        break
                    cur_net = float(stock.net_weight or 0.0)
                    cur_gross = float(stock.gross_weight or cur_net)

                    if cur_net <= remaining_net + 0.005:
                        # استهلاك كامل القطعة
                        stock.status = "sold"
                        stock.sold_invoice_id = invoice.id
                        stock.sold_price = round(cur_net * (db_item.price_per_gram or 0.0), 2)
                        stock.sold_at = datetime.datetime.utcnow()
                        remaining_net = round(max(0.0, remaining_net - cur_net), 3)
                        remaining_gross = round(max(0.0, remaining_gross - cur_gross), 3)
                    else:
                        # خصم جزئي من وزن القطعة
                        stock.net_weight = round(cur_net - remaining_net, 3)
                        stock.gross_weight = round(max(stock.net_weight, cur_gross - remaining_gross), 3)
                        sold_part = InventoryItem(
                            shop_id=shop_id,
                            type_id=stock.type_id,
                            type_name=stock.type_name,
                            section=stock.section,
                            status="sold",
                            name=f"{db_item.item_name or stock.name} (مباع)",
                            karat=stock.karat,
                            gross_weight=remaining_gross,
                            stones_weight=round(max(0.0, remaining_gross - remaining_net), 3),
                            net_weight=remaining_net,
                            purchase_price_per_gram=stock.purchase_price_per_gram,
                            purchase_total=round(remaining_net * (stock.purchase_price_per_gram or 0.0), 2),
                            workmanship_per_gram=db_item.workmanship_per_gram,
                            brand=stock.brand,
                            serial_number=stock.serial_number,
                            notes=f"مباع من رصيد #{stock.id} بالفاتورة #{invoice.invoice_number}",
                            source="sale",
                            sold_invoice_id=invoice.id,
                            sold_price=db_item.total_item_price,
                            sold_at=datetime.datetime.utcnow(),
                        )
                        db.add(sold_part)
                        remaining_net = 0.0
                        remaining_gross = 0.0
                        break

                # إذا لم يكن هناك رصيد في المخزن أو نفد الرصيد، نسجل عملية البيع المباشر في أرشيف المباع
                if remaining_net > 0.001:
                    direct_sold = InventoryItem(
                        shop_id=shop_id,
                        type_id=None,
                        type_name=payload.get("type_name") or "مبيعات مباشرة",
                        section="new",
                        status="sold",
                        name=f"{db_item.item_name} (بيع مباشر من الفاتورة)",
                        karat=sold_karat,
                        gross_weight=remaining_gross,
                        stones_weight=round(max(0.0, remaining_gross - remaining_net), 3),
                        net_weight=remaining_net,
                        purchase_price_per_gram=0.0,
                        purchase_total=0.0,
                        workmanship_per_gram=db_item.workmanship_per_gram,
                        brand=db_item.brand,
                        serial_number=db_item.serial_number,
                        notes=f"بيع مباشر بالفاتورة #{invoice.invoice_number}",
                        source="direct_sale",
                        sold_invoice_id=invoice.id,
                        sold_price=db_item.total_item_price,
                        sold_at=datetime.datetime.utcnow(),
                    )
                    db.add(direct_sold)

            moved += 1

        else:  # buyback -> scrap into inventory automatically!
            scrap_type = (
                db.query(JewelryType)
                .filter(JewelryType.shop_id == shop_id, JewelryType.name.ilike("%كسر%"))
                .first()
            )
            if not scrap_type:
                scrap_type = db.query(JewelryType).filter(JewelryType.shop_id == shop_id).first()

            scrap = InventoryItem(
                shop_id=shop_id,
                type_id=payload.get("type_id") or (scrap_type.id if scrap_type else None),
                type_name=payload.get("type_name") or (scrap_type.name if scrap_type else "كسر ومستعمل"),
                section="scrap",
                status="in_stock",
                name=db_item.item_name or f"كسر عيار {db_item.karat}",
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
                paid_from_cash=True,
                notes=f"شراء كسر من {invoice.customer_name} بالفاتورة #{invoice.invoice_number}",
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


def reconcile_past_invoices(db, shop_id=1):
    """تسوية وخصم الفواتير السابقة التي لم تُخصم من المخزن وتسجيل شراء الكسر"""
    try:
        # 1. تسوية المبيعات
        past_sales = db.query(Invoice).filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_type == "sale"
        ).all()
        for inv in past_sales:
            already_deducted = db.query(InventoryItem).filter(
                InventoryItem.shop_id == shop_id,
                InventoryItem.sold_invoice_id == inv.id
            ).first()
            if not already_deducted:
                payload_items = [
                    {
                        "inventory_item_id": getattr(item, "inventory_item_id", None),
                        "type_id": getattr(item, "type_id", None),
                        "type_name": getattr(item, "type_name", None),
                    }
                    for item in inv.items
                ]
                apply_invoice_inventory_effects(db, shop_id, inv, payload_items)

        # 2. تسوية شراء الكسر
        past_buybacks = db.query(Invoice).filter(
            Invoice.shop_id == shop_id,
            Invoice.invoice_type == "buyback"
        ).all()
        for inv in past_buybacks:
            already_in = db.query(InventoryItem).filter(
                InventoryItem.shop_id == shop_id,
                InventoryItem.source_invoice_id == inv.id
            ).first()
            if not already_in:
                payload_items = [
                    {
                        "inventory_item_id": None,
                        "type_id": getattr(item, "type_id", None),
                        "type_name": getattr(item, "type_name", None),
                    }
                    for item in inv.items
                ]
                apply_invoice_inventory_effects(db, shop_id, inv, payload_items)

        db.commit()
    except Exception as exc:
        print(f"[db] reconcile_past_invoices error: {exc}")
