import React, { useState, useEffect } from 'react';
import type { TrustItem, TrustSummary, ShopInfo } from '../types';
import {
  fetchTrusts, fetchTrustsSummary, createTrustAPI, updateTrustStatusAPI, deleteTrustAPI,
} from '../api';
import {
  ShieldCheck, Package, Wallet, Plus, Search, Printer, Send,
  CheckCircle, ArrowUpRight, Trash2, X, Clock, Calendar, User
} from 'lucide-react';

interface TrustsViewProps {
  shopInfo: ShopInfo | null;
  isAdmin: boolean;
}

export const TrustsView: React.FC<TrustsViewProps> = ({ shopInfo, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'gold' | 'cash'>('gold');
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'returned' | 'settled'>('held');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<TrustItem[]>([]);
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalType, setModalType] = useState<'gold' | 'cash'>('gold');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [karat, setKarat] = useState(21);
  const [grossWeight, setGrossWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  // Selected item for printable receipt
  const [receiptItem, setReceiptItem] = useState<TrustItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [fetchedItems, fetchedSummary] = await Promise.all([
      fetchTrusts(activeTab, statusFilter === 'all' ? undefined : statusFilter),
      fetchTrustsSummary(),
    ]);
    setItems(fetchedItems);
    setSummary(fetchedSummary);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statusFilter]);

  const handleOpenAddModal = (type: 'gold' | 'cash') => {
    setModalType(type);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNationalId('');
    setItemDescription('');
    setKarat(21);
    setGrossWeight('');
    setNetWeight('');
    setCashAmount('');
    setExpectedReturnDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSaveTrust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('من فضلك أدخل اسم صاحب الأمانة');
      return;
    }

    if (modalType === 'gold') {
      const net = parseFloat(netWeight) || 0;
      if (net <= 0) {
        alert('من فضلك أدخل الوزن الصافي للذهب بالأمانة');
        return;
      }
    } else {
      const cash = parseFloat(cashAmount) || 0;
      if (cash <= 0) {
        alert('من فضلك أدخل المبلغ النقدي المودع بالأمانة');
        return;
      }
    }

    setSaving(true);
    const payload: Partial<TrustItem> = {
      trust_type: modalType,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || undefined,
      customer_national_id: customerNationalId.trim() || undefined,
      item_description: itemDescription.trim() || (modalType === 'gold' ? 'ذهب أمانة' : 'وديعة نقدية'),
      karat: modalType === 'gold' ? karat : undefined,
      gross_weight: modalType === 'gold' ? (parseFloat(grossWeight) || parseFloat(netWeight) || 0) : undefined,
      net_weight: modalType === 'gold' ? (parseFloat(netWeight) || 0) : undefined,
      cash_amount: modalType === 'cash' ? (parseFloat(cashAmount) || 0) : undefined,
      expected_return_date: expectedReturnDate.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const res = await createTrustAPI(payload);
    setSaving(false);
    if (res.ok && res.data) {
      setIsModalOpen(false);
      loadData();
      setReceiptItem(res.data);
    } else {
      alert(res.error || 'تعذر تسجيل الأمانة');
    }
  };

  const handleStatusChange = async (item: TrustItem, newStatus: 'returned' | 'settled') => {
    const actionLabel = newStatus === 'returned'
      ? (item.trust_type === 'gold' ? 'تسليم الذهب للعميل وإبراء الذمة' : 'رد المبلغ النقدي للعميل')
      : (item.trust_type === 'gold' ? 'تسوية وشراء الذهب لصالح المحل' : 'استخدام النقدية في شراء ذهب للعميل');

    const confirmed = confirm(`هل أنت متأكد من تنفيذ: "${actionLabel}" للأستاذ/ة ${item.customer_name}؟`);
    if (!confirmed) return;

    const res = await updateTrustStatusAPI(item.id, newStatus);
    if (res.ok) {
      loadData();
    } else {
      alert(res.error || 'تعذر تحديث الحالة');
    }
  };

  const handleDelete = async (item: TrustItem) => {
    const confirmed = confirm(`تحذير: هل أنت متأكد من حذف سجل الأمانة كلياً للأستاذ/ة ${item.customer_name}؟`);
    if (!confirmed) return;

    const res = await deleteTrustAPI(item.id);
    if (res.ok) {
      loadData();
    } else {
      alert(res.error || 'تعذر الحذف');
    }
  };

  const handleSendWhatsAppReceipt = (item: TrustItem) => {
    const cleanPhone = (item.customer_phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      alert('لا يوجد رقم هاتف مسجل لهذا العميل');
      return;
    }

    const shopName = shopInfo?.name || 'مجوهرات الهدى';
    const ownerName = shopInfo?.owner_name || 'أ/ طه رجب';
    const phones = shopInfo?.phone || '';
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('ar-EG') : 'اليوم';

    let msg = `✨ *إيصال استلام أمانة معتمد*\n`;
    msg += `🏛 *${shopName}* (${ownerName})\n`;
    msg += `📍 ${shopInfo?.address || 'شارع الصاغة'}\n`;
    msg += `📞 ${phones}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *صاحب الأمانة:* ${item.customer_name}\n`;
    if (item.customer_national_id) msg += `🪪 *الرقم القومي:* ${item.customer_national_id}\n`;
    msg += `📅 *تاريخ الاستلام:* ${dateStr}\n`;
    if (item.expected_return_date) msg += `⏳ *الموعد المتوقع:* ${item.expected_return_date}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    if (item.trust_type === 'gold') {
      msg += `📦 *نوع الأمانة:* ذهب ومصوغات\n`;
      msg += `🏷️ *البيان:* ${item.item_description || 'ذهب'}\n`;
      msg += `⚖️ *العيار:* عيار ${item.karat}\n`;
      msg += `⚖️ *الوزن الصافي:* ${item.net_weight?.toFixed(3)} جرام\n`;
    } else {
      msg += `💵 *نوع الأمانة:* وديعة نقدية / عربون\n`;
      msg += `💰 *المبلغ المودع:* ${(item.cash_amount || 0).toLocaleString()} جنيه مصري\n`;
      msg += `📝 *الغرض:* ${item.item_description || 'عربون شراء ذهب'}\n`;
    }

    if (item.notes) msg += `📝 *ملاحظات:* ${item.notes}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔒 *إقرار أمانة:* أمانة محفوظة بخزينة المحل تحت مسئوليتنا ومطابقة للمواصفات والأوزان المذكورة أعلاه.\n`;
    msg += `✨ نسعد دائماً بخدمتكم وتفضلوا بقبول فائق الاحترام.`;

    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('002')) {
      formattedPhone = formattedPhone.substring(2);
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = `2${formattedPhone}`;
    } else if (formattedPhone.length === 10 && !formattedPhone.startsWith('2')) {
      formattedPhone = `20${formattedPhone}`;
    }

    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 500);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const filteredItems = items.filter(i => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.customer_name.toLowerCase().includes(q) ||
      (i.customer_phone || '').includes(q) ||
      (i.item_description || '').toLowerCase().includes(q) ||
      (i.customer_national_id || '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-5 rounded-2xl border border-amber-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-100">مخزن الأمانات والودائع</h2>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                معزول تماماً عن المحل
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مخزن مخصص للأمانات: ذهب زبائن متروك للأسبوع القادم، أو ودائع وعرابين نقدية — لا تدخل في رأس مال أو مخزن المحل الأساسي.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal('gold')}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>تسجيل ذهب أمانة</span>
          </button>
          <button
            onClick={() => handleOpenAddModal('cash')}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>تسجيل نقدية أمانة</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-amber-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-400">
            <div className="flex items-center gap-1.5 font-bold">
              <Package className="w-4 h-4" />
              <span>إجمالي الذهب بالأمانة</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
              {summary?.active_gold_count || 0} أمانة
            </span>
          </div>
          <div className="text-xl font-black font-mono text-amber-300">
            {(summary?.total_gold_weight || 0).toFixed(3)} <span className="text-xs font-sans text-slate-400 font-normal">جرام صافي</span>
          </div>
          <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 pt-1 font-mono">
            {summary?.gold_by_karat && Object.entries(summary.gold_by_karat).map(([k, w]) => (
              <span key={k} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-amber-200/80">
                عيار {k}: {w.toFixed(2)}g
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/30 shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-1.5 font-bold">
              <Wallet className="w-4 h-4" />
              <span>إجمالي النقدية بالأمانة</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
              {summary?.active_cash_count || 0} وديعة
            </span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-300">
            {(summary?.total_cash_amount || 0).toLocaleString()} <span className="text-xs font-sans text-slate-400 font-normal">جنيه مصري</span>
          </div>
          <p className="text-[10px] text-slate-500 pt-1">
            عرابين وودائع نقدية محفوظة للعملاء
          </p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold">
            <Clock className="w-4 h-4" />
            <span>الأمانات الجارية بالخزنة</span>
          </div>
          <div className="text-xl font-black font-mono text-sky-300">
            {(summary?.active_gold_count || 0) + (summary?.active_cash_count || 0)}
          </div>
          <p className="text-[10px] text-slate-500 pt-1">
            تحت التحفظ والحفظ الأمين للمحل
          </p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold">
            <CheckCircle className="w-4 h-4" />
            <span>نظام التوثيق والإيصالات</span>
          </div>
          <div className="text-sm font-bold text-slate-200">
            إيصال استرداد + واتساب
          </div>
          <p className="text-[10px] text-slate-500 pt-1">
            إبراء ذمة رسمي فور تسليم الأمانة للزبون
          </p>
        </div>
      </div>

      {/* Main Tabs and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gold')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
              activeTab === 'gold'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>أمانات الذهب (ذهب تحت التحفظ)</span>
            <span className="text-[10px] bg-slate-950/40 px-2 py-0.5 rounded-full font-mono">
              {summary?.active_gold_count || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cash')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
              activeTab === 'cash'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>الودائع النقدية (نقدية بالأمانة / عربون)</span>
            <span className="text-[10px] bg-slate-950/40 px-2 py-0.5 rounded-full font-mono">
              {summary?.active_cash_count || 0}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('held')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'held' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              أمانات جارية
            </button>
            <button
              onClick={() => setStatusFilter('returned')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'returned' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              تم الرد
            </button>
            <button
              onClick={() => setStatusFilter('settled')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'settled' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              تمت التسوية
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-44 bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            جارٍ تحميل سجلات مخزن الأمانات...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-300">لا توجد أمانات مسجلة بهذه الفئة</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              يمكنك تسجيل استلام ذهب أو نقدية أمانة من الزبون بالضغط على أحد الأزرار بالأعلى.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">كود / تاريخ</th>
                  <th className="p-3.5">صاحب الأمانة</th>
                  <th className="p-3.5">الهاتف / القومي</th>
                  {activeTab === 'gold' ? (
                    <>
                      <th className="p-3.5">بيان المصوغات</th>
                      <th className="p-3.5">العيار</th>
                      <th className="p-3.5">الوزن الصافي</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3.5">المبلغ المودع</th>
                      <th className="p-3.5">الغرض من الوديعة</th>
                    </>
                  )}
                  <th className="p-3.5">الموعد المتوقع</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">إجراءات الأمانة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredItems.map((item) => {
                  const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('ar-EG') : '—';
                  const isHeld = item.status === 'held';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono">
                        <span className="font-bold text-slate-300">#{item.id}</span>
                        <span className="block text-[10px] text-slate-500">{dateStr}</span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-100">
                        {item.customer_name}
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        <div>{item.customer_phone || '—'}</div>
                        {item.customer_national_id && (
                          <div className="text-[10px] text-slate-500">{item.customer_national_id}</div>
                        )}
                      </td>

                      {activeTab === 'gold' ? (
                        <>
                          <td className="p-3.5 text-slate-200">
                            {item.item_description || 'ذهب أمانة'}
                          </td>
                          <td className="p-3.5 font-bold text-amber-400 font-mono">
                            عيار {item.karat}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-amber-300 text-sm">
                            {item.net_weight?.toFixed(3)} g
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3.5 font-mono font-black text-emerald-300 text-sm">
                            {(item.cash_amount || 0).toLocaleString()} ج.م
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {item.item_description || 'عربون / حفظ أمانة'}
                          </td>
                        </>
                      )}

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {item.expected_return_date ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{item.expected_return_date}</span>
                          </span>
                        ) : 'غير محدد'}
                        {item.notes && (
                          <span className="block text-[10px] text-slate-500 truncate max-w-xs" title={item.notes}>
                            ملاحظة: {item.notes}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {item.status === 'held' && (
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            أمانة جارية بالخزنة
                          </span>
                        )}
                        {item.status === 'returned' && (
                          <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            تم الرد للعميل
                          </span>
                        )}
                        {item.status === 'settled' && (
                          <span className="bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-sky-400" />
                            تمت التسوية والشراء
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isHeld && (
                            <>
                              <button
                                onClick={() => handleStatusChange(item, 'returned')}
                                className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-500/40 transition cursor-pointer"
                                title="تسليم الأمانة للعميل وإبراء الذمة"
                              >
                                إبراء ذمة / رد
                              </button>

                              <button
                                onClick={() => handleStatusChange(item, 'settled')}
                                className="bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white px-2 py-1 rounded-lg text-[11px] font-bold border border-sky-500/40 transition cursor-pointer"
                                title="تسوية الأمانة كشراء أو مبيعات"
                              >
                                تسوية
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setReceiptItem(item)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition cursor-pointer"
                            title="طباعة إيصال أمانة رسمي"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {item.customer_phone && (
                            <button
                              onClick={() => handleSendWhatsAppReceipt(item)}
                              className="p-1.5 bg-emerald-950 hover:bg-emerald-800 text-emerald-300 rounded-lg border border-emerald-800/60 transition cursor-pointer"
                              title="إرسال إيصال الأمانة عبر واتساب"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                              title="حذف السجل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Trust Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">
                  تسجيل أمانة جديدة في الخزينة
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setModalType('gold')}
                className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  modalType === 'gold'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>ذهب أمانة تحت التحفظ</span>
              </button>
              <button
                type="button"
                onClick={() => setModalType('cash')}
                className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  modalType === 'cash'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>نقدية أمانة / عربون</span>
              </button>
            </div>

            <form onSubmit={handleSaveTrust} className="space-y-4">
              {/* Customer Info */}
              <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>بيانات صاحب الأمانة</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">الاسم بالكامل *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="اسم العميل المودع للأمانة..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="010... أو 011..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">الرقم القومي (اختياري)</label>
                    <input
                      type="text"
                      value={customerNationalId}
                      onChange={(e) => setCustomerNationalId(e.target.value)}
                      placeholder="14 رقم..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Gold specifics */}
              {modalType === 'gold' ? (
                <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-amber-900/30">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>مواصفات الذهب المودع</span>
                  </h4>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">بيان ووصف القطع *</label>
                    <input
                      type="text"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="مثال: غويشة عيار 21 + خاتم كسر..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">العيار</label>
                      <select
                        value={karat}
                        onChange={(e) => setKarat(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value={24}>عيار 24</option>
                        <option value={21}>عيار 21</option>
                        <option value={18}>عيار 18</option>
                        <option value={14}>عيار 14</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">الوزن القائم (g)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                        placeholder="0.000"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-amber-300 mb-1">الوزن الصافي (g) *</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={netWeight}
                        onChange={(e) => setNetWeight(e.target.value)}
                        placeholder="0.000"
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-emerald-900/30">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>بيانات الوديعة النقدية</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-emerald-300 mb-1">المبلغ المودع (ج.م) *</label>
                      <input
                        type="number"
                        step="1"
                        required
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="مثال: 100000"
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-3 py-2 text-base font-mono font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">الغرض من الوديعة</label>
                      <input
                        type="text"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        placeholder="عربون لشراء سبيكة الأسبوع القادم..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dates & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الموعد المتوقع للاسترداد</label>
                  <input
                    type="text"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    placeholder="مثال: الأسبوع القادم / 15 نوفمبر"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="شروط خاصة أو ملحوظات..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {saving ? 'جارٍ الحفظ...' : 'حفظ وإصدار إيصال أمانة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Trust Receipt Modal */}
      {receiptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-800">
                إيصال استلام أمانة معتمد
              </h3>
              <button
                onClick={() => setReceiptItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div id="printable-trust-voucher" className="border border-slate-300 rounded-xl p-4 text-xs space-y-3 bg-amber-50/20 font-sans">
              <div className="text-center border-b pb-2">
                <h4 className="font-black text-base text-amber-900">{shopInfo?.name || 'مجوهرات الهدى'}</h4>
                <p className="text-[11px] text-slate-600">{shopInfo?.owner_name || 'أ/ طه رجب'}</p>
                <p className="text-[10px] text-slate-500">{shopInfo?.phone || ''} • {shopInfo?.address || ''}</p>
              </div>

              <div className="flex justify-between font-mono text-[11px] text-slate-700">
                <span>رقم الإيصال: <strong>#{receiptItem.id}</strong></span>
                <span>التاريخ: <strong>{receiptItem.created_at ? new Date(receiptItem.created_at).toLocaleDateString('ar-EG') : '—'}</strong></span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                <div>
                  <span className="text-slate-500">اسم صاحب الأمانة: </span>
                  <strong className="text-slate-900">{receiptItem.customer_name}</strong>
                </div>
                {receiptItem.customer_phone && (
                  <div>
                    <span className="text-slate-500">رقم الهاتف: </span>
                    <strong className="font-mono">{receiptItem.customer_phone}</strong>
                  </div>
                )}
                {receiptItem.customer_national_id && (
                  <div>
                    <span className="text-slate-500">الرقم القومي: </span>
                    <strong className="font-mono">{receiptItem.customer_national_id}</strong>
                  </div>
                )}
              </div>

              <div className="bg-amber-100/40 border border-amber-300/60 p-3 rounded-lg space-y-1">
                <div className="font-bold text-amber-950 text-xs">
                  {receiptItem.trust_type === 'gold' ? 'تفاصيل الذهب المودع بالأمانة:' : 'تفاصيل الوديعة النقدية بالأمانة:'}
                </div>
                {receiptItem.trust_type === 'gold' ? (
                  <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1 text-slate-800">
                    <div className="bg-white p-1.5 rounded border border-amber-200">
                      <span className="block text-[9px] text-slate-500">البيان</span>
                      <strong>{receiptItem.item_description || 'ذهب'}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-amber-200">
                      <span className="block text-[9px] text-slate-500">العيار</span>
                      <strong>{receiptItem.karat}k</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-amber-200">
                      <span className="block text-[9px] text-slate-500">الوزن الصافي</span>
                      <strong className="text-amber-800">{receiptItem.net_weight?.toFixed(3)}g</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <span className="text-xs text-slate-600 block">المبلغ المودع أمانة:</span>
                    <span className="text-xl font-black font-mono text-emerald-800">
                      {(receiptItem.cash_amount || 0).toLocaleString()} جنيه مصري
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      الغرض: {receiptItem.item_description || 'عربون لشراء ذهب'}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-600 leading-relaxed border-t pt-2">
                <strong>إقرار أمانة:</strong> نقر نحن إدارة المحل باستلام الأمانة الموضحة أعلاه من السيد/ة المذكور اسمه، وذلك على سبيل الأمانة والحفظ الأمين بخزينة المحل، وتُسلَّم لحامل هذا الإيصال أو لشخصه الكريم عند الطلب.
              </p>

              <div className="grid grid-cols-2 pt-4 text-center text-[10px] text-slate-700">
                <div>توقيع المودع: ....................</div>
                <div>ختم وتوقيع المحل: ....................</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {receiptItem.customer_phone && (
                <button
                  onClick={() => handleSendWhatsAppReceipt(receiptItem)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال واتساب</span>
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs transition cursor-pointer shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الإيصال</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
