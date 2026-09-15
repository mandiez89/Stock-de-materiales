import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tablet, 
  CheckCircle2, 
  RotateCcw, 
  SendHorizontal, 
  Search, 
  Calendar, 
  User, 
  Plus, 
  Minus, 
  Clock, 
  Wifi, 
  Layers, 
  Boxes, 
  Hash, 
  Check, 
  AlertCircle,
  Package,
  FileSpreadsheet
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor } from '../types';
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
    title: 'Sector 1: Cajas de Empaque y Presentación'
  },
  Celofanes: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200',
    icon: '📄',
    title: 'Sector 2: Celofanes (Sin Impresión)'
  },
  Bolsitas: {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: '🛍️',
    title: 'Sector 3: Bolsitas (Con Impresión)'
  },
  Caballetes: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: '🏷️',
    title: 'Sector 4: Caballetes de Cartulina'
  },
  Cartones: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: '📋',
    title: 'Sector 5: Cartones Soporte'
  }
};

export const TabletStockEntry: React.FC<TabletStockEntryProps> = ({
  items,
  selectedMonth,
  onSaveBatch,
  onSyncWithSheets,
}) => {
  const [responsible, setResponsible] = useState(() => {
    return localStorage.getItem('sugestion_tablet_responsible') || 'Operador Depósito';
  });
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('Relevamiento físico de materias primas en tablet');
  
  // Local form items (persisted to localStorage)
  const [formItems, setFormItems] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem('sugestion_tablet_draft_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return items;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Auto-save to localStorage on every change
  useEffect(() => {
    localStorage.setItem('sugestion_tablet_draft_v3', JSON.stringify(formItems));
    localStorage.setItem('sugestion_tablet_responsible', responsible);
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [formItems, responsible]);

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

  // 1. Set by Bultos (multiplies by unitsPerBulto)
  const handleSetBultos = (id: string, newBultosVal: number) => {
    const bultos = Math.max(0, isNaN(newBultosVal) ? 0 : Math.floor(newBultosVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const totalUnits = bultos * item.unitsPerBulto;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);

          const bultosToOrder = unitsToOrder > 0 && item.unitsPerBulto > 0
            ? Math.ceil(unitsToOrder / item.unitsPerBulto)
            : 0;

          return {
            ...item,
            bultos,
            totalUnits,
            isDirectUnits: false,
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

  // 2. Set by Total Units directly (for when there are no bultos or loose counts)
  const handleSetTotalUnitsDirect = (id: string, newTotalVal: number) => {
    const totalUnits = Math.max(0, isNaN(newTotalVal) ? 0 : Math.floor(newTotalVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          // Calculate approximate bultos for reference if unitsPerBulto > 0
          const approxBultos = item.unitsPerBulto > 0 ? Math.floor(totalUnits / item.unitsPerBulto) : 0;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);

          const bultosToOrder = unitsToOrder > 0 && item.unitsPerBulto > 0
            ? Math.ceil(unitsToOrder / item.unitsPerBulto)
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

  const handleStepBultos = (id: string, delta: number) => {
    const current = formItems.find((i) => i.id === id);
    if (!current) return;
    handleSetBultos(id, current.bultos + delta);
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

  // Grouped items by category for clear presentation
  const groupedCategories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  const filteredCategories = useMemo(() => {
    if (activeCategory === 'all') {
      return groupedCategories;
    }
    return groupedCategories.filter((c) => c === activeCategory);
  }, [activeCategory]);

  // Counting metrics
  const totalBultosCounted = formItems.reduce((acc, i) => acc + i.bultos, 0);
  const totalUnitsCounted = formItems.reduce((acc, i) => acc + i.totalUnits, 0);
  const itemsWithStock = formItems.filter((i) => i.totalUnits > 0).length;

  const handleResetDraft = () => {
    if (window.confirm('¿Deseas reiniciar los valores ingresados en la tablet a los valores base?')) {
      setFormItems(items);
      localStorage.removeItem('sugestion_tablet_draft_v3');
    }
  };

  const handleFinishAndSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    // Save to parent state
    onSaveBatch(formItems, responsible, entryDate, notes);

    try {
      const success = await onSyncWithSheets(formItems, {
        responsible,
        date: entryDate,
        month: selectedMonth.name,
      });

      if (success) {
        setSyncSuccessMessage(`¡Conteo de ${formItems.length} materiales enviado y guardado con éxito en Google Sheets!`);
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => setSyncSuccessMessage(null), 6000);
      } else {
        setSyncErrorMessage('Los datos se guardaron en la tablet pero no se pudo conectar con Google Sheets. Verifica la conexión.');
      }
    } catch (err: any) {
      setSyncErrorMessage(`Error de conexión: ${err.message || 'Sin respuesta'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 max-w-5xl mx-auto">
      {/* Tablet Mode Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Tablet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Planilla de Carga de Stock en Depósito</h2>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Memoria Offline Activa
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Carga por <strong>bultos cerrados</strong> o ingresa la <strong>cantidad total de unidades directamente</strong> si el material está suelto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Guardado: {lastSavedTime || 'Automático'}</span>
            </div>
            <button
              onClick={handleResetDraft}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Restaurar conteo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Responsible & Date Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> Responsable de Carga:
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nombre del operador"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha del Relevamiento:
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Período / Mes:
            </label>
            <div className="px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-emerald-400 font-bold flex items-center justify-between">
              <span>{selectedMonth.name}</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {itemsWithStock} de {formItems.length} con stock
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Status Feedback */}
      {syncSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 font-semibold">{syncSuccessMessage}</div>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1 font-semibold">{syncErrorMessage}</div>
        </div>
      )}

      {/* Sector Category Filter Bar (Large Tactile Pills) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categoriesList.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`min-h-[46px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-indigo-500'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
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
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar material o código (ej: 8100, bombachas, plantines, celofán)..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>
      </div>

      {/* Products grouped by clear Category Sections */}
      <div className="space-y-6">
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
              {/* Distinct Category Section Header */}
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${categoryStyle.bg} ${categoryStyle.border}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryStyle.icon}</span>
                  <h3 className={`font-black text-sm uppercase tracking-wide ${categoryStyle.text}`}>
                    {categoryStyle.title}
                  </h3>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/80 border ${categoryStyle.border} ${categoryStyle.text}`}>
                  {categoryItems.length} materiales en este sector
                </span>
              </div>

              {/* Items in this category */}
              <div className="space-y-2">
                {categoryItems.map((item) => {
                  const isZero = item.totalUnits === 0;
                  const isCritical = item.status === 'CRITICO';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border-2 rounded-2xl p-4 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isZero
                          ? 'border-rose-300 bg-rose-50/20'
                          : isCritical
                          ? 'border-amber-300 bg-amber-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Product description & info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}>
                            {item.category}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                            {item.name}
                          </h4>
                          {isZero && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              Sin Stock (0 Unidades)
                            </span>
                          )}
                          {item.isDirectUnits && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Carga Directa por Unidades
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 font-mono">
                          <span>Unid. x bulto cerrado: <strong className="text-slate-700">{item.unitsPerBulto.toLocaleString('es-AR')} un.</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Stock mínimo {selectedMonth.shortName}: <strong className="text-indigo-700">{item.minStockAdjusted.toLocaleString('es-AR')} un.</strong></span>
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Dual Input: Bultos Cerrados AND Direct Total Units */}
                      <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* INPUT 1: BULTOS (with tactile stepper) */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Boxes className="w-3 h-3 text-slate-400" /> Bultos Cerrados
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStepBultos(item.id, -1)}
                              disabled={item.bultos <= 0}
                              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                              title="Restar 1 bulto"
                            >
                              <Minus className="w-4 h-4" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              value={item.bultos}
                              onChange={(e) => handleSetBultos(item.id, parseInt(e.target.value, 10))}
                              className="w-16 h-10 text-center font-mono font-black text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900"
                            />

                            <button
                              onClick={() => handleStepBultos(item.id, 1)}
                              className="w-10 h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                              title="Sumar 1 bulto"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            (= {(item.bultos * item.unitsPerBulto).toLocaleString('es-AR')} un.)
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="hidden sm:flex flex-col items-center justify-center px-1 text-slate-300 text-xs font-bold">
                          <span>O</span>
                        </div>

                        {/* INPUT 2: CANTIDAD TOTAL DIRECTA (si no hay bultos o hay unidades sueltas) */}
                        <div className="flex flex-col items-center sm:items-start">
                          <span className="text-[10px] font-bold text-indigo-900 uppercase mb-1 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-indigo-600" /> Cantidad Total (Unidades)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={item.totalUnits}
                              onChange={(e) => handleSetTotalUnitsDirect(item.id, parseInt(e.target.value, 10))}
                              className="w-28 h-10 px-2 text-right font-mono font-black text-base border-2 border-indigo-300 bg-indigo-50/40 text-indigo-950 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-hidden"
                            />
                            <span className="text-xs font-bold text-slate-500">un.</span>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-medium mt-0.5">
                            Ingreso directo sin bultos
                          </span>
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

      {/* Floating Action Bar (Sticky at bottom for Tablet) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md text-white border-t border-slate-800 p-3 sm:p-4 shadow-2xl">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-bold text-white text-sm">
                Total Contabilizado: {totalUnitsCounted.toLocaleString('es-AR')} unidades ({totalBultosCounted.toLocaleString('es-AR')} bultos)
              </p>
            </div>
            <p className="text-slate-400 text-[11px]">
              Operador: <strong className="text-slate-200">{responsible}</strong> • Fecha: <strong className="text-slate-200">{entryDate}</strong> • Mes: <strong className="text-emerald-400">{selectedMonth.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleFinishAndSync}
              disabled={isSyncing}
              className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer tracking-tight"
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Google Sheets...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4" />
                  <span>Guardar a Google Sheets</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
