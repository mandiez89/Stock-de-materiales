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
  FileSpreadsheet,
  Lock,
  Unlock
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

  // 1. Set by Bultos (recalculates totalUnits if direct entry is not unlocked)
  const handleSetBultos = (id: string, newBultosVal: number) => {
    const bultos = Math.max(0, isNaN(newBultosVal) ? 0 : Math.floor(newBultosVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isDirect = item.allowDirectTotal ?? false;
          const totalUnits = isDirect ? item.totalUnits : bultos * item.unitsPerBulto;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);

          const bultosToOrder = unitsToOrder > 0 && item.unitsPerBulto > 0
            ? Math.ceil(unitsToOrder / item.unitsPerBulto)
            : 0;

          return {
            ...item,
            bultos,
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

  // 2. Set Units per Bulto (recalculates totalUnits if direct entry is not unlocked)
  const handleSetUnitsPerBulto = (id: string, newUnitsVal: number) => {
    const unitsPerBulto = Math.max(1, isNaN(newUnitsVal) ? 1 : Math.floor(newUnitsVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isDirect = item.allowDirectTotal ?? false;
          const totalUnits = isDirect ? item.totalUnits : item.bultos * unitsPerBulto;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);

          const bultosToOrder = unitsToOrder > 0 && unitsPerBulto > 0
            ? Math.ceil(unitsToOrder / unitsPerBulto)
            : 0;

          return {
            ...item,
            unitsPerBulto,
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

  // 3. Toggle allow direct total entry per item (default is FALSE = locked)
  const handleToggleAllowDirectTotal = (id: string) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const current = item.allowDirectTotal ?? false;
          const next = !current;
          // If locking back, recalculate from bultos * unitsPerBulto
          const totalUnits = next ? item.totalUnits : item.bultos * item.unitsPerBulto;
          const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);

          const bultosToOrder = unitsToOrder > 0 && item.unitsPerBulto > 0
            ? Math.ceil(unitsToOrder / item.unitsPerBulto)
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

  // 4. Toggle allow direct total entry globally
  const handleToggleAllDirectTotal = (enable: boolean) => {
    setFormItems((prev) =>
      prev.map((item) => {
        const totalUnits = enable ? item.totalUnits : item.bultos * item.unitsPerBulto;
        const { status, unitsToOrder } = computeItemStatus(totalUnits, item.minStockAdjusted, item.maxStockAdjusted);
        const bultosToOrder = unitsToOrder > 0 && item.unitsPerBulto > 0
          ? Math.ceil(unitsToOrder / item.unitsPerBulto)
          : 0;
        return {
          ...item,
          allowDirectTotal: enable,
          isDirectUnits: enable,
          totalUnits,
          unitsToOrder,
          bultosToOrder,
          status,
        };
      })
    );
  };

  // 5. Set by Total Units directly (only when allowDirectTotal is enabled)
  const handleSetTotalUnitsDirect = (id: string, newTotalVal: number) => {
    const totalUnits = Math.max(0, isNaN(newTotalVal) ? 0 : Math.floor(newTotalVal));
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
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
    <div className="space-y-5 pb-20 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Clean Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Planilla de Carga de Stock</h2>
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-600" /> Memoria Offline Activa
                </span>
                <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  Mes: {selectedMonth.name} ({itemsWithStock} de {formItems.length} contados)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Contá los bultos cerrados o activá <strong>Total Manual</strong> si tenés paquetes abiertos o unidades sueltas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{lastSavedTime ? `Guardado: ${lastSavedTime}` : 'Autoguardado local'}</span>
            </div>
            <button
              onClick={handleResetDraft}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5 active:scale-95"
              title="Restaurar conteo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {/* Responsible & Date Bar - Clean & Compact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-slate-600 shrink-0 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" /> Operador:
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nombre del operador..."
              className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-slate-600 shrink-0 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" /> Fecha:
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Sync Status Feedback */}
      {syncSuccessMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-center gap-3 shadow-xs animate-fade-in font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">{syncSuccessMessage}</div>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs sm:text-sm flex items-center gap-3 shadow-xs font-bold">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">{syncErrorMessage}</div>
        </div>
      )}

      {/* Category Filter Bar (Tipo de material) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Filtrar por tipo de material:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoriesList.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`h-10 sm:h-11 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
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
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar material o código (ej: 8100, bombachas, plantines, celofán)..."
            className="w-full h-10 sm:h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
          />
        </div>

        {/* Banner de Modo de Carga - Clean & Inline */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="leading-snug">
              Cargá <strong>Bultos</strong> con <strong>+ / -</strong>. El total se calcula automáticamente salvo que actives <strong>Total Manual</strong>.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => handleToggleAllDirectTotal(true)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              title="Permite editar la cantidad total directamente en todos los materiales"
            >
              <Unlock className="w-3 h-3 text-amber-700" />
              <span>Habilitar Total Directo</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllDirectTotal(false)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              title="Bloquea la cantidad total en todos y vuelve al cálculo automático Bultos × Unidades"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Auto</span>
            </button>
          </div>
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
            <div key={category} className="space-y-3">
              {/* Category Section Header */}
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${categoryStyle.bg} ${categoryStyle.border}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl sm:text-2xl">{categoryStyle.icon}</span>
                  <h3 className={`font-bold text-sm sm:text-base uppercase tracking-wide ${categoryStyle.text}`}>
                    {categoryStyle.title}
                  </h3>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/90 border ${categoryStyle.border} ${categoryStyle.text}`}>
                  {categoryItems.length} materiales
                </span>
              </div>

              {/* Items in this category */}
              <div className="space-y-2.5">
                {categoryItems.map((item) => {
                  const isZero = item.totalUnits === 0;
                  const isCritical = item.status === 'CRITICO';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-2xl p-4 shadow-xs transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                        isZero
                          ? 'border-slate-200 hover:border-slate-300'
                          : isCritical
                          ? 'border-amber-300 bg-amber-50/15'
                          : 'border-emerald-300 bg-emerald-50/10'
                      }`}
                    >
                      {/* Product description & info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border uppercase ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}>
                            {item.category}
                          </span>
                          <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                            {item.name}
                          </h4>
                          {isZero ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              Sin Stock (0 un.)
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Contado
                            </span>
                          )}
                          {item.isDirectUnits && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Carga Directa
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-slate-600 font-medium">
                          <span>Mínimo: <strong className="text-indigo-700 font-bold">{item.minStockAdjusted.toLocaleString('es-AR')} un.</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Máximo: <strong className="text-slate-800 font-bold">{item.maxStockAdjusted.toLocaleString('es-AR')} un.</strong></span>
                        </div>

                        {item.notes && (
                          <p className="text-xs text-slate-500 font-normal mt-1">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Triple Input System: Bultos + Cantidad por Bulto + Cantidad Total */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-wrap lg:flex-nowrap items-center gap-3 sm:gap-4 shrink-0">
                        {/* 1. CANTIDAD DE BULTOS */}
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                            <Boxes className="w-3.5 h-3.5 text-indigo-600" /> Bultos
                          </span>
                          <div className="flex items-center gap-1.5">
                            {/* Botón Menos */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, -1)}
                              disabled={item.bultos <= 0}
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold text-lg flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Restar 1 bulto"
                            >
                              <Minus className="w-5 h-5 stroke-[2.5]" />
                            </button>

                            {/* Input Bultos */}
                            <input
                              type="number"
                              min="0"
                              value={item.bultos}
                              onChange={(e) => handleSetBultos(item.id, parseInt(e.target.value, 10))}
                              className="w-16 sm:w-18 h-10 sm:h-11 text-center font-mono font-bold text-lg sm:text-xl border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900 shadow-xs"
                            />

                            {/* Botón Más (+1) */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, 1)}
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-lg flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Sumar 1 bulto"
                            >
                              <Plus className="w-5 h-5 stroke-[2.5]" />
                            </button>

                            {/* Botón Rápido +5 */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, 5)}
                              className="h-10 sm:h-11 px-2.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              title="Sumar 5 bultos rápidamente"
                            >
                              +5
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">bultos cerrados</span>
                        </div>

                        <div className="hidden sm:block text-slate-400 font-bold text-lg">×</div>

                        {/* 2. CANTIDAD POR BULTO (EDITABLE) */}
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-indigo-600" /> Cant. x Bulto
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={item.unitsPerBulto}
                              onChange={(e) => handleSetUnitsPerBulto(item.id, parseInt(e.target.value, 10))}
                              className="w-20 sm:w-24 h-10 sm:h-11 text-center font-mono font-bold text-base sm:text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-800 shadow-xs"
                              title="Unidades contenidas en cada bulto"
                            />
                            <span className="text-xs font-bold text-slate-500">un.</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">por paquete</span>
                        </div>

                        <div className="hidden sm:block text-slate-400 font-bold text-lg">=</div>

                        {/* 3. CANTIDAD TOTAL */}
                        <div className="flex flex-col items-center sm:items-start pl-1 sm:border-l border-slate-200">
                          <div className="flex items-center justify-between w-full gap-2 mb-1">
                            <span className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1">
                              <Hash className="w-3.5 h-3.5 text-indigo-600" /> Total Unidades
                            </span>
                            {/* Botón para habilitar carga directa */}
                            <button
                              type="button"
                              onClick={() => handleToggleAllowDirectTotal(item.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer active:scale-95 border ${
                                item.allowDirectTotal
                                  ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
                              }`}
                              title={
                                item.allowDirectTotal
                                  ? 'Clic para volver a calcular el total automáticamente (Bultos × Unidades)'
                                  : 'Clic para habilitar la carga manual de la cantidad total'
                              }
                            >
                              {item.allowDirectTotal ? (
                                <>
                                  <Unlock className="w-3 h-3 text-amber-800" />
                                  <span>Manual</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 text-slate-600" />
                                  <span>Auto</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 w-full">
                            <input
                              type="number"
                              min="0"
                              disabled={!item.allowDirectTotal}
                              value={item.totalUnits}
                              onChange={(e) => handleSetTotalUnitsDirect(item.id, parseInt(e.target.value, 10))}
                              className={`w-full sm:w-36 h-10 sm:h-11 px-2.5 text-right font-mono font-black text-lg sm:text-xl rounded-xl border transition-all ${
                                item.allowDirectTotal
                                  ? 'bg-amber-50 border-amber-400 text-amber-950 focus:ring-2 focus:ring-amber-500 outline-hidden'
                                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-950 cursor-not-allowed select-none'
                              }`}
                              title={
                                item.allowDirectTotal
                                  ? 'Carga manual de unidades totales habilitada'
                                  : 'Bloqueado: se calcula automáticamente como Bultos × Cant. por bulto.'
                              }
                            />
                            <span className="text-xs font-bold text-slate-500">un.</span>
                          </div>

                          <div className="text-[10px] mt-1 font-semibold">
                            {item.allowDirectTotal ? (
                              <span className="text-amber-800 flex items-center gap-1">
                                <Unlock className="w-3 h-3" /> Manual activo
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">
                                {item.bultos} bultos × {item.unitsPerBulto}
                              </span>
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
                Total: <span className="text-emerald-300 font-mono font-black text-sm sm:text-base">{totalUnitsCounted.toLocaleString('es-AR')}</span> un. ({totalBultosCounted.toLocaleString('es-AR')} bultos)
              </p>
              <p className="text-slate-400 text-[11px] font-normal">
                {responsible || 'Operador'} • {entryDate} • {selectedMonth.name}
              </p>
            </div>
          </div>

          <button
            onClick={handleFinishAndSync}
            disabled={isSyncing}
            className="w-full sm:w-auto h-10 sm:h-11 px-5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer tracking-tight active:scale-95 shrink-0"
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
