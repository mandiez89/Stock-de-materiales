import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Download, 
  Plus, 
  Filter, 
  ArrowUpRight, 
  Calendar, 
  Clock, 
  PackageOpen, 
  RefreshCw, 
  X, 
  Check, 
  Truck, 
  User, 
  Zap,
  Info,
  CalendarDays
} from 'lucide-react';
import { MaterialItem, MaterialCategory, StockMovement, MovementType, UserRole } from '../types';
import { 
  formatMovementDate, 
  formatMovementTimeOnly, 
  formatMovementShortDate, 
  formatMovementRelative,
  exportMovementsToCSV 
} from '../utils/movementHistory';

interface MovementsHistoryViewProps {
  movements: StockMovement[];
  items: MaterialItem[];
  userRole: UserRole;
  onRecordMovement: (movement: Omit<StockMovement, 'id' | 'dateFormatted'>) => Promise<void> | void;
}

type TimeFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export const MovementsHistoryView: React.FC<MovementsHistoryViewProps> = ({
  movements,
  items,
  userRole,
  onRecordMovement,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customDate, setCustomDate] = useState<string>('');
  
  // Modals & fast loading bar state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [quickItemId, setQuickItemId] = useState<string>(items[0]?.id || '');

  // Manual movement form state
  const [manualItemId, setManualItemId] = useState<string>(items[0]?.id || '');
  const [manualType, setManualType] = useState<MovementType>('ENTRADA');
  const [manualBultos, setManualBultos] = useState<number>(1);
  const [manualNewTotalBultos, setManualNewTotalBultos] = useState<number>(0);
  const [manualReason, setManualReason] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [manualResponsible, setManualResponsible] = useState<string>(
    userRole === 'operator' ? 'Operador Depósito' : 'Administrador'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Categories list
  const categories: MaterialCategory[] = ['Cajas', 'Celofanes', 'Bolsitas', 'Caballetes', 'Cartones'];

  // Current date boundaries
  const now = new Date();
  const todayStr = formatMovementShortDate(now);
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const yesterdayStr = formatMovementShortDate(yesterday);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Selected item for modal
  const selectedModalItem = useMemo(() => {
    return items.find((i) => i.id === manualItemId) || items[0];
  }, [items, manualItemId]);

  // Selected item for quick action bar
  const selectedQuickItem = useMemo(() => {
    return items.find((i) => i.id === quickItemId) || items[0];
  }, [items, quickItemId]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (m.itemName || '').toLowerCase().includes(query);
        const matchReason = (m.reason || '').toLowerCase().includes(query);
        const matchResp = (m.responsible || '').toLowerCase().includes(query);
        const matchCat = (m.category || '').toLowerCase().includes(query);
        if (!matchName && !matchReason && !matchResp && !matchCat) return false;
      }

      // 2. Type filter
      if (selectedType === 'ENTRADAS_ONLY') {
        if (m.type !== 'ENTRADA' && m.type !== 'RECEPCION_PEDIDO' && m.bultosDelta <= 0) return false;
      } else if (selectedType !== 'all' && m.type !== selectedType) {
        return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;

      // 4. Time filter
      if (timeFilter !== 'all') {
        const mDate = new Date(m.timestamp);
        const mDateStr = formatMovementShortDate(mDate);
        if (timeFilter === 'today' && mDateStr !== todayStr) return false;
        if (timeFilter === 'yesterday' && mDateStr !== yesterdayStr) return false;
        if (timeFilter === 'week' && mDate < oneWeekAgo) return false;
        if (timeFilter === 'month' && mDate < startOfMonth) return false;
        if (timeFilter === 'custom' && customDate) {
          const [cYear, cMonth, cDay] = customDate.split('-');
          const expectedStr = `${cDay}/${cMonth}/${cYear}`;
          if (mDateStr !== expectedStr) return false;
        }
      }

      return true;
    });
  }, [movements, searchQuery, selectedType, selectedCategory, timeFilter, customDate, todayStr, yesterdayStr, oneWeekAgo, startOfMonth]);

  // Statistics
  const stats = useMemo(() => {
    const todayMovements = movements.filter((m) => formatMovementShortDate(new Date(m.timestamp)) === todayStr);
    
    const bultosAbiertosToday = todayMovements
      .filter((m) => m.type === 'ABRIR_BULTO' || m.bultosDelta < 0)
      .reduce((acc, m) => acc + Math.abs(m.bultosDelta), 0);

    const bultosEntradaToday = todayMovements
      .filter((m) => m.type === 'ENTRADA' || m.type === 'RECEPCION_PEDIDO' || (m.bultosDelta > 0 && m.type !== 'AJUSTE'))
      .reduce((acc, m) => acc + m.bultosDelta, 0);

    const unitsEntradaToday = todayMovements
      .filter((m) => m.unitsDelta > 0)
      .reduce((acc, m) => acc + m.unitsDelta, 0);

    const unitsConsumidasToday = todayMovements
      .filter((m) => m.unitsDelta < 0)
      .reduce((acc, m) => acc + Math.abs(m.unitsDelta), 0);

    const lastMovement = movements[0];

    return {
      total: movements.length,
      todayCount: todayMovements.length,
      bultosAbiertosToday,
      unitsConsumidasToday,
      bultosEntradaToday,
      unitsEntradaToday,
      lastTimestamp: lastMovement ? lastMovement.dateFormatted || formatMovementDate(lastMovement.timestamp) : 'Sin registros',
    };
  }, [movements, todayStr]);

  // Download CSV
  const handleExportCSV = () => {
    const csvData = exportMovementsToCSV(filteredMovements);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Historial_Movimientos_${now.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Quick Stock Adjustment from the bar
  const handleQuickLoad = async (deltaBultos: number, reasonText: string) => {
    const item = selectedQuickItem;
    if (!item) return;

    const uPerBto = item.unitsPerBulto || 1;
    const curBultos = item.bultos || 0;
    const newBultos = Math.max(0, curBultos + deltaBultos);
    const actualDelta = newBultos - curBultos;
    if (actualDelta === 0) return;

    const uDelta = actualDelta * uPerBto;
    const prevUnits = item.totalUnits || (curBultos * uPerBto);
    const newUnits = Math.max(0, prevUnits + uDelta);
    const type: MovementType = actualDelta > 0 ? 'ENTRADA' : 'ABRIR_BULTO';

    const timestamp = new Date().toISOString();
    await onRecordMovement({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      type,
      timestamp,
      bultosDelta: actualDelta,
      unitsDelta: uDelta,
      previousBultos: curBultos,
      newBultos,
      previousUnits: prevUnits,
      newUnits,
      unitsPerBulto: uPerBto,
      responsible: userRole === 'operator' ? 'Operador Depósito' : 'Administrador',
      reason: reasonText,
    });

    setSuccessToast(`✓ Stock actualizado: ${item.name} (${actualDelta > 0 ? `+${actualDelta}` : actualDelta} btos = ${actualDelta > 0 ? `+${uDelta.toLocaleString('es-AR')}` : uDelta.toLocaleString('es-AR')} un.)`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Open modal with item preselected
  const handleOpenModal = (presetItemId?: string, presetType?: MovementType) => {
    if (presetItemId) setManualItemId(presetItemId);
    if (presetType) setManualType(presetType);
    const targetItem = items.find((i) => i.id === (presetItemId || manualItemId)) || items[0];
    if (targetItem) {
      setManualNewTotalBultos(targetItem.bultos);
    }
    setUseCurrentTime(true);
    setIsManualModalOpen(true);
  };

  // Submit manual movement
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = selectedModalItem;
    if (!item) return;

    setIsSubmitting(true);
    try {
      const unitsPerBulto = item.unitsPerBulto || 1;
      let bDelta = 0;
      let prevBultos = item.bultos;
      let newBultos = item.bultos;
      let prevUnits = item.totalUnits;
      let newUnits = item.totalUnits;
      let uDelta = 0;

      if (manualType === 'AJUSTE') {
        newBultos = Math.max(0, manualNewTotalBultos);
        bDelta = newBultos - prevBultos;
        uDelta = bDelta * unitsPerBulto;
        newUnits = Math.max(0, prevUnits + uDelta);
      } else {
        if (manualType === 'ABRIR_BULTO' || manualType === 'SALIDA') {
          bDelta = -Math.abs(manualBultos);
        } else {
          bDelta = Math.abs(manualBultos);
        }
        newBultos = Math.max(0, prevBultos + bDelta);
        uDelta = bDelta * unitsPerBulto;
        newUnits = Math.max(0, prevUnits + uDelta);
      }

      // Determine date & time
      let timestamp = new Date().toISOString();
      if (!useCurrentTime && customDateTime) {
        const parsed = new Date(customDateTime);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.toISOString();
        }
      }

      let finalReason = manualReason.trim();
      if (!finalReason) {
        if (manualType === 'ENTRADA') finalReason = `Entrada de stock (+${Math.abs(bDelta)} btos)`;
        else if (manualType === 'ABRIR_BULTO') finalReason = 'Apertura de bulto para línea de empaque';
        else if (manualType === 'RECEPCION_PEDIDO') finalReason = 'Recepción de pedido de compra';
        else if (manualType === 'AJUSTE') finalReason = `Ajuste por recuento físico (${prevBultos} ➔ ${newBultos} btos)`;
        else finalReason = 'Movimiento registrado';
      }

      await onRecordMovement({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        type: manualType,
        timestamp,
        bultosDelta: bDelta,
        unitsDelta: uDelta,
        previousBultos: prevBultos,
        newBultos,
        previousUnits: prevUnits,
        newUnits,
        unitsPerBulto,
        responsible: manualResponsible.trim() || (userRole === 'operator' ? 'Operador Depósito' : 'Administrador'),
        reason: finalReason,
      });

      setSuccessToast(`✓ Stock actualizado: ${item.name} (${bDelta > 0 ? `+${bDelta}` : bDelta} btos). Nuevo stock: ${newBultos} btos.`);
      setTimeout(() => setSuccessToast(null), 4000);
      setIsManualModalOpen(false);
      setManualReason('');
      setManualBultos(1);
    } catch {
      // handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Title Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
              <History className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Auditoría y Trazabilidad de Stock
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Historial de Movimientos y Cargas de Stock
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Visualizá con precisión <strong>cuándo y cuánto se cargó o descontó</strong> con fecha y hora exacta. 
            Cada carga registrada aquí actualiza automáticamente el stock del material en todo el sistema.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-stretch md:self-auto justify-end">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredMovements.length === 0}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
            title="Exportar listado completo a CSV / Excel"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Descargar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal(undefined, 'ENTRADA')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            title="Cargar stock de mercadería ingresada y guardar fecha y hora"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Cargar Stock / Registrar Entrada</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Movements */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Movimientos</span>
            <History className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl sm:text-3xl text-slate-900">
              {stats.total.toLocaleString('es-AR')}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
              {stats.todayCount} registrados hoy
            </span>
          </div>
        </div>

        {/* Card 2: Stock Cargado Hoy */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Cargado Hoy (Entradas)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-600">
                +{stats.bultosEntradaToday}
              </span>
              <span className="text-xs font-bold text-emerald-700">btos</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
              +{stats.unitsEntradaToday.toLocaleString('es-AR')} un. ingresadas
            </span>
          </div>
        </div>

        {/* Card 3: Bultos Abiertos Hoy */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Bultos Abiertos (Empaque)</span>
            <PackageOpen className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-black text-2xl sm:text-3xl text-rose-600">
                {stats.bultosAbiertosToday}
              </span>
              <span className="text-xs font-bold text-rose-700">btos</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
              {stats.unitsConsumidasToday.toLocaleString('es-AR')} un. descontadas
            </span>
          </div>
        </div>

        {/* Card 4: Última Fecha y Hora */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Último Registro</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2">
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 block leading-tight">
              {stats.lastTimestamp}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado en tiempo real
            </span>
          </div>
        </div>
      </div>

      {/* QUICK STOCK LOADING STRIP (Carga Rápida Directa) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <Zap className="w-4 h-4 fill-emerald-100" />
              </span>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Carga Rápida de Stock (Actualización Inmediata)
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Seleccioná un material y sumá bultos con 1 toque. El stock se actualiza al instante con la fecha y hora actual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Material selector */}
            <select
              value={quickItemId}
              onChange={(e) => setQuickItemId(e.target.value)}
              className="bg-white border-2 border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-emerald-200 outline-hidden min-w-[220px]"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  [{it.category}] {it.name} — (Stock: {it.bultos} btos)
                </option>
              ))}
            </select>

            {/* Quick increment buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLoad(1, 'Carga rápida (+1 bto) desde Historial')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Cargar +1 bulto ahora mismo"
              >
                +1 Bto
              </button>

              <button
                type="button"
                onClick={() => handleQuickLoad(5, 'Carga rápida (+5 btos) desde Historial')}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Cargar +5 bultos rápidamente"
              >
                +5 Btos
              </button>

              <button
                type="button"
                onClick={() => handleQuickLoad(10, 'Carga rápida (+10 btos) desde Historial')}
                className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Cargar +10 bultos rápidamente"
              >
                +10 Btos
              </button>

              <button
                type="button"
                onClick={() => handleQuickLoad(-1, 'Apertura de bulto (-1) para empaque')}
                disabled={!selectedQuickItem || selectedQuickItem.bultos <= 0}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Abrir 1 bulto para empaque (-1)"
              >
                Abrir (-1)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por material, remito, motivo o responsable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select Category */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap hidden sm:inline">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-hidden cursor-pointer"
            >
              <option value="all">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Pills: Time and Type */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Time Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Período:
            </span>
            {(
              [
                { id: 'all', label: 'Todo' },
                { id: 'today', label: 'Hoy' },
                { id: 'yesterday', label: 'Ayer' },
                { id: 'week', label: 'Últimos 7 días' },
                { id: 'month', label: 'Este Mes' },
              ] as { id: TimeFilter; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  timeFilter === t.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) setTimeFilter('custom');
                }}
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all outline-hidden cursor-pointer ${
                  timeFilter === 'custom'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
                title="Filtrar por fecha específica"
              />
              {timeFilter === 'custom' && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate('');
                    setTimeFilter('all');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Movement Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Operación:
            </span>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'ENTRADAS_ONLY', label: 'Solo Cargas / Entradas (+)' },
              { id: 'ABRIR_BULTO', label: 'Abrir Bulto (-)' },
              { id: 'AJUSTE', label: 'Ajustes' },
              { id: 'RECEPCION_PEDIDO', label: 'Recepción Pedido' },
            ].map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelectedType(op.id)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  selectedType === op.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Movements History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span>
              Registros encontrados: <strong>{filteredMovements.length}</strong>
            </span>
            {selectedType === 'ENTRADAS_ONLY' && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                Filtrando solo cargas de stock
              </span>
            )}
          </div>
          <span className="text-slate-400 font-normal">
            Orden cronológico: más recientes primero
          </span>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No se encontraron movimientos con los filtros aplicados</p>
            <p className="text-xs text-slate-400">
              Probá cambiando el filtro de fecha o buscando otra denominación de material.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Material / Categoría</th>
                  <th className="py-3 px-4 text-center">Operación</th>
                  <th className="py-3 px-4 text-right">Cuánto se Cargó / Movió</th>
                  <th className="py-3 px-4 text-right">Stock Anterior ➔ Nuevo</th>
                  <th className="py-3 px-4">Responsable & Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((m) => {
                  const isPositive = m.bultosDelta > 0 || m.unitsDelta > 0;
                  const isNegative = m.bultosDelta < 0 || m.unitsDelta < 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Fecha y Hora Exacta */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl shrink-0 ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-slate-900 leading-tight">
                                {formatMovementTimeOnly(m.timestamp)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                {formatMovementRelative(m.timestamp)}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              {formatMovementShortDate(m.timestamp)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Material & Categoría */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                              {m.category}
                            </span>
                            {m.unitsPerBulto > 0 && (
                              <span className="text-[9px] font-medium text-slate-400">
                                ({m.unitsPerBulto.toLocaleString('es-AR')} un/bto)
                              </span>
                            )}
                          </div>
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                            {m.itemName}
                          </div>
                        </div>
                      </td>

                      {/* Tipo de Operación */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {m.type === 'ABRIR_BULTO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                            <PackageOpen className="w-3 h-3" /> Bulto Abierto
                          </span>
                        ) : m.type === 'ENTRADA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600 stroke-[3]" /> Carga de Stock
                          </span>
                        ) : m.type === 'RECEPCION_PEDIDO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs">
                            <Truck className="w-3 h-3 text-sky-600" /> Pedido Recibido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            <RefreshCw className="w-3 h-3" /> Ajuste / Conteo
                          </span>
                        )}
                      </td>

                      {/* Cuánto se Cargó / Movió */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                        <div className="inline-block text-right">
                          <div
                            className={`font-black text-sm sm:text-base leading-tight ${
                              isNegative ? 'text-rose-600' : isPositive ? 'text-emerald-600' : 'text-slate-700'
                            }`}
                          >
                            {m.bultosDelta > 0 ? `+${m.bultosDelta}` : `${m.bultosDelta}`} bto{Math.abs(m.bultosDelta) === 1 ? '' : 's'}
                          </div>
                          <span className={`text-[11px] font-bold block ${isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-500'}`}>
                            {m.unitsDelta > 0 ? `+${m.unitsDelta.toLocaleString('es-AR')}` : `${m.unitsDelta.toLocaleString('es-AR')}`} un.
                          </span>
                        </div>
                      </td>

                      {/* Stock Anterior ➔ Nuevo */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400 font-medium">
                            {m.previousBultos} bto ({m.previousUnits.toLocaleString('es-AR')} un.)
                          </span>
                          <span className="text-slate-300 font-black">➔</span>
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {m.newBultos} bto ({m.newUnits.toLocaleString('es-AR')} un.)
                          </span>
                        </div>
                      </td>

                      {/* Responsable & Motivo */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{m.responsible}</span>
                          </div>
                          {m.reason && (
                            <p className="text-[10px] text-slate-500 font-medium line-clamp-2">
                              {m.reason}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Movement Modal: Cargar Stock / Registrar Movimiento */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cargar Stock / Registrar Movimiento
                  </h3>
                  <p className="text-xs text-slate-500">
                    Actualiza el inventario y almacena fecha y hora exacta
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 text-xs">
              {/* Material Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Material a Actualizar:
                </label>
                <select
                  value={manualItemId}
                  onChange={(e) => {
                    setManualItemId(e.target.value);
                    const it = items.find((i) => i.id === e.target.value);
                    if (it) setManualNewTotalBultos(it.bultos);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.name} — (Stock actual: {item.bultos} btos / {item.totalUnits.toLocaleString('es-AR')} un.)
                    </option>
                  ))}
                </select>
                {selectedModalItem && (
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                    <span>Stock actual: <strong className="text-slate-800">{selectedModalItem.bultos} btos</strong> ({selectedModalItem.totalUnits.toLocaleString('es-AR')} un.)</span>
                    <span>•</span>
                    <span>Medida: <strong className="text-slate-800">{selectedModalItem.unitsPerBulto.toLocaleString('es-AR')} un/bto</strong></span>
                  </div>
                )}
              </div>

              {/* Movement Type Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tipo de Operación:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualType('ENTRADA')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      manualType === 'ENTRADA'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <div>
                      <span>Carga de Stock (+)</span>
                      <span className="block text-[9px] font-normal text-emerald-700">Ingreso de mercadería</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualType('ABRIR_BULTO')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      manualType === 'ABRIR_BULTO'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <PackageOpen className="w-4 h-4 text-rose-600" />
                    <div>
                      <span>Abrir Bulto (-)</span>
                      <span className="block text-[9px] font-normal text-rose-600">Para uso en empaque</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualType('RECEPCION_PEDIDO')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      manualType === 'RECEPCION_PEDIDO'
                        ? 'bg-sky-50 border-sky-300 text-sky-800 ring-2 ring-sky-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-sky-600" />
                    <div>
                      <span>Recepción Pedido (+)</span>
                      <span className="block text-[9px] font-normal text-sky-600">Llegada de compras</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualType('AJUSTE')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      manualType === 'AJUSTE'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-indigo-600" />
                    <div>
                      <span>Ajuste / Conteo</span>
                      <span className="block text-[9px] font-normal text-indigo-600">Corrección física total</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quantity Section */}
              {manualType !== 'AJUSTE' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cantidad de Bultos a {manualType === 'ABRIR_BULTO' ? 'Descontar' : 'Cargar'}:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={manualBultos}
                      onChange={(e) => setManualBultos(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-28 font-mono font-black text-xl text-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 2, 5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setManualBultos(num)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                            manualBultos === num
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculation Preview */}
                  {selectedModalItem && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Total a mover:</span>
                        <strong className={manualType === 'ABRIR_BULTO' ? 'text-rose-600 font-mono' : 'text-emerald-700 font-mono'}>
                          {manualType === 'ABRIR_BULTO' ? '-' : '+'}{(manualBultos * (selectedModalItem.unitsPerBulto || 1)).toLocaleString('es-AR')} unidades
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span>Nuevo stock resultante:</span>
                        <strong className="text-slate-900 font-mono">
                          {Math.max(0, selectedModalItem.bultos + (manualType === 'ABRIR_BULTO' ? -manualBultos : manualBultos))} btos
                          ({Math.max(0, selectedModalItem.totalUnits + (manualType === 'ABRIR_BULTO' ? -manualBultos : manualBultos) * selectedModalItem.unitsPerBulto).toLocaleString('es-AR')} un.)
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* AJUSTE / RECUENTO FÍSICO DIRECT TOTAL BULTOS */
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nuevo Total de Bultos Físicos Contados:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={manualNewTotalBultos}
                      onChange={(e) => setManualNewTotalBultos(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-28 font-mono font-black text-xl text-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                    />
                    <span className="text-slate-500 font-medium text-xs">
                      bultos contados en depósito
                    </span>
                  </div>
                  {selectedModalItem && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Diferencia con stock actual:</span>
                        <strong className={manualNewTotalBultos >= selectedModalItem.bultos ? 'text-emerald-700 font-mono' : 'text-rose-600 font-mono'}>
                          {manualNewTotalBultos - selectedModalItem.bultos > 0 ? `+${manualNewTotalBultos - selectedModalItem.bultos}` : `${manualNewTotalBultos - selectedModalItem.bultos}`} btos
                          ({((manualNewTotalBultos - selectedModalItem.bultos) * selectedModalItem.unitsPerBulto).toLocaleString('es-AR')} un.)
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Date and Time Customization (Fecha y Hora) */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Fecha y Hora de Carga:
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCurrentTime}
                      onChange={(e) => setUseCurrentTime(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Usar fecha y hora actual</span>
                  </label>
                </div>

                {!useCurrentTime && (
                  <div className="mt-1">
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Permite registrar cargas que ingresaron con anterioridad o en otro turno.
                    </p>
                  </div>
                )}
              </div>

              {/* Responsable */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Responsable:
                </label>
                <input
                  type="text"
                  value={manualResponsible}
                  onChange={(e) => setManualResponsible(e.target.value)}
                  placeholder="Ej: Operador Depósito, Turno Mañana, etc."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                />
              </div>

              {/* Motivo o Remito */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motivo / Remito / Observación (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Remito N° 4512, proveedor entregó bobinas, etc."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Actualizando Stock...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Cargar Stock y Actualizar Inventario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg bg-emerald-950 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-emerald-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="flex-1">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-300 hover:text-white p-1 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
