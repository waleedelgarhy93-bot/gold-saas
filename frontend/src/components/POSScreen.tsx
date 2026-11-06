import React, { useState, useEffect } from 'react';
import type { GoldPrices, POSItem, Invoice, InventoryItem, ShopInfo } from '../types';
import { 
  Plus, Trash2, ShoppingBag, ArrowDownLeft, Camera, Printer, 
  Send, Sparkles, User, CheckCircle2, Package, Phone, X, Search, FileDown
} from 'lucide-react';
import { createInvoiceAPI, fetchInventory } from '../api';
import { downloadInvoicePDF, sendInvoiceViaWhatsApp } from '../utils/pdfGenerator';

interface POSScreenProps {
  prices: GoldPrices;
  onOpenAIScanner: (mode: 'id' | 'bullion') => void;
  scannedCustomer?: { name: string | null; national_id: string | null };
  scannedItem?: { brand: string | null; serial_number: string | null; karat: number; declared_weight: number };
  onInvoiceSaved?: (invoice: Invoice) => void;
  shopInfo?: ShopInfo | null;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  prices,
  onOpenAIScanner,
  scannedCustomer,
  scannedItem,
  onInvoiceSaved,
  shopInfo,
}) => {
  const [invoiceType, setInvoiceType] = useState<'sale' | 'buyback'>('sale');
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);

  // Default Item in progress
  const [itemName, setItemName] = useState('غويشة عيار 21');
  const [karat, setKarat] = useState<number>(21);
  const [grossWeight, setGrossWeight] = useState<string>('10.0');
  const [stonesWeight, setStonesWeight] = useState<string>('0.0');
  const [workmanship, setWorkmanship] = useState<string>('120'); // 120 EGP per gram default
  const [stampVat, setStampVat] = useState<string>('25'); // 25 EGP per gram default

  const [items, setItems] = useState<POSItem[]>([]);

  // Direct price override per gram (empty = use app prices)
  const [priceInput, setPriceInput] = useState('');
  // Paid / remaining
  const [paidInput, setPaidInput] = useState('');

  // Stock picker
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSection, setPickerSection] = useState<'new' | 'scrap'>('new');
  const [pickerItems, setPickerItems] = useState<InventoryItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedStock, setSelectedStock] = useState<InventoryItem | null>(null);

  // Update customer when scanned from AI
  useEffect(() => {
    if (scannedCustomer) {
      if (scannedCustomer.name) setCustomerName(scannedCustomer.name);
      if (scannedCustomer.national_id) setCustomerNationalId(scannedCustomer.national_id);
    }
  }, [scannedCustomer]);

  // Update item when scanned from Bullion AI
  useEffect(() => {
    if (scannedItem) {
      setItemName(`${scannedItem.brand || 'سبيكة'} ${scannedItem.declared_weight}g`);
      setKarat(scannedItem.karat || 24);
      setGrossWeight(scannedItem.declared_weight?.toString() || '10.0');
      setStonesWeight('0.0');
      setWorkmanship('65'); // Standard bullion workmanship
      setStampVat('20');
    }
  }, [scannedItem]);

  // Price per gram according to Karat and Mode
  const getPricePerGram = (k: number, mode: 'sale' | 'buyback') => {
    if (mode === 'sale') {
      switch (k) {
        case 24: return prices.sell_24k;
        case 21: return prices.sell_21k;
        case 18: return prices.sell_18k;
        case 14: return prices.sell_14k;
        default: return prices.sell_21k;
      }
    } else {
      switch (k) {
        case 24: return prices.buy_24k;
        case 21: return prices.buy_21k;
        case 18: return prices.buy_18k;
        case 14: return prices.buy_14k;
        default: return prices.buy_21k;
      }
    }
  };

  const defaultUnitPrice = getPricePerGram(karat, invoiceType);
  const effectiveUnitPrice = priceInput.trim() !== '' ? (parseFloat(priceInput) || 0) : defaultUnitPrice;

  const loadPickerItems = async (section: 'new' | 'scrap', term: string) => {
    setPickerLoading(true);
    const data = await fetchInventory({ section, status: 'in_stock', q: term || undefined });
    setPickerItems(data);
    setPickerLoading(false);
  };

  const openStockPicker = async (section: 'new' | 'scrap') => {
    setPickerSection(section);
    setPickerSearch('');
    setIsPickerOpen(true);
    await loadPickerItems(section, '');
  };

  const chooseStockItem = (item: InventoryItem) => {
    setSelectedStock(item);
    setItemName(item.name);
    setKarat(item.karat);
    setGrossWeight(String(item.gross_weight));
    setStonesWeight(String(item.stones_weight || 0));
    if (invoiceType === 'sale' && item.workmanship_per_gram) {
      setWorkmanship(String(item.workmanship_per_gram));
    }
    setPriceInput('');
    setIsPickerOpen(false);
  };

  const canUseContacts = typeof navigator !== 'undefined' && 'contacts' in navigator;

  const pickPhoneFromContacts = async () => {
    const nav = navigator as unknown as {
      contacts?: { select: (props: string[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> };
    };
    if (!nav.contacts?.select) {
      alert('متصفح الجهاز لا يدعم اختيار جهة اتصال. اكتب الرقم يدوياً.');
      return;
    }
    try {
      const [contact] = await nav.contacts.select(['name', 'tel'], { multiple: false });
      if (contact?.tel?.length) {
        setCustomerPhone(contact.tel[0].replace(/\s+/g, ''));
      }
      if (contact?.name?.length && (!customerName || customerName === 'عميل نقدي')) {
        setCustomerName(contact.name[0]);
      }
    } catch {
      // user cancelled the contact picker
    }
  };

  const handleAddItem = () => {
    const gross = parseFloat(grossWeight) || 0;
    const stones = parseFloat(stonesWeight) || 0;
    const net = Math.max(0, parseFloat((gross - stones).toFixed(3)));
    const pricePerGram = effectiveUnitPrice;
    const work = invoiceType === 'sale' ? (parseFloat(workmanship) || 0) : 0;
    const vat = invoiceType === 'sale' ? (parseFloat(stampVat) || 0) : 0;

    const rawCost = net * pricePerGram;
    const workCost = net * work;
    const vatCost = net * vat;
    const totalLine = parseFloat((rawCost + workCost + vatCost).toFixed(2));

    const newItem: POSItem = {
      id: Math.random().toString(36).substring(2, 9),
      item_name: itemName,
      karat,
      gross_weight: gross,
      stones_weight: stones,
      net_weight: net,
      price_per_gram: pricePerGram,
      workmanship_per_gram: work,
      stamp_vat_per_gram: vat,
      total_item_price: totalLine,
      inventory_item_id: selectedStock?.id,
      type_id: selectedStock?.type_id || undefined,
      type_name: selectedStock?.type_name || undefined,
      brand: selectedStock?.brand || undefined,
      serial_number: selectedStock?.serial_number || undefined,
    };

    setItems([...items, newItem]);
    // Reset weights
    setGrossWeight('');
    setStonesWeight('0.0');
    setSelectedStock(null);
    setPriceInput('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  // Calculations for current invoice
  const totalGrossWeight = items.reduce((acc, i) => acc + i.gross_weight, 0);
  const totalNetWeight = items.reduce((acc, i) => acc + i.net_weight, 0);
  const totalRawGold = items.reduce((acc, i) => acc + (i.net_weight * i.price_per_gram), 0);
  const totalWorkmanship = items.reduce((acc, i) => acc + (i.net_weight * i.workmanship_per_gram), 0);
  const totalStampVat = items.reduce((acc, i) => acc + (i.net_weight * i.stamp_vat_per_gram), 0);
  const subtotal = totalRawGold + totalWorkmanship + totalStampVat;
  const finalTotal = Math.max(0, subtotal - discount);
  const effectivePaid = paidInput.trim() === ''
    ? finalTotal
    : Math.max(0, Math.min(parseFloat(paidInput) || 0, finalTotal));
  const remainingAmount = Math.max(0, finalTotal - effectivePaid);

  // Calculate equivalent in 21k
  const equivalent21k = items.reduce((acc, i) => {
    const purity = i.karat === 24 ? 1.0 : i.karat === 21 ? 0.875 : i.karat === 18 ? 0.75 : 0.5833;
    return acc + (i.net_weight * purity / 0.875);
  }, 0);

  const [pdfDownloading, setPdfDownloading] = useState(false);

  const handleDownloadInvoicePDF = async () => {
    if (!successInvoice) return;
    setPdfDownloading(true);
    try {
      await downloadInvoicePDF('half-a4-invoice-receipt', successInvoice.invoice_number);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleSaveInvoice = async (printImmediately = true): Promise<Invoice | null> => {
    if (items.length === 0) {
      alert('من فضلك أضف صنفاً واحداً على الأقل للفاتورة');
      return null;
    }

    if (invoiceType === 'buyback' && !customerNationalId) {
      const confirmProceed = confirm('تنبيه أمني وقانوني: لم تسجل الرقم القومي للعميل في فاتورة شراء الكسر! هل تريد المتابعة بدون رقم قومي؟');
      if (!confirmProceed) return null;
    }

    const payload = {
      invoice_type: invoiceType,
      customer_name: customerName,
      customer_national_id: customerNationalId || null,
      customer_phone: customerPhone || null,
      payment_method: paymentMethod,
      paid_amount: paidInput.trim() === '' ? undefined : effectivePaid,
      discount,
      notes,
      items: items.map(i => ({
        item_name: i.item_name,
        karat: i.karat,
        gross_weight: i.gross_weight,
        stones_weight: i.stones_weight,
        price_per_gram: i.price_per_gram,
        workmanship_per_gram: i.workmanship_per_gram,
        stamp_vat_per_gram: i.stamp_vat_per_gram,
        brand: i.brand,
        serial_number: i.serial_number,
        inventory_item_id: i.inventory_item_id,
        type_id: i.type_id,
        type_name: i.type_name,
      })),
    };

    try {
      const saved = await createInvoiceAPI(payload);
      setSuccessInvoice(saved);
      if (onInvoiceSaved) {
        onInvoiceSaved(saved);
      }

      if (printImmediately) {
        setTimeout(() => window.print(), 300);
      }
      return saved;
    } catch (e) {
      console.error('Error saving invoice:', e);
      return null;
    }
  };

  const handleWhatsAppSend = async () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let waWindow: Window | null = null;
    if (!isMobile) {
      try {
        waWindow = window.open('about:blank', '_blank');
      } catch {
        waWindow = null;
      }
    }

    // 1. If invoice is already saved and shown in banner
    if (successInvoice) {
      const invToSend = {
        ...successInvoice,
        customer_phone: successInvoice.customer_phone || customerPhone || undefined,
      };
      sendInvoiceViaWhatsApp(invToSend, shopInfo, waWindow);
      return;
    }

    // 2. If no items
    if (items.length === 0) {
      if (waWindow) waWindow.close();
      alert('من فضلك أضف صنفاً واحداً على الأقل للفاتورة أولاً');
      return;
    }

    // 3. Save invoice first
    let savedInvoice: Invoice | null = null;
    try {
      savedInvoice = await handleSaveInvoice(false);
    } catch (e) {
      console.warn('Error saving before WhatsApp:', e);
    }

    // 4. Fallback invoice object so WhatsApp NEVER fails
    const targetInvoice: Invoice = savedInvoice || {
      invoice_number: `INV-${Date.now().toString().slice(-4)}`,
      invoice_type: invoiceType,
      customer_name: customerName || 'عميل نقدي',
      customer_phone: customerPhone || undefined,
      customer_national_id: customerNationalId || undefined,
      total_gross_weight: totalGrossWeight,
      total_net_weight: totalNetWeight,
      equivalent_21k_weight: equivalent21k,
      total_raw_gold_cost: totalRawGold,
      total_workmanship: totalWorkmanship,
      total_stamp_vat: totalStampVat,
      discount: discount,
      final_amount: finalTotal,
      paid_amount: effectivePaid,
      remaining_amount: remainingAmount,
      payment_method: paymentMethod,
      items: items.map(i => ({
        id: String(i.id),
        item_name: i.item_name,
        karat: i.karat,
        gross_weight: i.gross_weight,
        stones_weight: i.stones_weight,
        net_weight: i.net_weight,
        price_per_gram: i.price_per_gram,
        workmanship_per_gram: i.workmanship_per_gram,
        stamp_vat_per_gram: i.stamp_vat_per_gram,
        total_item_price: i.total_item_price,
        brand: i.brand,
      })),
      created_at: new Date().toISOString(),
    };

    sendInvoiceViaWhatsApp(targetInvoice, shopInfo, waWindow);
  };

  const handleReset = () => {
    setItems([]);
    setSuccessInvoice(null);
    setDiscount(0);
    setNotes('');
    setCustomerName('عميل نقدي');
    setCustomerNationalId('');
    setCustomerPhone('');
    setPaidInput('');
    setSelectedStock(null);
    setPriceInput('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Success Notification Bar */}
      {successInvoice && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="font-bold text-sm">تم حفظ الفاتورة بنجاح: {successInvoice.invoice_number}</p>
              <p className="text-xs text-amber-300 font-medium">
                {successInvoice.invoice_type === 'sale'
                  ? '✨ تم خصم وزن الذهب المباع تلقائياً من رصيد المخزن'
                  : '✨ تم إضافة الذهب الكسر المشترى تلقائياً إلى مخزن الكسر والمستعمل'}
              </p>
              <p className="text-xs text-emerald-300/80">
                المعادل الذهبي: {successInvoice.equivalent_21k_weight} جرام عيار 21
                {(successInvoice.remaining_amount || 0) > 0 && (
                  <span className="text-rose-300"> • الباقي: {(successInvoice.remaining_amount || 0).toLocaleString()} ج.م</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow"
              title="طباعة الفاتورة بنظام نصف صفحة A4 المعتمد"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة (نصف A4)</span>
            </button>
            <button
              onClick={handleDownloadInvoicePDF}
              disabled={pdfDownloading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-1.5 rounded-lg text-xs border border-amber-500/40 transition cursor-pointer disabled:opacity-50"
              title="تحميل الفاتورة كملف PDF رسمي بحجم نصف A4"
            >
              <FileDown className="w-4 h-4" />
              <span>{pdfDownloading ? 'جارٍ التحميل...' : 'تحميل PDF'}</span>
            </button>
            <button
              onClick={handleWhatsAppSend}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow"
              title="إرسال الفاتورة عبر واتساب مباشرة للعميل"
            >
              <Send className="w-4 h-4" />
              <span>واتساب</span>
            </button>
            <button
              onClick={handleReset}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              فاتورة جديدة
            </button>
          </div>
        </div>
      )}

      {/* Mode Selector Tabs (Sale vs Buyback) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => { setInvoiceType('sale'); setPriceInput(''); setSelectedStock(null); }}
            className={`flex items-center justify-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer text-center ${
              invoiceType === 'sale'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <div className="text-right">
              <span className="block leading-tight font-extrabold">فاتورة بيع ذهب للزبون</span>
              <span className="text-[10px] opacity-75 font-normal">بيع مصوغات (خصم من المخزن)</span>
            </div>
          </button>

          <button
            onClick={() => { setInvoiceType('buyback'); setPriceInput(''); setSelectedStock(null); }}
            className={`flex items-center justify-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer text-center ${
              invoiceType === 'buyback'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                : 'text-emerald-400 hover:text-white hover:bg-slate-800 border border-emerald-500/30'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <div className="text-right">
              <span className="block leading-tight font-extrabold flex items-center gap-1.5">
                <span>منفذ شراء كسر من عميل</span>
                <span className="text-[9px] bg-emerald-400/30 text-emerald-100 px-1.5 py-0.2 rounded font-sans">إيداع للمخزن</span>
              </span>
              <span className="text-[10px] opacity-90 font-normal">المحل يشتري كسر (يُضاف للمخزن فوراً)</span>
            </div>
          </button>
        </div>

        {/* AI Quick Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onOpenAIScanner('id')}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer"
            title="التقاط بطاقة الرقم القومي بكاميرا الموبايل أو الكاشير"
          >
            <Camera className="w-4 h-4 text-amber-400 shrink-0" />
            <span>مسح الهوية</span>
          </button>

          <button
            onClick={() => onOpenAIScanner('bullion')}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer"
            title="فحص كارت السبيكة (BTC, لازوردي) وقراءة السيريال والوزن"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>فحص سبيكة</span>
          </button>
        </div>
      </div>

      {invoiceType === 'buyback' && (
        <div className="bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 border border-emerald-500/40 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-base shrink-0">
              📥
            </span>
            <div>
              <p className="font-bold text-sm text-emerald-300">منفذ شراء كسر معتمد من الزبائن</p>
              <p className="text-[11px] text-emerald-400/80">
                الذهب الكسر المشترى يُضاف تلقائياً لمخزن الكسر والمستعمل بالمحل فور حفظ الفاتورة، ويتم تسجيل المصروفات بالدرج لحساب الأرباح بدقة.
              </p>
            </div>
          </div>
          <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-mono font-bold text-xs shrink-0">
            ✓ يضاف للمخزن تلقائياً
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Item Builder (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <span>بيانات العميل</span>
              {invoiceType === 'buyback' && (
                <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-normal">
                  (مطلوب إلزامياً في شراء الكسر لحماية المحل قانونياً)
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="عميل نقدي"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">الرقم القومي (14 رقم)</label>
                <input
                  type="text"
                  value={customerNationalId}
                  onChange={(e) => setCustomerNationalId(e.target.value)}
                  placeholder="2950101..."
                  maxLength={14}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none ${
                    invoiceType === 'buyback' && !customerNationalId
                      ? 'border-rose-500/50 bg-rose-950/20'
                      : 'border-slate-700 focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">رقم الموبايل (واتساب)</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010..."
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  {canUseContacts && (
                    <button
                      type="button"
                      onClick={pickPhoneFromContacts}
                      title="اختيار الرقم من جهات اتصال الهاتف"
                      className="shrink-0 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 rounded-xl cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-emerald-400/70 mt-1">العميل بيتسجل تلقائياً في سجل العملاء</p>
              </div>
            </div>
          </div>

          {/* Item Input Card */}
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>إضافة صنف للفاتورة</span>
              </h3>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => { setItemName('غويشة عيار 21'); setKarat(21); setWorkmanship('110'); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-[11px] cursor-pointer"
                >
                  غويشة 21
                </button>
                <button
                  type="button"
                  onClick={() => { setItemName('خاتم لازوردي 18'); setKarat(18); setWorkmanship('150'); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-[11px] cursor-pointer"
                >
                  خاتم 18
                </button>
                <button
                  type="button"
                  onClick={() => { setItemName('سبيكة BTC 10g عيار 24'); setKarat(24); setGrossWeight('10.0'); setWorkmanship('65'); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-[11px] cursor-pointer"
                >
                  سبيكة BTC
                </button>
                <button
                  type="button"
                  onClick={() => { setItemName('جنيه ذهب 8g عيار 21'); setKarat(21); setGrossWeight('8.0'); setWorkmanship('60'); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-[11px] cursor-pointer"
                >
                  جنيه ذهب
                </button>
              </div>
            </div>

            {invoiceType === 'sale' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">ربط بقطعة من المخزن:</span>
                  <button
                    type="button"
                    onClick={() => openStockPicker('new')}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>📦 اختيار قطعة من المخزن</span>
                  </button>
                  {selectedStock && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg text-xs">
                      <Package className="w-3.5 h-3.5" />
                      <span className="font-bold">{selectedStock.name}</span>
                      <span className="font-mono">{selectedStock.net_weight.toFixed(2)}g</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStock(null)}
                        className="text-amber-200/70 hover:text-white cursor-pointer"
                        title="إلغاء الاختيار"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {selectedStock ? (
                  <p className="text-[10px] text-emerald-400">
                    ✓ تم ربط القطعة: سيتم خصمها من المخزن ونقلها للمباع فور حفظ الفاتورة.
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                    <span>⚡</span>
                    <span>خصم ذكي: يتم خصم الوزن تلقائياً من رصيد عيار {karat} في المخزن فور حفظ الفاتورة.</span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">اسم ووصف الصنف</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: خاتم سوليتير، إسورة، سبيكة..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">العيار</label>
                <select
                  value={karat}
                  onChange={(e) => setKarat(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value={24}>عيار 24 (999.9)</option>
                  <option value={21}>عيار 21 (875)</option>
                  <option value={18}>عيار 18 (750)</option>
                  <option value={14}>عيار 14 (583)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  سعر الجرام ({invoiceType === 'sale' ? 'بيع' : 'شراء'})
                </label>
                <input
                  type="number"
                  step="1"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder={defaultUnitPrice.toFixed(0)}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] mt-1 text-slate-500">
                  {priceInput.trim() !== ''
                    ? `سعر معدّل يدوياً (الأساسي ${defaultUnitPrice.toLocaleString()} ج.م)`
                    : `سعر التطبيق الحالي • يمكن تعديله مباشرة`}
                </p>
              </div>
            </div>

            {/* Weights and Workmanship */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <label className="block text-xs text-amber-300 font-medium mb-1">الوزن القائم (جرام)</label>
                <input
                  type="number"
                  step="0.01"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-base font-bold font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">خصم فصوص/شوائب (g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={stonesWeight}
                  onChange={(e) => setStonesWeight(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {invoiceType === 'sale' ? (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">المصنعية للجرام (ج.م)</label>
                    <input
                      type="number"
                      step="1"
                      value={workmanship}
                      onChange={(e) => setWorkmanship(e.target.value)}
                      placeholder="120"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">الدمغة والقيمة المضافة (ج.م)</label>
                    <input
                      type="number"
                      step="1"
                      value={stampVat}
                      onChange={(e) => setStampVat(e.target.value)}
                      placeholder="25"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center justify-center p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  شراء كسر: يتم الحساب على الوزن الصافي فقط دون مصنعية أو دمغة
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إضافة الصنف للقائمة</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300">قائمة أصناف الفاتورة ({items.length})</h3>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                لم يتم إضافة أصناف بعد. أدخل بيانات القطعة واضغط "إضافة الصنف".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">العيار</th>
                      <th className="p-3">الوزن الصافي</th>
                      <th className="p-3">سعر الجرام</th>
                      {invoiceType === 'sale' && <th className="p-3">مصنعية+دمغة</th>}
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-sans font-medium text-slate-200">{item.item_name}</td>
                        <td className="p-3 text-amber-400 font-bold">عيار {item.karat}</td>
                        <td className="p-3 text-slate-200">{item.net_weight.toFixed(3)} g</td>
                        <td className="p-3 text-slate-300">{item.price_per_gram.toLocaleString()}</td>
                        {invoiceType === 'sale' && (
                          <td className="p-3 text-slate-400">
                            {(item.workmanship_per_gram + item.stamp_vat_per_gram).toFixed(0)} ج/g
                          </td>
                        )}
                        <td className="p-3 font-bold text-amber-300">
                          {item.total_item_price.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invoice Totals & Checkout (1 col) */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-5 border border-amber-900/30 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-amber-300 flex items-center justify-between border-b border-amber-900/40 pb-3">
              <span>ملخص وحسابات الفاتورة</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-mono">
                {invoiceType === 'sale' ? 'فاتورة مبيعات' : 'فاتورة شراء كسر'}
              </span>
            </h3>

            {/* Weights Summary */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>إجمالي الوزن القائم:</span>
                <span className="font-mono text-slate-200 font-bold">{totalGrossWeight.toFixed(3)} جرام</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>إجمالي الوزن الصافي:</span>
                <span className="font-mono text-amber-400 font-bold text-sm">{totalNetWeight.toFixed(3)} جرام</span>
              </div>
              <div className="flex justify-between text-emerald-400/90 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">
                <span>المعادل لعيار 21 (للميزان):</span>
                <span className="font-mono font-bold">{equivalent21k.toFixed(3)} جرام</span>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Financial Breakdown */}
            <div className="space-y-2 text-xs">
              {invoiceType === 'buyback' && (
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي قيمة الكسر المشترى:</span>
                  <span className="font-mono text-emerald-300 font-bold">{totalRawGold.toLocaleString()} ج.م</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">الخصم / التقريب:</span>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-right text-rose-300 focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            {/* Final Big Total */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/20 to-amber-500/10 p-4 rounded-xl border border-amber-500/30 text-center space-y-1">
              <span className="text-xs text-amber-400 font-medium">
                {invoiceType === 'sale' ? 'المبلغ المطلوب تحصيله' : 'المبلغ المدفوع للزبون'}
              </span>
              <div className="text-2xl font-black text-amber-300 font-mono tracking-tight">
                {finalTotal.toLocaleString()} <span className="text-sm font-sans font-normal">جنيه مصري</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">طريقة الدفع</label>
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                {['cash', 'visa', 'transfer', 'credit'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg font-medium border transition cursor-pointer ${
                      paymentMethod === m
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {m === 'cash' ? 'نقدي' : m === 'visa' ? 'فيزا' : m === 'transfer' ? 'تحويل' : 'آجل'}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid / Remaining */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-slate-400">المسدد</label>
                <input
                  type="number"
                  step="0.01"
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  placeholder={finalTotal.toFixed(2)}
                  className="w-32 bg-slate-900 border border-emerald-500/40 rounded-lg px-2 py-1.5 text-xs font-mono text-right text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">الباقي على العميل</span>
                <span className={`font-mono font-bold text-sm ${remainingAmount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {remainingAmount.toLocaleString()} ج.م
                </span>
              </div>
              {paidInput.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setPaidInput('')}
                  className="text-[10px] text-amber-400/80 hover:text-amber-300 cursor-pointer"
                >
                  مسدد بالكامل (إلغاء التقسيط)
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveInvoice(true)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>حفظ وطباعة الفاتورة</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                <Send className="w-4 h-4" />
                <span>إرسال الفاتورة عبر واتساب</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Picker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span>اختيار قطعة من مخزن {pickerSection === 'new' ? 'الجديد' : 'الكسر'}</span>
              </h2>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => {
                    setPickerSearch(e.target.value);
                    loadPickerItems(pickerSection, e.target.value);
                  }}
                  placeholder="بحث بالاسم أو النوع..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={() => openStockPicker(pickerSection === 'new' ? 'scrap' : 'new')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 rounded-xl text-xs cursor-pointer"
              >
                {pickerSection === 'new' ? 'الكسر' : 'الجديد'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {pickerLoading ? (
                <p className="text-center text-slate-500 text-sm py-8">جارٍ التحميل...</p>
              ) : pickerItems.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">لا توجد قطع متاحة في هذا الفرع</p>
              ) : (
                pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseStockItem(item)}
                    className="w-full text-right bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-100 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.type_name || 'بدون نوع'} • عيار {item.karat}
                        {item.brand ? ` • ${item.brand}` : ''}
                      </p>
                    </div>
                    <div className="text-left shrink-0 font-mono">
                      <p className="text-sm font-bold text-amber-300">{item.net_weight.toFixed(2)} g</p>
                      <p className="text-[10px] text-slate-500">صافي</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
