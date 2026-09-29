import React, { useState, useMemo } from 'react';
import { 
  Tablet, 
  SendHorizontal, 
  Search, 
  Plus, 
  Minus, 
  Wifi, 
  Package,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudCheck,
  RefreshCw,
  Zap,
  Check,
  Truck,
  History
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor, BultoBatch, StockMovement, MovementType } from '../types';
import confetti from 'canvas-confetti';
import { SheetsSyncState } from '../state/useSheetsSync';

interface TabletStockEntryProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onUpdateItem: (id: string, change: (item: MaterialItem) => MaterialItem) => void;
  sync: SheetsSyncState;
  onRecordMovement?: (movement: Omit<StockMovement, 'id' | 'dateFormatted'>) => Promise<void> | void;
}

// Category visual badges and styling for instant recognition
const CATEGORY_STYLES: Record<MaterialCategory, { bg: string; text: string; border: string; icon: string; title: string }> = {
  Cajas: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: '📦',
    title: 'Cajas de Empaque y Presentación'
  },
  Celofanes: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200',
    icon: '📄',
    title: 'Celofanes (Sin Impresión)'
  },
  Bolsitas: {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: '🛍️',
    title: 'Bolsitas (Con Impresión)'
  },
  Caballetes: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: '🏷️',
    title: 'Caballetes de Cartulina'
  },
  Cartones: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: '📋',
    title: 'Cartones Soporte'
  }
};

// Ensure an item has valid batches
function normalizeBatches(item: MaterialItem): BultoBatch[] {
  if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
    return item.batches;
  }
  return [
    {
      id: `batch-${item.id}-1`,
      bultos: item.bultos ?? 0,
      unitsPerBulto: item.unitsPerBulto || 1,
      label: 'Partida 1',
    }
  ];
}

