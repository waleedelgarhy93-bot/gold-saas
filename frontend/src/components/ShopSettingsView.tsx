import React, { useState, useEffect } from 'react';
import type { ShopInfo, User } from '../types';
import { fetchShopInfo, updateShopInfoAPI, changeUserPasswordAPI } from '../api';
import { Settings, Store, Lock, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface ShopSettingsViewProps {
  currentUser: User;
  onShopUpdated?: (shop: ShopInfo) => void;
}

export const ShopSettingsView: React.FC<ShopSettingsViewProps> = ({ currentUser, onShopUpdated }) => {
  const [shop, setShop] = useState<ShopInfo>({
    id: currentUser.shop_id || 1,
    name: currentUser.shop_name || 'محل الذهب والمجوهرات',
    owner_name: currentUser.name ? currentUser.name.replace(/\s*\(.*?\)/, '') : 'صاحب المحل',
    phone: '',
    address: '',
    commercial_record: '',
    tax_number: '',
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingShop, setSavingShop] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [shopSuccess, setShopSuccess] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    fetchShopInfo(currentUser.shop_id || undefined).then((data) => {
      if (data) setShop(data);
    });
  }, [currentUser.shop_id]);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    setShopSuccess(false);

    const payload = {
      ...shop,
      id: currentUser.shop_id || shop.id || 1,
    };
    const ok = await updateShopInfoAPI(payload);
    setSavingShop(false);
    if (ok) {
      setShopSuccess(true);
      if (onShopUpdated) onShopUpdated(payload);
      setTimeout(() => setShopSuccess(false), 3000);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (newPassword.length < 3) {
      setPassError('كلمة المرور يجب أن تكون 3 أحرف/أرقام على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('كلمتا المرور غير متطابقتين');
      return;
    }

    setSavingPass(true);
    const ok = await changeUserPasswordAPI(currentUser.id, newPassword);
    setSavingPass(false);
    if (ok) {
      setPassSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" />
          <span>إعدادات المحل والملف الشخصي</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          هنا يمكنك تغيير اسم محلك (الذي سيظهر في ترويسة الفواتير المطبوعة)، العناوين، وكلمة المرور
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form 1: Shop Information (2 cols) */}
        <div className="md:col-span-2 bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              <span>بيانات المحل وهوية الفواتير</span>
            </h3>
            {shopSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ بنجاح</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSaveShop} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">اسم المحل (يظهر في الفاتورة وبداية النظام)</label>
              <input
                type="text"
                value={shop.name}
                onChange={(e) => setShop({ ...shop, name: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">اسم المالك / الجواهرجي</label>
                <input
                  type="text"
                  value={shop.owner_name}
                  onChange={(e) => setShop({ ...shop, owner_name: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">رقم الهاتف للتواصل</label>
                <input
                  type="text"
                  value={shop.phone}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">العنوان والفرع (المحافظة والشارع)</label>
              <input
                type="text"
                value={shop.address}
                onChange={(e) => setShop({ ...shop, address: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">رقم السجل التجاري (س.ت)</label>
                <input
                  type="text"
                  value={shop.commercial_record}
                  onChange={(e) => setShop({ ...shop, commercial_record: e.target.value })}
                  placeholder="مثال: 45892"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">رقم البطاقة الضريبية (ب.ض)</label>
                <input
                  type="text"
                  value={shop.tax_number}
                  onChange={(e) => setShop({ ...shop, tax_number: e.target.value })}
                  placeholder="مثال: 100-245-889"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingShop}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                <span>حفظ بيانات المحل</span>
              </button>
            </div>
          </form>
        </div>

        {/* Form 2: Password Change (1 col) */}
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>تغيير كلمة المرور</span>
            </h3>
          </div>

          {passError && (
            <div className="bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم تغيير كلمة المرور بنجاح</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">اسم المستخدم</label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-amber-300 font-bold">
                {currentUser.username}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">كلمة المرور الجديدة</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingPass}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>تحديث كلمة المرور</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
