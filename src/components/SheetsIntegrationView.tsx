import React, { useState, useEffect } from 'react';
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
  Database,
  Table,
  HelpCircle,
  Key
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_TEMPLATE, SHEETS_ARCHITECTURE_OPTIONS, exportInventoryToCSV } from '../data/sheetsIntegration';
import { MaterialItem, MonthlyFactor } from '../types';
import { syncWithGoogleSheets } from '../services/sheetsSync';
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
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('sugestion_webhook_url') || '';
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Save webhookUrl to localStorage
  useEffect(() => {
    localStorage.setItem('sugestion_webhook_url', webhookUrl);
  }, [webhookUrl]);

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
    link.setAttribute('download', `Plantilla_Stock_MP_Sugestion_${selectedMonth.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTestSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const responsible = localStorage.getItem('sugestion_tablet_responsible') || 'Operador Depósito';
      const result = await syncWithGoogleSheets(webhookUrl, {
        action: 'UPDATE_STOCK',
        metadata: {
          date: new Date().toLocaleDateString('es-AR'),
          responsible,
          month: selectedMonth.name,
          criticalCount: items.filter((i) => i.status === 'CRITICO').length,
          totalUnitsToOrder: items.reduce((acc, i) => acc + i.unitsToOrder, 0),
        },
        items,
      });

      if (result.success) {
        setSyncResult({
          success: true,
          message: webhookUrl
            ? '¡Sincronizado exitosamente con tu Google Sheet en vivo!'
            : '¡Prueba simulada exitosa! Los materiales han sido formateados para el Webhook.',
          details: `${items.length} materiales procesados • Mes: ${selectedMonth.name} • Responsable: ${responsible}`,
        });
        onSyncSuccess();
        confetti({ particleCount: 50, spread: 60 });
      } else {
        throw new Error(result.message || 'Error en la respuesta del Webhook');
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
                {syncResult.details && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {syncResult.details}
                  </p>
                )}
                {!syncResult.success && (
                  <div className="mt-2.5 pt-2.5 border-t border-rose-200 text-[11px] text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <Key className="w-3.5 h-3.5 text-rose-600" />
                      <span>Solución al error "Unexpected token 'T', 'The page c...' is not valid JSON":</span>
                    </div>
                    <p className="text-rose-800">
                      Google Apps Script devolvió una página HTML de error de inicio de sesión de Google en lugar de responder JSON. Esto ocurre cuando la Web App no tiene permisos públicos.
                    </p>
                    <div className="bg-white/80 p-2.5 rounded border border-rose-200 font-mono text-[11px] space-y-1 text-slate-800">
                      <p className="font-bold text-rose-800">Pasos para corregirlo en 1 minuto:</p>
                      <p>1. En tu Google Sheet, abre <strong>Extensiones &gt; Apps Script</strong>.</p>
                      <p>2. Arriba a la derecha haz clic en <strong>Implementar &gt; Administrar implementaciones</strong>.</p>
                      <p>3. Haz clic en el <strong>icono de lápiz (Editar)</strong> junto a tu implementación.</p>
                      <p>4. En el campo <strong>Quién tiene acceso (Who has access)</strong> selecciona: <span className="bg-emerald-100 text-emerald-900 px-1 font-bold rounded">Cualquier usuario (Anyone)</span>.</p>
                      <p>5. En "Versión", cambia a <strong>Nueva versión</strong> y pulsa <strong>Implementar</strong>.</p>
                      <p>6. Copia la nueva URL que termina en <code>/exec</code> y pégala arriba.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GUÍA VISUAL COMPLETA: Cómo debe ser el Google Sheet exacto */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Estructura Exacta que debe tener tu Google Sheet
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Si quieres armar la hoja manualmente o verificar que tus columnas coincidan exactamente, esta es la plantilla recomendada:
            </p>
          </div>

          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Descargar Archivo CSV Listo para Google Sheets
          </button>
        </div>

        {/* Hoja 1: Stock_Actual */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-mono font-bold text-xs rounded">
                Pestaña 1
              </span>
              <strong className="text-sm text-slate-800 font-mono">Stock_Actual</strong>
              <span className="text-xs text-slate-400">(hoja principal donde impacta el stock físico)</span>
            </div>
            <span className="text-[11px] text-slate-500">12 Columnas (A hasta L)</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-200 font-mono">
                  <th className="p-2 border-r border-slate-800 text-center">Col</th>
                  <th className="p-2 border-r border-slate-800">Nombre del Encabezado (Fila 1)</th>
                  <th className="p-2 border-r border-slate-800">Tipo de Contenido</th>
                  <th className="p-2">Ejemplo / Fórmula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">A</td>
                  <td className="p-2 font-bold text-slate-800">ID</td>
                  <td className="p-2 text-slate-600">Identificador interno del material</td>
                  <td className="p-2 font-mono text-slate-500">cajas-8100, celo-15x20</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">B</td>
                  <td className="p-2 font-bold text-slate-800">Categoría</td>
                  <td className="p-2 text-slate-600">Sector o familia de material</td>
                  <td className="p-2 text-slate-700">Cajas, Celofanes, Bolsitas, Caballetes, Cartones</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">C</td>
                  <td className="p-2 font-bold text-slate-800">Material</td>
                  <td className="p-2 text-slate-600">Nombre y descripción comercial</td>
                  <td className="p-2 text-slate-800 font-medium">Caja 8100 24 Bombachas 22x13.5x8</td>
                </tr>
                <tr className="hover:bg-slate-50 bg-indigo-50/30">
                  <td className="p-2 font-mono font-bold text-center bg-indigo-50 text-indigo-700">D</td>
                  <td className="p-2 font-bold text-indigo-950">Bultos</td>
                  <td className="p-2 text-slate-600">Número de bultos cerrados relevados</td>
                  <td className="p-2 font-mono text-indigo-700 font-bold">32</td>
                </tr>
                <tr className="hover:bg-slate-50 bg-indigo-50/30">
                  <td className="p-2 font-mono font-bold text-center bg-indigo-50 text-indigo-700">E</td>
                  <td className="p-2 font-bold text-indigo-950">Unidades x Bulto</td>
                  <td className="p-2 text-slate-600">Cantidad de unidades por cada bulto</td>
                  <td className="p-2 font-mono text-indigo-700 font-bold">65</td>
                </tr>
                <tr className="hover:bg-slate-50 bg-indigo-50/50">
                  <td className="p-2 font-mono font-bold text-center bg-indigo-100 text-indigo-900">F</td>
                  <td className="p-2 font-bold text-indigo-950">Total Unidades</td>
                  <td className="p-2 text-slate-600">Fórmula de cálculo o ingreso directo</td>
                  <td className="p-2 font-mono text-emerald-700 font-bold bg-emerald-50 px-1 rounded">=D2*E2</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">G</td>
                  <td className="p-2 font-bold text-slate-800">Stock Mínimo</td>
                  <td className="p-2 text-slate-600">Punto de reorden para el mes</td>
                  <td className="p-2 font-mono text-slate-700">1.800</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">H</td>
                  <td className="p-2 font-bold text-slate-800">Stock Máximo</td>
                  <td className="p-2 text-slate-600">Capacidad objetivo de reposición</td>
                  <td className="p-2 font-mono text-slate-700">3.600</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">I</td>
                  <td className="p-2 font-bold text-slate-800">Estado</td>
                  <td className="p-2 text-slate-600">Fórmula de alerta por semáforo</td>
                  <td className="p-2 font-mono text-emerald-700 text-[10px] bg-slate-50 p-1 rounded">
                    =SI(F2&lt;=G2*0.5, "🔴 CRITICO", SI(F2&lt;G2, "🟡 REPOSICION", "🟢 OPTIMO"))
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">J</td>
                  <td className="p-2 font-bold text-slate-800">Unidades a Pedir</td>
                  <td className="p-2 text-slate-600">Fórmula de cálculo de compra</td>
                  <td className="p-2 font-mono text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                    =SI(F2&lt;G2, H2-F2, 0)
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">K</td>
                  <td className="p-2 font-bold text-slate-800">Proveedor</td>
                  <td className="p-2 text-slate-600">Proveedor habitual</td>
                  <td className="p-2 text-slate-700">Cartonera del Plata S.A.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold text-center bg-slate-50 text-slate-600">L</td>
                  <td className="p-2 font-bold text-slate-800">Fecha Actualización</td>
                  <td className="p-2 text-slate-600">Fecha del último conteo en tablet</td>
                  <td className="p-2 font-mono text-slate-500">15/09/2026</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Hoja 2: Historial_Cargas */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono font-bold text-xs rounded">
                Pestaña 2 (Opcional - el script la crea sola)
              </span>
              <strong className="text-sm text-slate-800 font-mono">Historial_Cargas</strong>
            </div>
            <span className="text-[11px] text-slate-500">6 Columnas (A hasta F)</span>
          </div>
          <p className="text-xs text-slate-500">
            Encabezados: <code>Fecha | Responsable | Mes | Ítems Críticos | Unidades a Pedir | Notas</code>. Cada vez que el operador presiona "Enviar y Sincronizar con Google Sheets" desde la tablet, se agrega una nueva fila en esta pestaña con la auditoría del conteo.
          </p>
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
