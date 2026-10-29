import React from 'react';
import type { GoldPrices, User } from '../types';
import { Coins, Sparkles, Scale, Receipt, TrendingUp, LogOut, Users, Shield, Settings } from 'lucide-react';

interface NavbarProps {
  prices: GoldPrices;
  currentUser: User;
  shopName: string;
  activeTab: 'pos' | 'invoices' | 'daily' | 'ai_scanner' | 'staff' | 'superadmin' | 'settings';
  setActiveTab: (tab: 'pos' | 'invoices' | 'daily' | 'ai_scanner' | 'staff' | 'superadmin' | 'settings') => void;
  onOpenPriceModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  prices,
  currentUser,
  shopName,
  activeTab,
  setActiveTab,
  onOpenPriceModal,
  onLogout,
}) => {
  const isCashier = currentUser.role === 'cashier';
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isShopAdmin = currentUser.role === 'shop_admin';

  return (
    <header className="bg-slate-900 border-b border-amber-900/40 sticky top-0 z-40 shadow-xl">
      {/* Top Banner: Live Gold Rates Bar */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 px-4 py-1.5 border-b border-amber-800/20 text-xs flex flex-wrap items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 font-medium">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="tracking-wide">بورصة الذهب المحلية (الآن):</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 font-semibold overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">عيار 24:</span>
            <span className="text-amber-300 font-mono">{prices.sell_24k.toLocaleString()} ج.م</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <span className="text-amber-400 font-bold">عيار 21:</span>
            <span className="text-amber-300 font-bold font-mono">{prices.sell_21k.toLocaleString()} ج.م</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">عيار 18:</span>
            <span className="text-amber-300 font-mono">{prices.sell_18k.toLocaleString()} ج.م</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">الجنيه الذهب:</span>
            <span className="text-amber-300 font-mono">{prices.sell_pound.toLocaleString()} ج.م</span>
          </div>
        </div>

        {/* Price Edit: Only for Shop Admin or Super Admin */}
        {!isCashier ? (
          <button
            onClick={onOpenPriceModal}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-0.5 rounded transition text-xs font-medium cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>تعديل الأسعار</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
            الأسعار محددة من الإدارة (للقراءة فقط)
          </span>
        )}
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30 border border-amber-300/30">
              <Coins className="w-6 h-6 text-slate-950 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
                  {isSuperAdmin ? 'منصة الصاغة السحابية (النظام الرئيسي)' : shopName}
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  SaaS Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">نظام إدارة المبيعات والكسر والميزان التلقائي</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Super Admin Tab */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('superadmin')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                  activeTab === 'superadmin'
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>إدارة المنصة والمحلات</span>
              </button>
            )}

            {/* Standard Tabs */}
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>نقطة البيع (POS)</span>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>سجل الفواتير</span>
            </button>

            {/* Daily & Periodic Scale: Hidden from Cashier */}
            {!isCashier && (
              <button
                onClick={() => setActiveTab('daily')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                  activeTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>ميزان الذهب والجرد</span>
              </button>
            )}

            {/* Staff Management: Only for Shop Admin */}
            {isShopAdmin && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                  activeTab === 'staff'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>فريق العمل (المساعدين)</span>
              </button>
            )}

            {/* Shop Settings: Only for Shop Admin */}
            {isShopAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>إعدادات المحل</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('ai_scanner')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'ai_scanner'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>فحص الـ AI</span>
            </button>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200">{currentUser.name}</span>
              <span className={`text-[10px] font-medium ${
                isSuperAdmin ? 'text-indigo-400' : isShopAdmin ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {isSuperAdmin ? 'سوبر أدمن المنصة' : isShopAdmin ? 'مدير المحل (جواهرجي)' : 'مساعد كاشير'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