export const TabletStockEntry: React.FC<TabletStockEntryProps> = ({
  items,
  selectedMonth,
  onUpdateItem,
  sync,
  onRecordMovement,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Edits go straight to the app state; status and totals are recomputed there
  const updateBatches = (itemId: string, change: (batches: BultoBatch[]) => BultoBatch[]) => {
    onUpdateItem(itemId, (item) => {
      const batches = change(normalizeBatches(item));
      return { ...item, batches, unitsPerBulto: batches[0]?.unitsPerBulto || item.unitsPerBulto };
    });
  };

  const setBatchField = (itemId: string, batchId: string, patch: (b: BultoBatch) => Partial<BultoBatch>) =>
    updateBatches(itemId, (batches) => batches.map((b) => (b.id === batchId ? { ...b, ...patch(b) } : b)));

  // Step bultos for a specific batch (Abrir o sumar bultos)
  const handleStepBatchBultos = (itemId: string, batchId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (item && onRecordMovement) {
      const batch = (item.batches || []).find((b) => b.id === batchId) || {
        id: batchId,
        bultos: item.bultos,
        unitsPerBulto: item.unitsPerBulto,
      };
      const curBatchBultos = batch.bultos || 0;
      const targetBatchBultos = Math.max(0, curBatchBultos + delta);
      const actualDelta = targetBatchBultos - curBatchBultos;

      if (actualDelta !== 0) {
        const uPerBto = batch.unitsPerBulto || item.unitsPerBulto || 1;
        const uDelta = actualDelta * uPerBto;
        const prevBultos = item.bultos;
        const newBultos = Math.max(0, prevBultos + actualDelta);
        const prevUnits = item.totalUnits;
        const newUnits = Math.max(0, prevUnits + uDelta);

        const type: MovementType = actualDelta < 0 ? 'ABRIR_BULTO' : 'ENTRADA';
        const reason =
          actualDelta === -1
            ? 'Apertura de bulto para empaque'
            : actualDelta === 1
            ? 'Entrada de 1 bulto cerrado'
            : actualDelta === 5
            ? 'Carga rápida (+5 btos)'
            : `${actualDelta > 0 ? `+${actualDelta}` : actualDelta} btos`;

        onRecordMovement({
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          type,
          timestamp: new Date().toISOString(),
          bultosDelta: actualDelta,
          unitsDelta: uDelta,
          previousBultos: prevBultos,
          newBultos,
          previousUnits: prevUnits,
          newUnits,
          unitsPerBulto: uPerBto,
          batchId,
          responsible: 'Operador Depósito',
          reason,
        });
      }
    }

    setBatchField(itemId, batchId, (b) => ({ bultos: Math.max(0, (b.bultos || 0) + delta) }));
  };

  // Set explicit bultos count for a specific batch
  const handleSetBatchBultos = (itemId: string, batchId: string, value: number) =>
    setBatchField(itemId, batchId, () => ({ bultos: Math.max(0, isNaN(value) ? 0 : Math.floor(value)) }));

  // Set units per bulto for a specific batch
  const handleSetBatchUnitsPerBulto = (itemId: string, batchId: string, value: number) =>
    setBatchField(itemId, batchId, () => ({
      unitsPerBulto: isNaN(value) ? 0 : Math.max(0, Math.floor(value)),
    }));

  // Add extra batch line (e.g. 15 bultos de 85 unidades)
  const handleAddBatch = (itemId: string) =>
    updateBatches(itemId, (batches) => [
      ...batches,
      {
        id: `batch-${itemId}-${Date.now()}`,
        bultos: 0,
        unitsPerBulto: batches[0]?.unitsPerBulto || 100,
        label: `Partida ${batches.length + 1}`,
      },
    ]);

  // Remove a batch line (if more than 1 batch)
  const handleRemoveBatch = (itemId: string, batchId: string) =>
    updateBatches(itemId, (batches) => (batches.length <= 1 ? batches : batches.filter((b) => b.id !== batchId)));

  // Toggle direct total entry per item (Manual vs Auto)
  const handleToggleAllowDirectTotal = (id: string) =>
    onUpdateItem(id, (item) => {
      const next = !(item.allowDirectTotal ?? false);
      return { ...item, batches: normalizeBatches(item), allowDirectTotal: next, isDirectUnits: next };
    });

  // Set by Total Units directly (only when direct entry is enabled)
  const handleSetTotalUnitsDirect = (id: string, newTotalVal: number) => {
    const totalUnits = Math.max(0, isNaN(newTotalVal) ? 0 : Math.floor(newTotalVal));
    onUpdateItem(id, (item) => ({ ...item, totalUnits, isDirectUnits: true, allowDirectTotal: true }));
  };

  // Categories list
  const categoriesList: { id: string; label: string; count: number; icon: string }[] = [
    { id: 'all', label: 'Todos', count: items.length, icon: '📋' },
    { id: 'Cajas', label: 'Cajas', count: items.filter((i) => i.category === 'Cajas').length, icon: '📦' },
    { id: 'Celofanes', label: 'Celofanes', count: items.filter((i) => i.category === 'Celofanes').length, icon: '📄' },
    { id: 'Bolsitas', label: 'Bolsitas', count: items.filter((i) => i.category === 'Bolsitas').length, icon: '🛍️' },
    { id: 'Caballetes', label: 'Caballetes', count: items.filter((i) => i.category === 'Caballetes').length, icon: '🏷️' },
    { id: 'Cartones', label: 'Cartones', count: items.filter((i) => i.category === 'Cartones').length, icon: '📋' },
  ];

  const groupedCategories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  const filteredCategories = useMemo(() => {
    if (activeCategory === 'all') {
      return groupedCategories;
    }
    return groupedCategories.filter((c) => c === activeCategory);
  }, [activeCategory]);

  // Overall totals
  const totalUnitsCounted = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.totalUnits || 0), 0);
  }, [items]);

  const totalBultosCounted = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.bultos || 0), 0);
  }, [items]);

  // Manual sync: sends everything now and records a history row in the sheet
  const handleForceManualSync = async () => {
    if (await sync.syncNow()) {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.9 } });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-28 space-y-3 font-sans">
      {/* VERTICAL-FIRST TOP BAR: Compact & Informative for portrait tablets/phones */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Title & Live Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Tablet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                  Planilla de Carga MP
                </h2>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  En Vivo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Descontá con <strong className="text-rose-600">[-]</strong> al abrir bulto para empaque
              </p>
            </div>
          </div>

          {/* Cloud Auto-Sync Indicator & Manual Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleForceManualSync}
              disabled={sync.status === 'syncing'}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                sync.status === 'syncing'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : sync.status === 'synced'
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : sync.status === 'error'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}
              title="Sincronizar de inmediato con la nube"
            >
              {sync.status === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  <span className="hidden sm:inline text-[11px]">Guardando...</span>
                </>
              ) : sync.status === 'synced' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span className="text-[11px] hidden sm:inline">Nube al día</span>
                  <span className="text-[11px] sm:hidden">Al día</span>
                </>
              ) : sync.status === 'error' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px]">Reintentar</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px]">Sincronizar</span>
                </>
              )}
            </button>

          </div>
        </div>

        {/* Immediate Sync Status Banner */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-medium text-slate-600 truncate">
              {!sync.configured ? (
                <span className="text-amber-700 font-bold">Modo local: los datos se guardan solo en esta tablet</span>
              ) : sync.autoSync ? (
                sync.status === 'syncing' ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin inline" /> Guardando en la nube de inmediato...
                  </span>
                ) : sync.status === 'pending' || sync.pendingCount > 0 ? (
                  <span className="text-indigo-600 font-medium">{sync.pendingCount} cambio(s) pendientes de sincronizar...</span>
                ) : sync.lastSyncedAt ? (
                  <span>
                    Guardado en la nube a las <strong className="text-slate-700 font-mono">{sync.lastSyncedAt}</strong>
                  </span>
                ) : (
                  <span>Autoguardado en la nube activo</span>
                )
              ) : (
                <span>Autoguardado inmediato pausado</span>
              )}
            </span>
          </div>

          <label className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold cursor-pointer shrink-0 select-none">
            <input
              type="checkbox"
              checked={sync.autoSync}
              onChange={(e) => sync.setAutoSync(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <span className="hidden sm:inline">Autoguardado inmediato</span>
          </label>
        </div>
      </div>

      {/* Error alert if sync failed */}
      {sync.error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between gap-2 animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{sync.error}</span>
          </div>
          <button
            onClick={handleForceManualSync}
            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg shrink-0 cursor-pointer"
          >
            Reintentar ahora
          </button>
        </div>
      )}

      {/* HORIZONTAL SWIPABLE CATEGORY BAR & SEARCH (Perfect for vertical portrait navigation) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs space-y-2 sticky top-16 z-30 backdrop-blur-md bg-white/95">
        {/* Category Pills Slider */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
          {categoriesList.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar material (ej: Cajas 5 cm, Celofán 15x20...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* VERTICAL-FIRST PRODUCT CARDS */}
      <div className="space-y-4">
        {filteredCategories.map((category) => {
          const categoryStyle = CATEGORY_STYLES[category];
          const categoryItems = items.filter(
            (item) =>
              item.category === category &&
              (searchQuery === '' ||
                item.name.toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="space-y-2.5">
              {/* Category Header Bar */}
              <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${categoryStyle.bg} ${categoryStyle.border}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{categoryStyle.icon}</span>
                  <h3 className={`font-bold text-xs uppercase tracking-wide ${categoryStyle.text}`}>
                    {categoryStyle.title}
                  </h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border ${categoryStyle.border} ${categoryStyle.text}`}>
                  {categoryItems.length} ítems
                </span>
              </div>

              {/* Stacked Cards for Vertical/Portrait View */}
              <div className="space-y-2.5">
                {categoryItems.map((item) => {
                  const isZero = item.totalUnits === 0;
                  const batches = normalizeBatches(item);
                  const hasMultipleBatches = batches.length > 1;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-2xl p-3 sm:p-3.5 shadow-2xs transition-all space-y-2.5 ${
                        isZero
                          ? 'border-slate-200 bg-slate-50/50'
                          : 'border-slate-200/90 hover:border-indigo-300'
                      }`}
                    >
                      {/* CARD ROW 1: Name & Live Stock Total Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}>
                              {item.category}
                            </span>
                            {item.allowDirectTotal && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                                <Unlock className="w-2.5 h-2.5" /> Manual
                              </span>
                            )}
                            {isZero && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                Sin Stock (0)
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight mt-1 leading-snug">
                            {item.name}
                          </h4>
                          {item.notes && (
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {item.notes}
                            </p>
                          )}
                          {item.isOrdered && (
                            <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-300 text-sky-950 px-2.5 py-1 rounded-xl text-xs font-bold mt-1.5 shadow-2xs">
                              <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>
                                Pedido en camino{item.orderedUnits ? `: ${item.orderedUnits.toLocaleString('es-AR')} un.` : ''}
                              </span>
                              <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-semibold ml-auto">
                                En Base de Datos
                              </span>
                            </div>
                          )}
                        </div>

                        {/* High-Contrast Stock Total Display */}
                        <div className="shrink-0 bg-slate-900 text-white rounded-xl px-3 py-1.5 text-right shadow-2xs min-w-[105px]">
                          <div className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider leading-none mb-0.5">
                            Stock Total
                          </div>
                          <div className="font-mono font-black text-base sm:text-lg text-emerald-400 leading-tight">
                            {item.totalUnits.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] text-slate-300 font-mono font-medium">
                            {item.bultos} {item.bultos === 1 ? 'bto' : 'btos'}
                          </div>
                        </div>
                      </div>

                      {/* CARD ROW 2: Bulto Batches (Optimized for Portrait & Thumb Touch) */}
                      <div className="space-y-2 bg-slate-50/80 border border-slate-200/90 rounded-xl p-2 sm:p-2.5">
                        {batches.map((batch, batchIndex) => {
                          const batchSubtotal = (batch.bultos || 0) * (batch.unitsPerBulto || 0);

                          return (
                            <div
                              key={batch.id}
                              className="bg-white border border-slate-200 rounded-xl p-2 shadow-2xs space-y-2"
                            >
                              {/* Batch Header if multiple */}
                              {hasMultipleBatches && (
                                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-100">
                                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                    Partida #{batchIndex + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBatch(item.id, batch.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                                    title="Eliminar partida"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* MAIN TOUCH CONTROL STRIP (Thumb-Friendly, Balanced 4-Column Layout) */}
                              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 items-stretch">
                                {/* BUTTON 1: ABRIR 1 BULTO (DESCONTAR) */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, -1)}
                                  disabled={batch.bultos <= 0}
                                  className={`h-16 rounded-2xl flex flex-col items-center justify-center transition-all select-none cursor-pointer border ${
                                    batch.bultos <= 0
                                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed shadow-none'
                                      : 'bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:from-rose-700 active:to-rose-800 text-white shadow-sm hover:shadow active:scale-95 border-rose-600'
                                  }`}
                                  title="Abrir 1 bulto para usar en empaque (-1)"
                                >
                                  <div className="flex items-center gap-0.5 leading-none">
                                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                    <span className="font-mono font-black text-lg">1</span>
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight mt-0.5 leading-none">
                                    Abrir Bulto
                                  </span>
                                  <span className="text-[8px] font-semibold opacity-85 mt-0.5 leading-none">
                                    Empaque
                                  </span>
                                </button>

                                {/* ELEMENT 2: BULTOS CERRADOS COUNT & DIRECT INPUT */}
                                <div className="h-16 bg-white border-2 border-slate-200 hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl px-1 py-1 flex flex-col items-center justify-center transition-all shadow-inner text-center">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none">
                                    Bultos
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={batch.bultos}
                                    onChange={(e) =>
                                      handleSetBatchBultos(item.id, batch.id, parseInt(e.target.value, 10))
                                    }
                                    className="w-full text-center font-mono font-black text-2xl sm:text-3xl text-slate-900 bg-transparent outline-hidden leading-tight p-0 mt-0.5"
                                    title="Cantidad de bultos cerrados (clic para editar)"
                                  />
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none">
                                    Cerrados
                                  </span>
                                </div>

                                {/* BUTTON 3: +1 BTO (SUMAR 1 BULTO) */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, 1)}
                                  className="h-16 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm hover:shadow border border-emerald-700 select-none"
                                  title="Sumar 1 bulto cerrado (+1)"
                                >
                                  <div className="flex items-center gap-0.5 leading-none">
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                    <span className="font-mono font-black text-lg">1</span>
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight mt-0.5 text-emerald-100 leading-none">
                                    +1 Bto
                                  </span>
                                  <span className="text-[8px] font-semibold text-emerald-200/90 mt-0.5 leading-none">
                                    Entrada
                                  </span>
                                </button>

                                {/* BUTTON 4: +5 RÁPIDO (SUMAR 5 BULTOS) */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, 5)}
                                  className="h-16 rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:from-indigo-700 active:to-indigo-800 text-white flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm hover:shadow border border-indigo-700 select-none"
                                  title="Sumar 5 bultos cerrados rápidamente (+5)"
                                >
                                  <div className="flex items-center gap-0.5 leading-none">
                                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                                    <span className="font-mono font-black text-lg text-white">+5</span>
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight mt-0.5 text-indigo-100 leading-none">
                                    Rápido
                                  </span>
                                  <span className="text-[8px] font-semibold text-indigo-200/90 mt-0.5 leading-none">
                                    +5 Btos
                                  </span>
                                </button>
                              </div>

                              {/* BATCH CALCULATION BAR (Multiplication & Subtotal) - ENLARGED TOUCH CONTROLS */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 mt-1 border-t-2 border-slate-200/90 bg-slate-50/70 p-2 sm:p-2.5 rounded-xl">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={`units-${item.id}-${batch.id}`}
                                    className="font-black text-slate-700 text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5"
                                  >
                                    <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <span>Unidades por bulto:</span>
                                  </label>
                                  <div className="inline-flex items-center bg-white border-2 border-slate-300 hover:border-slate-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-xs transition-all">
                                    <input
                                      id={`units-${item.id}-${batch.id}`}
                                      type="number"
                                      min="1"
                                      value={batch.unitsPerBulto === 0 ? '' : batch.unitsPerBulto}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? 0 : parseInt(raw, 10);
                                        handleSetBatchUnitsPerBulto(item.id, batch.id, val);
                                      }}
                                      onBlur={() => {
                                        if (!batch.unitsPerBulto || batch.unitsPerBulto < 1) {
                                          handleSetBatchUnitsPerBulto(item.id, batch.id, 1);
                                        }
                                      }}
                                      className="w-20 sm:w-24 text-center font-mono font-black text-base sm:text-lg text-slate-900 bg-transparent outline-hidden"
                                      title="Cantidad de unidades en cada bulto cerrado de esta partida"
                                    />
                                    <span className="text-xs sm:text-sm text-slate-400 font-bold ml-1.5 select-none">
                                      un/bto
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-1.5 text-right bg-white sm:bg-transparent px-2.5 sm:px-0 py-1 sm:py-0 rounded-lg border sm:border-0 border-slate-200">
                                  <span className="text-xs text-slate-500 font-semibold">Subtotal partida:</span>
                                  <span className="font-mono font-black text-sm sm:text-base text-slate-900">
                                    {batchSubtotal.toLocaleString('es-AR')}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">un.</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* CARD ROW 3: Secondary Actions (+ Otra Medida / Unidades Sueltas) */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddBatch(item.id)}
                            className="h-10 sm:h-11 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 hover:text-indigo-900 border-2 border-dashed border-indigo-300 hover:border-indigo-400 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                            title="Agregar otra partida de bultos con diferente cantidad de unidades"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>+ Otra Medida de bulto</span>
                          </button>

                          {item.allowDirectTotal ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-amber-800">Sueltas:</span>
                              <input
                                type="number"
                                min="0"
                                value={item.totalUnits}
                                onChange={(e) => handleSetTotalUnitsDirect(item.id, parseInt(e.target.value, 10))}
                                className="w-18 h-7 text-center font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded-md text-amber-950"
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleAllowDirectTotal(item.id)}
                                className="text-[10px] font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                Auto
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleAllowDirectTotal(item.id)}
                              className="text-[10px] font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>Cargar sueltas</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* COMPACT STICKY BOTTOM BAR FOR VERTICAL VIEW */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 py-2 px-3 sm:px-4 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          {/* Total Counter */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stock Total:</span>
              <span className="font-mono font-black text-sm sm:text-base text-emerald-400">
                {totalUnitsCounted.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-slate-300">un.</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {totalBultosCounted.toLocaleString('es-AR')} bultos • {selectedMonth.name}
            </div>
          </div>

          {/* Quick Immediate Sync Trigger Button */}
          <button
            type="button"
            onClick={handleForceManualSync}
            disabled={sync.status === 'syncing'}
            className="h-10 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
          >
            {sync.status === 'syncing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <SendHorizontal className="w-3.5 h-3.5" />
                <span>Sincronizar Nube</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
