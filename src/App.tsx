import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { CloudSyncSettingsModal } from './components/CloudSyncSettingsModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { callSheets, getSheetsConfig, isSheetsConfigured } from './services/sheetsSync';
import { mergeMinMaxEdits, mergeSavedItems, normalizeRawItem } from './state/stockState';
import {
  loadDirtyIds,
  loadMinMaxDirty,
  saveDirtyIds,
  saveMinMaxDirty,
  useSheetsSync,
} from './state/useSheetsSync';

const ITEMS_KEY = 'sugestion_raw_items_v3';

export default function App() {
  // By default, the app ALWAYS opens in Tablet Mode (operator).
  // The Admin portal is kept separate behind a PIN.
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

  // Raw items state (includes per-month min/max matrix for all products).
  // This is the single source of truth: every view reads it and every edit goes through updateItem.
  const [rawItems, setRawItems] = useState<MaterialItem[]>(() => {
    const catalog = RAW_MATERIALS_FROM_SHEET as unknown as MaterialItem[];
    try {
      return mergeSavedItems(catalog, JSON.parse(localStorage.getItem(ITEMS_KEY) || 'null'));
    } catch {
      return catalog;
    }
  });

  // Items edited on this device and not yet confirmed by Google Sheets
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(loadDirtyIds);
  const [minMaxDirty, setMinMaxDirty] = useState<boolean>(loadMinMaxDirty);

  useEffect(() => {
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(rawItems));
    } catch {
      // storage full or unavailable
    }
  }, [rawItems]);
  useEffect(() => saveDirtyIds(dirtyIds), [dirtyIds]);
  useEffect(() => saveMinMaxDirty(minMaxDirty), [minMaxDirty]);

  // Modals
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [isCloudSettingsOpen, setIsCloudSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Load live shared database state on initial render so all devices start in sync
  useEffect(() => {
    let active = true;
    fetch('/api/shared-state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data || !data.success || !Array.isArray(data.items) || data.items.length === 0) return;
        setRawItems((prev) => applyRemoteStock(prev, data.items, loadDirtyIds()).items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Dynamically compute adjusted items based on per-product monthly min/max
  const computedItems: MaterialItem[] = useMemo(() => {
    return rawItems.map((raw) => 
      computeMaterialCalculations(raw, selectedMonth.factor, selectedMonth.month)
    );
  }, [rawItems, selectedMonth.factor, selectedMonth.month]);

  const sync = useSheetsSync({
    setRawItems,
    computedItems,
    dirtyIds,
    setDirtyIds,
    minMaxDirty,
    monthName: selectedMonth.name,
  });

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

  // Single entry point for stock edits: recomputes derived fields, stamps the time
  // and queues the item for Google Sheets.
  const updateItem = useCallback(
    (id: string, change: (item: MaterialItem) => MaterialItem) => {
      setRawItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...normalizeRawItem(change(item), selectedMonth.month), lastUpdated: new Date().toISOString() }
            : item
        )
      );
      setDirtyIds((prev) => new Set(prev).add(id));
    },
    [selectedMonth.month]
  );

  // Dashboard +/- : newBultos is the item total; with several batches apply only the difference to the first one
  const handleUpdateBultos = (id: string, newBultos: number) =>
    updateItem(id, (item) => {
      const batches = item.batches && item.batches.length > 0 ? item.batches : undefined;
      if (!batches) {
        return { ...item, bultos: newBultos, totalUnits: newBultos * item.unitsPerBulto, isDirectUnits: false, allowDirectTotal: false };
      }
      const currentTotal = batches.reduce((acc, b) => acc + (b.bultos || 0), 0);
      const first = batches[0];
      return {
        ...item,
        batches: [{ ...first, bultos: Math.max(0, (first.bultos || 0) + newBultos - currentTotal) }, ...batches.slice(1)],
        isDirectUnits: false,
        allowDirectTotal: false,
      };
    });

  const handleToggleOrdered = async (id: string, isOrdered: boolean) => {
    const target = rawItems.find((i) => i.id === id);
    const ts = new Date().toISOString();
    const computedTarget = target ? computeMaterialCalculations(target, selectedMonth.factor, selectedMonth.month) : null;
    const orderedUnits = isOrdered ? (computedTarget ? computedTarget.unitsToOrder : 0) : undefined;
    const orderedStockSnapshot = isOrdered ? (target ? target.totalUnits : undefined) : undefined;
    const orderedAt = isOrdered ? ts : undefined;

    updateItem(id, (item) => ({
      ...item,
      isOrdered,
      orderedAt,
      orderedStockSnapshot,
      orderedUnits,
    }));

    // Save directly to the shared server database so any other tablet or PC sees the order immediately
    try {
      const cfg = getSheetsConfig();
      const res = await fetch('/api/mark-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: id,
          itemName: target?.name,
          isOrdered,
          orderedUnits: orderedUnits ?? 0,
          orderedStockSnapshot,
          orderedAt,
          month: selectedMonth.name,
          webhookUrl: cfg.webhookUrl,
          accessToken: cfg.accessToken,
        }),
      });

      if (res.ok) {
        setToastMessage(
          isOrdered
            ? `✓ Pedido guardado en base de datos: ${target?.name || 'Material'}`
            : `✓ Estado de pedido actualizado: ${target?.name || 'Material'}`
        );
      }
    } catch {
      // offline / local fallback
      setToastMessage(
        isOrdered
          ? `✓ Pedido marcado localmente: ${target?.name || 'Material'}`
          : `✓ Estado actualizado localmente: ${target?.name || 'Material'}`
      );
    }

    // Also forward immediately to Google Sheets if configured
    if (target && isSheetsConfigured()) {
      const updatedItem = {
        ...target,
        isOrdered,
        orderedAt,
        orderedStockSnapshot,
        orderedUnits,
        lastUpdated: ts,
      };
      void callSheets('UPDATE_STOCK', { items: [updatedItem] });
      if (isOrdered && orderedUnits && orderedUnits > 0) {
        void callSheets('LOG_ORDER', {
          order: {
            month: selectedMonth.name,
            items: [{ id: target.id, name: target.name, unitsToOrder: orderedUnits }],
          },
        });
      }
    }
  };

  const handleMarkBatchOrdered = async (items: MaterialItem[]) => {
    if (!items || items.length === 0) return;
    const ts = new Date().toISOString();
    const batchOrders = items.map((item) => {
      const computed = computeMaterialCalculations(item, selectedMonth.factor, selectedMonth.month);
      return {
        itemId: item.id,
        itemName: item.name,
        isOrdered: true,
        orderedUnits: computed.unitsToOrder || 0,
        orderedStockSnapshot: item.totalUnits,
        orderedAt: ts,
        month: selectedMonth.name,
      };
    });

    const itemMap = new Map(batchOrders.map((o) => [o.itemId, o]));
    setRawItems((prev) =>
      prev.map((item) => {
        const match = itemMap.get(item.id);
        if (!match) return item;
        return {
          ...item,
          isOrdered: true,
          orderedAt: ts,
          orderedStockSnapshot: match.orderedStockSnapshot,
          orderedUnits: match.orderedUnits,
          lastUpdated: ts,
        };
      })
    );

    try {
      const cfg = getSheetsConfig();
      const res = await fetch('/api/mark-orders-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: batchOrders,
          webhookUrl: cfg.webhookUrl,
          accessToken: cfg.accessToken,
        }),
      });

      if (res.ok) {
        setToastMessage(`✓ ${batchOrders.length} materiales registrados como pedidos en la base de datos central.`);
      }
    } catch {
      setToastMessage(`✓ ${batchOrders.length} pedidos registrados localmente.`);
    }
  };

  // Min/max edits only touch configuration, never stock counts
  const handleUpdateItemsMinMax = (updatedItems: MaterialItem[]) => {
    setRawItems((prev) => mergeMinMaxEdits(prev, updatedItems));
    setMinMaxDirty(true);
  };

  const handleSyncMinMaxToSheets = async (updatedItems: MaterialItem[]): Promise<boolean> => {
    const merged = mergeMinMaxEdits(rawItems, updatedItems);
    setRawItems((prev) => mergeMinMaxEdits(prev, updatedItems));
    setMinMaxDirty(true);
    const result = await callSheets('UPDATE_MIN_MAX', { minMaxMatrix: merged });
    if (result.success) setMinMaxDirty(false);
    return result.success;
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
        onOpenSyncSettings={() => setIsCloudSettingsOpen(true)}
        criticalCount={criticalCount}
        totalUnitsToOrder={totalUnitsToOrder}
        sync={sync}
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
            onToggleOrdered={handleToggleOrdered}
          />
        )}

        {/* VIEW 2: Tablet Stock Entry (Operator & Admin) */}
        {activeTab === 'entry' && (
          <TabletStockEntry
            items={computedItems}
            selectedMonth={selectedMonth}
            onUpdateItem={updateItem}
            sync={sync}
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
                onClick={() => setIsCloudSettingsOpen(true)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition-colors"
              >
                Ajustes de Sincronización en la Nube
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
        onMarkBatchOrdered={handleMarkBatchOrdered}
        onToggleOrdered={handleToggleOrdered}
      />

      {/* Cloud Sync Settings Modal (Admin Only) */}
      <CloudSyncSettingsModal
        isOpen={isCloudSettingsOpen}
        onClose={() => setIsCloudSettingsOpen(false)}
        items={computedItems}
        selectedMonth={selectedMonth}
        sync={sync}
      />

      {/* Floating Database Sync Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
