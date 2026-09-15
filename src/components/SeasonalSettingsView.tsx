import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  TrendingUp, 
  Calendar, 
  Info, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { MonthlyFactor, MaterialItem } from '../types';

interface SeasonalSettingsViewProps {
  monthlyFactors: MonthlyFactor[];
  onUpdateMonthFactor: (month: number, newFactor: number) => void;
  onResetFactors: () => void;
  selectedMonth: MonthlyFactor;
  items: MaterialItem[];
}

export const SeasonalSettingsView: React.FC<SeasonalSettingsViewProps> = ({
  monthlyFactors,
  onUpdateMonthFactor,
  onResetFactors,
  selectedMonth,
  items,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSliderChange = (monthNum: number, value: number) => {
    onUpdateMonthFactor(monthNum, value);
    setSuccessMessage(`Factor para ${monthlyFactors.find(m => m.month === monthNum)?.name} actualizado a ${value.toFixed(2)}x`);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Sample items to show impact
  const sampleBombachas = items.find((i) => i.id === 'cajitas-bombachas');
  const sampleCelofan = items.find((i) => i.id === 'celofan-grandes');
  const sampleCaballete = items.find((i) => i.id === 'cab-909');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header & Concept */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              Gestión de Mínimos y Máximos Estacionales
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              En la industria textil y de lencería (como <em>Sugestión</em>), el consumo de materias primas cambia radicalmente a lo largo del año. En lugar de tener un stock mínimo fijo y rígido, el sistema ajusta automáticamente el Mínimo y Máximo según el mes seleccionado.
            </p>
          </div>

          <button
            onClick={onResetFactors}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Curva Típica
          </button>
        </div>

        {/* Live Simulation Widget */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Simulación en Vivo para el Mes en Curso:
            </span>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg px-3 py-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>{selectedMonth.name} ({selectedMonth.factor.toFixed(2)}x - {selectedMonth.seasonName})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {sampleBombachas && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">{sampleBombachas.name}</span>
                <span className="text-slate-400 text-[11px]">Stock base: {sampleBombachas.minStockBase} un.</span>
                <div className="mt-2 text-indigo-700 font-mono font-semibold">
                  Mínimo mes {selectedMonth.shortName}: {sampleBombachas.minStockAdjusted.toLocaleString('es-AR')} un.
                </div>
              </div>
            )}
            {sampleCelofan && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">{sampleCelofan.name}</span>
                <span className="text-slate-400 text-[11px]">Stock base: {sampleCelofan.minStockBase} un.</span>
                <div className="mt-2 text-indigo-700 font-mono font-semibold">
                  Mínimo mes {selectedMonth.shortName}: {sampleCelofan.minStockAdjusted.toLocaleString('es-AR')} un.
                </div>
              </div>
            )}
            {sampleCaballete && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block">{sampleCaballete.name}</span>
                <span className="text-slate-400 text-[11px]">Stock base: {sampleCaballete.minStockBase} un.</span>
                <div className="mt-2 text-indigo-700 font-mono font-semibold">
                  Mínimo mes {selectedMonth.shortName}: {sampleCaballete.minStockAdjusted.toLocaleString('es-AR')} un.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Months Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Curva de Estacionalidad Mensual (12 Meses)
            </h3>
            <p className="text-xs text-slate-500">
              Ajusta el multiplicador (1.0 = demanda estándar, 1.30 = +30% stock por alta temporada).
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {monthlyFactors.map((mf) => {
            const isSelected = selectedMonth.month === mf.month;
            const isHigh = mf.factor >= 1.2;
            const isLow = mf.factor <= 0.9;

            return (
              <div
                key={mf.month}
                className={`p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{mf.name}</span>
                    {isSelected && (
                      <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">
                        Mes Activo
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                      isHigh
                        ? 'bg-rose-100 text-rose-800'
                        : isLow
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {mf.factor.toFixed(2)}x
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-slate-700 mb-1">{mf.seasonName}</p>
                <p className="text-[10px] text-slate-500 mb-3">{mf.description}</p>

                {/* Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Baja (0.75x)</span>
                    <span>Normal (1.0x)</span>
                    <span>Pico (1.50x)</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.50"
                    step="0.05"
                    value={mf.factor}
                    onChange={(e) => handleSliderChange(mf.month, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logic explanation card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 space-y-2">
        <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
          <Info className="w-4 h-4 text-indigo-600" />
          Fórmulas Matemáticas de Decisión del Sistema
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600 pt-1">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <strong>1. Stock Mínimo y Máximo Ajustado:</strong>
            <p className="mt-1 font-mono text-[11px] text-indigo-900">
              Min_Ajustado = Stock_Base_Min * Factor_Mes<br/>
              Max_Ajustado = Stock_Base_Max * Factor_Mes
            </p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <strong>2. Bultos Enteros a Comprar:</strong>
            <p className="mt-1 font-mono text-[11px] text-indigo-900">
              Unidades_a_Pedir = Max(0, Max_Ajustado - Stock_Actual)<br/>
              Bultos = Redondear_Arriba(Unidades_a_Pedir / Unidades_x_Bulto)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
