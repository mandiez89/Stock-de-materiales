import React, { useState, useMemo, useEffect } from 'react';
import { 
  MONTHLY_FACTORS, 
  RAW_MATERIALS_FROM_SHEET, 
  computeMaterialCalculations 
} from './data/initialData';
import { exportInventoryToCSV } from './data/sheetsIntegration';
import { MaterialItem, MonthlyFactor, UserRole } from './types';
import { Header, AppTab } from './components/Header';
import { StockDashboard } from './components/StockDashboard';
import { TabletStockEntry } from './components/TabletStockEntry';
import { CurrentStockView } from './components/CurrentStockView';
import { ProductMonthlyMinMaxView } from './components/ProductMonthlyMinMaxView';
import { SheetsIntegrationView } from './components/SheetsIntegrationView';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { syncWithGoogleSheets } from './services/sheetsSync';

export default function App() {
  // By default, the app ALWAYS opens in Tablet Mode (operator).
  // The Admin portal is kept separate and secured with PIN 1458.
  const [userRole, setUserRole] = useState<UserRole>('operator');

  // Navigation: default view is 'entry' (Planilla de Carga Tablet)
  const [activeTab, setActiveTab] = useState<AppTab>('entry');

  // Strict operator protection: enforce operator tabs only
  useEffect(() => {
    if (userRole === 'operator' && activeTab !== 'entry' && activeTab !== 'stock') {
      setActiveTab('entry');
    }
  }, [userRole, activeTab]);

  // Monthly factors (can be customized by the user)
  const [monthlyFactors, setMonthlyFactors] = useState<MonthlyFactor[]>(MONTHLY_FACTORS);
  
  // Current month: ALWAYS automatically taken from system date (0 = Enero ... 11 = Diciembre)
  const currentMonthIndex = useMemo(() => new Date().getMonth(), []);
  const selectedMonth = useMemo(() => {
    return monthlyFactors[currentMonthIndex] || monthlyFactors[0];
  }, [monthlyFactors, currentMonthIndex]);

  // Raw items state (includes per-month min/max matrix for all 52 products)
  const [rawItems, setRawItems] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem('sugestion_raw_items_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === RAW_MATERIALS_FROM_SHEET.length) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return RAW_MATERIALS_FROM_SHEET as unknown as MaterialItem[];
  });

  // Auto-save raw items to localStorage
  useEffect(() => {
    localStorage.setItem('sugestion_raw_items_v3', JSON.stringify(rawItems));
  }, [rawItems]);

  // Sheets connection status flag
  const [sheetsConnected, setSheetsConnected] = useState<boolean>(true);

  // Modals
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);

  // Dynamically compute adjusted items based on month factor AND per-product monthly min/max
  const computedItems: MaterialItem[] = useMemo(() => {
    return rawItems.map((raw) => 
      computeMaterialCalculations(raw, selectedMonth.factor, selectedMonth.month)
    );
  }, [rawItems, selectedMonth.factor, selectedMonth.month]);

  // Derived counts
  const criticalCount = useMemo(
    () => computedItems.filter((i) => i.status === 'CRITICO').length,
    [computedItems]
  );
  const itemsToOrder = useMemo(
    () => computedItems.filter((i) => i.unitsToOrder > 0),
    [computedItems]
  );
  const totalUnitsToOrder = useMemo(
    () => computedItems.reduce((acc, i) => acc + i.unitsToOrder, 0),
    [computedItems]
  );

  // Handlers
  const handleUpdateBultos = (id: string, newBultos: number) => {
    setRawItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              bultos: newBultos,
              totalUnits: newBultos * item.unitsPerBulto,
              isDirectUnits: false,
            }
          : item
      )
    );
  };

  const handleSaveBatch = (
    updatedItems: MaterialItem[],
    _responsible: string,
    _date: string,
    _notes: string
  ) => {
    setRawItems((prev) =>
      prev.map((oldItem) => {
        const found = updatedItems.find((u) => u.id === oldItem.id);
        if (found) {
          return {
            ...oldItem,
            bultos: found.bultos,
            unitsPerBulto: found.unitsPerBulto,
            totalUnits: found.totalUnits,
            isDirectUnits: found.isDirectUnits,
            allowDirectTotal: found.allowDirectTotal,
          };
        }
        return oldItem;
      })
    );
  };

  // Sync to Google Sheets via direct webhook / proxy
  const handleSyncWithSheets = async (
    itemsToSync: MaterialItem[],
    meta: { responsible: string; date: string; month: string }
  ): Promise<boolean> => {
    try {
      const webhookUrl = localStorage.getItem('sugestion_webhook_url') || '';
      const result = await syncWithGoogleSheets(webhookUrl, {
        action: 'UPDATE_STOCK',
        metadata: meta,
        items: itemsToSync,
      });

      if (result.success) {
        setSheetsConnected(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error syncing to sheets:', e);
      return false;
    }
  };

  // Sync Min/Max parameters matrix to Google Sheets
  const handleSyncMinMaxToSheets = async (updatedItems: MaterialItem[]): Promise<boolean> => {
    try {
      const webhookUrl = localStorage.getItem('sugestion_webhook_url') || '';
      const result = await syncWithGoogleSheets(webhookUrl, {
        action: 'UPDATE_MIN_MAX',
        minMaxMatrix: updatedItems,
      });
      return !!result.success;
    } catch (e) {
      console.error('Error syncing min/max to sheets:', e);
      return false;
    }
  };

  // Update items min/max matrix from ProductMonthlyMinMaxView
  const handleUpdateItemsMinMax = (updatedItems: MaterialItem[]) => {
    setRawItems(updatedItems);
  };

  const handleExportCSV = () => {
    const csvData = exportInventoryToCSV(
      computedItems,
      selectedMonth.name,
      'Operador Depósito',
      new Date().toISOString().split('T')[0]
    );
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_MP_Sugestion_${selectedMonth.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        selectedMonth={selectedMonth}
        monthlyFactors={monthlyFactors}
        onExportCSV={handleExportCSV}
        onOpenPurchaseOrder={() => setIsPurchaseOrderOpen(true)}
        criticalCount={criticalCount}
        totalUnitsToOrder={totalUnitsToOrder}
        sheetsConnected={sheetsConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: Dashboard & Orders (Admin Only) */}
        {activeTab === 'dashboard' && userRole === 'admin' && (
          <StockDashboard
            items={computedItems}
            selectedMonth={selectedMonth}
            onUpdateBultos={handleUpdateBultos}
            onOpenPurchaseOrder={() => setIsPurchaseOrderOpen(true)}
          />
        )}

        {/* VIEW 2: Tablet Stock Entry (Operator & Admin) */}
        {activeTab === 'entry' && (
          <TabletStockEntry
            items={computedItems}
            selectedMonth={selectedMonth}
            onSaveBatch={handleSaveBatch}
            onSyncWithSheets={handleSyncWithSheets}
          />
        )}

        {/* VIEW 3: Stock Actual Contado (Operator & Admin) */}
        {activeTab === 'stock' && (
          <CurrentStockView
            items={computedItems}
            selectedMonth={selectedMonth}
            onNavigateToEntry={() => setActiveTab('entry')}
          />
        )}

        {/* VIEW 4: Monthly Min/Max Matrix per Product (Admin Only) */}
        {activeTab === 'minmax' && userRole === 'admin' && (
          <ProductMonthlyMinMaxView
            items={computedItems}
            monthlyFactors={monthlyFactors}
            onUpdateItemsMinMax={handleUpdateItemsMinMax}
            onSyncMinMaxToSheets={handleSyncMinMaxToSheets}
          />
        )}

        {/* VIEW 5: Google Sheets Webhook Architecture (Admin Only) */}
        {activeTab === 'sheets' && userRole === 'admin' && (
          <SheetsIntegrationView
            items={computedItems}
            selectedMonth={selectedMonth}
            onSyncSuccess={() => setSheetsConnected(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Sugestión</strong> • Sistema Digital de Stock de Materia Prima y Packaging
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-400">
              Perfil Activo: <strong className="text-slate-700 uppercase">{userRole === 'operator' ? 'Tablet / Operador Depósito' : 'Administrador'}</strong>
            </span>
            {userRole === 'admin' && (
              <button
                onClick={() => setActiveTab('sheets')}
                className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
              >
                Configurar Google Sheets
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Purchase Order Modal (By Category & Total Units Only) */}
      <PurchaseOrderModal
        isOpen={isPurchaseOrderOpen}
        onClose={() => setIsPurchaseOrderOpen(false)}
        itemsToOrder={itemsToOrder}
        monthName={selectedMonth.name}
      />
    </div>
  );
}
