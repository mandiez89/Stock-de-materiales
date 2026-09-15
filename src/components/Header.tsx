import React, { useState } from 'react';
import { 
  BarChart3, 
  ClipboardList, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  Download, 
  Calendar, 
  ShoppingBag,
  Tablet,
  Shield,
  PackageCheck,
  Lock,
  Unlock,
  X,
  Wifi,
  KeyRound,
  Delete
} from 'lucide-react';
import { MonthlyFactor, UserRole } from '../types';

export type AppTab = 'dashboard' | 'entry' | 'stock' | 'minmax' | 'sheets';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  selectedMonth: MonthlyFactor;
  monthlyFactors: MonthlyFactor[];
  onExportCSV: () => void;
  onOpenPurchaseOrder: () => void;
  criticalCount: number;
  totalUnitsToOrder: number;
  sheetsConnected: boolean;
}

const ADMIN_PIN = '1458';

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  selectedMonth,
  monthlyFactors,
  onExportCSV,
  onOpenPurchaseOrder,
  criticalCount,
  totalUnitsToOrder,
  sheetsConnected,
}) => {
  const isOperator = userRole === 'operator';
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const checkPin = (code: string) => {
    if (code === ADMIN_PIN || code.toLowerCase() === 'mariano') {
      setUserRole('admin');
      setActiveTab('dashboard');
      setIsPinModalOpen(false);
      setPinInput('');
      setPinError(false);
      return true;
    }
    return false;
  };

  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPin(pinInput)) {
      setPinError(true);
    }
  };

  const handleKeypadPress = (digit: string) => {
    setPinError(false);
    if (pinInput.length < 4) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin.length === 4) {
        if (!checkPin(nextPin)) {
          setPinError(true);
        }
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPinError(false);
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPinError(false);
    setPinInput('');
  };

  return (
    <>
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        {/* Top Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Title and Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-black text-lg text-white shadow-inner tracking-tight shrink-0">
              MP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  Sugestión • Control de Stock
                </h1>
                {isOperator ? (
                  <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tablet className="w-3 h-3" /> Portal Operador (Tablet)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Administración
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {isOperator 
                  ? 'Relevamiento mensual de materias primas y consulta de existencias'
                  : 'Gestión integral de compras, cálculo mensual de mínimos/máximos y Google Sheets'}
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Current Month (Automatic) */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 shadow-xs">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              <span className="font-bold text-white text-xs">{selectedMonth.name}</span>
              <span className="ml-1.5 text-[10px] bg-emerald-950 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-700/50">
                Mes Actual
              </span>
            </div>

            {/* Sheets connection status badge */}
            <div 
              className={`hidden sm:flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border ${
                sheetsConnected 
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' 
                  : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
              }`}
              title={sheetsConnected ? 'Google Sheets Conectado' : 'Sin sincronizar'}
            >
              <Wifi className="w-3 h-3" />
              <span>{sheetsConnected ? 'Sheets Activo' : 'Offline'}</span>
            </div>

            {/* IF OPERATOR: Button to access Admin protected with PIN */}
            {isOperator ? (
              <button
                onClick={() => {
                  setPinInput('');
                  setPinError(false);
                  setIsPinModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white text-sm font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Acceso seguro para Administración (requiere PIN)"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Acceso Admin</span>
              </button>
            ) : (
              /* IF ADMIN: Admin action controls + Lock button to return to Tablet Mode */
              <>
                {/* Switch to Operator Tablet Mode button */}
                <button
                  onClick={() => {
                    setUserRole('operator');
                    setActiveTab('entry');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-200 text-xs font-bold rounded-lg border border-emerald-700/60 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Bloquear administración y volver a Modo Tablet para el operador"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bloquear Tablet</span>
                </button>

                {/* Order Button (ONLY TOTAL UNITS, NO BULTOS) */}
                <button
                  onClick={onOpenPurchaseOrder}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pedir ({totalUnitsToOrder.toLocaleString('es-AR')} un.)</span>
                </button>

                {/* CSV Export */}
                <button
                  onClick={onExportCSV}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  title="Exportar planilla actual a CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between border-t border-slate-800 text-xs">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2">
            {isOperator ? (
              /* OPERATOR TABS: STRICTLY ONLY ENTRY AND STOCK VIEW - SIZED LARGE FOR TABLET & SENIORS */
              <>
                <button
                  onClick={() => setActiveTab('entry')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm sm:text-base font-black transition-all cursor-pointer ${
                    activeTab === 'entry'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  <span>Planilla de Carga (Tablet)</span>
                </button>

                <button
                  onClick={() => setActiveTab('stock')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm sm:text-base font-black transition-all cursor-pointer ${
                    activeTab === 'stock'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <PackageCheck className="w-5 h-5" />
                  <span>Stock Actual Contado</span>
                </button>
              </>
            ) : (
              /* ADMIN TABS: COMPLETE ARCHITECTURE */
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard & Pedidos</span>
                  {criticalCount > 0 && (
                    <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {criticalCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('entry')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'entry'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Planilla de Carga (Tablet)</span>
                </button>

                <button
                  onClick={() => setActiveTab('stock')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'stock'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Stock Actual Contado</span>
                </button>

                <button
                  onClick={() => setActiveTab('minmax')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'minmax'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Mínimos y Máximos Mensuales</span>
                </button>

                <button
                  onClick={() => setActiveTab('sheets')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'sheets'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Google Sheets</span>
                </button>
              </>
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400">
            <span>Mes: <strong className="text-white">{selectedMonth.name}</strong></span>
            <span>•</span>
            <span>Factor: <strong className="text-emerald-400">{selectedMonth.factor}x</strong></span>
          </div>
        </div>
      </header>

      {/* Admin Unlock Modal (PIN Protected: 1458) */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs sm:max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 text-slate-800 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">Acceso Administrador</h3>
                  <p className="text-[11px] text-slate-500">Módulo reservado para gestión y compras</p>
                </div>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual PIN Dots Indicator */}
            <div className="my-3 flex flex-col items-center justify-center">
              <div className="flex items-center gap-4 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      pinInput.length > idx
                        ? 'bg-indigo-600 border-indigo-600 scale-125 shadow-sm'
                        : 'border-slate-300 bg-slate-100'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-sm text-rose-600 mt-2 font-bold text-center">
                  PIN incorrecto. Ingresa el PIN 1458.
                </p>
              )}
            </div>

            {/* Form for physical keyboard typing or keypad */}
            <form onSubmit={handleAdminUnlock} className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(val);
                    setPinError(false);
                    if (val.length === 4) {
                      checkPin(val);
                    }
                  }}
                  placeholder="••••"
                  className="w-full h-14 px-4 text-center text-3xl font-mono font-black tracking-[0.6em] bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-slate-900"
                />
              </div>

              {/* On-Screen Touch Keypad (Large Tactile Buttons for Tablet) */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-14 sm:h-15 bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 text-slate-900 active:text-indigo-700 font-black text-2xl rounded-2xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-14 sm:h-15 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-sm rounded-2xl transition-all cursor-pointer active:scale-95"
                  title="Borrar todo"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-14 sm:h-15 bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 text-slate-900 active:text-indigo-700 font-black text-2xl rounded-2xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-14 sm:h-15 bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center rounded-2xl transition-all cursor-pointer active:scale-95"
                  title="Borrar último dígito"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-medium">PIN: <strong className="text-slate-800 font-mono text-sm">1458</strong></span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Desbloquear</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
