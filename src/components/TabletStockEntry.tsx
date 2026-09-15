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
    <div className="space-y-6 pb-36 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Tablet Mode Header Banner - High Contrast & Large for Seniors */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <Tablet className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight">Planilla de Carga de Stock en Depósito</h2>
                <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" /> Memoria Offline Activa
                </span>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
                Contá los <strong>bultos cerrados</strong> o habilitá el <strong>total manual</strong> si tenés paquetes abiertos o unidades sueltas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <div className="flex items-center gap-2 text-slate-200 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700 text-xs sm:text-sm font-semibold">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Guardado: {lastSavedTime || 'Automático'}</span>
            </div>
            <button
              onClick={handleResetDraft}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer border border-slate-700 flex items-center gap-1.5 active:scale-95"
              title="Restaurar conteo"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
          </div>
        </div>

        {/* Responsible & Date Bar - Large Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800">
          <div>
            <label className="block text-slate-300 font-bold text-sm sm:text-base mb-1.5 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> Operador Responsable:
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Escribe tu nombre..."
              className="w-full h-12 sm:h-13 px-4 bg-slate-800 border-2 border-slate-600 rounded-xl text-white font-bold text-base sm:text-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold text-sm sm:text-base mb-1.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" /> Fecha del Conteo:
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full h-12 sm:h-13 px-4 bg-slate-800 border-2 border-slate-600 rounded-xl text-white font-bold text-base sm:text-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold text-sm sm:text-base mb-1.5">
              Período / Mes Activo:
            </label>
            <div className="h-12 sm:h-13 px-4 bg-slate-800 border-2 border-slate-600 rounded-xl text-emerald-300 font-black text-base sm:text-lg flex items-center justify-between">
              <span>{selectedMonth.name}</span>
              <span className="text-xs sm:text-sm text-slate-300 font-semibold">
                {itemsWithStock} de {formItems.length} contados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Status Feedback */}
      {syncSuccessMessage && (
        <div className="p-4 sm:p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-950 text-sm sm:text-base flex items-center gap-3.5 shadow-md animate-fade-in font-bold">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="flex-1">{syncSuccessMessage}</div>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-400 rounded-2xl text-rose-950 text-sm sm:text-base flex items-center gap-3.5 shadow-md font-bold">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div className="flex-1">{syncErrorMessage}</div>
        </div>
      )}

      {/* Sector Category Filter Bar (Large Tactile Pills for Tablet Fingers) */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-wider block mb-2">
            Filtrar por sector de depósito:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categoriesList.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`min-h-[54px] sm:min-h-[58px] px-5 py-3 rounded-2xl text-sm sm:text-base font-black transition-all whitespace-nowrap flex items-center gap-2.5 cursor-pointer shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-md ring-4 ring-indigo-500/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
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

        {/* Quick Search - Large & Easy to Tap */}
        <div className="relative">
          <Search className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar material o código (ej: 8100, bombachas, plantines, celofán)..."
            className="w-full h-14 sm:h-16 pl-13 pr-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base sm:text-lg font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        {/* Banner de Modo de Carga - Friendly Guide for Seniors */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-indigo-50/90 rounded-2xl border-2 border-indigo-200 text-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600 text-white rounded-xl font-bold shrink-0">
              <Boxes className="w-5 h-5" />
            </span>
            <p className="text-sm sm:text-base font-semibold leading-relaxed">
              Cargá <strong>Bultos</strong> con los botones <strong>+</strong> y <strong>-</strong>. El <strong>Total de Unidades</strong> se calcula automáticamente. Si tenés unidades sueltas, tocá <strong>Total Manual</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => handleToggleAllDirectTotal(true)}
              className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-black rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Permite editar la cantidad total directamente en todos los materiales"
            >
              <Unlock className="w-4 h-4 text-amber-800" />
              <span>Habilitar Total Directo</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllDirectTotal(false)}
              className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-black rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border-2 border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Bloquea la cantidad total en todos y vuelve al cálculo automático Bultos × Unidades"
            >
              <Lock className="w-4 h-4 text-slate-600" />
              <span>Auto (Por defecto)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products grouped by clear Category Sections */}
      <div className="space-y-8">
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
            <div key={category} className="space-y-4">
              {/* Distinct Category Section Header */}
              <div className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border-2 ${categoryStyle.bg} ${categoryStyle.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl">{categoryStyle.icon}</span>
                  <h3 className={`font-black text-base sm:text-lg uppercase tracking-wide ${categoryStyle.text}`}>
                    {categoryStyle.title}
                  </h3>
                </div>
                <span className={`text-xs sm:text-sm font-black px-3.5 py-1 rounded-full bg-white/90 border-2 ${categoryStyle.border} ${categoryStyle.text}`}>
                  {categoryItems.length} materiales
                </span>
              </div>

              {/* Items in this category */}
              <div className="space-y-3">
                {categoryItems.map((item) => {
                  const isZero = item.totalUnits === 0;
                  const isCritical = item.status === 'CRITICO';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border-2 rounded-3xl p-5 sm:p-6 shadow-sm transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-5 ${
                        isZero
                          ? 'border-slate-300 hover:border-slate-400'
                          : isCritical
                          ? 'border-amber-400 bg-amber-50/15'
                          : 'border-emerald-400 bg-emerald-50/10 shadow-xs'
                      }`}
                    >
                      {/* Product description & info - Large & High Contrast */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border uppercase ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}>
                            {item.category}
                          </span>
                          <h4 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                            {item.name}
                          </h4>
                          {isZero ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-300">
                              Sin Stock (0 un.)
                            </span>
                          ) : (
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Contado
                            </span>
                          )}
                          {item.isDirectUnits && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Carga Directa
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm sm:text-base text-slate-600 font-semibold">
                          <span>Stock mínimo: <strong className="text-indigo-700 font-extrabold">{item.minStockAdjusted.toLocaleString('es-AR')} un.</strong></span>
                          <span className="text-slate-300 font-bold">•</span>
                          <span>Stock máximo: <strong className="text-slate-800 font-extrabold">{item.maxStockAdjusted.toLocaleString('es-AR')} un.</strong></span>
                        </div>

                        {item.notes && (
                          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Triple Input System: Bultos + Cantidad por Bulto + Cantidad Total (Optimized for Seniors) */}
                      <div className="bg-slate-100/90 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap lg:flex-nowrap items-center gap-4 sm:gap-6 shrink-0">
                        {/* 1. CANTIDAD DE BULTOS */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs sm:text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-1.5">
                            <Boxes className="w-4 h-4 text-indigo-600" /> Bultos
                          </span>
                          <div className="flex items-center gap-1.5">
                            {/* Botón Menos */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, -1)}
                              disabled={item.bultos <= 0}
                              className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-white border-2 border-slate-300 hover:bg-slate-50 active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Restar 1 bulto"
                            >
                              <Minus className="w-6 h-6 stroke-[3]" />
                            </button>

                            {/* Input Bultos */}
                            <input
                              type="number"
                              min="0"
                              value={item.bultos}
                              onChange={(e) => handleSetBultos(item.id, parseInt(e.target.value, 10))}
                              className="w-20 sm:w-22 h-13 sm:h-15 text-center font-mono font-black text-2xl sm:text-3xl border-2 border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-900 shadow-inner"
                            />

                            {/* Botón Más (+1) */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, 1)}
                              className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
                              title="Sumar 1 bulto"
                            >
                              <Plus className="w-6 h-6 stroke-[3]" />
                            </button>

                            {/* Botón Rápido +5 (Ideal para pallets o estibas) */}
                            <button
                              type="button"
                              onClick={() => handleStepBultos(item.id, 5)}
                              className="h-13 sm:h-15 px-3 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border-2 border-indigo-200 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer active:scale-95"
                              title="Sumar 5 bultos rápidamente"
                            >
                              +5
                            </button>
                          </div>
                          <span className="text-xs text-slate-500 font-bold mt-1.5">bultos cerrados</span>
                        </div>

                        <div className="hidden sm:block text-slate-400 font-black text-2xl">×</div>

                        {/* 2. CANTIDAD POR BULTO (EDITABLE) */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs sm:text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-indigo-600" /> Cant. x Bulto
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={item.unitsPerBulto}
                              onChange={(e) => handleSetUnitsPerBulto(item.id, parseInt(e.target.value, 10))}
                              className="w-24 sm:w-28 h-13 sm:h-15 text-center font-mono font-black text-xl sm:text-2xl border-2 border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-800 shadow-inner"
                              title="Unidades contenidas en cada bulto"
                            />
                            <span className="text-sm sm:text-base font-black text-slate-600">un.</span>
                          </div>
                          <span className="text-xs text-slate-500 font-bold mt-1.5">por paquete</span>
                        </div>

                        <div className="hidden sm:block text-slate-400 font-black text-2xl">=</div>

                        {/* 3. CANTIDAD TOTAL (BLOQUEADA POR DEFECTO, HABILITABLE CON BOTÓN) */}
                        <div className="flex flex-col items-center sm:items-start pl-1 sm:border-l-2 border-slate-200">
                          <div className="flex items-center justify-between w-full gap-2 mb-2">
                            <span className="text-xs sm:text-sm font-black text-slate-900 uppercase flex items-center gap-1.5">
                              <Hash className="w-4 h-4 text-indigo-600" /> Total Unidades
                            </span>
                            {/* Botón para habilitar carga directa */}
                            <button
                              type="button"
                              onClick={() => handleToggleAllowDirectTotal(item.id)}
                              className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border-2 ${
                                item.allowDirectTotal
                                  ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                              }`}
                              title={
                                item.allowDirectTotal
                                  ? 'Clic para volver a calcular el total automáticamente (Bultos × Unidades)'
                                  : 'Clic para habilitar la carga manual de la cantidad total'
                              }
                            >
                              {item.allowDirectTotal ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5 text-amber-800" />
                                  <span>Total Manual</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Auto</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="number"
                              min="0"
                              disabled={!item.allowDirectTotal}
                              value={item.totalUnits}
                              onChange={(e) => handleSetTotalUnitsDirect(item.id, parseInt(e.target.value, 10))}
                              className={`w-full sm:w-44 h-13 sm:h-15 px-3 text-right font-mono font-black text-2xl sm:text-3xl rounded-2xl border-2 transition-all ${
                                item.allowDirectTotal
                                  ? 'bg-amber-50 border-amber-500 text-amber-950 focus:ring-2 focus:ring-amber-500 outline-hidden'
                                  : 'bg-indigo-50/80 border-indigo-200 text-indigo-950 cursor-not-allowed select-none'
                              }`}
                              title={
                                item.allowDirectTotal
                                  ? 'Carga manual de unidades totales habilitada'
                                  : 'Bloqueado: se calcula automáticamente como Bultos × Cant. por bulto.'
                              }
                            />
                            <span className="text-sm sm:text-base font-black text-slate-600">un.</span>
                          </div>

                          <div className="text-xs mt-1.5 font-bold">
                            {item.allowDirectTotal ? (
                              <span className="text-amber-800 flex items-center gap-1">
                                <Unlock className="w-3.5 h-3.5" /> Ingreso manual activo
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono">
                                Cálculo: {item.bultos} bultos × {item.unitsPerBulto}
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

      {/* Floating Action Bar (Sticky at bottom for Tablet) - Prominent & Senior Friendly */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md text-white border-t-2 border-slate-800 p-4 sm:p-5 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-black text-white text-base sm:text-xl tracking-tight">
                Total Contabilizado: {totalUnitsCounted.toLocaleString('es-AR')} unidades ({totalBultosCounted.toLocaleString('es-AR')} bultos)
              </p>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm font-medium mt-0.5">
              Operador: <strong className="text-white font-bold">{responsible || 'Sin asignar'}</strong> • Fecha: <strong className="text-white font-bold">{entryDate}</strong> • Mes: <strong className="text-emerald-400 font-bold">{selectedMonth.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={handleFinishAndSync}
              disabled={isSyncing}
              className="w-full sm:w-auto min-h-[58px] sm:min-h-[62px] px-8 sm:px-10 py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-base sm:text-xl rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer tracking-tight active:scale-95"
            >
              {isSyncing ? (
                <>
                  <div className="w-5 h-5 border-3 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Google Sheets...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="w-6 h-6" />
                  <span>GUARDAR EN GOOGLE SHEETS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
