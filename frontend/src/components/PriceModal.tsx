import React, { useState, useEffect } from 'react';
import type { GoldPrices, LivePrices } from '../types';
import { saveGoldPrices, fetchLivePrices } from '../api';
import { X, TrendingUp, Save, RefreshCw } from 'lucide-react';

interface PriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrices: GoldPrices;
  onPricesUpdated: (prices: GoldPrices) => void;
}

export const PriceModal: React.FC<PriceModalProps> = ({
  isOpen,
  onClose,
  currentPrices,
  onPricesUpdated,
}) => {
  const [prices, setPrices] = useState<GoldPrices>({ ...currentPrices });
  const [saving, setSaving] = useState(false);
  const [live, setLive] = useState<LivePrices | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    setPrices({ ...currentPrices });
  }, [currentPrices]);

  const loadLive = async () => {
    setLiveLoading(true);
    setLiveError(null);
    const result = await fetchLivePrices();
    setLiveLoading(false);
    if (result.ok && result.data) {
      setLive(result.data);
    } else {
      setLiveError(result.error || 'تعذر جلب الأسعار اللحظية');
    }
  };

  useEffect(() => {
    if (isOpen && !live) {
      loadLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof GoldPrices, val: string) => {
    const num = parseFloat(val) || 0;
    setPrices({ ...prices, [field]: num });
  };

  const market = live?.market_per_gram;
  const marketFor = (k: number) => market?.[String(k)] ?? 0;

  const applyLiveSell = () => {
    if (!market) return;
    setPrices({
      ...prices,
      sell_24k: marketFor(24),
      sell_21k: marketFor(21),
      sell_18k: marketFor(18),
      sell_14k: marketFor(14),
      sell_pound: Math.round(marketFor(21) * 8 * 100) / 100,
    });
  };

  const applyLiveBuy = () => {
    if (!market) return;
    setPrices({
      ...prices,
      buy_24k: marketFor(24),
      buy_21k: marketFor(21),
      buy_18k: marketFor(18),
      buy_14k: marketFor(14),
      buy_pound: Math.round(marketFor(21) * 8 * 100) / 100,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = await saveGoldPrices(prices);
    setSaving(false);
    onPricesUpdated(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">تحديث أسعار الذهب اللحظية</h2>
              <p className="text-xs text-slate-400">تحديث أسعار البيع والشراء لجميع العيارات في المحل</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Market Prices */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400">غرفة الذهب (السعر العالمي اللحظي)</h3>
            <button
              onClick={loadLive}
              disabled={liveLoading}
              className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${liveLoading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>

          {liveError ? (
            <p className="text-[11px] text-rose-400">{liveError}</p>
          ) : live ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[24, 21, 18, 14].map((k) => (
                  <div key={k} className={`rounded-xl border px-2 py-2 ${k === 21 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
                    <p className="text-[10px] text-slate-400">عيار {k}</p>
                    <p className={`font-mono font-bold text-xs ${k === 21 ? 'text-amber-300' : 'text-slate-200'}`}>
                      {marketFor(k).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>دولار/أونصة: {live.usd_per_ounce.toLocaleString()}</span>
                <span>دولار/جنيه: {live.usd_egp}</span>
                <span>{new Date(live.fetched_at).toLocaleTimeString('ar-EG')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={applyLiveSell}
                  className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl py-2 text-[11px] font-bold transition cursor-pointer"
                >
                  تطبيق على أسعار البيع
                </button>
                <button
                  onClick={applyLiveBuy}
                  className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl py-2 text-[11px] font-bold transition cursor-pointer"
                >
                  تطبيق على أسعار الشراء
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                بعد التطبيق يمكنك تعديل أي سعر يدوياً قبل الحفظ (هامش الربح والمصنعية).
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">{liveLoading ? 'جارٍ جلب الأسعار...' : 'اضغط تحديث لجلب الأسعار'}</p>
          )}
        </div>

        <div className="space-y-4">
          {/* Sell Prices */}
          <div>
            <h3 className="text-xs font-bold text-amber-400 mb-2">أسعار البيع للزبون (جنيه / جرام):</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">عيار 24</label>
                <input
                  type="number"
                  value={prices.sell_24k}
                  onChange={(e) => handleChange('sell_24k', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">عيار 21 (الرئيسي)</label>
                <input
                  type="number"
                  value={prices.sell_21k}
                  onChange={(e) => handleChange('sell_21k', e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">عيار 18</label>
                <input
                  type="number"
                  value={prices.sell_18k}
                  onChange={(e) => handleChange('sell_18k', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">الجنيه الذهب (8g)</label>
                <input
                  type="number"
                  value={prices.sell_pound}
                  onChange={(e) => handleChange('sell_pound', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Buy Prices */}
          <div>
            <h3 className="text-xs font-bold text-rose-400 mb-2">أسعار شراء الكسر من الزبون (جنيه / جرام):</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">شراء عيار 24</label>
                <input
                  type="number"
                  value={prices.buy_24k}
                  onChange={(e) => handleChange('buy_24k', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">شراء عيار 21</label>
                <input
                  type="number"
                  value={prices.buy_21k}
                  onChange={(e) => handleChange('buy_21k', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">شراء عيار 18</label>
                <input
                  type="number"
                  value={prices.buy_18k}
                  onChange={(e) => handleChange('buy_18k', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">شراء الجنيه الذهب</label>
                <input
                  type="number"
                  value={prices.buy_pound}
                  onChange={(e) => handleChange('buy_pound', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer">
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الأسعار وتطبيقها</span>
          </button>
        </div>
      </div>
    </div>
  );
};
