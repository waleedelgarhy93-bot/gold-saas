import React, { useState } from 'react';
import type { GoldPrices, User } from '../types';
import { 
  Coins, Sparkles, Scale, Receipt, TrendingUp, LogOut, Users, 
  Shield, Settings, Menu, X, Package
} from 'lucide-react';

export type AppTab = 'pos' | 'invoices' | 'inventory' | 'daily' | 'ai_scanner' | 'staff' | 'superadmin' | 'settings';

interface NavbarProps {
  prices: GoldPrices;
  currentUser: User;
  shopName: string;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const isCashier = currentUser.role === 'cashier';
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isShopAdmin = currentUser.role === 'shop_admin';

  const handleTabClick = (tab: AppTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-amber-900/40 sticky top-0 z-40 shadow-xl w-full">
      {/* Top Banner: Live Gold Rates Bar (Smooth horizontal scroll on mobile without breaking layout) */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 px-3 py-1.5 border-b border-amber-800/20 text-xs flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 text-amber-400 font-medium shrink-0">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] sm:text-xs">بورصة الذهب:</span>
        </div>

        {/* Ticker items */}
        <div className="flex items-center gap-3 sm:gap-5 font-semibold overflow-x-auto no-scrollbar py-0.5 text-[11px] sm:text-xs whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-normal">ع 24:</span>
            <span className="text-amber-300 font-mono">{prices.sell_24k.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            <span className="text-amber-400 font-bold">ع 21:</span>
            <span className="text-amber-300 font-bold font-mono">{prices.sell_21k.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-normal">ع 18:</span>
            <span className="text-amber-300 font-mono">{prices.sell_18k.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-normal">الجنيه:</span>
            <span className="text-amber-300 font-mono">{prices.sell_pound.toLocaleString()}</span>
          </div>
        </div>

        {/* Price Edit: Only for Shop Admin or Super Admin */}
        {!isCashier ? (
          <button
            onClick={onOpenPriceModal}
            className="shrink-0 flex items-center gap-1 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded transition text-[11px] font-medium cursor-pointer"
          >
            <TrendingUp className="w-3 h-3" />
            <span className="hidden sm:inline">تعديل الأسعار</span>
          </button>
        ) : null}
      </div>

      {/* Main Navbar Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30 border border-amber-300/30 shrink-0">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-lg font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent truncate">
                  {isSuperAdmin ? 'منصة الصاغة السحابية' : shopName}
                </span>
                <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/30 font-mono shrink-0">
                  SaaS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block">
                نظام إدارة المبيعات والكسر والميزان
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Clean, focused on daily operations) */}
          <nav className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => handleTabClick('pos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-sm transition cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>نقطة البيع (POS)</span>
            </button>

            <button
              onClick={() => handleTabClick('inventory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-sm transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>المخزن والأرصدة</span>
            </button>

            <button
              onClick={() => handleTabClick('invoices')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-sm transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>قسم الفواتير</span>
            </button>

            {!isCashier && (
              <button
                onClick={() => handleTabClick('daily')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-sm transition cursor-pointer ${
                  activeTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>تقفيل اليومية والميزان</span>
              </button>
            )}
          </nav>

          {/* User profile & Settings menu */}
          <div className="flex items-center gap-2">
            {/* Quick Settings dropdown for Admin/Superadmin */}
            {!isCashier && (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    activeTab === 'settings' || activeTab === 'staff' || activeTab === 'superadmin'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="إعدادات النظام"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>الإعدادات</span>
                </button>

                {settingsDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                    {isShopAdmin && (
                      <button
                        onClick={() => { handleTabClick('settings'); setSettingsDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-800 text-right"
                      >
                        <Settings className="w-4 h-4 text-amber-400" />
                        <span>بيانات وإعدادات المحل</span>
                      </button>
                    )}
                    {isShopAdmin && (
                      <button
                        onClick={() => { handleTabClick('staff'); setSettingsDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-800 text-right"
                      >
                        <Users className="w-4 h-4 text-amber-400" />
                        <span>فريق العمل والمساعدين</span>
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => { handleTabClick('superadmin'); setSettingsDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-300 hover:text-white hover:bg-slate-800 text-right"
                      >
                        <Shield className="w-4 h-4 text-indigo-400" />
                        <span>إدارة المنصة (SuperAdmin)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200">{currentUser.name}</span>
              <span className={`text-[10px] font-medium ${
                isSuperAdmin ? 'text-indigo-400' : isShopAdmin ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {isSuperAdmin ? 'سوبر أدمن' : isShopAdmin ? 'صاحب المحل' : 'كاشير'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="hidden sm:flex items-center gap-1 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 hover:bg-slate-700 transition cursor-pointer"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu (Full width, vertical, elegant, zero horizontal overflow) */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-2 shadow-2xl animate-in slide-in-from-top-2">
          {/* User Info inside mobile drawer */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-200">{currentUser.name}</p>
              <p className="text-[10px] text-amber-400">
                {isSuperAdmin ? 'سوبر أدمن المنصة' : isShopAdmin ? 'صاحب المحل (مدير)' : 'كاشير'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-lg text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {isSuperAdmin && (
              <button
                onClick={() => handleTabClick('superadmin')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === 'superadmin'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800/80 text-indigo-300 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>إدارة المنصة</span>
              </button>
            )}

            <button
              onClick={() => handleTabClick('pos')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>نقطة البيع (POS)</span>
            </button>

            <button
              onClick={() => handleTabClick('inventory')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>المخزن</span>
            </button>

            <button
              onClick={() => handleTabClick('invoices')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>قسم الفواتير</span>
            </button>

            {!isCashier && (
              <button
                onClick={() => handleTabClick('daily')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span>ميزان الذهب</span>
              </button>
            )}

            {isShopAdmin && (
              <button
                onClick={() => handleTabClick('staff')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === 'staff'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>فريق العمل</span>
              </button>
            )}

            {isShopAdmin && (
              <button
                onClick={() => handleTabClick('settings')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>إعدادات المحل</span>
              </button>
            )}

            <button
              onClick={() => handleTabClick('ai_scanner')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition cursor-pointer col-span-2 ${
                activeTab === 'ai_scanner'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>فحص الذكاء الاصطناعي (AI Scanner)</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick Navigation Bar (Clean & Accessible) */}
      <div className="lg:hidden flex items-center justify-around bg-slate-950/95 backdrop-blur border-t border-slate-800/80 px-2 py-1.5 fixed bottom-0 left-0 right-0 z-50">
        <button
          onClick={() => handleTabClick('pos')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] ${
            activeTab === 'pos' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>نقطة البيع</span>
        </button>

        <button
          onClick={() => handleTabClick('inventory')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] ${
            activeTab === 'inventory' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>المخزن</span>
        </button>

        <button
          onClick={() => handleTabClick('invoices')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] ${
            activeTab === 'invoices' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>قسم الفواتير</span>
        </button>

        {!isCashier && (
          <button
            onClick={() => handleTabClick('daily')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] ${
              activeTab === 'daily' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>الميزان</span>
          </button>
        )}

        {isShopAdmin && (
          <button
            onClick={() => handleTabClick('settings')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] ${
              activeTab === 'settings' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>الإعدادات</span>
          </button>
        )}
      </div>
    </header>
  );
};
