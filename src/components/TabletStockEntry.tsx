import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Tablet, 
  RotateCcw, 
  SendHorizontal, 
  Search, 
  Plus, 
  Minus, 
  Clock, 
  Wifi, 
  Boxes, 
  Hash, 
  AlertCircle,
  Package,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor, BultoBatch } from '../types';
import confetti from 'canvas-confetti';

interface TabletStockEntryProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onSaveBatch: (updatedItems: MaterialItem[], responsible: string, date: string, notes: string) => void;
  onSyncWithSheets: (itemsToSync: MaterialItem[], meta: { responsible: string; date: string; month: string }) => Promise<boolean>;
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
  onSaveBatch,
  onSyncWithSheets,
}) => {
  // Local form items (persisted to localStorage)
  const [formItems, setFormItems] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem('sugestion_tablet_draft_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: MaterialItem) => ({
            ...item,
            batches: normalizeBatches(item),
          }));
        }
      } catch (e) {
        // ignore
      }
    }
    return items.map((item) => ({
      ...item,
      batches: normalizeBatches(item),
    }));
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Sync to parent real-time without re-render loop
  const onSaveBatchRef = useRef(onSaveBatch);
  onSaveBatchRef.current = onSaveBatch;

  // Auto-save to localStorage and parent real-time
  useEffect(() => {
    localStorage.setItem('sugestion_tablet_draft_v4', JSON.stringify(formItems));
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    onSaveBatchRef.current(
      formItems, 
      'Operador en Planta', 
      new Date().toISOString().split('T')[0], 
      'Actualización en tiempo real por bultos'
    );
  }, [formItems]);

  // Recalculate status and units to order
  const computeItemStatus = (totalUnits: number, minStockAdjusted: number, maxStockAdjusted: number) => {
    let status: MaterialItem['status'] = 'OPTIMO';
    let unitsToOrder = 0;

    if (totalUnits <= minStockAdjusted * 0.5) {
      status = 'CRITICO';
      unitsToOrder = Math.max(0, maxStockAdjusted - totalUnits);
    } else if (totalUnits < minStockAdjusted) {
      status = 'PEDIR';
      unitsToOrder = Math.max(0, maxStockAdjusted - totalUnits);
    } else if (totalUnits > maxStockAdjusted * 1.25) {
      status = 'SOBRESTOCK';
      unitsToOrder = 0;
    }

    return { status, unitsToOrder };
  };

  // Helper to recompute totals from batches
  const recalculateItemBatches = (item: MaterialItem, updatedBatches: BultoBatch[]): MaterialItem => {
    const totalBultos = updatedBatches.reduce((acc, b) => acc + (b.bultos || 0), 0);
    const calculatedUnits = updatedBatches.reduce((acc, b) => acc + ((b.bultos || 0) * (b.unitsPerBulto || 0)), 0);
    const totalUnits = item.allowDirectTotal ? item.totalUnits : calculatedUnits;
    
    const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);
    const primaryUnitsPerBulto = updatedBatches[0]?.unitsPerBulto || item.unitsPerBulto;
    const bultosToOrder = unitsToOrder > 0 && primaryUnitsPerBulto > 0
      ? Math.ceil(unitsToOrder / primaryUnitsPerBulto)
      : 0;

    // Check if order was delivered (stock increased past snapshot)
    let isOrdered = item.isOrdered;
    let orderedAt = item.orderedAt;
    let orderedStockSnapshot = item.orderedStockSnapshot;
    if (isOrdered && orderedStockSnapshot !== undefined && totalUnits > orderedStockSnapshot) {
      isOrdered = false;
      orderedAt = undefined;
      orderedStockSnapshot = undefined;
    }

    return {
      ...item,
      batches: updatedBatches,
      bultos: totalBultos,
      unitsPerBulto: primaryUnitsPerBulto,
      totalUnits,
      status,
      unitsToOrder,
      bultosToOrder,
      isOrdered,
      orderedAt,
      orderedStockSnapshot,
      lastUpdated: new Date().toISOString(),
    };
  };

  // Step bultos for a specific batch (Abrir o sumar bultos)
  const handleStepBatchBultos = (itemId: string, batchId: string, delta: number) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentBatches = normalizeBatches(item);
          const updatedBatches = currentBatches.map((b) => {
            if (b.id === batchId) {
              return {
                ...b,
                bultos: Math.max(0, (b.bultos || 0) + delta),
              };
            }
            return b;
          });
          return recalculateItemBatches(item, updatedBatches);
        }
        return item;
      })
    );
  };

  // Set explicit bultos count for a specific batch
  const handleSetBatchBultos = (itemId: string, batchId: string, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : Math.floor(value));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentBatches = normalizeBatches(item);
          const updatedBatches = currentBatches.map((b) => {
            if (b.id === batchId) {
              return { ...b, bultos: val };
            }
            return b;
          });
          return recalculateItemBatches(item, updatedBatches);
        }
        return item;
      })
    );
  };

  // Set units per bulto for a specific batch
  const handleSetBatchUnitsPerBulto = (itemId: string, batchId: string, value: number) => {
    const val = Math.max(1, isNaN(value) ? 1 : Math.floor(value));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentBatches = normalizeBatches(item);
          const updatedBatches = currentBatches.map((b) => {
            if (b.id === batchId) {
              return { ...b, unitsPerBulto: val };
            }
            return b;
          });
          return recalculateItemBatches(item, updatedBatches);
        }
        return item;
      })
    );
  };

  // Add extra batch line (e.g. 15 bultos de 85 unidades)
  const handleAddBatch = (itemId: string) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentBatches = normalizeBatches(item);
          const newBatch: BultoBatch = {
            id: `batch-${item.id}-${Date.now()}`,
            bultos: 0,
            unitsPerBulto: currentBatches[0]?.unitsPerBulto || item.unitsPerBulto || 100,
            label: `Partida ${currentBatches.length + 1}`,
          };
          const updatedBatches = [...currentBatches, newBatch];
          return recalculateItemBatches(item, updatedBatches);
        }
        return item;
      })
    );
  };

  // Remove a batch line (if more than 1 batch)
  const handleRemoveBatch = (itemId: string, batchId: string) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentBatches = normalizeBatches(item);
          if (currentBatches.length <= 1) return item;
          const updatedBatches = currentBatches.filter((b) => b.id !== batchId);
          return recalculateItemBatches(item, updatedBatches);
        }
        return item;
      })
    );
  };

  // Toggle allow direct total entry per item (Manual vs Auto)
  const handleToggleAllowDirectTotal = (id: string) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !(item.allowDirectTotal ?? false);
          const currentBatches = normalizeBatches(item);
          const calculatedUnits = currentBatches.reduce((acc, b) => acc + (b.bultos * b.unitsPerBulto), 0);
          const totalUnits = next ? item.totalUnits : calculatedUnits;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);
          const primaryUnits = currentBatches[0]?.unitsPerBulto || item.unitsPerBulto;
          const bultosToOrder = unitsToOrder > 0 && primaryUnits > 0
            ? Math.ceil(unitsToOrder / primaryUnits)
            : 0;

          return {
            ...item,
            allowDirectTotal: next,
            isDirectUnits: next,
            totalUnits,
            unitsToOrder,
            bultosToOrder,
            status,
            lastUpdated: new Date().toISOString(),
          };
        }
        return item;
      })
    );
  };

  // Set by Total Units directly (only when allowDirectTotal is enabled)
  const handleSetTotalUnitsDirect = (id: string, newTotalVal: number) => {
    const totalUnits = Math.max(0, isNaN(newTotalVal) ? 0 : Math.floor(newTotalVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentBatches = normalizeBatches(item);
          const primaryUnits = currentBatches[0]?.unitsPerBulto || item.unitsPerBulto || 1;
          const approxBultos = Math.floor(totalUnits / primaryUnits);
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);
          const bultosToOrder = unitsToOrder > 0 && primaryUnits > 0
            ? Math.ceil(unitsToOrder / primaryUnits)
            : 0;

          return {
            ...item,
            bultos: approxBultos,
            totalUnits,
            isDirectUnits: true,
            unitsToOrder,
            bultosToOrder,
            status,
            lastUpdated: new Date().toISOString(),
          };
        }
        return item;
      })
    );
  };

  // Categories list
  const categoriesList: { id: string; label: string; count: number; icon: string }[] = [
    { id: 'all', label: 'Todos los Tipos', count: formItems.length, icon: '📋' },
    { id: 'Cajas', label: '1. Cajas', count: formItems.filter((i) => i.category === 'Cajas').length, icon: '📦' },
    { id: 'Celofanes', label: '2. Celofanes', count: formItems.filter((i) => i.category === 'Celofanes').length, icon: '📄' },
    { id: 'Bolsitas', label: '3. Bolsitas', count: formItems.filter((i) => i.category === 'Bolsitas').length, icon: '🛍️' },
    { id: 'Caballetes', label: '4. Caballetes', count: formItems.filter((i) => i.category === 'Caballetes').length, icon: '🏷️' },
    { id: 'Cartones', label: '5. Cartones', count: formItems.filter((i) => i.category === 'Cartones').length, icon: '📋' },
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
    return formItems.reduce((acc, item) => acc + (item.totalUnits || 0), 0);
  }, [formItems]);

  const totalBultosCounted = useMemo(() => {
    return formItems.reduce((acc, item) => acc + (item.bultos || 0), 0);
  }, [formItems]);

  // Reset draft to initial items
  const handleResetDraft = () => {
    if (window.confirm('¿Deseas reiniciar el stock a los valores originales iniciales?')) {
      const reset = items.map((i) => ({ ...i, batches: normalizeBatches(i) }));
      setFormItems(reset);
      localStorage.removeItem('sugestion_tablet_draft_v4');
      setSyncSuccessMessage('Se han restaurado los valores iniciales.');
      setTimeout(() => setSyncSuccessMessage(null), 3000);
    }
  };

  // Finish and Sync with Google Sheets
  const handleFinishAndSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    try {
      const success = await onSyncWithSheets(formItems, {
        responsible: 'Operador Depósito',
        date: new Date().toISOString().split('T')[0],
        month: selectedMonth.name,
      });

      if (success) {
        setSyncSuccessMessage(
          `¡Sincronizado con éxito en Google Sheets! Se registraron ${totalUnitsCounted.toLocaleString('es-AR')} unidades (${totalBultosCounted.toLocaleString('es-AR')} bultos).`
        );
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.8 } });
        setTimeout(() => setSyncSuccessMessage(null), 6000);
      } else {
        setSyncErrorMessage('Los datos se guardaron en la tablet pero no se pudo conectar con Google Sheets. Revisa la URL del Webhook.');
      }
    } catch (err: any) {
      setSyncErrorMessage(`Error de conexión: ${err.message || 'Sin respuesta'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Clean Real-Time Header Bar (Operador y Fecha eliminados para flujo en tiempo real) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Control de Bultos y Stock en Tiempo Real
                </h2>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tiempo Real Activo
                </span>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-600" /> Memoria Local
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Al empaquetar, descontá con <strong>-1</strong> el bulto abierto. Si recibís mercadería o hay distintas medidas, agregá una línea de partida.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{lastSavedTime ? `Autoguardado: ${lastSavedTime}` : 'En vivo'}</span>
            </div>
            <button
              onClick={handleResetDraft}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5 active:scale-95"
              title="Restaurar valores de stock"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Status Feedback */}
      {syncSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-center gap-3 shadow-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">{syncSuccessMessage}</div>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs sm:text-sm flex items-center gap-3 shadow-xs font-bold">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">{syncErrorMessage}</div>
        </div>
      )}

      {/* Category Filter Bar (Tipo de material) & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Filtrar por tipo de material:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoriesList.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`h-9 sm:h-10 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
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
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar material rápidamente (ej: Cajas 5 cm, Celofán 15x20...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Product List Grouped by Category */}
      <div className="space-y-5">
        {filteredCategories.map((category) => {
          const categoryStyle = CATEGORY_STYLES[category];
          const categoryItems = formItems.filter(
            (item) =>
              item.category === category &&
              (searchQuery === '' ||
                item.name.toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="space-y-2.5">
              {/* Category Section Header */}
              <div className={`flex items-center justify-between px-3.5 py-2 rounded-xl border ${categoryStyle.bg} ${categoryStyle.border}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{categoryStyle.icon}</span>
                  <h3 className={`font-bold text-xs sm:text-sm uppercase tracking-wide ${categoryStyle.text}`}>
                    {categoryStyle.title}
                  </h3>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border ${categoryStyle.border} ${categoryStyle.text}`}>
                  {categoryItems.length} materiales
                </span>
              </div>

              {/* Items in this category - Compact & Tactile */}
              <div className="space-y-2">
                {categoryItems.map((item) => {
                  const isZero = item.totalUnits === 0;
                  const batches = normalizeBatches(item);
                  const hasMultipleBatches = batches.length > 1;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                        isZero
                          ? 'border-slate-200 bg-slate-50/40'
                          : 'border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      {/* Left: Material Name and Stock Total Display (SIN mínimos, máximos ni estado 'Contado') */}
                      <div className="min-w-[240px] flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}>
                            {item.category}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            {item.name}
                          </h4>
                          {isZero && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              Sin Stock (0 un.)
                            </span>
                          )}
                          {item.allowDirectTotal && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Unlock className="w-2.5 h-2.5" /> Total Manual
                            </span>
                          )}
                        </div>

                        {/* Summary of Total Stock */}
                        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs text-slate-500 font-medium">Stock Total:</span>
                          <span className="font-mono font-black text-slate-900 text-base sm:text-lg">
                            {item.totalUnits.toLocaleString('es-AR')}
                          </span>
                          <span className="text-xs font-bold text-indigo-700">unidades</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {item.bultos} {item.bultos === 1 ? 'bulto' : 'bultos'}
                          </span>
                        </div>

                        {/* Breakdown pills if multiple batches */}
                        {hasMultipleBatches && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {batches.map((b, idx) => (
                              <span
                                key={b.id}
                                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                #{idx + 1}: {b.bultos} btos × {b.unitsPerBulto} = {(b.bultos * b.unitsPerBulto).toLocaleString('es-AR')} un.
                              </span>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Right: Bulto Lines (Partidas) with Quick Abrir/Restar/Sumar Buttons */}
                      <div className="flex flex-col gap-2 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        {batches.map((batch, batchIndex) => {
                          const batchSubtotal = (batch.bultos || 0) * (batch.unitsPerBulto || 0);

                          return (
                            <div
                              key={batch.id}
                              className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 shadow-2xs"
                            >
                              {/* Batch index label */}
                              {hasMultipleBatches && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                  #{batchIndex + 1}
                                </span>
                              )}

                              {/* Bultos Controls: Minus, Input, Plus */}
                              <div className="flex items-center gap-1">
                                {/* Botón ABRIR BULTO (Restar 1) */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, -1)}
                                  disabled={batch.bultos <= 0}
                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 active:bg-rose-200 disabled:opacity-25 disabled:cursor-not-allowed text-rose-700 font-black text-base flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Abrir 1 bulto (descontar del stock)"
                                >
                                  <Minus className="w-4 h-4 stroke-[3]" />
                                </button>

                                {/* Input Bultos */}
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    value={batch.bultos}
                                    onChange={(e) =>
                                      handleSetBatchBultos(item.id, batch.id, parseInt(e.target.value, 10))
                                    }
                                    className="w-14 sm:w-16 h-8 sm:h-9 text-center font-mono font-bold text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900 shadow-2xs"
                                    title="Cantidad de bultos cerrados"
                                  />
                                </div>

                                {/* Botón Sumar 1 */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, 1)}
                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-base flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Ingresar / Sumar 1 bulto"
                                >
                                  <Plus className="w-4 h-4 stroke-[3]" />
                                </button>

                                {/* Botón Rápido +5 */}
                                <button
                                  type="button"
                                  onClick={() => handleStepBatchBultos(item.id, batch.id, 5)}
                                  className="h-8 sm:h-9 px-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                  title="Sumar 5 bultos rápidamente"
                                >
                                  +5
                                </button>
                              </div>

                              <span className="text-slate-400 font-bold text-xs px-0.5">×</span>

                              {/* Cantidad x Bulto (Editable) */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={batch.unitsPerBulto}
                                  onChange={(e) =>
                                    handleSetBatchUnitsPerBulto(item.id, batch.id, parseInt(e.target.value, 10))
                                  }
                                  className="w-16 sm:w-20 h-8 sm:h-9 text-center font-mono font-bold text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-800 shadow-2xs"
                                  title="Unidades por bulto en esta partida"
                                />
                                <span className="text-[10px] font-bold text-slate-500">un/bto</span>
                              </div>

                              <span className="text-slate-400 font-bold text-xs px-0.5">=</span>

                              {/* Subtotal Partida */}
                              <div className="min-w-[70px] text-right">
                                <span className="font-mono font-bold text-xs sm:text-sm text-slate-800">
                                  {batchSubtotal.toLocaleString('es-AR')}
                                </span>
                                <span className="text-[9px] text-slate-400 block font-normal">unidades</span>
                              </div>

                              {/* Delete batch button (only if >1 batch) */}
                              {hasMultipleBatches && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatch(item.id, batch.id)}
                                  className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Eliminar esta línea de bultos"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Extra Actions: + Agregar otra cantidad de bultos / Total Manual */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                          {/* Botón para agregar línea extra (ej: 15 de 85 un.) */}
                          <button
                            type="button"
                            onClick={() => handleAddBatch(item.id)}
                            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-dashed border-indigo-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="Cargar otra partida si hay bultos de diferente cantidad (ej: 30 de 65 un. y 15 de 85 un.)"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Otra medida de bulto</span>
                          </button>

                          {/* Toggle Total Manual */}
                          <div className="flex items-center gap-1.5">
                            {item.allowDirectTotal ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.totalUnits}
                                  onChange={(e) => handleSetTotalUnitsDirect(item.id, parseInt(e.target.value, 10))}
                                  className="w-20 h-7 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded-md px-1 text-amber-950"
                                  title="Unidades sueltas totales"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllowDirectTotal(item.id)}
                                  className="text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded cursor-pointer"
                                  title="Volver a cálculo automático por bultos"
                                >
                                  Auto
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleAllowDirectTotal(item.id)}
                                className="text-[10px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Habilitar ingreso de total manual si hay unidades sueltas"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Unidades sueltas</span>
                              </button>
                            )}
                          </div>
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

      {/* Floating Action Bar (Sticky at bottom for Tablet) - Compact & Clean */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 py-2.5 px-4 sm:px-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-white text-xs sm:text-sm">
                Stock Total: <span className="text-emerald-300 font-mono font-black text-sm sm:text-base">{totalUnitsCounted.toLocaleString('es-AR')}</span> un. ({totalBultosCounted.toLocaleString('es-AR')} bultos)
              </p>
              <p className="text-slate-400 text-[10px] font-normal">
                Sincronización en tiempo real • {selectedMonth.name}
              </p>
            </div>
          </div>

          <button
            onClick={handleFinishAndSync}
            disabled={isSyncing}
            className="w-full sm:w-auto h-10 px-5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer tracking-tight active:scale-95 shrink-0"
          >
            {isSyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Guardando en Google Sheets...</span>
              </>
            ) : (
              <>
                <SendHorizontal className="w-4 h-4" />
                <span>Guardar en Google Sheets</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
