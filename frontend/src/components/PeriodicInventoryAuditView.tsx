import React, { useState, useEffect } from 'react';
import type { AuditReportData } from '../types';
import { fetchAuditReportAPI } from '../api';
import { Scale, Wallet, Calendar, Printer } from 'lucide-react';

export const PeriodicInventoryAuditView: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [auditData, setAuditData] = useState<AuditReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = () => {
    setLoading(true);
    fetchAuditReportAPI(period, startDate, endDate).then((data) => {
      setAuditData(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadReport();
  }, [period]);

  const handleCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      setPeriod('custom');
      loadReport();
    }
  };

  const financials = auditData?.financials || {
    total_sales_egp: 0,
    total_buybacks_egp: 0,
    total_workmanship_collected_egp: 0,
    total_vat_collected_egp: 0,
    net_cash_flow_egp: 0,
  };

  const gold = auditData?.gold_ledger || {
    sold_eq21_grams: 0,
    bought_eq21_grams: 0,
    net_weight_change_eq21_grams: 0,
    karat_breakdown: {},
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Period Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>تقارير الجرد الدوري وميزان الذهب الشامل</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة حركة الجرامات والسيولة والأرباح المحصلة خلال الفترات الزمنية المختلفة
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setPeriod('day')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                period === 'day'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الجرد اليومي
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                period === 'week'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الجرد الأسبوعي (7 أيام)
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                period === 'month'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الجرد الشهري
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة تقرير الجرد</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <form onSubmit={handleCustomFilter} className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>أو حدد فترة مخصصة:</span>
          </span>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-[11px]">من:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-[11px]">إلى:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg transition cursor-pointer"
          >
            عرض الجرد
          </button>
        </form>

        <div className="text-xs text-amber-300 font-medium">
          {auditData?.title || 'جاري تحميل التقرير...'}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">جاري احتساب أرقام الجرد والميزان...</div>
      ) : (
        <>
          {/* Main 2 Balance Cards (Gold Scale vs Cash Drawer) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Gold Weight Scale */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-amber-900/40 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">ميزان الذهب (المعادل لعيار 21)</h3>
                    <p className="text-[11px] text-slate-400">صافي حركة الجرامات في الخزينة</p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/20">
                  {auditData?.total_invoices || 0} عملية في الفترة
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs block">ذهب تم بيعه (خرج):</span>
                  <span className="text-lg font-black font-mono text-rose-400">
                    - {gold.sold_eq21_grams.toFixed(3)} <span className="text-xs font-sans">جرام</span>
                  </span>
                  <p className="text-[10px] text-slate-500">{auditData?.sales_count || 0} فاتورة بيع</p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs block">كسر تم شراؤه (دخل):</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    + {gold.bought_eq21_grams.toFixed(3)} <span className="text-xs font-sans">جرام</span>
                  </span>
                  <p className="text-[10px] text-slate-500">{auditData?.buybacks_count || 0} فاتورة شراء كسر</p>
                </div>
              </div>

              {/* Net Gold Position */}
              <div
                className={`p-4 rounded-2xl border text-center space-y-1 ${
                  gold.net_weight_change_eq21_grams >= 0
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                }`}
              >
                <span className="text-xs font-medium">صافي التغير في رصيد ذهب المحل:</span>
                <div className="text-2xl font-black font-mono">
                  {gold.net_weight_change_eq21_grams >= 0
                    ? `+ ${gold.net_weight_change_eq21_grams.toFixed(3)}`
                    : gold.net_weight_change_eq21_grams.toFixed(3)}{' '}
                  جرام
                </div>
                <p className="text-[11px] opacity-80">
                  {gold.net_weight_change_eq21_grams >= 0
                    ? 'زيادة في رصيد الجرامات المخزنة بالمحل'
                    : 'نقص في رصيد الجرامات (استهلاك مخزون)'}
                </p>
              </div>
            </div>

            {/* Card 2: Cash & Profit Ledger */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">درج النقدية والأرباح المحصلة</h3>
                    <p className="text-[11px] text-slate-400">حركة الجنيه المصري وصافي السيولة</p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  صافي السيولة
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs block">تحصيل المبيعات (+):</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {financials.total_sales_egp.toLocaleString()} <span className="text-xs font-sans">ج.م</span>
                  </span>
                  <p className="text-[10px] text-slate-500">نقدية داخلة</p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-xs block">مدفوعات الكسر (-):</span>
                  <span className="text-lg font-black font-mono text-rose-400">
                    {financials.total_buybacks_egp.toLocaleString()} <span className="text-xs font-sans">ج.م</span>
                  </span>
                  <p className="text-[10px] text-slate-500">نقدية خارجة</p>
                </div>
              </div>

              {/* Net Cash & Workmanship */}
              <div className="p-4 rounded-2xl border border-slate-700 bg-slate-950 space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>إجمالي المصنعية المحصلة (ربح التشغيل):</span>
                  <span className="font-mono text-amber-300 font-bold text-sm">
                    {financials.total_workmanship_collected_egp.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>إجمالي ضريبة الدمغة والقيمة المضافة:</span>
                  <span className="font-mono text-slate-300">
                    {financials.total_vat_collected_egp.toLocaleString()} ج.م
                  </span>
                </div>
                <hr className="border-slate-800" />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-300 font-bold">صافي التدفق النقدي بالدرج:</span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {financials.net_cash_flow_egp.toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Karat Breakdown Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200">تفصيل حركة الجرامات الصافية لكل عيار في الفترة</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">العيار</th>
                    <th className="p-4">نسبة النقاوة</th>
                    <th className="p-4">الوزن المباع (جرام)</th>
                    <th className="p-4">الكسر المشترى (جرام)</th>
                    <th className="p-4">صافي حركة العيار</th>
                    <th className="p-4">المعادل لعيار 21</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {[24, 21, 18, 14].map((k) => {
                    const row = gold.karat_breakdown?.[k] || { sold_net_grams: 0, bought_net_grams: 0 };
                    const net = row.bought_net_grams - row.sold_net_grams;
                    const purity = k === 24 ? 1.0 : k === 21 ? 0.875 : k === 18 ? 0.75 : 0.5833;
                    const eq21 = (net * purity) / 0.875;

                    return (
                      <tr key={k} className="hover:bg-slate-800/40">
                        <td className="p-4 font-sans font-bold text-amber-400">عيار {k}</td>
                        <td className="p-4 text-slate-400 font-sans">{(purity * 100).toFixed(1)}%</td>
                        <td className="p-4 text-rose-400">- {row.sold_net_grams.toFixed(2)} g</td>
                        <td className="p-4 text-emerald-400">+ {row.bought_net_grams.toFixed(2)} g</td>
                        <td className={`p-4 font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {net >= 0 ? `+${net.toFixed(2)}` : net.toFixed(2)} g
                        </td>
                        <td className="p-4 text-amber-300 font-bold">
                          {eq21 >= 0 ? `+${eq21.toFixed(2)}` : eq21.toFixed(2)} g
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
