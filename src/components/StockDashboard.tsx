import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Search, 
  ShoppingBag, 
  Layers, 
  Truck,
  Plus,
  Minus
} from 'lucide-react';
import { MaterialItem, MaterialCategory, MonthlyFactor } from '../types';

interface StockDashboardProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onUpdateBultos: (id: string, newBultos: number) => void;
  onOpenPurchaseOrder: () => void;
}

export const StockDashboard: React.FC<StockDashboardProps> = ({
  items,
  selectedMonth,
  onUpdateBultos,
  onOpenPurchaseOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Statistics
  const totalCount = items.length;
  const criticalItems = useMemo(() => items.filter((i) => i.status === 'CRITICO'), [items]);
  const reorderItems = useMemo(() => items.filter((i) => i.status === 'PEDIR'), [items]);
  const optimalItems = useMemo(() => items.filter((i) => i.status === 'OPTIMO'), [items]);
  const overstockItems = useMemo(() => items.filter((i) => i.status === 'SOBRESTOCK'), [items]);

  const totalUnitsToOrder = useMemo(
    () => items.reduce((acc, i) => acc + i.unitsToOrder, 0),
    [items]
  );
  const itemsToOrderCount = useMemo(
    () => items.filter((i) => i.unitsToOrder > 0).length,
    [items]
  );

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.provider.toLowerCase().includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

      // Status
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  // Provider summary
  const providerSummary = useMemo<Record<string, { units: number; itemsCount: number }>>(() => {
    const summary: Record<string, { units: number; itemsCount: number }> = {};
    items.forEach((item) => {
      if (item.unitsToOrder > 0) {
        if (!summary[item.provider]) {
          summary[item.provider] = { units: 0, itemsCount: 0 };
        }
        summary[item.provider].units += item.unitsToOrder;
        summary[item.provider].itemsCount += 1;
      }
    });
    return summary;
  }, [items]);

  const categories: { label: string; value: string; count: number }[] = [
    { label: 'Todas las Categorías', value: 'all', count: totalCount },
    { label: 'Cajas', value: 'Cajas', count: items.filter((i) => i.category === 'Cajas').length },
    { label: 'Celofanes', value: 'Celofanes', count: items.filter((i) => i.category === 'Celofanes').length },
    { label: 'Bolsitas', value: 'Bolsitas', count: items.filter((i) => i.category === 'Bolsitas').length },
    { label: 'Caballetes', value: 'Caballetes', count: items.filter((i) => i.category === 'Caballetes').length },
    { label: 'Cartones', value: 'Cartones', count: items.filter((i) => i.category === 'Cartones').length },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if Critical */}
      {criticalItems.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-950">
                ¡Atención! Se detectaron {criticalItems.length} materiales en estado crítico para {selectedMonth.name}
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                Riesgo inminente de quiebre de stock en fábrica (especialmente: {criticalItems.slice(0, 3).map(i => i.name).join(', ')}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedStatus('CRITICO');
                setSelectedCategory('all');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Ver Críticos ({criticalItems.length})
            </button>
            <button
              onClick={onOpenPurchaseOrder}
              className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Pedir Reposición ({totalUnitsToOrder.toLocaleString('es-AR')} un.)
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Materials */}
        <div 
          onClick={() => setSelectedStatus('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'all'
              ? 'bg-white border-indigo-400 ring-2 ring-indigo-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Ítems</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-400">materiales</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Relevados en 5 sectores</p>
        </div>

        {/* Critical */}
        <div 
          onClick={() => setSelectedStatus('CRITICO')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'CRITICO'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">🔴 Críticos</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{criticalItems.length}</span>
            <span className="text-xs text-rose-600 font-semibold">quiebre inminente</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Menos del 50% del mínimo</p>
        </div>

        {/* Reorder */}
        <div 
          onClick={() => setSelectedStatus('PEDIR')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'PEDIR'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">🟡 Reponer</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{reorderItems.length}</span>
            <span className="text-xs text-amber-600 font-semibold">a pedir</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Por debajo del mínimo</p>
        </div>

        {/* Optimal */}
        <div 
          onClick={() => setSelectedStatus('OPTIMO')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'OPTIMO'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">🟢 Óptimos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{optimalItems.length}</span>
            <span className="text-xs text-emerald-600 font-semibold">abastecidos</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Dentro del rango Min/Max</p>
        </div>

        {/* Cantidad Total to Order */}
        <div 
          onClick={onOpenPurchaseOrder}
          className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 hover:border-indigo-400 transition-all cursor-pointer shadow-xs col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">📦 Total a Pedir</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-900 font-mono">
              {totalUnitsToOrder.toLocaleString('es-AR')}
            </span>
            <span className="text-xs text-indigo-700 font-bold">unidades</span>
          </div>
          <p className="text-[11px] text-indigo-600 mt-1">
            En {itemsToOrderCount} materiales a reponer
          </p>
        </div>
      </div>

      {/* Provider Quick Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cantidades Totales a Pedir por Proveedor ({selectedMonth.name})
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            Factor de demanda: <strong>{selectedMonth.factor}x</strong> ({selectedMonth.seasonName})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(providerSummary).length === 0 ? (
            <div className="col-span-3 text-center py-4 text-xs text-slate-400">
              No hay pedidos requeridos para este período.
            </div>
          ) : (
            (Object.entries(providerSummary) as [string, { units: number; itemsCount: number }][]).map(([providerName, data]) => (
              <div
                key={providerName}
                onClick={onOpenPurchaseOrder}
                className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 truncate">{providerName}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-1.5 py-0.2 rounded">
                    {data.itemsCount} ítems
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">Volumen Requerido:</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {data.units.toLocaleString('es-AR')} un.
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category Pills & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 pl-1 pr-2">
            <Layers className="w-3.5 h-3.5" /> Sectores:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.value
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat.label}
              <span
                className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.value
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and status filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar material, código o proveedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Status filter buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'all'
                  ? 'bg-indigo-100 text-indigo-800 font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setSelectedStatus('CRITICO')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'CRITICO'
                  ? 'bg-rose-100 text-rose-800 font-bold'
                  : 'text-slate-600 hover:bg-rose-50'
              }`}
            >
              🔴 Críticos ({criticalItems.length})
            </button>
            <button
              onClick={() => setSelectedStatus('PEDIR')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'PEDIR'
                  ? 'bg-amber-100 text-amber-800 font-bold'
                  : 'text-slate-600 hover:bg-amber-50'
              }`}
            >
              🟡 Reponer ({reorderItems.length})
            </button>
            <button
              onClick={() => setSelectedStatus('OPTIMO')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'OPTIMO'
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'text-slate-600 hover:bg-emerald-50'
              }`}
            >
              🟢 Óptimos ({optimalItems.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Material / Código</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3 text-right">Bultos</th>
                <th className="py-3 px-3 text-right">Unid. x Bto</th>
                <th className="py-3 px-3 text-right font-bold text-slate-900">Total Stock (Unid)</th>
                <th className="py-3 px-3 text-right">Mín Req. ({selectedMonth.shortName})</th>
                <th className="py-3 px-3 text-right">Máx Req. ({selectedMonth.shortName})</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-right font-bold text-indigo-700 bg-indigo-50/50">
                  Total a Pedir
                </th>
                <th className="py-3 px-3">Proveedor</th>
                <th className="py-3 px-3 text-center">Ajuste Bultos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No se encontraron materiales con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isCritical = item.status === 'CRITICO';
                  const isReorder = item.status === 'PEDIR';
                  const isOverstock = item.status === 'SOBRESTOCK';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {item.name}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Bultos */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                        {item.bultos}
                      </td>

                      {/* Units per Bulto */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {item.unitsPerBulto.toLocaleString('es-AR')}
                      </td>

                      {/* Total Units */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {item.totalUnits.toLocaleString('es-AR')} un.
                        {item.isDirectUnits && (
                          <span className="block text-[9px] text-indigo-600 font-medium">directo</span>
                        )}
                      </td>

                      {/* Min Adjusted */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {item.minStockAdjusted.toLocaleString('es-AR')}
                      </td>

                      {/* Max Adjusted */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {item.maxStockAdjusted.toLocaleString('es-AR')}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isCritical && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            🔴 Crítico
                          </span>
                        )}
                        {isReorder && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            🟡 Reponer
                          </span>
                        )}
                        {item.status === 'OPTIMO' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            🟢 Óptimo
                          </span>
                        )}
                        {isOverstock && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            🔵 Sobrestock
                          </span>
                        )}
                      </td>

                      {/* Suggestion to Order (TOTAL UNITS ONLY) */}
                      <td className="py-3 px-3 text-right font-mono font-bold bg-indigo-50/40">
                        {item.unitsToOrder > 0 ? (
                          <span className="text-indigo-800 text-sm font-black">
                            {item.unitsToOrder.toLocaleString('es-AR')} un.
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0 (Cubierto)</span>
                        )}
                      </td>

                      {/* Provider */}
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {item.provider}
                      </td>

                      {/* Quick Adjustment */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 border border-slate-200 rounded-md bg-white p-0.5">
                          <button
                            onClick={() => onUpdateBultos(item.id, Math.max(0, item.bultos - 1))}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                            title="Restar 1 bulto"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-1.5 font-mono font-bold text-slate-800 text-xs">
                            {item.bultos}
                          </span>
                          <button
                            onClick={() => onUpdateBultos(item.id, item.bultos + 1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                            title="Sumar 1 bulto"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div>
            Mostrando <strong>{filteredItems.length}</strong> de <strong>{totalCount}</strong> materiales
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total a pedir: <strong className="text-indigo-700 text-sm">{totalUnitsToOrder.toLocaleString('es-AR')} unidades</strong>
            </span>
            <button
              onClick={onOpenPurchaseOrder}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
            >
              Pedir Reposición ({totalUnitsToOrder.toLocaleString('es-AR')} un.)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
