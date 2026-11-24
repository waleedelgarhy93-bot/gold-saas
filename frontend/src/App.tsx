import React, { useState, useEffect } from 'react';
import type { GoldPrices, Invoice, VisionAnalysisResult, User, ShopInfo } from './types';
import { fetchGoldPrices, defaultPrices, fetchShopInfo, getAuthToken } from './api';
import { Navbar, type AppTab } from './components/Navbar';
import { POSScreen } from './components/POSScreen';
import { InventoryView } from './components/InventoryView';
import { TrustsView } from './components/TrustsView';
import { InvoicesListView } from './components/InvoicesListView';
import { PeriodicInventoryAuditView } from './components/PeriodicInventoryAuditView';
import { StaffManagementView } from './components/StaffManagementView';
import { SuperAdminView } from './components/SuperAdminView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { AIScannerModal } from './components/AIScannerModal';
import { PriceModal } from './components/PriceModal';
import { ThermalReceipt } from './components/ThermalReceipt';
import { QuickCalculator } from './components/QuickCalculator';
import { PendingLocalInvoicesBanner } from './components/PendingLocalInvoicesBanner';
import { LoginScreen } from './components/LoginScreen';
import { MarketingLanding } from './components/MarketingLanding';

export const App: React.FC = () => {
  // Current authenticated user (null = show login)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('gold_user');
    return saved ? (JSON.parse(saved) as User) : null;
  });

  // View mode when not logged in: 'login' | 'landing' (defaults to 'login' as primary)
  const [unauthView, setUnauthView] = useState<'login' | 'landing'>(() => {
    // If URL has ?landing or #landing open marketing page directly
    if (typeof window !== 'undefined' && (window.location.search.includes('landing') || window.location.hash.includes('landing'))) {
      return 'landing';
    }
    return 'login';
  });
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [prices, setPrices] = useState<GoldPrices>(defaultPrices);
  // السوبر أدمن بيفتح دايماً على لوحة المنصة (حتى بعد الريفرش)
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    currentUser?.role === 'super_admin' ? 'superadmin' : 'pos'
  );
  
  // Modals state
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'id' | 'bullion'>('id');

  // Scanned data passed into POS
  const [scannedCustomer, setScannedCustomer] = useState<{ name: string | null; national_id: string | null } | undefined>(undefined);
  const [scannedItem, setScannedItem] = useState<{ brand: string | null; serial_number: string | null; karat: number; declared_weight: number } | undefined>(undefined);

  // Active invoice for printing
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

    useEffect(() => {
    if (currentUser?.role === 'cashier' && activeTab === 'inventory') {
      setActiveTab('pos');
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    // قبل الدخول، أو للسوبر أدمن: مفيش محل نحمّل أسعاره أو بياناته
    if (!currentUser || currentUser.role === 'super_admin') return;
    fetchGoldPrices().then(setPrices);
    if (currentUser.shop_id) {
      fetchShopInfo(currentUser.shop_id).then(setShopInfo);
    } else {
      fetchShopInfo().then(setShopInfo);
    }
  }, [currentUser?.shop_id, currentUser?.role]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('gold_user', JSON.stringify(user));
    if (user.shop_id) {
      fetchShopInfo(user.shop_id).then(setShopInfo);
    }
    if (user.role === 'super_admin') {
      setActiveTab('superadmin');
    } else {
      setActiveTab('pos');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('gold_user');
    setActiveTab('pos');
  };

  const handleOpenScanner = (mode: 'id' | 'bullion') => {
    setScannerMode(mode);
    setIsScannerOpen(true);
  };

  const handleApplyVisionData = (data: VisionAnalysisResult) => {
    if (data.detected_type === 'national_id' || data.customer?.name || data.customer?.national_id) {
      setScannedCustomer({
        name: data.customer?.name || null,
        national_id: data.customer?.national_id || null,
      });
      setActiveTab('pos');
    }

    if (data.detected_type === 'bullion_card' || data.gold_item?.brand) {
      setScannedItem({
        brand: data.gold_item?.brand || null,
        serial_number: data.gold_item?.serial_number || null,
        karat: data.gold_item?.karat || 24,
        declared_weight: data.gold_item?.declared_weight || 10.0,
      });
      setActiveTab('pos');
    }
  };

  // If not logged in, render the Login Screen or Marketing Landing
  if (!currentUser) {
    if (unauthView === 'landing') {
      return <MarketingLanding onGoToLogin={() => setUnauthView('login')} />;
    }
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess} 
        onGoToLanding={() => setUnauthView('landing')} 
      />
    );
  }

  const currentShopName = shopInfo?.name || currentUser.shop_name || 'محل الذهب والمجوهرات';

  // صاحب المنصة: لوحة المنصة بس، من غير شاشات المحل
  if (currentUser.role === 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar
          prices={prices}
          currentUser={currentUser}
          shopName={currentShopName}
          activeTab="superadmin"
          setActiveTab={() => {}}
          onOpenPriceModal={() => {}}
          onLogout={handleLogout}
        />
        <main className="flex-1 pb-6 overflow-x-hidden">
          <SuperAdminView />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Navbar with ticker and role badges */}
      <div className="no-print">
        <Navbar
          prices={prices}
          currentUser={currentUser}
          shopName={currentShopName}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'ai_scanner') {
              handleOpenScanner('id');
            } else {
              setActiveTab(tab);
            }
          }}
          onOpenPriceModal={() => setIsPriceModalOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* فواتير اتحفظت على الجهاز بس وقت مشكلة الاتصال */}
      <PendingLocalInvoicesBanner />

      {/* Main Content Area */}
      <main className="flex-1 no-print pb-16 lg:pb-6 overflow-x-hidden">
        {activeTab === 'pos' && (
          <POSScreen
            prices={prices}
            onOpenAIScanner={handleOpenScanner}
            scannedCustomer={scannedCustomer}
            scannedItem={scannedItem}
            onInvoiceSaved={(inv) => setActiveInvoice(inv)}
            shopInfo={shopInfo}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView role={currentUser.role} />
        )}

        {activeTab === 'trusts' && currentUser.role !== 'cashier' && (
          <TrustsView
            shopInfo={shopInfo}
            isAdmin={currentUser.role === 'shop_admin' || currentUser.role === 'super_admin'}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesListView
            onSelectInvoiceForPrint={(inv) => setActiveInvoice(inv)}
            shopInfo={shopInfo}
          />
        )}

        {activeTab === 'daily' && currentUser.role !== 'cashier' && (
          <PeriodicInventoryAuditView />
        )}

        {activeTab === 'staff' && currentUser.role === 'shop_admin' && (
          <StaffManagementView />
        )}

        {activeTab === 'settings' && currentUser.role === 'shop_admin' && (
          <ShopSettingsView
            currentUser={currentUser}
            onShopUpdated={(updated) => {
              setShopInfo(updated);
              if (currentUser && currentUser.role === 'shop_admin') {
                const updatedUser: User = {
                  ...currentUser,
                  // لو كلمة المرور اتغيرت في نفس الجلسة، التوكن الجديد محفوظ في localStorage
                  token: getAuthToken() || currentUser.token,
                  name: `${updated.owner_name} (صاحب المحل)`,
                  shop_name: updated.name
                };
                setCurrentUser(updatedUser);
                localStorage.setItem('gold_user', JSON.stringify(updatedUser));
              }
            }}
          />
        )}
      </main>

      {/* Printable Thermal Receipt */}
      <ThermalReceipt invoice={activeInvoice} shopInfo={shopInfo} />

      {/* Modals */}
      <PriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        currentPrices={prices}
        onPricesUpdated={setPrices}
      />

      <AIScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode={scannerMode}
        onApplyData={handleApplyVisionData}
      />

      {/* Floating Jewelry Calculator */}
      <QuickCalculator />
    </div>
  );
};

export default App;
