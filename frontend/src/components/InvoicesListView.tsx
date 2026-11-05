import React, { useState, useEffect } from 'react';
import type { Invoice, ShopInfo } from '../types';
import { fetchInvoices, payInvoiceAPI, deleteInvoiceAPI } from '../api';
import { downloadInvoicePDF, shareInvoiceViaWhatsApp } from '../utils/pdfGenerator';
import { 
  Search, Printer, FileText, ShoppingBag, ArrowDownLeft, Wallet, X, 
  Trash2, Eye, Calendar, Clock, RefreshCw, CheckCircle2, AlertCircle,
  Coins, FileDown, Send
} from 'lucide-react';

interface InvoicesListViewProps {
  onSelectInvoiceForPrint?: (invoice: Invoice) => void;
  shopInfo?: ShopInfo | null;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({ onSelectInvoiceForPrint, shopInfo }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const userRole = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('gold_user') || '{}');
      return u.role || 'cashier';
    } catch { return 'cashier'; }
  })();
  const isAdmin = userRole === 'shop_admin' || userRole === 'super_admin';

  const [filterType, setFilterType] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');

  // Modal states
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices({ limit: 500 });
      setInvoices(data);
    } catch (e) {
      console.warn('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Format exact date & time in readable Egyptian Arabic format
  const formatExactDateTime = (isoString?: string) => {
    if (!isoString) return { date: '—', time: '—', full: '—' };
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '—', time: '—', full: '—' };

    const dateStr = d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeStr = d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return {
      date: dateStr,
      time: timeStr,
      full: `${dateStr} - ${timeStr}`,
    };
  };

  // Filter invoices
  const filtered = invoices.filter((inv) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      (inv.customer_phone && inv.customer_phone.includes(term)) ||
      (inv.customer_national_id && inv.customer_national_id.includes(term)) ||
      (inv.notes && inv.notes.toLowerCase().includes(term));

    const matchesType = filterType === 'all' || inv.invoice_type === filterType;
    const remaining = inv.remaining_amount || 0;
    const matchesPayment =
      filterPayment === 'all' ||
      (filterPayment === 'unpaid' && remaining > 0) ||
      (filterPayment === 'paid' && remaining <= 0);

    let matchesDate = true;
    if (filterDate !== 'all' && inv.created_at) {
      const invDate = new Date(inv.created_at);
      const now = new Date();
      if (filterDate === 'today') {
        matchesDate = invDate.toDateString() === now.toDateString();
      } else if (filterDate === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        matchesDate = invDate >= weekAgo;
      } else if (filterDate === 'month') {
        matchesDate = invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      }
    }

    return matchesSearch && matchesType && matchesPayment && matchesDate;
  });

  // Analytics / aggregates
  const salesInvoices = invoices.filter(i => i.invoice_type === 'sale');
  const buybackInvoices = invoices.filter(i => i.invoice_type === 'buyback');

  const totalSalesAmount = salesInvoices.reduce((acc, i) => acc + (i.final_amount || 0), 0);
  const totalSalesWeight = salesInvoices.reduce((acc, i) => acc + (i.total_net_weight || 0), 0);

  const totalBuybackAmount = buybackInvoices.reduce((acc, i) => acc + (i.final_amount || 0), 0);
  const totalBuybackWeight = buybackInvoices.reduce((acc, i) => acc + (i.total_net_weight || 0), 0);

  const totalRemaining = invoices.reduce((acc, i) => acc + (i.remaining_amount || 0), 0);

  const handlePrint = (inv: Invoice) => {
    if (onSelectInvoiceForPrint) {
      onSelectInvoiceForPrint(inv);
    }
    setTimeout(() => window.print(), 200);
  };

  const handleDownloadPDF = async (inv: Invoice) => {
    if (onSelectInvoiceForPrint) {
      onSelectInvoiceForPrint(inv);
    }
    setTimeout(async () => {
      await downloadInvoicePDF('half-a4-invoice-receipt', inv.invoice_number);
    }, 150);
  };

  const handleShareWhatsApp = async (inv: Invoice) => {
    if (onSelectInvoiceForPrint) {
      onSelectInvoiceForPrint(inv);
    }
    setTimeout(async () => {
      await shareInvoiceViaWhatsApp('half-a4-invoice-receipt', inv, shopInfo);
    }, 150);
  };

  const openPayment = (inv: Invoice) => {
    setPayingInvoice(inv);
    setPayAmount(String(inv.remaining_amount || 0));
    setPayError(null);
  };

  const handleCollect = async () => {
    if (!payingInvoice?.id) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) {
      setPayError('أدخل مبلغاً صحيحاً أكبر من صفر');
      return;
    }
    setPaySaving(true);
    const result = await payInvoiceAPI(payingInvoice.id, amount);
    setPaySaving(false);
    if (!result.ok) {
      setPayError(result.error || 'تعذر تسجيل الدفعة');
      return;
    }
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === payingInvoice.id
          ? { ...inv, paid_amount: result.paid_amount ?? inv.paid_amount, remaining_amount: result.remaining_amount ?? inv.remaining_amount }
          : inv
      )
    );
    showNotification(`تم تسجيل دفعة بقيمة ${amount.toLocaleString()} ج.م بنجاح`);
    setPayingInvoice(null);
  };

  const handleDeleteInvoice = async () => {
    if (!deleteConfirmInvoice?.id) return;
    setDeleting(true);
    const res = await deleteInvoiceAPI(deleteConfirmInvoice.id);
    setDeleting(false);
    if (res.ok) {
      setInvoices(prev => prev.filter(i => i.id !== deleteConfirmInvoice.id));
      showNotification('تم حذف الفاتورة وتحديث الأرصدة بنجاح');
      if (detailsInvoice?.id === deleteConfirmInvoice.id) {
        setDetailsInvoice(null);
      }
      setDeleteConfirmInvoice(null);
    } else {
      showNotification(res.error || 'فشل حذف الفاتورة', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-lg animate-in fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
            : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-bold">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <span>قسم الفواتير والمعاملات</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سجل شامل ومؤرشف لجميع فواتير المبيعات وشراء الكسر مع التوقيت الدقيق وتفاصيل الذهب والمبالغ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            title="تحديث قائمة الفواتير"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-amber-900/30 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-amber-400">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>إجمالي الفواتير</span>
            </span>
            <span className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300 font-bold">
              {invoices.length} فاتورة
            </span>
          </div>
          <div className="text-lg font-black font-mono text-amber-200">
            {salesInvoices.length} بيع · {buybackInvoices.length} شراء
          </div>
          <p className="text-[10px] text-slate-500">مؤرشفة بالتوقيت الدقيق في النظام</p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-900/30 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>مبيعات الذهب الجديد</span>
            </span>
            <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300 font-bold">
              {totalSalesWeight.toFixed(2)} g
            </span>
          </div>
          <div className="text-lg font-black font-mono text-emerald-200">
            {totalSalesAmount.toLocaleString()} ج.م
          </div>
          <p className="text-[10px] text-slate-500">تم خصمها تلقائياً من رصيد المخزن</p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-rose-900/30 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-rose-400">
            <span className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>شراء الذهب الكسر</span>
            </span>
            <span className="font-mono bg-rose-500/10 px-1.5 py-0.5 rounded text-rose-300 font-bold">
              {totalBuybackWeight.toFixed(2)} g
            </span>
          </div>
          <div className="text-lg font-black font-mono text-rose-200">
            {totalBuybackAmount.toLocaleString()} ج.م
          </div>
          <p className="text-[10px] text-slate-500">أُضيفت تلقائياً لمخزن الكسر والمستعمل</p>
        </div>

        <div className="bg-slate-900/90 rounded-2xl p-4 border border-sky-900/30 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-sky-400">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              <span>الباقي عند العملاء</span>
            </span>
            <span className="font-mono bg-sky-500/10 px-1.5 py-0.5 rounded text-sky-300 font-bold">
              {invoices.filter(i => (i.remaining_amount || 0) > 0).length} فواتير
            </span>
          </div>
          <div className={`text-lg font-black font-mono ${totalRemaining > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
            {totalRemaining.toLocaleString()} ج.م
          </div>
          <p className="text-[10px] text-slate-500">مبالغ آجلة قيد التحصيل</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({invoices.length})
            </button>
            <button
              onClick={() => setFilterType('sale')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filterType === 'sale' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              مبيعات جديدة ({salesInvoices.length})
            </button>
            <button
              onClick={() => setFilterType('buyback')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filterType === 'buyback' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              شراء كسر ({buybackInvoices.length})
            </button>
          </div>

          {/* Payment Filter */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterPayment === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterPayment('unpaid')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterPayment === 'unpaid' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              عليه باقي
            </button>
            <button
              onClick={() => setFilterPayment('paid')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterPayment === 'paid' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              مسدد
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterDate('all')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterDate === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              كل الأوقات
            </button>
            <button
              onClick={() => setFilterDate('today')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterDate === 'today' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setFilterDate('week')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                filterDate === 'week' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              آخر 7 أيام
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة، العميل، الهاتف، الرقم القومي..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>جاري تحميل قسم الفواتير...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p>لا توجد فواتير مطابقة لخيارات البحث المحددة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">رقم الفاتورة</th>
                  <th className="p-3.5">نوع الفاتورة</th>
                  <th className="p-3.5">بيانات العميل</th>
                  <th className="p-3.5">الأصناف</th>
                  <th className="p-3.5">الوزن الصافي</th>
                  <th className="p-3.5">المعادل (21k)</th>
                  <th className="p-3.5">إجمالي المبلغ</th>
                  <th className="p-3.5">المسدد والباقي</th>
                  <th className="p-3.5">التاريخ والساعة بدقة</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((inv) => {
                  const remaining = inv.remaining_amount || 0;
                  const paid = inv.paid_amount ?? inv.final_amount;
                  const timeMeta = formatExactDateTime(inv.created_at);
                  const itemCount = inv.items?.length || 1;

                  return (
                    <tr
                      key={inv.id || inv.invoice_number}
                      className={`hover:bg-slate-800/40 transition ${
                        remaining > 0 ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Invoice number */}
                      <td className="p-3.5 font-bold text-amber-300">
                        <button
                          onClick={() => setDetailsInvoice(inv)}
                          className="hover:underline text-amber-400 cursor-pointer flex items-center gap-1"
                          title="عرض تفاصيل الفاتورة"
                        >
                          <span>{inv.invoice_number}</span>
                        </button>
                      </td>

                      {/* Type */}
                      <td className="p-3.5">
                        {inv.invoice_type === 'sale' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px] font-sans">
                            <ShoppingBag className="w-3 h-3" />
                            <span>بيع ذهب جديد</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[11px] font-sans">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>شراء كسر</span>
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5 font-sans">
                        <div className="font-bold text-slate-200">{inv.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                          {inv.customer_phone && <span>{inv.customer_phone}</span>}
                          {inv.customer_national_id && <span>• قومي: {inv.customer_national_id}</span>}
                          {!inv.customer_phone && !inv.customer_national_id && <span className="text-slate-600">—</span>}
                        </div>
                      </td>

                      {/* Items snapshot */}
                      <td className="p-3.5 font-sans text-slate-300">
                        <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-[11px]">
                          {itemCount} {itemCount === 1 ? 'صنف' : 'أصناف'}
                        </span>
                      </td>

                      {/* Weights */}
                      <td className="p-3.5 text-slate-200 font-bold">
                        {inv.total_net_weight.toFixed(2)} g
                      </td>
                      <td className="p-3.5 text-amber-400/90 font-medium">
                        {inv.equivalent_21k_weight.toFixed(2)} g
                      </td>

                      {/* Total */}
                      <td className="p-3.5 font-bold text-slate-100">
                        {inv.final_amount.toLocaleString()} ج.م
                      </td>

                      {/* Payment */}
                      <td className="p-3.5">
                        <div className="text-emerald-400 font-bold">{paid.toLocaleString()} ج.م</div>
                        {remaining > 0 ? (
                          <div className="text-rose-400 font-bold text-[11px]">
                            باقي: {remaining.toLocaleString()} ج.م
                          </div>
                        ) : (
                          <div className="text-emerald-500/80 text-[10px] font-sans">مسدد بالكامل</div>
                        )}
                      </td>

                      {/* Exact Date and Time */}
                      <td className="p-3.5 text-slate-300 text-xs font-sans">
                        <div className="flex items-center gap-1 text-slate-300 font-medium">
                          <Calendar className="w-3 h-3 text-amber-400/80" />
                          <span>{timeMeta.date}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px] mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{timeMeta.time}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDetailsInvoice(inv)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition cursor-pointer"
                            title="عرض كافة بيانات الفاتورة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {remaining > 0 && (
                            <button
                              onClick={() => openPayment(inv)}
                              className="inline-flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-lg text-[11px] font-sans transition cursor-pointer"
                              title="تحصيل دفعة نقدية"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>تحصيل</span>
                            </button>
                          )}

                          <button
                            onClick={() => handlePrint(inv)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition cursor-pointer"
                            title="طباعة الفاتورة بنظام نصف A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownloadPDF(inv)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition cursor-pointer"
                            title="تحميل الفاتورة كملف PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleShareWhatsApp(inv)}
                            className="p-1.5 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 rounded-lg transition cursor-pointer"
                            title="إرسال الفاتورة عبر واتساب (PDF)"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmInvoice(inv)}
                              className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                              title="حذف الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Invoice Details Modal (Comprehensive Inspection) */}
      {detailsInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-slate-100">
                  تفاصيل الفاتورة: <span className="text-amber-400 font-mono">{detailsInvoice.invoice_number}</span>
                </h2>
              </div>
              <button
                onClick={() => setDetailsInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">نوع الفاتورة:</span>
                <span className="font-bold text-slate-200">
                  {detailsInvoice.invoice_type === 'sale' ? 'فاتورة بيع ذهب جديد' : 'فاتورة شراء كسر ومستعمل'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">العميل:</span>
                <span className="font-bold text-slate-200">{detailsInvoice.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">الهاتف:</span>
                <span className="font-mono text-slate-200">{detailsInvoice.customer_phone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">الرقم القومي:</span>
                <span className="font-mono text-slate-200">{detailsInvoice.customer_national_id || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">تاريخ الإنشاء:</span>
                <span className="font-mono text-slate-200">{formatExactDateTime(detailsInvoice.created_at).date}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">الساعة والتوقيت الدقيق:</span>
                <span className="font-mono text-amber-300 font-bold">{formatExactDateTime(detailsInvoice.created_at).time}</span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>بيان القطع والأصناف بالفاتورة:</span>
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5">العيار</th>
                      <th className="p-2.5">الوزن الصافي</th>
                      <th className="p-2.5">سعر الجرام</th>
                      <th className="p-2.5">المصنعية/الدمغة</th>
                      <th className="p-2.5 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-xs">
                    {(detailsInvoice.items || []).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2.5 font-sans font-medium text-slate-200">{it.item_name}</td>
                        <td className="p-2.5 text-amber-400 font-bold">{it.karat} k</td>
                        <td className="p-2.5 text-slate-100">{it.net_weight.toFixed(2)} g</td>
                        <td className="p-2.5 text-slate-300">{it.price_per_gram.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-400">
                          {(it.workmanship_per_gram || 0) + (it.stamp_vat_per_gram || 0)} ج.م
                        </td>
                        <td className="p-2.5 text-left font-bold text-amber-300">
                          {it.total_item_price.toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>إجمالي الوزن الصافي:</span>
                <span className="font-mono text-slate-200 font-bold">{detailsInvoice.total_net_weight.toFixed(2)} جرام</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>المعادل الذهبي (عيار 21):</span>
                <span className="font-mono text-amber-400 font-bold">{detailsInvoice.equivalent_21k_weight.toFixed(2)} جرام</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>إجمالي الفاتورة:</span>
                <span className="font-mono text-slate-100 font-black text-sm">{detailsInvoice.final_amount.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>المسدد نقدياً:</span>
                <span className="font-mono text-emerald-400 font-bold">{(detailsInvoice.paid_amount ?? detailsInvoice.final_amount).toLocaleString()} ج.م</span>
              </div>
              {(detailsInvoice.remaining_amount || 0) > 0 && (
                <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-800">
                  <span>المتبقي الآجل:</span>
                  <span className="font-mono text-base font-black">{(detailsInvoice.remaining_amount || 0).toLocaleString()} ج.م</span>
                </div>
              )}
              {detailsInvoice.notes && (
                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <span className="font-bold text-slate-300">ملاحظات:</span> {detailsInvoice.notes}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              {isAdmin ? (
                <button
                  onClick={() => setDeleteConfirmInvoice(detailsInvoice)}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف هذه الفاتورة</span>
                </button>
              ) : <div />}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handlePrint(detailsInvoice)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
                  title="طباعة الفاتورة بحجم نصف صفحة A4"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة (نصف A4)</span>
                </button>
                <button
                  onClick={() => handleDownloadPDF(detailsInvoice)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                  title="تحميل كملف PDF رسمي"
                >
                  <FileDown className="w-4 h-4" />
                  <span>تحميل PDF</span>
                </button>
                <button
                  onClick={() => handleShareWhatsApp(detailsInvoice)}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer shadow"
                  title="إرسال عبر واتساب كملف PDF"
                >
                  <Send className="w-4 h-4" />
                  <span>واتساب (PDF)</span>
                </button>
                <button
                  onClick={() => setDetailsInvoice(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-emerald-900/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>تحصيل دفعة من العميل</span>
              </h2>
              <button
                onClick={() => setPayingInvoice(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">الفاتورة:</span>
                <span className="font-mono font-bold text-amber-300">{payingInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">العميل:</span>
                <span className="font-bold">{payingInvoice.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الإجمالي:</span>
                <span className="font-mono">{payingInvoice.final_amount.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الباقي الحالي:</span>
                <span className="font-mono font-bold text-rose-400">{(payingInvoice.remaining_amount || 0).toLocaleString()} ج.م</span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">المبلغ المحصّل الآن (ج.م):</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-base font-mono font-bold text-emerald-300 text-center focus:outline-none focus:border-emerald-400"
              />
            </div>

            {payError && <p className="text-xs text-rose-400">{payError}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleCollect}
                disabled={paySaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-60"
              >
                {paySaving ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-900/50 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">تأكيد حذف الفاتورة</h3>
                <p className="text-xs text-slate-400">رقم الفاتورة: {deleteConfirmInvoice.invoice_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              هل أنت متأكد من حذف هذه الفاتورة نهائياً؟
              سيتم التراجع عن أثرها في المخزن وإلغاء تسجيل المبيعات/الكسر المرتبط بها.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmInvoice(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteInvoice}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'جاري الحذف...' : 'نعم، احذف الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
