import React, { useState, useEffect } from 'react';
import type { Invoice, CapitalSummary } from '../types';
import { fetchInvoices, fetchCapital } from '../api';
import { Scale, Wallet, Banknote, Package, Coins } from 'lucide-react';

export const DailyRegisterView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [capital, setCapital] = useState<CapitalSummary | null>(null);

  useEffect(() => {
    fetchInvoices().then((data) => {
      setInvoices(data);
    });
    fetchCapital().then(setCapital);
  }, []);

  // Filter today's invoices
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayInvoices = invoices.filter((i) => i.created_at.startsWith(todayStr));

  const sales = todayInvoices.filter((i) => i.invoice_type === 'sale');
  const buybacks = todayInvoices.filter((i) => i.invoice_type === 'buyback');

  const totalSalesCash = sales.reduce((acc, i) => acc + i.final_amount, 0);
  const totalBuybackCash = buybacks.reduce((acc, i) => acc + i.final_amount, 0);
  const netCashInDrawer = totalSalesCash - totalBuybackCash;

  const totalGoldSold21k = sales.reduce((acc, i) => acc + i.equivalent_21k_weight, 0);
  const totalGoldBought21k = buybacks.reduce((acc, i) => acc + i.equivalent_21k_weight, 0);
  const netGoldWeightChange = totalGoldBought21k - totalGoldSold21k;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <span>ميزان الذهب والخزينة النقدية (تقفيل الوردية اليومية)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          حساب دقيق لميزان الجرامات المعادل لعيار 21 + صافي السيولة النقدية في الدرج
        </p>
      </div>

      {/* End-of-day capital tiles: new gold / scrap gold / cash / receivables */}
      {capital && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-amber-900/30">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
              <Package className="w-4 h-4" />
              <span>ذهب جديد بالمخزن</span>
            </div>
            <p className="font-mono font-black text-amber-300 text-lg">
              {(capital.new_gold.value || 0).toLocaleString()} <span className="text-[10px] font-sans">ج.م</span>
            </p>
            <p className="text-[10px] text-slate-500 font-mono">{capital.new_gold.net_weight.toFixed(3)}g • {capital.new_gold.count} قطعة</p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-rose-900/30">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-1">
              <Coins className="w-4 h-4" />
              <span>الكسر بالمخزن</span>
            </div>
            <p className="font-mono font-black text-rose-300 text-lg">
              {(capital.scrap_gold.value || 0).toLocaleString()} <span className="text-[10px] font-sans">ج.م</span>
            </p>
            <p className="text-[10px] text-slate-500 font-mono">{capital.scrap_gold.net_weight.toFixed(3)}g • {capital.scrap_gold.count} قطعة</p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-emerald-900/30">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
              <Banknote className="w-4 h-4" />
              <span>النقدية بالدرج</span>
            </div>
            <p className={`font-mono font-black text-lg ${capital.cash >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {capital.cash.toLocaleString()} <span className="text-[10px] font-sans">ج.م</span>
            </p>
            <p className="text-[10px] text-slate-500">رصيد الخزينة الحالي</p>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-700">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold mb-1">
              <Wallet className="w-4 h-4" />
              <span>الباقي عند العملاء</span>
            </div>
            <p className="font-mono font-black text-slate-100 text-lg">
              {capital.receivables.toLocaleString()} <span className="text-[10px] font-sans">ج.م</span>
            </p>
            <p className="text-[10px] text-slate-500">مبالغ غير محصّلة</p>
          </div>
        </div>
      )}

      {/* 2 Big Cards: Gold Scale vs Cash Drawer */}
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
                <p className="text-[11px] text-slate-400">حركة الجرامات في الخزينة اليوم</p>
              </div>
            </div>
            <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/20">
              {todayInvoices.length} عملية اليوم
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-xs block">ذهب تم بيعه (خرج):</span>
              <span className="text-lg font-black font-mono text-rose-400">
                - {totalGoldSold21k.toFixed(3)} <span className="text-xs font-sans">جرام</span>
              </span>
              <p className="text-[10px] text-slate-500">{sales.length} فواتير بيع</p>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-xs block">كسر تم شراؤه (دخل):</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                + {totalGoldBought21k.toFixed(3)} <span className="text-xs font-sans">جرام</span>
              </span>
              <p className="text-[10px] text-slate-500">{buybacks.length} فواتير شراء</p>
            </div>
          </div>

          {/* Net Gold Position */}
          <div className={`p-4 rounded-2xl border text-center space-y-1 ${
            netGoldWeightChange >= 0
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}>
            <span className="text-xs font-medium">صافي التغير في رصيد ذهب المحل اليوم:</span>
            <div className="text-2xl font-black font-mono">
              {netGoldWeightChange >= 0 ? `+ ${netGoldWeightChange.toFixed(3)}` : netGoldWeightChange.toFixed(3)} جرام
            </div>
            <p className="text-[11px] opacity-80">
              {netGoldWeightChange >= 0
                ? 'زيادة في المخزون (تم شراء كسر أكثر مما تم بيعه)'
                : 'نقص في المخزون (تم بيع ذهب أكثر من المشترى)'}
            </p>
          </div>
        </div>

        {/* Card 2: Cash Drawer Balance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">درج النقدية (السيولة المالية)</h3>
                <p className="text-[11px] text-slate-400">حركة الجنيه المصري في الخزينة</p>
              </div>
            </div>
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20">
              مبيعات كاش
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-xs block">تحصيل المبيعات (+):</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                {totalSalesCash.toLocaleString()} <span className="text-xs font-sans">ج.م</span>
              </span>
              <p className="text-[10px] text-slate-500">نقدية داخلة من الزبائن</p>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-xs block">مدفوعات شراء الكسر (-):</span>
              <span className="text-lg font-black font-mono text-rose-400">
                {totalBuybackCash.toLocaleString()} <span className="text-xs font-sans">ج.م</span>
              </span>
              <p className="text-[10px] text-slate-500">نقدية مدفوعة لزبائن الكسر</p>
            </div>
          </div>

          {/* Net Cash Position */}
          <div className="p-4 rounded-2xl border border-slate-700 bg-slate-950 text-center space-y-1">
            <span className="text-xs text-slate-400 font-medium">صافي النقدية بالدرج من حركة اليوم:</span>
            <div className="text-2xl font-black font-mono text-amber-300">
              {netCashInDrawer.toLocaleString()} <span className="text-sm font-sans">جنيه مصري</span>
            </div>
            <p className="text-[11px] text-slate-400">
              (إجمالي المبيعات المحصلة ناقص إجمالي الكسر المدفوع)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
