import React, { useState, useEffect } from 'react';
import type { Invoice } from '../types';
import { fetchInvoices, payInvoiceAPI } from '../api';
import { Search, Printer, FileText, ShoppingBag, ArrowDownLeft, Wallet, X } from 'lucide-react';

interface InvoicesListViewProps {
  onSelectInvoiceForPrint?: (invoice: Invoice) => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({ onSelectInvoiceForPrint }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices().then((data) => {
      setInvoices(data);
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customer_national_id && inv.customer_national_id.includes(search));

    const matchesType = filterType === 'all' || inv.invoice_type === filterType;
    const remaining = inv.remaining_amount || 0;
    const matchesPayment =
      filterPayment === 'all' ||
      (filterPayment === 'unpaid' && remaining > 0) ||
      (filterPayment === 'paid' && remaining <= 0);
    return matchesSearch && matchesType && matchesPayment;
  });

  const totalRemaining = invoices.reduce((acc, i) => acc + (i.remaining_amount || 0), 0);

  const handlePrint = (inv: Invoice) => {
    if (onSelectInvoiceForPrint) {
      onSelectInvoiceForPrint(inv);
    }
    setTimeout(() => window.print(), 200);
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
    setPayingInvoice(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span>سجل الفواتير والمعاملات</span>
          </h2>
          <p className="text-xs text-slate-400">سجل فواتير البيع وشراء الكسر والضمانات الصادرة</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterType('sale')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'sale' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              مبيعات جديدة
            </button>
            <button
              onClick={() => setFilterType('buyback')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'buyback' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              شراء كسر
            </button>
          </div>

          {/* Payment Filter */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterPayment === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterPayment('unpaid')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterPayment === 'unpaid' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              عليه باقي
            </button>
            <button
              onClick={() => setFilterPayment('paid')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterPayment === 'paid' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              مسدد
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالرقم أو العميل..."
              className="bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Receivables Banner */}
      {totalRemaining > 0 && (
        <div className="flex items-center justify-between bg-rose-950/30 border border-rose-500/30 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-rose-300 text-sm font-bold">
            <Wallet className="w-4 h-4" />
            <span>إجمالي الباقي عند العملاء</span>
          </div>
          <span className="font-mono font-black text-rose-300 text-lg">{totalRemaining.toLocaleString()} ج.م</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">جاري تحميل الفواتير...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">لا توجد فواتير مطابقة للبحث</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">رقم الفاتورة</th>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">العميل</th>
                  <th className="p-3.5">الرقم القومي</th>
                  <th className="p-3.5">الوزن الصافي</th>
                  <th className="p-3.5">المعادل (21k)</th>
                  <th className="p-3.5">الإجمالي</th>
                  <th className="p-3.5">المسدد</th>
                  <th className="p-3.5">الباقي</th>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((inv) => {
                  const remaining = inv.remaining_amount || 0;
                  const paid = inv.paid_amount ?? inv.final_amount;
                  return (
                    <tr
                      key={inv.id || inv.invoice_number}
                      className={`hover:bg-slate-800/40 ${remaining > 0 ? 'bg-rose-950/10' : ''}`}
                    >
                      <td className="p-3.5 font-bold text-amber-300">{inv.invoice_number}</td>
                      <td className="p-3.5">
                        {inv.invoice_type === 'sale' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px] font-sans">
                            <ShoppingBag className="w-3 h-3" />
                            <span>بيع ذهب</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[11px] font-sans">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>شراء كسر</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-sans font-medium text-slate-200">{inv.customer_name}</td>
                      <td className="p-3.5 text-slate-400">{inv.customer_national_id || '—'}</td>
                      <td className="p-3.5 text-slate-200 font-bold">{inv.total_net_weight.toFixed(2)} g</td>
                      <td className="p-3.5 text-amber-400/90">{inv.equivalent_21k_weight.toFixed(2)} g</td>
                      <td className="p-3.5 font-bold text-slate-100">
                        {inv.final_amount.toLocaleString()} ج.م
                      </td>
                      <td className="p-3.5 text-emerald-400">{paid.toLocaleString()}</td>
                      <td className={`p-3.5 font-bold ${remaining > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                        {remaining > 0 ? remaining.toLocaleString() : '—'}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {new Date(inv.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1">
                          {remaining > 0 && (
                            <button
                              onClick={() => openPayment(inv)}
                              className="inline-flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-lg text-[11px] font-sans transition cursor-pointer"
                              title="تحصيل دفعة"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>تحصيل</span>
                            </button>
                          )}
                          <button
                            onClick={() => handlePrint(inv)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition cursor-pointer"
                            title="طباعة إيصال"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
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
              <label className="block text-xs text-slate-400 mb-1">المبلغ المحصّل</label>
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
    </div>
  );
};
