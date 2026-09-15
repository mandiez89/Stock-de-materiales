import React, { useState } from 'react';
import { 
  Save, 
  RotateCcw, 
  FileSpreadsheet, 
  CheckCircle2, 
  Calendar, 
  User, 
  AlertCircle, 
  HelpCircle,
  Eye,
  SendHorizontal
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor } from '../types';
import confetti from 'canvas-confetti';

interface MonthlyStockEntryProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onSaveBatch: (updatedItems: MaterialItem[], responsible: string, date: string, notes: string) => void;
  onOpenOriginalSheet: () => void;
  onSyncWithSheets: () => void;
}

export const MonthlyStockEntry: React.FC<MonthlyStockEntryProps> = ({
  items,
  selectedMonth,
  onSaveBatch,
  onOpenOriginalSheet,
  onSyncWithSheets,
}) => {
  const [responsible, setResponsible] = useState('Vivi y Érica');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('Carga mensual de depósito y planta de empaque');
  const [formItems, setFormItems] = useState<MaterialItem[]>(items);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Keep formItems in sync when items prop changes unless dirty
  const handleBultosChange = (id: string, newBultosVal: number) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const bultos = Math.max(0, isNaN(newBultosVal) ? 0 : newBultosVal);
          const totalUnits = bultos * item.unitsPerBulto;
          
          let status: MaterialItem['status'] = 'OPTIMO';
          let unitsToOrder = 0;
          if (totalUnits <= item.minStockAdjusted * 0.5) {
            status = 'CRITICO';
            unitsToOrder = Math.max(0, item.maxStockAdjusted - totalUnits);
          } else if (totalUnits < item.minStockAdjusted) {
            status = 'PEDIR';
            unitsToOrder = Math.max(0, item.maxStockAdjusted - totalUnits);
          } else if (totalUnits > item.maxStockAdjusted * 1.25) {
            status = 'SOBRESTOCK';
            unitsToOrder = 0;
          }

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
          };
        }
        return item;
      })
    );
  };

  const handleSave = () => {
    onSaveBatch(formItems, responsible, entryDate, notes);
    setSavedSuccess(true);
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleResetToSheetValues = () => {
    if (window.confirm('¿Deseas restaurar los valores originales transcriptos de la planilla en papel del 15-08-26?')) {
      setFormItems(items);
    }
  };

  const handleClearAllToZero = () => {
    if (window.confirm('¿Deseas poner todos los bultos en 0 para iniciar un nuevo recuento físico en blanco?')) {
      setFormItems((prev) =>
        prev.map((item) => ({
          ...item,
          bultos: 0,
          totalUnits: 0,
          status: 'CRITICO',
          unitsToOrder: item.maxStockAdjusted,
          bultosToOrder: Math.ceil(item.maxStockAdjusted / item.unitsPerBulto),
        }))
      );
    }
  };

  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  const categoryTitles: Record<MaterialCategory, { title: string; subtitle: string; color: string }> = {
    Cajas: { title: '1. Cajas de Cartón', subtitle: '5 cm, 9 cm, 13 cm, Bombachas y Dussio', color: 'border-amber-300 bg-amber-50/50' },
    Celofanes: { title: '2. Celofanes (Sin Impresión)', subtitle: 'Grandes, Medianos con/sin solapa, Chicos y Trusas', color: 'border-blue-300 bg-blue-50/50' },
    Bolsitas: { title: '3. Bolsitas (Con Impresión)', subtitle: 'Genéricas colores, Plantines, 3/4 Lycra y Sugesteen Panty', color: 'border-purple-300 bg-purple-50/50' },
    Caballetes: { title: '4. Caballetes', subtitle: 'Modelos y numeraciones (15 al 8500)', color: 'border-emerald-300 bg-emerald-50/50' },
    Cartones: { title: '5. Cartones de Soporte', subtitle: 'Grandes, Medianos, Chicos y Plantines', color: 'border-slate-300 bg-slate-50/50' },
  };

  return (
    <div className="space-y-6">
      {/* Instructions & Metadata Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Planilla Digital de Carga Mensual</span>
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Reemplazo de la planilla física de papel
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carga rápida por sector. Al ingresar los bultos, el sistema calcula automáticamente las unidades totales y evalúa el pedido para {selectedMonth.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenOriginalSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              Ver Foto Original
            </button>
            <button
              onClick={handleResetToSheetValues}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              title="Restaurar datos del 15-08-26"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Datos 15-08-26
            </button>
            <button
              onClick={handleClearAllToZero}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              title="Iniciar planilla vacía"
            >
              Limpiar para Nuevo Mes
            </button>
          </div>
        </div>

        {/* Metadata inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> Responsable(s) de la Carga:
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Ej: Vivi y Érica"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha del Relevamiento:
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notas / Observaciones del Sector:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Control fin de mes, todo en orden"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Success alert */}
      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 shadow-sm flex items-center justify-between text-emerald-900 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-bold text-sm">¡Planilla mensual guardada y calculada exitosamente!</p>
              <p className="text-emerald-700">
                Los stocks, mínimos estacionales y pedidos sugeridos se han actualizado en el sistema y están listos para sincronizar con Google Sheets.
              </p>
            </div>
          </div>
          <button
            onClick={onSyncWithSheets}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            <SendHorizontal className="w-3.5 h-3.5" /> Sincronizar Sheets
          </button>
        </div>
      )}

      {/* Sections based on physical sheet */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = formItems.filter((i) => i.category === category);
          const meta = categoryTitles[category];

          return (
            <div
              key={category}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
            >
              {/* Category Header */}
              <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${meta.color}`}>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{meta.title}</h3>
                  <p className="text-xs text-slate-600">{meta.subtitle}</p>
                </div>
                <div className="text-xs font-medium text-slate-600">
                  {categoryItems.length} materiales en esta sección
                </div>
              </div>

              {/* Items Grid / Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4">Material / Denominación</th>
                      <th className="py-2.5 px-3 text-center w-32">Bultos Físicos</th>
                      <th className="py-2.5 px-3 text-right">Unid. x Bulto</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-800">Total Unidades</th>
                      <th className="py-2.5 px-3 text-right text-slate-500">Mínimo Mes</th>
                      <th className="py-2.5 px-3 text-center">Diagnóstico</th>
                      <th className="py-2.5 px-3 text-right text-indigo-700 font-bold">Pedido Sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryItems.map((item) => {
                      const isCritical = item.status === 'CRITICO';
                      const isReorder = item.status === 'PEDIR';

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            item.isMarkedInSheet ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          {/* Name */}
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.isMarkedInSheet && (
                                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                                  Resaltado
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-slate-400 font-normal block">
                                {item.notes}
                              </span>
                            )}
                          </td>

                          {/* Bultos Input */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.bultos}
                              onChange={(e) => handleBultosChange(item.id, parseInt(e.target.value, 10))}
                              className={`w-24 text-center py-1 px-2 border rounded-md font-mono font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500 outline-hidden ${
                                item.bultos === 0
                                  ? 'border-rose-400 bg-rose-50 text-rose-800 font-black'
                                  : isCritical
                                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                                  : 'border-slate-300 bg-white text-slate-900'
                              }`}
                            />
                          </td>

                          {/* Unidades x Bulto */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {item.unitsPerBulto.toLocaleString('es-AR')}
                          </td>

                          {/* Total Calculado */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.totalUnits.toLocaleString('es-AR')}
                          </td>

                          {/* Mínimo Mes */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {item.minStockAdjusted.toLocaleString('es-AR')}
                          </td>

                          {/* Estado */}
                          <td className="py-2.5 px-3 text-center">
                            {isCritical && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                                🔴 Crítico
                              </span>
                            )}
                            {isReorder && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                🟡 Reponer
                              </span>
                            )}
                            {!isCritical && !isReorder && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                🟢 OK
                              </span>
                            )}
                          </td>

                          {/* Pedido sugerido */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                            {item.bultosToOrder > 0 ? (
                              <span>+{item.bultosToOrder} btos ({item.unitsToOrder.toLocaleString('es-AR')} un.)</span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating or bottom Action Bar */}
      <div className="sticky bottom-4 z-30 bg-slate-900 text-white rounded-xl p-4 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs">
          <p className="font-bold text-white text-sm">
            {formItems.length} materiales listos para confirmar
          </p>
          <p className="text-slate-400">
            Responsable: <strong>{responsible}</strong> • Fecha: <strong>{entryDate}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetToSheetValues}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Descartar Cambios
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Guardar y Actualizar Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
