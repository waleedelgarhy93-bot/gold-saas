import React, { useState, useEffect } from 'react';
import type { Invoice } from '../types';
import { fetchInvoices } from '../api';
import { Search, Printer, FileText, ShoppingBag, ArrowDownLeft } from 'lucide-react';

interface InvoicesListViewProps {
  onSelectInvoiceForPrint?: (invoice: Invoice) => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({ onSelectInvoiceForPrint }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

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
    return matchesSearch && matchesType;
  });

  const handlePrint = (inv: Invoice) => {
    if (onSelectInvoiceForPrint) {
      onSelectInvoiceForPrint(inv);
    }
    setTimeout(() => window.print(), 200);
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

        <div className="flex items-center gap-3">
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
                  <th className="p-3.5">المبلغ الإجمالي</th>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5 text-center">طباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((inv) => (
                  <tr key={inv.id || inv.invoice_number} className="hover:bg-slate-800/40">
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
                    <td className="p-3.5 font-bold text-slate-100 text-sm">
                      {inv.final_amount.toLocaleString()} ج.م
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(inv.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handlePrint(inv)}
                        className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition cursor-pointer"
                        title="طباعة إيصال"
                      >
                        <Printer className="w-4 h-4" />
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
  );
};
