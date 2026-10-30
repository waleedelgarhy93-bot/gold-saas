import React, { useState, useEffect } from 'react';
import type { GoldPrices, POSItem, Invoice } from '../types';
import { 
  Plus, Trash2, ShoppingBag, ArrowDownLeft, Camera, Printer, 
  Send, Sparkles, User, CheckCircle2 
} from 'lucide-react';
import { createInvoiceAPI } from '../api';

interface POSScreenProps {
  prices: GoldPrices;
  onOpenAIScanner: (mode: 'id' | 'bullion') => void;
  scannedCustomer?: { name: string | null; national_id: string | null };
  scannedItem?: { brand: string | null; serial_number: string | null; karat: number; declared_weight: number };
  onInvoiceSaved?: (invoice: Invoice) => void;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  prices,
  onOpenAIScanner,
  scannedCustomer,
  scannedItem,
  onInvoiceSaved,
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

  const handleAddItem = () => {
    const gross = parseFloat(grossWeight) || 0;
    const stones = parseFloat(stonesWeight) || 0;
    const net = Math.max(0, parseFloat((gross - stones).toFixed(3)));
    const pricePerGram = getPricePerGram(karat, invoiceType);
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
    };

    setItems([...items, newItem]);
    // Reset weights
    setGrossWeight('');
    setStonesWeight('0.0');
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

  // Calculate equivalent in 21k
  const equivalent21k = items.reduce((acc, i) => {
    const purity = i.karat === 24 ? 1.0 : i.karat === 21 ? 0.875 : i.karat === 18 ? 0.75 : 0.5833;
    return acc + (i.net_weight * purity / 0.875);
  }, 0);

  const handleSaveInvoice = async (printImmediately = true) => {
    if (items.length === 0) {
      alert('من فضلك أضف صنفاً واحداً على الأقل للفاتورة');
      return;
    }

    if (invoiceType === 'buyback' && !customerNationalId) {
      const confirmProceed = confirm('تنبيه أمني وقانوني: لم تسجل الرقم القومي للعميل في فاتورة شراء الكسر! هل تريد المتابعة بدون رقم قومي؟');
      if (!confirmProceed) return;
    }

    const payload = {
      invoice_type: invoiceType,
      customer_name: customerName,
      customer_national_id: customerNationalId || null,
      customer_phone: customerPhone || null,
      payment_method: paymentMethod,
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
      })),
    };

    const saved = await createInvoiceAPI(payload);
    setSuccessInvoice(saved);
    if (onInvoiceSaved) {
      onInvoiceSaved(saved);
    }

    if (printImmediately) {
      setTimeout(() => window.print(), 300);
    }
  };

  const handleWhatsAppSend = () => {
    if (!customerPhone) {
      alert('من فضلك أدخل رقم هاتف العميل أولاً');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    const msg = `مرحباً ${customerName}، شكراً لتعاملك مع مجوهرات الأمانة الذهبية.
فاتورتك رقم: ${successInvoice?.invoice_number || 'قيد الإصدار'}
نوع الفاتورة: ${invoiceType === 'sale' ? 'فاتورة بيع ذهب جديد' : 'فاتورة شراء كسر'}
إجمالي الوزن الصافي: ${totalNetWeight.toFixed(2)} جرام
المبلغ الإجمالي: ${finalTotal.toLocaleString()} ج.م
يسعدنا دائماً خدمتكم.`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleReset = () => {
    setItems([]);
    setSuccessInvoice(null);
    setDiscount(0);
    setNotes('');
    setCustomerName('عميل نقدي');
    setCustomerNationalId('');
    setCustomerPhone('');
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
              <p className="text-xs text-emerald-300/80">المعادل الذهبي: {successInvoice.equivalent_21k_weight} جرام عيار 21</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة حرارية</span>
            </button>
            <button
              onClick={handleWhatsAppSend}
              className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
          <button
            onClick={() => setInvoiceType('sale')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer text-center ${
              invoiceType === 'sale'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>بيع ذهب جديد</span>
          </button>

          <button
            onClick={() => setInvoiceType('buyback')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer text-center ${
              invoiceType === 'buyback'
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>شراء كسر / مستعمل</span>
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
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
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
                <div className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-400">
                  {getPricePerGram(karat, invoiceType).toLocaleString()} ج.م
                </div>
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
              <div className="flex justify-between text-slate-400">
                <span>قيمة الذهب الخام:</span>
                <span className="font-mono text-slate-200">{totalRawGold.toLocaleString()} ج.م</span>
              </div>
              {invoiceType === 'sale' && (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>إجمالي المصنعية:</span>
                    <span className="font-mono text-slate-200">{totalWorkmanship.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الدمغة وضريبة القيمة المضافة:</span>
                    <span className="font-mono text-slate-200">{totalStampVat.toLocaleString()} ج.م</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2">
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
              <div className="grid grid-cols-3 gap-2 text-xs">
                {['cash', 'visa', 'transfer'].map((m) => (
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
                    {m === 'cash' ? 'نقدي' : m === 'visa' ? 'فيزا / بطاقة' : 'تحويل بنكي'}
                  </button>
                ))}
              </div>
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
    </div>
  );
};
