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
  Key, 
  RefreshCw,
  LogOut,
  Sparkles,
  FileSpreadsheet,
  Bell,
  BellRing,
  Mail,
  Volume2,
  VolumeX,
  Eye,
  EyeOff
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_TEMPLATE, exportInventoryToCSV } from '../data/sheetsIntegration';
import { MaterialItem, MonthlyFactor } from '../types';
import { callSheets, getSheetsConfig, saveSheetsConfig } from '../services/sheetsSync';
import { SheetsSyncState } from '../state/useSheetsSync';
import { StockAlertsHook } from '../services/stockAlerts';
import confetti from 'canvas-confetti';

interface CloudSyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MaterialItem[];
  selectedMonth: MonthlyFactor;
  sync: SheetsSyncState;
  alerts: StockAlertsHook;
}

type ModalTab = 'connection' | 'alerts' | 'structure' | 'script';

export const CloudSyncSettingsModal: React.FC<CloudSyncSettingsModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedMonth,
  sync,
  alerts,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('connection');
  const [copiedScript, setCopiedScript] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => getSheetsConfig().webhookUrl);
  const [accessToken, setAccessToken] = useState(() => getSheetsConfig().accessToken);
  const [showToken, setShowToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [initializingStructure, setInitializingStructure] = useState(false);

  // Email alert state
  const [emailInput, setEmailInput] = useState(() => alerts.settings.alertEmail);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

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
      if (result.details?.alertEmail && !emailInput) {
        setEmailInput(result.details.alertEmail);
        alerts.updateSettings({ alertEmail: result.details.alertEmail });
      }
      setSyncResult({
        success: true,
        message: 'Conexión verificada y guardada correctamente.',
        details: 'Los movimientos y existencias se sincronizan con Google Sheets en tiempo real.',
      });
      confetti({ particleCount: 50, spread: 60 });
    } else {
      setSyncResult({ success: false, message: result.message });
    }
    setSyncing(false);
  };

  const handleInitializeStructure = async () => {
    setInitializingStructure(true);
    setSyncResult(null);
    const result = await callSheets('SETUP_STRUCTURE', {});
    if (result.success) {
      setSyncResult({
        success: true,
        message: 'Estructura oficial creada en tu Google Sheet.',
        details: 'Se crearon y formatearon las 4 hojas: Stock_Actual, Movimientos, Parametros_MinMax y Ordenes_Compra.',
      });
      confetti({ particleCount: 60, spread: 70 });
    } else {
      setSyncResult({
        success: false,
        message: `No se pudo inicializar la estructura: ${result.message}`,
      });
    }
    setInitializingStructure(false);
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

  const handleSaveAlertSettingsToSheets = async () => {
    const cleanEmail = emailInput.trim();
    alerts.updateSettings({ alertEmail: cleanEmail });

    if (!sync.configured) {
      setSyncResult({
        success: true,
        message: 'Preferencias de alerta guardadas en este dispositivo.',
        details: 'Conecta Google Sheets en la pestaña "Conexión Webhook" para habilitar también el envío automático de emails.',
      });
      return;
    }

    setSavingEmail(true);
    setSyncResult(null);
    const res = await callSheets('SET_ALERT_CONFIG', {
      alertConfig: {
        alertEmail: cleanEmail,
        triggerLevel: alerts.settings.triggerLevel,
        muteOrderedItems: alerts.settings.muteOrderedItems,
      },
    });
    setSavingEmail(false);

    if (res.success) {
      setSyncResult({
        success: true,
        message: 'Configuración de alertas sincronizada con Google Sheets.',
        details: cleanEmail
          ? `Se enviarán avisos automáticos a: ${cleanEmail} cuando un producto caiga a ${
              alerts.settings.triggerLevel === 'CRITICO_ONLY' ? 'CRÍTICO' : 'CRÍTICO o PEDIR'
            }.`
          : 'Alertas por email desactivadas (sin dirección de correo).',
      });
    } else {
      setSyncResult({
        success: false,
        message: res.message,
        details: 'Asegúrate de haber actualizado el código de Apps Script (pestaña "Código Apps Script") en tu planilla.',
      });
    }
  };

  const handleSendTestEmail = async () => {
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setSyncResult({
        success: false,
        message: 'Ingresa un correo electrónico válido para enviar la prueba.',
      });
      return;
    }
    alerts.updateSettings({ alertEmail: cleanEmail });

    if (!sync.configured) {
      setSyncResult({
        success: false,
        message: 'Debes configurar primero la Conexión Webhook con Google Sheets para enviar emails.',
      });
      return;
    }

    setTestingEmail(true);
    setSyncResult(null);
    const res = await callSheets('TEST_EMAIL_ALERT', {
      alertConfig: {
        alertEmail: cleanEmail,
        triggerLevel: alerts.settings.triggerLevel,
        muteOrderedItems: alerts.settings.muteOrderedItems,
      },
      items,
    });
    setTestingEmail(false);

    if (res.success) {
      setSyncResult({
        success: true,
        message: `Email de prueba enviado a ${cleanEmail}`,
        details: `Incluye el reporte actual con ${alerts.activeAlerts.length} materiales pendientes de reposición.`,
      });
      confetti({ particleCount: 40, spread: 50 });
    } else {
      setSyncResult({
        success: false,
        message: res.message,
        details: 'Verifica que hayas pegado la última versión del código Apps Script y autorizado el envío de correos (MailApp) al implementar.',
      });
    }
  };

  const handleTestBrowserPush = async () => {
    setSyncResult(null);
    if (alerts.permissionStatus !== 'granted') {
      const perm = await alerts.requestBrowserPermission();
      if (perm !== 'granted') {
        setSyncResult({
          success: false,
          message: 'Permiso de notificaciones denegado en el navegador.',
          details: 'Haz clic en el candado junto a la barra de direcciones del navegador y permite las "Notificaciones".',
        });
        return;
      }
    } else {
      const testRes = alerts.sendTestPush();
      if (testRes.ok) {
        setSyncResult({
          success: true,
          message: 'Notificación Push enviada a tu pantalla.',
          details: 'Así verás el aviso emergente cuando un insumo entre en estado CRÍTICO o PEDIR.',
        });
      } else {
        setSyncResult({
          success: false,
          message: testRes.reason || 'No se pudo mostrar la notificación.',
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sincronización en la Nube y Alertas de Stock
              </h3>
              <p className="text-xs text-slate-500">
                Conexión con Google Sheets, notificaciones push nativas y alertas por correo
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

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('connection');
              setSyncResult(null);
            }}
            className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'connection'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Conexión Webhook</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('alerts');
              setSyncResult(null);
            }}
            className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'alerts'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Alertas Push y Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('structure');
              setSyncResult(null);
            }}
            className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'structure'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Estructura Planilla (Kardex)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('script');
              setSyncResult(null);
            }}
            className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'script'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Código Apps Script</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* TAB 1: CONNECTION */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
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
                      {sync.configured ? 'Conexión con Google Sheets Activa' : 'Sin conexión con Google Sheets'}
                    </p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {sync.configured
                        ? sync.lastSyncedAt
                          ? `Última sincronización exitosa: ${sync.lastSyncedAt}`
                          : 'Listo para sincronizar movimientos y stock en vivo'
                        : 'Ingresa la URL del Webhook y el ACCESS_TOKEN para enlazar tu planilla.'}
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
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Token configurado en Propiedades del script"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      title={showToken ? 'Ocultar token' : 'Mostrar token para copiar a otra PC'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Protege tu planilla para que solo dispositivos autorizados puedan registrar movimientos o consultar existencias.
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
            </div>
          )}

          {/* TAB 2: PUSH & EMAIL ALERTS */}
          {activeTab === 'alerts' && (
            <div className="space-y-4 text-xs">
              {/* Channel 1: Native Browser Push Notifications */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        1. Notificaciones Push Nativas (PC y Celular)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Muestra una alerta emergente en el sistema cuando un material cae en falta.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alerts.permissionStatus === 'granted' ? (
                      <button
                        type="button"
                        onClick={() =>
                          alerts.updateSettings({
                            browserNotificationsEnabled: !alerts.settings.browserNotificationsEnabled,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                          alerts.settings.browserNotificationsEnabled
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {alerts.settings.browserNotificationsEnabled ? 'Push Activo' : 'Push Pausado'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTestBrowserPush}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Activar Notificaciones Push</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleTestBrowserPush}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Probar Push
                    </button>
                  </div>
                </div>

                {/* Alert Rules & Sound Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-slate-700">Momento de Disparo</span>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                      <button
                        type="button"
                        onClick={() => alerts.updateSettings({ triggerLevel: 'CRITICO_AND_PEDIR' })}
                        className={`flex-1 py-1 px-2 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          alerts.settings.triggerLevel === 'CRITICO_AND_PEDIR'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Crítico + Pedir
                      </button>
                      <button
                        type="button"
                        onClick={() => alerts.updateSettings({ triggerLevel: 'CRITICO_ONLY' })}
                        className={`flex-1 py-1 px-2 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          alerts.settings.triggerLevel === 'CRITICO_ONLY'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Solo Crítico
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Silenciar Pedidos Realizados
                      </span>
                      <span className="text-[10px] text-slate-500">
                        No avisar si ya fue encargado
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={alerts.settings.muteOrderedItems}
                      onChange={(e) => alerts.updateSettings({ muteOrderedItems: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {alerts.settings.soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">Sonido de Alerta</span>
                        <span className="text-[10px] text-slate-500">Campana suave en PC/Tablet</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={alerts.settings.soundEnabled}
                      onChange={(e) => alerts.updateSettings({ soundEnabled: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Channel 2: Automatic Email from Google Sheets */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      2. Email Automático desde Google Sheets
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tu planilla de Google Sheets envía un correo automático cuando un material entra en falta y no está pedido.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email(s) de Destino para Alertas (separados por coma si son varios)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      placeholder="ejemplo: compras@empresa.com, deposito@empresa.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAlertSettingsToSheets}
                      disabled={savingEmail}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {savingEmail ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={testingEmail || !emailInput.trim()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testingEmail ? 'Enviando...' : 'Enviar Email de Prueba'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1.5">
                    Nota: Si actualizaste recientemente las funciones de alerta, recuerda copiar el código desde la pestaña <strong>Código Apps Script</strong> y pegarlo en tu Google Sheet.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURE & FORMULAS (KARDEX) */}
          {activeTab === 'structure' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-black text-indigo-950 uppercase tracking-wide">
                      Arquitectura de Hojas en Google Sheets
                    </h4>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    El inventario se gestiona como un <strong>Kardex continuo</strong>: todas las cargas, aperturas de bultos y ajustes se asientan como filas en la hoja <strong className="text-slate-900 font-mono">Movimientos</strong> con fecha y hora. A partir de esa hoja, la hoja <strong className="text-slate-900 font-mono">Stock_Actual</strong> calcula las existencias con fórmulas automáticas.
                  </p>
                </div>

                {sync.configured && (
                  <button
                    type="button"
                    onClick={handleInitializeStructure}
                    disabled={initializingStructure}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[11px] transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${initializingStructure ? 'animate-spin' : ''}`} />
                    <span>{initializingStructure ? 'Inicializando...' : 'Crear / Reparar Hojas en Sheets'}</span>
                  </button>
                )}
              </div>

              {/* The 4 Sheets Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Sheet 1: Stock_Actual */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      1. Stock_Actual
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Consolidado en vivo</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Contiene una fila por cada material del catálogo. No se editan cantidades a mano; se calculan con fórmulas vinculadas a la hoja Movimientos.
                  </p>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-[10px] text-slate-700 space-y-0.5">
                    <div><strong>Bultos Actuales:</strong> <code className="text-indigo-600">=E2 + F2</code></div>
                    <div><strong>Movimientos:</strong> <code className="text-indigo-600">=SUMAR.SI(Movimientos!C:C, A2, Movimientos!G:G)</code></div>
                    <div><strong>Total Unidades:</strong> <code className="text-indigo-600">=G2 * D2</code></div>
                  </div>
                </div>

                {/* Sheet 2: Movimientos */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      2. Movimientos
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Historial / Auditoría</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Libro mayor donde se asienta cada movimiento con <strong>Fecha y Hora exacta</strong>, Bultos movidos (+/-), Unidades, Responsable y Motivo/Remito.
                  </p>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-[10px] text-slate-700 space-y-0.5">
                    <div><strong>Columnas clave:</strong> ID_Mov, Fecha_Hora, ID_Material, Bultos_Movidos, Responsable, Motivo</div>
                    <div><strong>Formato:</strong> Bultos positivos (+) suman, negativos (-) descuentan</div>
                  </div>
                </div>

                {/* Sheet 3: Parametros_MinMax */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      3. Parametros_MinMax
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Estacionalidad</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Matriz de mínimos y máximos por producto para cada mes del año (Enero a Diciembre) y plazo del proveedor en días.
                  </p>
                </div>

                {/* Sheet 4: Ordenes_Compra */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      4. Ordenes_Compra
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Compras</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Registro de cada pedido de compra enviado a proveedores con fecha, mes, material y unidades a pedir.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCRIPT CODE */}
          {activeTab === 'script' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">
                    Google Apps Script Oficial (Code.gs) • Incluye Alertas por Email
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Copia y pega este código en Extensiones &gt; Apps Script de tu planilla.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Script</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl overflow-x-auto max-h-72 leading-relaxed">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          )}

          {/* Sync Result Feedback Message */}
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
