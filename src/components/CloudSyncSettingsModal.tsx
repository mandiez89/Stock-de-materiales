import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  Copy, 
  Check, 
  Send, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Code2, 
  ShieldCheck, 
  Key, 
  RefreshCw,
  LogOut
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_TEMPLATE, exportInventoryToCSV } from '../data/sheetsIntegration';
import { MaterialItem, MonthlyFactor } from '../types';
import { callSheets, getSheetsConfig, saveSheetsConfig } from '../services/sheetsSync';
import { SheetsSyncState } from '../state/useSheetsSync';
import confetti from 'canvas-confetti';

interface CloudSyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  sync: SheetsSyncState;
}

export const CloudSyncSettingsModal: React.FC<CloudSyncSettingsModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedMonth,
  sync,
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => getSheetsConfig().webhookUrl);
  const [accessToken, setAccessToken] = useState(() => getSheetsConfig().accessToken);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleDownloadCSV = () => {
    const csvData = exportInventoryToCSV(
      items,
      selectedMonth.name,
      'Administración',
      new Date().toISOString().split('T')[0]
    );
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Plantilla_Stock_MP_${selectedMonth.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAndTest = async () => {
    setSyncing(true);
    setSyncResult(null);
    const config = { webhookUrl: webhookUrl.trim(), accessToken: accessToken.trim() };
    const result = await callSheets('PING', {}, config);
    if (result.success) {
      saveSheetsConfig(config);
      sync.refreshConfig();
      await sync.pull();
      setSyncResult({
        success: true,
        message: 'Conexión verificada y guardada correctamente.',
        details: 'Los cambios se sincronizan en la nube automáticamente en tiempo real.',
      });
      confetti({ particleCount: 50, spread: 60 });
    } else {
      setSyncResult({ success: false, message: result.message });
    }
    setSyncing(false);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    const ok = await sync.syncNow({ responsible: 'Administración' });
    setSyncResult(
      ok
        ? {
            success: true,
            message: 'Stock completo enviado a la nube con éxito.',
            details: `${items.length} materiales actualizados • Mes: ${selectedMonth.name}`,
          }
        : { success: false, message: sync.error || 'No se pudo sincronizar.' }
    );
    setSyncing(false);
  };

  const handleDisconnect = () => {
    saveSheetsConfig({ webhookUrl: '', accessToken: '' });
    setWebhookUrl('');
    setAccessToken('');
    sync.refreshConfig();
    setSyncResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ajustes de Sincronización en la Nube
              </h3>
              <p className="text-xs text-slate-500">
                Configuración del webhook central y credenciales de acceso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Current Connection Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              sync.configured
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                : 'bg-amber-50/80 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {sync.configured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {sync.configured ? 'Conexión en la Nube Activa' : 'Sin conexión en la nube'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {sync.configured
                    ? sync.lastSyncedAt
                      ? `Última sincronización exitosa: ${sync.lastSyncedAt}`
                      : 'Listo para sincronizar cambios en vivo'
                    : 'Los datos se guardan únicamente en el almacenamiento local de este dispositivo.'}
                </p>
              </div>
            </div>

            {sync.configured && (
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Enviando...' : 'Sincronizar Todo'}</span>
              </button>
            )}
          </div>

          {/* Connection Parameters Form */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-600" />
              Credenciales de Conexión
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                URL del Webhook (Google Apps Script)
              </label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Token de Acceso (ACCESS_TOKEN)
              </label>
              <input
                type="password"
                placeholder="Token configurado en Propiedades del script"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Protege tu planilla para que solo dispositivos autorizados puedan leer o escribir datos.
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndTest}
                  disabled={syncing || !webhookUrl.trim() || !accessToken.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{syncing ? 'Verificando...' : 'Guardar y Probar Conexión'}</span>
                </button>

                {sync.configured && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Descargar copia del inventario actual en formato CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Sync Result Feedback */}
          {syncResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                syncResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{syncResult.message}</p>
                {syncResult.details && (
                  <p className="text-[11px] opacity-80 mt-0.5">{String(syncResult.details)}</p>
                )}
              </div>
            </div>
          )}

          {/* Script Copy Dropdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-600" />
                Código de Servidor (Apps Script)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptCode((prev) => !prev)}
                  className="text-slate-600 hover:text-slate-900 underline font-medium text-[11px] cursor-pointer"
                >
                  {showScriptCode ? 'Ocultar código' : 'Ver código'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-md font-bold text-[11px] text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            {showScriptCode && (
              <pre className="p-4 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
