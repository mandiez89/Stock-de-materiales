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
  Check
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor, BultoBatch } from '../types';
import confetti from 'canvas-confetti';
import { SheetsSyncState } from '../state/useSheetsSync';

interface TabletStockEntryProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onUpdateItem: (id: string, change: (item: MaterialItem) => MaterialItem) => void;
  sync: SheetsSyncState;
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
  const handleStepBatchBultos = (itemId: string, batchId: string, delta: number) =>
    setBatchField(itemId, batchId, (b) => ({ bultos: Math.max(0, (b.bultos || 0) + delta) }));

  // Set explicit bultos count for a specific batch
  const handleSetBatchBultos = (itemId: string, batchId: string, value: number) =>
    setBatchField(itemId, batchId, () => ({ bultos: Math.max(0, isNaN(value) ? 0 : Math.floor(value)) }));

  // Set units per bulto for a specific batch
  const handleSetBatchUnitsPerBulto = (itemId: string, batchId: string, value: number) =>
    setBatchField(itemId, batchId, () => ({ unitsPerBulto: Math.max(1, isNaN(value) ? 1 : Math.floor(value)) }));

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
              title="Sincronizar de inmediato con Google Sheets"
            >
              {sync.status === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  <span className="hidden sm:inline text-[11px]">Guardando...</span>
                </>
              ) : sync.status === 'synced' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span className="text-[11px] hidden sm:inline">Sheets al día</span>
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
                <span className="text-amber-700 font-bold">Sin conexión a Google Sheets: los datos se guardan solo en esta tablet</span>
              ) : sync.autoSync ? (
                sync.status === 'syncing' ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin inline" /> Guardando en Google Sheets de inmediato...
                  </span>
                ) : sync.status === 'pending' || sync.pendingCount > 0 ? (
                  <span className="text-indigo-600 font-medium">{sync.pendingCount} cambio(s) pendientes de enviar a Sheets...</span>
                ) : sync.lastSyncedAt ? (
                  <span>
                    Guardado en Google Sheets a las <strong className="text-slate-700 font-mono">{sync.lastSyncedAt}</strong>
                  </span>
                ) : (
                  <span>Sincronización inmediata a Google Sheets activa</span>
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
            <span className="hidden sm:inline">Sheets Inmediato</span>
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

                              {/* MAIN TOUCH CONTROL STRIP (Thumb-Friendly in Portrait) */}
                              <div className="grid grid-cols-12 gap-1.5 items-center">
                                {/* BIG RED BUTTON: ABRIR 1 BULTO (DESCONTAR) */}
                                <div className="col-span-4 sm:col-span-4">
                                  <button
                                    type="button"
                                    onClick={() => handleStepBatchBultos(item.id, batch.id, -1)}
                                    disabled={batch.bultos <= 0}
                                    className="w-full h-12 sm:h-13 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 disabled:opacity-30 disabled:cursor-not-allowed border-2 border-rose-300 text-rose-700 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs select-none"
                                    title="Abrir 1 bulto para usar en empaque"
                                  >
                                    <div className="flex items-center gap-1">
                                      <Minus className="w-4 h-4 stroke-[3]" />
                                      <span className="font-mono font-black text-base">1</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-tight text-rose-600">
                                      Abrir Bulto
                                    </span>
                                  </button>
                                </div>

                                {/* BULTOS COUNT DISPLAY & DIRECT INPUT */}
                                <div className="col-span-4 sm:col-span-4 text-center">
                                  <div className="flex flex-col items-center justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      Bultos
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={batch.bultos}
                                      onChange={(e) =>
                                        handleSetBatchBultos(item.id, batch.id, parseInt(e.target.value, 10))
                                      }
                                      className="w-full max-w-[90px] h-10 text-center font-mono font-black text-xl sm:text-2xl border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 text-slate-900 shadow-inner"
                                      title="Cantidad de bultos cerrados"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5">
                                      cerrados
                                    </span>
                                  </div>
                                </div>

                                {/* PLUS BUTTONS (SUMAR BULTOS) */}
                                <div className="col-span-4 sm:col-span-4 grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStepBatchBultos(item.id, batch.id, 1)}
                                    className="h-12 sm:h-13 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs select-none"
                                    title="Ingresar / Sumar 1 bulto"
                                  >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                    <span className="text-[9px] font-black uppercase tracking-tight text-indigo-100">
                                      +1 Bto
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStepBatchBultos(item.id, batch.id, 5)}
                                    className="h-12 sm:h-13 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs select-none"
                                    title="Ingresar 5 bultos rápidamente"
                                  >
                                    <span className="font-mono font-black text-sm text-slate-800">+5</span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">
                                      Rápido
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {/* BATCH CALCULATION BAR (Multiplication & Subtotal) */}
                              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                                <div className="flex items-center gap-1 text-slate-600">
                                  <span className="text-slate-400 font-bold">Medida:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={batch.unitsPerBulto}
                                    onChange={(e) =>
                                      handleSetBatchUnitsPerBulto(item.id, batch.id, parseInt(e.target.value, 10))
                                    }
                                    className="w-16 h-7 text-center font-mono font-bold text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                                  />
                                  <span className="text-[10px] text-slate-500 font-semibold">un/bto</span>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 font-medium mr-1">Subtotal:</span>
                                  <span className="font-mono font-black text-xs sm:text-sm text-slate-800">
                                    {batchSubtotal.toLocaleString('es-AR')}
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-0.5">un.</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* CARD ROW 3: Secondary Actions (+ Otra Medida / Unidades Sueltas) */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAddBatch(item.id)}
                            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-dashed border-indigo-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Otra medida de bulto</span>
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
                <span>Sincronizar Sheets</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
