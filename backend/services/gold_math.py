"""
Gold Math & Pricing Engine for Jewelry Shops and SaaS
Mathematical precision for Karat conversion, VAT, Workmanship, and Dual Inventory Balancing.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel

KARAT_PURITIES = {
    24: 1.000,
    21: 0.875,
    18: 0.750,
    14: 0.5833,
    9: 0.375
}

class GoldItemCalculation(BaseModel):
    karat: int
    gross_weight: float
    stones_weight: float = 0.0
    net_weight: float
    price_per_gram: float
    workmanship_per_gram: float = 0.0
    stamp_vat_per_gram: float = 0.0
    raw_gold_cost: float
    workmanship_cost: float
    stamp_vat_cost: float
    total_price: float
    equivalent_21k_grams: float
    equivalent_24k_grams: float

class BuybackItemCalculation(BaseModel):
    karat: int
    gross_weight: float
    stones_weight: float = 0.0
    net_weight: float
    buy_price_per_gram: float
    total_payout: float
    equivalent_21k_grams: float
    equivalent_24k_grams: float

def calculate_sale_item(
    karat: int,
    gross_weight: float,
    stones_weight: float,
    price_per_gram: float,
    workmanship_per_gram: float,
    stamp_vat_per_gram: float = 0.0,
    is_lump_sum_workmanship: bool = False,
    lump_sum_workmanship: float = 0.0
) -> GoldItemCalculation:
    """Calculate line item for a customer retail sale."""
    net_wt = max(0.0, round(gross_weight - stones_weight, 3))
    raw_gold = round(net_wt * price_per_gram, 2)
    
    if is_lump_sum_workmanship:
        workmanship = round(lump_sum_workmanship, 2)
    else:
        workmanship = round(net_wt * workmanship_per_gram, 2)
        
    stamp_vat = round(net_wt * stamp_vat_per_gram, 2)
    total = round(raw_gold + workmanship + stamp_vat, 2)
    
    purity = KARAT_PURITIES.get(karat, 0.875)
    eq_24 = round(net_wt * purity, 3)
    eq_21 = round((net_wt * purity) / 0.875, 3)
    
    return GoldItemCalculation(
        karat=karat,
        gross_weight=gross_weight,
        stones_weight=stones_weight,
        net_weight=net_wt,
        price_per_gram=price_per_gram,
        workmanship_per_gram=workmanship_per_gram,
        stamp_vat_per_gram=stamp_vat_per_gram,
        raw_gold_cost=raw_gold,
        workmanship_cost=workmanship,
        stamp_vat_cost=stamp_vat,
        total_price=total,
        equivalent_21k_grams=eq_21,
        equivalent_24k_grams=eq_24
    )

def calculate_buyback_item(
    karat: int,
    gross_weight: float,
    stones_weight: float,
    buy_price_per_gram: float
) -> BuybackItemCalculation:
    """Calculate purchase of scrap gold (كسر / مستعمل) from customer."""
    net_wt = max(0.0, round(gross_weight - stones_weight, 3))
    total = round(net_wt * buy_price_per_gram, 2)
    
    purity = KARAT_PURITIES.get(karat, 0.875)
    eq_24 = round(net_wt * purity, 3)
    eq_21 = round((net_wt * purity) / 0.875, 3)
    
    return BuybackItemCalculation(
        karat=karat,
        gross_weight=gross_weight,
        stones_weight=stones_weight,
        net_weight=net_wt,
        buy_price_per_gram=buy_price_per_gram,
        total_payout=total,
        equivalent_21k_grams=eq_21,
        equivalent_24k_grams=eq_24
    )

def convert_to_equivalent(weight_grams: float, from_karat: int, to_karat: int = 21) -> float:
    """Convert any gold weight between karats precisely."""
    from_purity = KARAT_PURITIES.get(from_karat, 0.875)
    to_purity = KARAT_PURITIES.get(to_karat, 0.875)
    return round((weight_grams * from_purity) / to_purity, 3)
