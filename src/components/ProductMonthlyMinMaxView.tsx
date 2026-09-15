import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Sparkles,
  Info,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor, MonthMinMax } from '../types';
import { exportMinMaxToCSV } from '../data/sheetsIntegration';
import confetti from 'canvas-confetti';

interface ProductMonthlyMinMaxViewProps {
  items: MaterialItem[];
  monthlyFactors: MonthlyFactor[];
  onUpdateItemsMinMax: (updatedItems: MaterialItem[]) => void;
  onSyncMinMaxToSheets?: (items: MaterialItem[]) => Promise<boolean>;
}

export const ProductMonthlyMinMaxView: React.FC<ProductMonthlyMinMaxViewProps> = ({
  items,
  monthlyFactors,
  onUpdateItemsMinMax,
  onSyncMinMaxToSheets,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // Current month
  const [viewMode, setViewMode] = useState<'single_month' | 'full_year'>('single_month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedCSV, setPastedCSV] = useState<string>('');

  // Local copy of items for in-place editing
  const [localItems, setLocalItems] = useState<MaterialItem[]>(items);

  // Sync if parent items update
  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  // Handle in-place editing of min or max for a specific item and month
  const handleThresholdChange = (itemId: string, month: number, field: 'min' | 'max', value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentMonthly = item.monthlyMinMax || {};
          const currentMonthVal = currentMonthly[month] || { min: item.minStockBase, max: item.maxStockBase };
          const updatedMonthVal: MonthMinMax = {
            ...currentMonthVal,
            [field]: val,
          };
          const updatedMonthly = {
            ...currentMonthly,
            [month]: updatedMonthVal,
          };
          return {
            ...item,
            monthlyMinMax: updatedMonthly,
          };
        }
        return item;
      })
    );
  };

  // Save changes to state
  const handleSaveToApp = () => {
    onUpdateItemsMinMax(localItems);
    setFeedbackMessage({
      type: 'success',
      text: '¡Parámetros de stock mínimo y máximo actualizados en la aplicación!',
    });
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Sync parameters directly to Google Sheets
  const handleSyncToSheets = async () => {
    if (!onSyncMinMaxToSheets) return;
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      const success = await onSyncMinMaxToSheets(localItems);
      if (success) {
        setFeedbackMessage({
          type: 'success',
          text: '¡Parámetros guardados y sincronizados con la hoja "Parametros_MinMax" en Google Sheets!',
        });
        confetti({ particleCount: 70, spread: 70 });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: 'No se pudo sincronizar con Google Sheets. Revisa la URL del Webhook.',
        });
      }
    } catch (e: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Error al enviar a Google Sheets: ${e.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleDownloadCSV = () => {
    const csvContent = exportMinMaxToCSV(localItems);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Parametros_MinMax_Sugestion.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return localItems.filter((item) => {
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [localItems, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Matriz de Stocks Mínimos y Máximos Mensuales por Producto
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Configura los umbrales de seguridad mes por mes para cada uno de los 52 materiales. Puedes editarlos aquí en la web, descargarlos en CSV o cargarlos directamente desde la pestaña <strong>"Parametros_MinMax"</strong> en tu Google Sheet.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descargar archivo CSV para abrir o importar en Google Sheets"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Plantilla Google Sheets (CSV)</span>
            </button>

            {onSyncMinMaxToSheets && (
              <button
                onClick={handleSyncToSheets}
                disabled={isSaving}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isSaving ? 'Sincronizando...' : 'Guardar en Google Sheets'}</span>
              </button>
            )}

            <button
              onClick={handleSaveToApp}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Aplicar Cambios</span>
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedbackMessage.text}</span>
          </div>
        )}

        {/* Filters and View Mode Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
          {/* Month Selector */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Mes a Configurar:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              {monthlyFactors.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month}. {m.name} ({m.seasonName})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">
              Sector / Categoría:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
            >
              <option value="all">Todos los Sectores ({localItems.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({localItems.filter((i) => i.category === c).length})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">
              Buscar Producto:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej: 8100, bombachas, celofán..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* How Google Sheets min/max works banner */}
      <div className="bg-indigo-900 text-white rounded-xl p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-white">¿Cómo cargar los Mínimos y Máximos directamente desde Google Sheets?</p>
            <p className="text-indigo-200 text-[11px] mt-0.5">
              En tu hoja de cálculo se crea la pestaña <strong>"Parametros_MinMax"</strong> con una columna para el Mínimo y Máximo de cada mes (Min_Ene, Max_Ene, ..., Min_Dic, Max_Dic). Mariano puede modificar los valores ahí libremente y la app web los respetará en cada cálculo de reposición.
            </p>
          </div>
        </div>
      </div>

      {/* Table of products */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Sector</th>
                <th className="py-3 px-4">Material / Denominación</th>
                <th className="py-3 px-4 text-right">Unid. x Bulto</th>
                <th className="py-3 px-4 text-center bg-indigo-50/70 border-x border-indigo-100 text-indigo-900 font-bold">
                  Stock Mínimo ({monthlyFactors[selectedMonth - 1]?.shortName})
                </th>
                <th className="py-3 px-4 text-center bg-indigo-50/70 border-r border-indigo-100 text-indigo-900 font-bold">
                  Stock Máximo ({monthlyFactors[selectedMonth - 1]?.shortName})
                </th>
                <th className="py-3 px-4 text-right text-slate-400">Base Histórica</th>
                <th className="py-3 px-4 text-left">Proveedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const monthVal = (item.monthlyMinMax && item.monthlyMinMax[selectedMonth]) || {
                  min: item.minStockBase,
                  max: item.maxStockBase,
                };

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Category */}
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {item.category}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {item.name}
                    </td>

                    {/* Units per Bulto */}
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                      {item.unitsPerBulto.toLocaleString('es-AR')}
                    </td>

                    {/* Min Threshold Input (Editable) */}
                    <td className="py-2 px-3 text-center bg-indigo-50/30 border-x border-indigo-100">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={monthVal.min}
                          onChange={(e) =>
                            handleThresholdChange(item.id, selectedMonth, 'min', parseInt(e.target.value, 10))
                          }
                          className="w-24 px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-center font-mono font-bold text-indigo-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                        <span className="text-[10px] text-slate-400">un.</span>
                      </div>
                    </td>

                    {/* Max Threshold Input (Editable) */}
                    <td className="py-2 px-3 text-center bg-indigo-50/30 border-r border-indigo-100">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={monthVal.max}
                          onChange={(e) =>
                            handleThresholdChange(item.id, selectedMonth, 'max', parseInt(e.target.value, 10))
                          }
                          className="w-24 px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-center font-mono font-bold text-indigo-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                        <span className="text-[10px] text-slate-400">un.</span>
                      </div>
                    </td>

                    {/* Base values */}
                    <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-400">
                      {item.minStockBase.toLocaleString('es-AR')} / {item.maxStockBase.toLocaleString('es-AR')}
                    </td>

                    {/* Provider */}
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-[140px]">
                      {item.provider}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
