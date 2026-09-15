import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  ExternalLink, 
  Send, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Code2,
  Sparkles,
  RefreshCw,
  Sliders,
  Database
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_TEMPLATE, SHEETS_ARCHITECTURE_OPTIONS, exportInventoryToCSV } from '../data/sheetsIntegration';
import { MaterialItem, MonthlyFactor } from '../types';
import confetti from 'canvas-confetti';

interface SheetsIntegrationViewProps {
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  onSyncSuccess: () => void;
}

export const SheetsIntegrationView: React.FC<SheetsIntegrationViewProps> = ({
  items,
  selectedMonth,
  onSyncSuccess,
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedFormulas, setCopiedFormulas] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleDownloadCSV = () => {
    const csvData = exportInventoryToCSV(items, selectedMonth.name, 'Operador Depósito', new Date().toISOString().split('T')[0]);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_MP_Sugestion_${selectedMonth.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTestSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          payload: {
            action: 'UPDATE_STOCK',
            metadata: {
              date: new Date().toLocaleDateString('es-AR'),
              responsible: 'Operador Depósito',
              month: selectedMonth.name,
              criticalCount: items.filter((i) => i.status === 'CRITICO').length,
              totalUnitsToOrder: items.reduce((acc, i) => acc + i.unitsToOrder, 0),
            },
            items,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSyncResult({
          success: true,
          message: webhookUrl
            ? '¡Sincronizado exitosamente con tu Google Sheet en vivo!'
            : '¡Prueba de sincronización exitosa! Los 52 materiales han sido preparados y formateados para el Webhook.',
        });
        onSyncSuccess();
        confetti({ particleCount: 50, spread: 60 });
      } else {
        throw new Error(data.error || 'Error en la respuesta del Webhook');
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: `Fallo al sincronizar: ${err.message}`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const sheetFormulas = [
    {
      col: 'F (Total Unidades)',
      formula: '=D2*E2',
      desc: 'Multiplica Bultos (Col D) por Unidades por Bulto (Col E).',
    },
    {
      col: 'I (Estado)',
      formula: '=SI(F2<=G2*0,5; "🔴 CRITICO"; SI(F2<G2; "🟡 REPOSICION"; "🟢 OPTIMO"))',
      desc: 'Evalúa si el stock actual está por debajo del mínimo estacional o del 50% crítico.',
    },
    {
      col: 'J (Bultos a Pedir)',
      formula: '=SI(F2<G2; REDONDEAR.MAS((H2-F2)/E2; 0); 0)',
      desc: 'Calcula cuántos bultos enteros cerrados comprar para llegar al stock máximo (Col H).',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">
                Propuesta: Google Sheets + Interfaz Web Personalizada
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Cómo transformar la planilla en papel de Vivi y Érica en un sistema automatizado, donde Google Sheets funciona como la base de datos central en la nube y esta interfaz web se encarga de la visualización, alertas y cálculo inteligente de compras.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar Plantilla CSV para Google Sheets
            </button>
          </div>
        </div>
      </div>

      {/* Architecture Options Analysis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            3 Formas de Implementarlo (Comparativa Técnica y Operativa)
          </h3>
          <span className="text-xs text-slate-500">Evaluación para Sugestión</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SHEETS_ARCHITECTURE_OPTIONS.map((opt, index) => (
            <div
              key={opt.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                index === 0
                  ? 'bg-white border-emerald-300 ring-2 ring-emerald-100 shadow-md'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      index === 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {opt.tag}
                  </span>
                  <span className="text-[10px] text-slate-400">{opt.complexity}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mb-2">{opt.title}</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">{opt.description}</p>

                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-700">Ventajas clave:</div>
                  <ul className="space-y-1 text-slate-600">
                    {opt.pros.map((p, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {index === 0 && (
                <div className="mt-4 pt-3 border-t border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Opción sugerida para comenzar hoy mismo
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Setup Guide for Option 1 */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-600" />
            Paso a Paso: Cómo Conectar tu Google Sheet en 3 Minutos
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Sigue estos 4 pasos simples. Solo necesitas copiar y pegar el código en tu planilla.
          </p>
        </div>

        {/* Step by step */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center mb-2">
              1
            </div>
            <h4 className="font-bold text-slate-800 mb-1">Crea tu Google Sheet</h4>
            <p className="text-slate-500">
              Abre un nuevo Google Sheet llamado <em>"Control de Stock MP - Sugestión"</em> o descarga nuestra plantilla CSV.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center mb-2">
              2
            </div>
            <h4 className="font-bold text-slate-800 mb-1">Abre Apps Script</h4>
            <p className="text-slate-500">
              En el menú superior de Google Sheets, ve a <strong>Extensiones &gt; Apps Script</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center mb-2">
              3
            </div>
            <h4 className="font-bold text-slate-800 mb-1">Pega el Código</h4>
            <p className="text-slate-500">
              Copia el código que te dejamos abajo, pégalo en el editor y haz clic en el ícono de Guardar.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center mb-2">
              4
            </div>
            <h4 className="font-bold text-slate-800 mb-1">Implementa Web App</h4>
            <p className="text-slate-500">
              Haz clic en <strong>Implementar &gt; Nueva implementación &gt; Aplicación Web</strong> con acceso "Cualquiera".
            </p>
          </div>
        </div>

        {/* Script Code Viewer */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-900 text-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-emerald-400 font-bold">codigo.gs</span>
              <span className="text-slate-400">Google Apps Script listo para copiar</span>
            </div>
            <button
              onClick={handleCopyScript}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                copiedScript ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {copiedScript ? (
                <>
                  <Check className="w-3.5 h-3.5" /> ¡Código Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copiar Código Apps Script
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-60 leading-relaxed">
            {GOOGLE_APPS_SCRIPT_TEMPLATE}
          </pre>
        </div>

        {/* Live Synchronizer Tester */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            Probar Sincronización en Vivo con tu Google Sheet
          </h4>
          <p className="text-xs text-slate-500">
            Pega aquí la URL de la Aplicación Web generada por Google Apps Script, o haz clic en "Probar Sincronización" para simular el envío completo de los 52 materiales.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec (opcional)"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <button
              onClick={handleTestSync}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sincronizando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Sincronizar Stock Ahora
                </>
              )}
            </button>
          </div>

          {syncResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                syncResult.success
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{syncResult.message}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  52 materiales procesados • Mes: {selectedMonth.name} • Responsable: Vivi y Érica
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alternative: Google Sheet Formulas Reference */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            Fórmulas para Quienes Prefieran Calcular Todo Dentro de Google Sheets
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Si deseas que tu propia hoja de cálculo calcule automáticamente los bultos y emita alertas con colores, estas son las fórmulas exactas que debes colocar en la fila 2 y arrastrar hacia abajo:
          </p>
        </div>

        <div className="space-y-3 text-xs">
          {sheetFormulas.map((f, i) => (
            <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <span className="font-bold text-slate-800">{f.col}</span>
                <p className="text-slate-500 text-[11px]">{f.desc}</p>
              </div>
              <code className="bg-slate-900 text-emerald-400 font-mono px-2.5 py-1 rounded text-[11px] shrink-0">
                {f.formula}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
