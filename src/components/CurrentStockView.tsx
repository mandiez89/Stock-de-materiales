import React, { useState, useMemo } from 'react';
import { 
  PackageCheck, 
  Search, 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Eye,
  ArrowUpDown
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor } from '../types';

interface CurrentStockViewProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onNavigateToEntry: () => void;
}

export const CurrentStockView: React.FC<CurrentStockViewProps> = ({
  items,
  selectedMonth,
  onNavigateToEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'bultos' | 'totalUnits'>('category');

  // Summary figures
  const totalBultos = useMemo(() => items.reduce((acc, i) => acc + i.bultos, 0), [items]);
  const totalUnits = useMemo(() => items.reduce((acc, i) => acc + i.totalUnits, 0), [items]);
  const criticalItems = useMemo(() => items.filter((i) => i.status === 'CRITICO'), [items]);
  const optimalItems = useMemo(() => items.filter((i) => i.status === 'OPTIMO'), [items]);
  const reorderItems = useMemo(() => items.filter((i) => i.status === 'PEDIR'), [items]);

  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  // Filter and sort
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, statusFilter]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title & KPI Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              <span>Visualización de Stock Actual en Depósito</span>
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Lectura Operativa
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estado consolidado del stock físico contabilizado en planta y depósito para el mes de {selectedMonth.name}.
            </p>
          </div>

          <button
            onClick={onNavigateToEntry}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            Modificar / Cargar en Tablet
          </button>
        </div>

        {/* 4 KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 block text-[11px]">Total Bultos Físicos</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
              {totalBultos.toLocaleString('es-AR')}
            </span>
            <span className="text-[10px] text-slate-400">En 52 materiales</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 block text-[11px]">Total Unidades Reales</span>
            <span className="text-xl font-black text-indigo-900 font-mono mt-0.5 block">
              {totalUnits.toLocaleString('es-AR')}
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold">Unidades empaque</span>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="text-emerald-700 block text-[11px] font-semibold">Stock Normal / Óptimo</span>
            <span className="text-xl font-black text-emerald-900 font-mono mt-0.5 block">
              {optimalItems.length}
            </span>
            <span className="text-[10px] text-emerald-600">Materiales abastecidos</span>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <span className="text-rose-700 block text-[11px] font-semibold">Por Debajo del Mínimo</span>
            <span className="text-xl font-black text-rose-900 font-mono mt-0.5 block">
              {criticalItems.length + reorderItems.length}
            </span>
            <span className="text-[10px] text-rose-600 font-medium">
              {criticalItems.length} críticos • {reorderItems.length} a reponer
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
          >
            <option value="all">Todos los Sectores ({items.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({items.filter((i) => i.category === c).length})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="CRITICO">🔴 Críticos</option>
            <option value="PEDIR">🟡 A Reponer</option>
            <option value="OPTIMO">🟢 Óptimos</option>
            <option value="SOBRESTOCK">🔵 Sobrestock</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar material o código..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Sector / Categoría</th>
                <th className="py-3 px-4">Material / Denominación</th>
                <th className="py-3 px-4 text-center">Bultos Físicos</th>
                <th className="py-3 px-4 text-right">Unid. x Bulto</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Total Unidades</th>
                <th className="py-3 px-4 text-right text-slate-500">Mínimo ({selectedMonth.shortName})</th>
                <th className="py-3 px-4 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isCritical = item.status === 'CRITICO';
                const isReorder = item.status === 'PEDIR';
                const isOver = item.status === 'SOBRESTOCK';

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.totalUnits === 0 ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {item.category}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{item.name}</span>
                        {item.isDirectUnits && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                            Carga x Unidades
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          {item.notes}
                        </span>
                      )}
                    </td>

                    {/* Bultos */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md ${
                          item.bultos === 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.bultos}
                      </span>
                    </td>

                    {/* Units per bulto */}
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {item.unitsPerBulto.toLocaleString('es-AR')}
                    </td>

                    {/* Total units */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {item.totalUnits.toLocaleString('es-AR')} un.
                    </td>

                    {/* Mínimo mensual */}
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {item.minStockAdjusted.toLocaleString('es-AR')}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {isCritical && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          🔴 Crítico
                        </span>
                      )}
                      {isReorder && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          🟡 Reponer
                        </span>
                      )}
                      {isOver && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          🔵 Sobrestock
                        </span>
                      )}
                      {!isCritical && !isReorder && !isOver && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          🟢 Óptimo
                        </span>
                      )}
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
