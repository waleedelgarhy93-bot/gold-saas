import type { GoldPrices, Invoice, VisionAnalysisResult, User, StaffUser, SubscriberShop, AuditReportData, ShopInfo } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://waleedelgarhy2.pythonanywhere.com/api';

export const defaultPrices: GoldPrices = {
  sell_24k: 4285,
  sell_21k: 3750,
  sell_18k: 3214,
  sell_14k: 2500,
  sell_pound: 30000,
  buy_24k: 4260,
  buy_21k: 3730,
  buy_18k: 3195,
  buy_14k: 2480,
  buy_pound: 29840,
};

export async function loginAPI(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.detail || 'بيانات الدخول غير صحيحة' };
  } catch (e) {
    console.warn('Backend login offline, fallback demo authentication:', e);
  }

  // Fallback demo users if offline
  if (username === 'superadmin' && password === '123') {
    return {
      success: true,
      user: {
        id: 1,
        name: 'أ/ وليد المقدم (سوبر أدمن)',
        username: 'superadmin',
        role: 'super_admin',
        shop_name: 'منصة الصاغة السحابية (النظام الرئيسي)'
      }
    };
  } else if (username === 'admin' && password === '123') {
    return {
      success: true,
      user: {
        id: 2,
        name: 'أ/ وليد المقدم (صاحب المحل)',
        username: 'admin',
        role: 'shop_admin',
        shop_id: 1,
        shop_name: 'مجوهرات الأمانة الذهبية'
      }
    };
  } else if (username === 'cashier' && password === '123') {
    return {
      success: true,
      user: {
        id: 3,
        name: 'محمود المصري (مساعد كاشير)',
        username: 'cashier',
        role: 'cashier',
        shop_id: 1,
        shop_name: 'مجوهرات الأمانة الذهبية'
      }
    };
  }
  return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
}

export async function fetchShopInfo(): Promise<ShopInfo> {
  try {
    const res = await fetch(`${API_BASE}/shop`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend fetchShopInfo offline:', e);
  }
  const saved = localStorage.getItem('gold_shop_info');
  return saved ? JSON.parse(saved) : {
    id: 1,
    name: 'مجوهرات الأمانة الذهبية',
    owner_name: 'أ/ وليد المقدم',
    phone: '01012345678',
    address: 'شارع الصاغة، سمالوط، المنيا',
    commercial_record: '45892',
    tax_number: '100-245-889',
    subscription_plan: 'الباقة الماسية (سنوي)',
    is_active: true,
  };
}

export async function updateShopInfoAPI(shopData: {
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  commercial_record: string;
  tax_number: string;
}): Promise<boolean> {
  localStorage.setItem('gold_shop_info', JSON.stringify(shopData));
  try {
    const res = await fetch(`${API_BASE}/shop`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData),
    });
    return res.ok;
  } catch (e) {
    console.warn('Backend updateShopInfo offline:', e);
    return true;
  }
}

export async function changeUserPasswordAPI(userId: number, newPassword: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/user/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, new_password: newPassword }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Backend changePassword offline:', e);
    return true;
  }
}

