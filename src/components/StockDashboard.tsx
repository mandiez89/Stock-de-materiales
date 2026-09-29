import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Search, 
  ShoppingBag, 
  Layers, 
  Plus,
  Minus,
  Truck,
  Check,
  X,
  Copy,
  History
} from 'lucide-react';
import { MaterialItem, MonthlyFactor } from '../types';
import { formatSingleOrderItemText } from '../utils/orderFormat';

interface StockDashboardProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onUpdateBultos: (id: string, newBultos: number) => void;
  onOpenPurchaseOrder: () => void;
  onToggleOrdered?: (id: string, isOrdered: boolean) => void;
}

export const StockDashboard: React.FC<StockDashboardProps> = ({
  items,
  selectedMonth,
  onUpdateBultos,
  onOpenPurchaseOrder,
  onToggleOrdered,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const handleCopySingleItem = (item: MaterialItem) => {
    const text = formatSingleOrderItemText(item);
    navigator.clipboard.writeText(text);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2500);
  };

  // Categorize items with order state awareness
  const totalCount = items.length;

  // Ordered items
  const orderedItems = useMemo(() => items.filter((i) => i.isOrdered), [items]);

  // Critical items that have NOT been ordered yet
  const criticalUnordered = useMemo(
    () => items.filter((i) => !i.isOrdered && i.status === 'CRITICO'),
    [items]
  );

  // Items that ARE ordered, but have extremely low or critical stock (Alert!)
  const criticalWhileOrdered = useMemo(
    () => items.filter((i) => i.isOrdered && (i.status === 'CRITICO' || i.totalUnits <= i.minStockAdjusted * 0.3)),
    [items]
  );

  // Reorder items that have NOT been ordered yet
  const reorderUnordered = useMemo(
    () => items.filter((i) => !i.isOrdered && i.status === 'PEDIR'),
    [items]
  );

  // Optimal items
  const optimalItems = useMemo(() => items.filter((i) => i.status === 'OPTIMO'), [items]);

  // Overstock items
  const overstockItems = useMemo(() => items.filter((i) => i.status === 'SOBRESTOCK'), [items]);

  // Units that ACTUALLY need ordering (excluding already placed orders)
  const totalUnitsToOrder = useMemo(
    () => items.filter((i) => !i.isOrdered).reduce((acc, i) => acc + i.unitsToOrder, 0),
    [items]
  );

  const itemsToOrderCount = useMemo(
    () => items.filter((i) => !i.isOrdered && i.unitsToOrder > 0).length,
    [items]
  );

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

      // Status
      let matchesStatus = true;
      if (selectedStatus === 'CRITICO') {
        matchesStatus = !item.isOrdered && item.status === 'CRITICO';
      } else if (selectedStatus === 'PEDIR') {
        matchesStatus = !item.isOrdered && item.status === 'PEDIR';
      } else if (selectedStatus === 'ORDERED') {
        matchesStatus = !!item.isOrdered;
      } else if (selectedStatus === 'OPTIMO') {
        matchesStatus = item.status === 'OPTIMO';
      } else if (selectedStatus === 'SOBRESTOCK') {
        matchesStatus = item.status === 'SOBRESTOCK';
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

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
      {/* High Alert Banner: Critical Items that are NOT ordered yet */}
      {criticalUnordered.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-950">
                ¡Atención! Hay {criticalUnordered.length} materiales en estado crítico sin pedir para {selectedMonth.name}
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                Riesgo inminente de quiebre de stock en fábrica ({criticalUnordered.slice(0, 3).map(i => i.name).join(', ')}).
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
              Ver Críticos ({criticalUnordered.length})
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

      {/* Warning Alert Banner: Ordered items that have very low stock (Risk before arrival!) */}
      {criticalWhileOrdered.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>⚠️ Stock Muy Bajo con Pedido en Tránsito</span>
                <span className="text-[11px] bg-amber-200 text-amber-900 font-bold px-2 py-0.2 rounded-full">
                  {criticalWhileOrdered.length} materiales
                </span>
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Estos materiales ya fueron pedidos al proveedor, pero el stock actual es muy escaso ({criticalWhileOrdered.map(i => `${i.name} [${i.totalUnits} un.]`).join(', ')}). Hacer seguimiento de entrega urgente.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedStatus('ORDERED');
              setSelectedCategory('all');
            }}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Ver Pedidos en Curso ({orderedItems.length})
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Materials */}
        <div 
          onClick={() => setSelectedStatus('all')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'all'
              ? 'bg-white border-indigo-400 ring-2 ring-indigo-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Ítems</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-[11px] text-slate-400">materiales</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">5 tipos de material</p>
        </div>

        {/* Critical (Unordered) */}
        <div 
          onClick={() => setSelectedStatus('CRITICO')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'CRITICO'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">🔴 Críticos</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">{criticalUnordered.length}</span>
            <span className="text-[11px] text-rose-600 font-semibold">a pedir ya</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Sin pedido registrado</p>
        </div>

        {/* Reorder (Unordered) */}
        <div 
          onClick={() => setSelectedStatus('PEDIR')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'PEDIR'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">🟡 Reponer</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{reorderUnordered.length}</span>
            <span className="text-[11px] text-amber-600 font-semibold">bajo mínimo</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Sin pedido registrado</p>
        </div>

        {/* Pedidos en Curso (NEW KPI) */}
        <div 
          onClick={() => setSelectedStatus('ORDERED')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'ORDERED'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-sky-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-sky-700 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">🚚 En Camino</span>
            <Truck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-sky-800">{orderedItems.length}</span>
            <span className="text-[11px] text-sky-700 font-semibold">pedidos</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {criticalWhileOrdered.length > 0 ? (
              <span className="text-amber-700 font-bold">{criticalWhileOrdered.length} muy bajos</span>
            ) : (
              'En espera de entrega'
            )}
          </p>
        </div>

        {/* Optimal */}
        <div 
          onClick={() => setSelectedStatus('OPTIMO')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'OPTIMO'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-100 shadow-sm'
              : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">🟢 Óptimos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{optimalItems.length}</span>
            <span className="text-[11px] text-emerald-600 font-semibold">abastecidos</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Dentro del rango</p>
        </div>

        {/* Total a Pedir (Pendientes reales) */}
        <div 
          onClick={onOpenPurchaseOrder}
          className="p-3.5 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 hover:border-indigo-400 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-indigo-700 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">📦 Total a Pedir</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-indigo-900 font-mono">
              {totalUnitsToOrder.toLocaleString('es-AR')}
            </span>
            <span className="text-[10px] text-indigo-700 font-bold">un.</span>
          </div>
          <p className="text-[10px] text-indigo-600 mt-1">
            {itemsToOrderCount} materiales pendientes
          </p>
        </div>
      </div>

      {/* Category Pills & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 pl-1 pr-2">
            <Layers className="w-3.5 h-3.5" /> Tipo:
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
              placeholder="Buscar material, código o tipo..."
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
              🔴 Críticos ({criticalUnordered.length})
            </button>
            <button
              onClick={() => setSelectedStatus('PEDIR')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'PEDIR'
                  ? 'bg-amber-100 text-amber-800 font-bold'
                  : 'text-slate-600 hover:bg-amber-50'
              }`}
            >
              🟡 Reponer ({reorderUnordered.length})
            </button>
            <button
              onClick={() => setSelectedStatus('ORDERED')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedStatus === 'ORDERED'
                  ? 'bg-sky-100 text-sky-800 font-bold'
                  : 'text-slate-600 hover:bg-sky-50'
              }`}
            >
              🚚 Pedidos ({orderedItems.length})
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
                <th className="py-3 px-3 text-center">Gestión de Pedido</th>
                <th className="py-3 px-3 text-center">Ajuste Rápido</th>
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
                  const isOrdered = item.isOrdered ?? false;
                  const isLowStockWhileOrdered = isOrdered && (isCritical || item.totalUnits <= item.minStockAdjusted * 0.3);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isOrdered ? 'bg-sky-50/20' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {item.name}
                        </div>
                        {item.batches && item.batches.length > 1 && (
                          <div className="text-[10px] text-indigo-600 font-mono mt-0.5">
                            {item.batches.length} partidas de bultos
                          </div>
                        )}
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

                      {/* Status Column: Si está pedido, NO muestra 'Reponer', muestra 'Pedido en Curso' + alerta si el stock es muy bajo */}
                      <td className="py-3 px-3 text-center">
                        {isOrdered ? (
                          isLowStockWhileOrdered ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                                ⚠️ Muy Bajo • Pedido
                              </span>
                              <span className="text-[9px] text-rose-700 font-semibold">
                                ¡Riesgo de quiebre!
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-300">
                              <Truck className="w-3 h-3 text-sky-600" /> Pedido en Curso
                            </span>
                          )
                        ) : (
                          <>
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
                          </>
                        )}
                      </td>

                      {/* Total to Order Column */}
                      <td className="py-3 px-3 text-right font-mono bg-indigo-50/30">
                        {isOrdered ? (
                          <div>
                            <span className="text-sky-700 text-xs font-bold block">
                              En tránsito
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({item.unitsToOrder.toLocaleString('es-AR')} un.)
                            </span>
                          </div>
                        ) : item.unitsToOrder > 0 ? (
                          <span className="text-indigo-800 text-sm font-black">
                            {item.unitsToOrder.toLocaleString('es-AR')} un.
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-[11px]">0 (Cubierto)</span>
                        )}
                      </td>

                      {/* Order Tracking Action: Marcar pedido / Recibido / Cancelar */}
                      <td className="py-3 px-3 text-center">
                        {isOrdered ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => onToggleOrdered?.(item.id, false)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                title="Marcar como recibido en fábrica (actualiza base de datos central)"
                              >
                                <Check className="w-3 h-3" /> Recibido
                              </button>
                              <button
                                onClick={() => onToggleOrdered?.(item.id, false)}
                                className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                                title="Cancelar estado de pedido en base de datos"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                              En Base de Datos
                            </span>
                          </div>
                        ) : (isReorder || isCritical) ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <button
                              type="button"
                              onClick={() => handleCopySingleItem(item)}
                              className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                                copiedItemId === item.id
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                              title="Copiar texto formal de solicitud para enviar a proveedor"
                            >
                              {copiedItemId === item.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => onToggleOrdered?.(item.id, true)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                              title="Cargar y registrar pedido en la base de datos central (visible para todos los que accedan)"
                            >
                              <Truck className="w-3 h-3" /> Marcar Pedido
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Quick Adjustment (+ / - Bultos) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 border border-slate-200 rounded-md bg-white p-0.5">
                          <button
                            onClick={() => onUpdateBultos(item.id, Math.max(0, item.bultos - 1))}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                            title="Restar 1 bulto (Abrir bulto)"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-1.5 font-mono font-bold text-slate-800 text-xs">
                            {item.bultos}
                          </span>
                          <button
                            onClick={() => onUpdateBultos(item.id, item.bultos + 1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                            title="Sumar 1 bulto (Entrada de stock)"
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
            {orderedItems.length > 0 && (
              <span className="ml-2 text-sky-700 font-semibold">
                • {orderedItems.length} pedidos en tránsito
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total pendiente de pedir: <strong className="text-indigo-700 text-sm">{totalUnitsToOrder.toLocaleString('es-AR')} unidades</strong>
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
