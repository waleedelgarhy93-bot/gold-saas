import React, { useState, useEffect } from 'react';
import type { GoldPrices, Invoice, VisionAnalysisResult, User, ShopInfo } from './types';
import { fetchGoldPrices, defaultPrices, fetchShopInfo } from './api';
import { Navbar, type AppTab } from './components/Navbar';
import { POSScreen } from './components/POSScreen';
import { InventoryView } from './components/InventoryView';
import { InvoicesListView } from './components/InvoicesListView';
import { PeriodicInventoryAuditView } from './components/PeriodicInventoryAuditView';
import { StaffManagementView } from './components/StaffManagementView';
import { SuperAdminView } from './components/SuperAdminView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { AIScannerModal } from './components/AIScannerModal';
import { PriceModal } from './components/PriceModal';
import { ThermalReceipt } from './components/ThermalReceipt';
import { LoginScreen } from './components/LoginScreen';
import { MarketingLanding } from './components/MarketingLanding';

export const App: React.FC = () => {
  // Current authenticated user (null = show login)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('gold_user');
    return saved ? JSON.parse(saved) : null;
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
  const [activeTab, setActiveTab] = useState<AppTab>('pos');
  
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
    fetchGoldPrices().then(setPrices);
    fetchShopInfo().then(setShopInfo);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('gold_user', JSON.stringify(user));
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

  const currentShopName = shopInfo?.name || currentUser.shop_name || 'مجوهرات الأمانة الذهبية';

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

      {/* Main Content Area */}
      <main className="flex-1 no-print pb-16 lg:pb-6 overflow-x-hidden">
        {activeTab === 'pos' && (
          <POSScreen
            prices={prices}
            onOpenAIScanner={handleOpenScanner}
            scannedCustomer={scannedCustomer}
            scannedItem={scannedItem}
            onInvoiceSaved={(inv) => setActiveInvoice(inv)}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView role={currentUser.role} />
        )}

        {activeTab === 'invoices' && (
          <InvoicesListView onSelectInvoiceForPrint={(inv) => setActiveInvoice(inv)} />
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
                  name: `${updated.owner_name} (صاحب المحل)`,
                  shop_name: updated.name
                };
                setCurrentUser(updatedUser);
                localStorage.setItem('gold_user', JSON.stringify(updatedUser));
              }
            }}
          />
        )}

        {activeTab === 'superadmin' && currentUser.role === 'super_admin' && (
          <SuperAdminView />
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
    </div>
  );
};

export default App;
