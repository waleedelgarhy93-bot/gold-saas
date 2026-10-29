import React, { useState } from 'react';
import type { GoldPrices } from '../types';
import { saveGoldPrices } from '../api';
import { X, TrendingUp, Save } from 'lucide-react';

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

  if (!isOpen) return null;

  const handleChange = (field: keyof GoldPrices, val: string) => {
    const num = parseFloat(val) || 0;
    setPrices({ ...prices, [field]: num });
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
      <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
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