export async function fetchGoldPrices(): Promise<GoldPrices> {
  try {
    const res = await fetch(`${API_BASE}/prices`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend not responding, using stored prices:', e);
  }
  const saved = localStorage.getItem('gold_prices');
  return saved ? JSON.parse(saved) : defaultPrices;
}

export async function saveGoldPrices(prices: GoldPrices): Promise<GoldPrices> {
  localStorage.setItem('gold_prices', JSON.stringify(prices));
  try {
    const res = await fetch(`${API_BASE}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices),
    });
    if (res.ok) {
      const data = await res.json();
      return data.prices;
    }
  } catch (e) {
    console.warn('Backend not responding, saved locally:', e);
  }
  return prices;
}

export async function createInvoiceAPI(invoiceData: any): Promise<Invoice> {
  try {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend not responding, saving invoice in local storage:', e);
  }

  const now = new Date();
  const prefix = invoiceData.invoice_type === 'sale' ? 'INV-S' : 'INV-B';
  const code = `${prefix}-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const savedInv: Invoice = {
    ...invoiceData,
    id: Date.now(),
    invoice_number: code,
    created_at: now.toISOString(),
  };

  const stored = JSON.parse(localStorage.getItem('gold_invoices') || '[]');
  stored.unshift(savedInv);
  localStorage.setItem('gold_invoices', JSON.stringify(stored));
  return savedInv;
}

export async function fetchInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch(`${API_BASE}/invoices`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend not responding, loading local invoices:', e);
  }
  return JSON.parse(localStorage.getItem('gold_invoices') || '[]');
}

export async function fetchAuditReportAPI(
  period: string = 'day',
  startDate?: string,
  endDate?: string
): Promise<AuditReportData | null> {
  try {
    let url = `${API_BASE}/reports/audit?period=${period}`;
    if (startDate && endDate) {
      url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend audit API offline:', e);
  }
  return null;
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  try {
    const res = await fetch(`${API_BASE}/users`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend fetchStaffUsers offline:', e);
  }
  return [
    { id: 2, name: 'أ/ وليد المقدم (صاحب المحل)', username: 'admin', role: 'shop_admin', is_active: true, created_at: new Date().toISOString() },
    { id: 3, name: 'محمود المصري (مساعد كاشير)', username: 'cashier', role: 'cashier', pin_code: '2222', is_active: true, created_at: new Date().toISOString() },
  ];
}

export async function createStaffUser(data: { name: string; username: string; password: string; role: string; pin_code?: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.warn('Error creating staff user:', e);
    return false;
  }
}

export async function deleteStaffUser(userId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.warn('Error deleting staff user:', e);
    return false;
  }
}

export async function fetchSubscriberShops(): Promise<SubscriberShop[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/shops`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend fetchSubscriberShops offline:', e);
  }
  return [
    { id: 1, name: 'مجوهرات الأمانة الذهبية', owner_name: 'أ/ وليد المقدم', phone: '01012345678', address: 'المنيا - سمالوط', subscription_plan: 'الباقة الماسية (سنوي)', is_active: true, total_invoices: 12, total_staff: 3, owner_username: 'admin', created_at: '2026-01-15' },
    { id: 2, name: 'مجوهرات الزمرد والذهب', owner_name: 'حاج إبراهيم رضوان', phone: '01122334455', address: 'المنيا - شارع التجارة', subscription_plan: 'باقة البريميوم (شهري)', is_active: true, total_invoices: 45, total_staff: 4, owner_username: 'radwan_gold', created_at: '2026-02-10' },
    { id: 3, name: 'صاغة النيل الجديدة', owner_name: 'كيرلس سمير', phone: '01299887766', address: 'أسيوط - الصاغة', subscription_plan: 'الباقة الماسية (سنوي)', is_active: true, total_invoices: 89, total_staff: 5, owner_username: 'nile_gold', created_at: '2026-03-01' },
  ];
}

export async function adminUpdateShopAPI(shopId: number, data: {
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  subscription_plan: string;
  is_active: boolean;
  owner_new_password?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/shops/${shopId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.warn('Backend adminUpdateShopAPI offline:', e);
    return true;
  }
}

export async function adminCreateShopAPI(data: {
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  subscription_plan: string;
  admin_username: string;
  admin_password: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.warn('Backend adminCreateShopAPI offline:', e);
    return false;
  }
}

export async function analyzeImageAPI(file: File, apiKey?: string): Promise<{ success: boolean; data?: VisionAnalysisResult; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (apiKey) formData.append('api_key', apiKey);

    const res = await fetch(`${API_BASE}/vision/analyze`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend vision failed or offline:', e);
  }
  return {
    success: false,
    error: 'تعذر الاتصال بخادم الذكاء الاصطناعي، يرجى التأكد من تشغيل الـ Backend وإدخال مفتاح Gemini API'
  };
}
