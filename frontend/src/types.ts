export type Role = 'super_admin' | 'shop_admin' | 'cashier';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  shop_id?: number | null;
  shop_name?: string;
}

export interface ShopInfo {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  commercial_record: string;
  tax_number: string;
  subscription_plan?: string;
  is_active?: boolean;
}

export interface GoldPrices {
  sell_24k: number;
  sell_21k: number;
  sell_18k: number;
  sell_14k: number;
  sell_pound: number;
  buy_24k: number;
  buy_21k: number;
  buy_18k: number;
  buy_14k: number;
  buy_pound: number;
  updated_at?: string;
}

export interface POSItem {
  id: string;
  item_name: string;
  karat: number;
  gross_weight: number;
  stones_weight: number;
  net_weight: number;
  price_per_gram: number;
  workmanship_per_gram: number;
  stamp_vat_per_gram: number;
  total_item_price: number;
  brand?: string;
  serial_number?: string;
}

export interface Invoice {
  id?: number;
  invoice_number: string;
  invoice_type: 'sale' | 'buyback';
  customer_name: string;
  customer_national_id?: string;
  customer_phone?: string;
  total_gross_weight: number;
  total_net_weight: number;
  equivalent_21k_weight: number;
  total_raw_gold_cost: number;
  total_workmanship: number;
  total_stamp_vat: number;
  discount: number;
  final_amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  items: POSItem[];
}

export interface VisionAnalysisResult {
  detected_type: 'national_id' | 'bullion_card' | 'hallmark' | 'invoice' | 'unknown';
  confidence_score: number;
  customer: {
    name: string | null;
    national_id: string | null;
    address: string | null;
  };
  gold_item: {
    brand: string | null;
    serial_number: string | null;
    karat: number;
    declared_weight: number;
    hallmark_text: string | null;
    hallmark_status: string;
    notes: string;
  };
  raw_text: string;
}

export interface StaffUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  pin_code?: string;
  is_active: boolean;
  created_at: string;
}

export interface SubscriberShop {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  commercial_record?: string;
  tax_number?: string;
  subscription_plan: string;
  is_active: boolean;
  total_invoices: number;
  total_staff: number;
  owner_username?: string;
  created_at: string;
}

export interface AuditReportData {
  title: string;
  period: 'day' | 'week' | 'month' | 'custom';
  start_date: string;
  end_date: string;
  total_invoices: number;
  sales_count: number;
  buybacks_count: number;
  financials: {
    total_sales_egp: number;
    total_buybacks_egp: number;
    total_workmanship_collected_egp: number;
    total_vat_collected_egp: number;
    net_cash_flow_egp: number;
  };
  gold_ledger: {
    sold_eq21_grams: number;
    bought_eq21_grams: number;
    net_weight_change_eq21_grams: number;
    karat_breakdown: Record<number, { sold_net_grams: number; bought_net_grams: number }>;
  };
}
