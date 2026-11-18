import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MaterialItem, MaterialStatus } from '../types';

export type AlertTriggerLevel = 'CRITICO_AND_PEDIR' | 'CRITICO_ONLY';

export interface AlertSettings {
  browserNotificationsEnabled: boolean;
  soundEnabled: boolean;
  alertEmail: string;
  triggerLevel: AlertTriggerLevel;
  muteOrderedItems: boolean;
}

export interface NotifiedItemRecord {
  status: MaterialStatus;
  totalUnits: number;
  notifiedAt: string;
}

const ALERT_SETTINGS_KEY = 'sugestion_alert_settings_v1';
const NOTIFIED_STATE_KEY = 'sugestion_notified_items_v1';

const DEFAULT_SETTINGS: AlertSettings = {
  browserNotificationsEnabled: false,
  soundEnabled: true,
  alertEmail: '',
  triggerLevel: 'CRITICO_AND_PEDIR',
  muteOrderedItems: true,
};

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(ALERT_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      browserNotificationsEnabled:
        typeof parsed.browserNotificationsEnabled === 'boolean'
          ? parsed.browserNotificationsEnabled
          : DEFAULT_SETTINGS.browserNotificationsEnabled,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      alertEmail: typeof parsed.alertEmail === 'string' ? parsed.alertEmail : '',
      triggerLevel:
        parsed.triggerLevel === 'CRITICO_ONLY' ? 'CRITICO_ONLY' : 'CRITICO_AND_PEDIR',
      muteOrderedItems:
        typeof parsed.muteOrderedItems === 'boolean'
          ? parsed.muteOrderedItems
          : DEFAULT_SETTINGS.muteOrderedItems,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAlertSettings(settings: AlertSettings) {
  try {
    localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

function loadNotifiedMap(): Record<string, NotifiedItemRecord> {
  try {
    const raw = localStorage.getItem(NOTIFIED_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveNotifiedMap(map: Record<string, NotifiedItemRecord>) {
  try {
    localStorage.setItem(NOTIFIED_STATE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function isItemAlertActive(item: MaterialItem, settings: AlertSettings): boolean {
  if (settings.muteOrderedItems && item.isOrdered) {
    return false;
  }
  if (settings.triggerLevel === 'CRITICO_ONLY') {
    return item.status === 'CRITICO';
  }
  return item.status === 'CRITICO' || item.status === 'PEDIR';
}

// Gentle Web Audio API chime so there is no external audio asset dependency
export function playAlertChime(isCritical: boolean = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCritical ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isCritical ? 587.33 : 523.25, now); // D5 or C5
    osc.frequency.setValueAtTime(isCritical ? 880 : 659.25, now + 0.14); // A5 or E5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Audio blocked by autoplay policy or unsupported
  }
}

export function sendBrowserPushNotification(title: string, body: string, tag?: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const n = new Notification(title, {
      body,
      tag: tag || `sugestion-stock-${Date.now()}`,
      renotify: false,
    } as NotificationOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    // Fallback for mobile browsers that require ServiceWorkerRegistration.showNotification
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            tag: tag || `sugestion-stock-${Date.now()}`,
          });
        })
        .catch(() => {});
      return true;
    }
    return false;
  }
}

export interface StockAlertsHook {
  settings: AlertSettings;
  updateSettings: (partial: Partial<AlertSettings>) => void;
  permissionStatus: NotificationPermission | 'unsupported';
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>;
  sendTestPush: () => { ok: boolean; reason?: string };
  activeAlerts: MaterialItem[];
  unacknowledgedCount: number;
  markAlertsSeen: () => void;
}

export function useStockAlerts(
  computedItems: MaterialItem[],
  onToast?: (msg: string) => void
): StockAlertsHook {
  const [settings, setSettings] = useState<AlertSettings>(loadAlertSettings);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  // Track whether this is the initial mount so we seed the baseline map without firing a storm of OS notifications on page refresh
  const initializedRef = useRef(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);

  const updateSettings = useCallback((partial: Partial<AlertSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveAlertSettings(next);
      return next;
    });
  }, []);

  const requestBrowserPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionStatus('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === 'granted') {
        updateSettings({ browserNotificationsEnabled: true });
        sendBrowserPushNotification(
          'Alertas de Stock Activadas • Sugestión',
          'Recibirás notificaciones push cuando un material entre en estado CRÍTICO o PEDIR.',
          'sugestion-welcome-push'
        );
      } else {
        updateSettings({ browserNotificationsEnabled: false });
      }
      return result;
    } catch {
      return permissionStatus;
    }
  }, [permissionStatus, updateSettings]);

  const activeAlerts = useMemo(() => {
    return computedItems
      .filter((item) => isItemAlertActive(item, settings))
      .sort((a, b) => {
        if (a.status === 'CRITICO' && b.status !== 'CRITICO') return -1;
        if (a.status !== 'CRITICO' && b.status === 'CRITICO') return 1;
        return b.unitsToOrder - a.unitsToOrder;
      });
  }, [computedItems, settings]);

  // Monitor transitions into CRITICO / PEDIR or stock drops while in alert state
  useEffect(() => {
    if (!computedItems || computedItems.length === 0) return;

    const notifiedMap = loadNotifiedMap();

    // First load: record current baseline so opening the app doesn't spam 15 notifications at once
    if (!initializedRef.current) {
      initializedRef.current = true;
      const initialMap: Record<string, NotifiedItemRecord> = { ...notifiedMap };
      computedItems.forEach((item) => {
        if (isItemAlertActive(item, settings)) {
          if (!initialMap[item.id]) {
            initialMap[item.id] = {
              status: item.status,
              totalUnits: item.totalUnits,
              notifiedAt: new Date().toISOString(),
            };
          }
        } else {
          delete initialMap[item.id];
        }
      });
      saveNotifiedMap(initialMap);
      return;
    }

    const newlyTriggered: MaterialItem[] = [];
    const nextMap: Record<string, NotifiedItemRecord> = { ...notifiedMap };

    computedItems.forEach((item) => {
      const active = isItemAlertActive(item, settings);
      if (!active) {
        // Clear from notified map if it recovered to OPTIMO/SOBRESTOCK or was marked as Ordered
        if (nextMap[item.id]) {
          delete nextMap[item.id];
        }
        return;
      }

      const prevRecord = nextMap[item.id];
      const escalatedToCritical = prevRecord && prevRecord.status === 'PEDIR' && item.status === 'CRITICO';
      const stockDroppedFurther = prevRecord && item.totalUnits < prevRecord.totalUnits;

      if (!prevRecord || escalatedToCritical || stockDroppedFurther) {
        newlyTriggered.push(item);
        nextMap[item.id] = {
          status: item.status,
          totalUnits: item.totalUnits,
          notifiedAt: new Date().toISOString(),
        };
      }
    });

    if (newlyTriggered.length > 0) {
      saveNotifiedMap(nextMap);

      const hasCritical = newlyTriggered.some((i) => i.status === 'CRITICO');
      if (settings.soundEnabled) {
        playAlertChime(hasCritical);
      }

      if (newlyTriggered.length === 1) {
        const item = newlyTriggered[0];
        const statusLabel = item.status === 'CRITICO' ? '⚠️ STOCK CRÍTICO' : '📦 REPONER STOCK (PEDIR)';
        const bodyText = `${item.name} (${item.category}): quedan ${item.totalUnits.toLocaleString('es-AR')} un. (${item.bultos} bultos) • Mínimo: ${item.minStockAdjusted.toLocaleString('es-AR')} un. • Sugerido pedir: ${item.unitsToOrder.toLocaleString('es-AR')} un.`;

        if (settings.browserNotificationsEnabled && permissionStatus === 'granted') {
          sendBrowserPushNotification(statusLabel, bodyText, `stock-alert-${item.id}`);
        }
        if (onToast) {
          onToast(`${statusLabel}: ${item.name} (${item.totalUnits.toLocaleString('es-AR')} un. disponibles)`);
        }
      } else {
        const critCount = newlyTriggered.filter((i) => i.status === 'CRITICO').length;
        const pedirCount = newlyTriggered.length - critCount;
        const names = newlyTriggered
          .slice(0, 3)
          .map((i) => i.name)
          .join(', ');
        const title =
          critCount > 0
            ? `⚠️ ${newlyTriggered.length} materiales en Stock Bajo (${critCount} Críticos)`
            : `📦 ${newlyTriggered.length} materiales en punto de pedido`;
        const bodyText = `${names}${newlyTriggered.length > 3 ? '...' : ''} requieren reposición.`;

        if (settings.browserNotificationsEnabled && permissionStatus === 'granted') {
          sendBrowserPushNotification(title, bodyText, 'stock-alert-batch');
        }
        if (onToast) {
          onToast(`${title}: ${names}`);
        }
        void pedirCount;
      }
    } else {
      saveNotifiedMap(nextMap);
    }
  }, [computedItems, settings, permissionStatus, onToast]);

  const sendTestPush = useCallback((): { ok: boolean; reason?: string } => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { ok: false, reason: 'Este navegador no soporta notificaciones nativas.' };
    }
    if (Notification.permission !== 'granted') {
      return { ok: false, reason: 'Primero debes conceder permiso al navegador tocando "Activar Notificaciones Push".' };
    }

    if (settings.soundEnabled) {
      playAlertChime(true);
    }

    const sampleItem = activeAlerts[0];
    const title = sampleItem
      ? `⚠️ Alerta de Stock (${sampleItem.status}): ${sampleItem.name}`
      : '⚠️ Prueba de Alerta • Stock Bajo (Sugestión)';
    const body = sampleItem
      ? `Stock actual: ${sampleItem.totalUnits.toLocaleString('es-AR')} un. (${sampleItem.bultos} bultos) • Mínimo: ${sampleItem.minStockAdjusted.toLocaleString('es-AR')} un. • Pedir: ${sampleItem.unitsToOrder.toLocaleString('es-AR')} un.`
      : 'Las notificaciones push nativas están funcionando correctamente en este dispositivo.';

    const sent = sendBrowserPushNotification(title, body, `sugestion-test-${Date.now()}`);
    return sent
      ? { ok: true }
      : { ok: false, reason: 'No se pudo mostrar la notificación. Verifica que no tengas activado el modo "No Molestar" en tu sistema.' };
  }, [activeAlerts, settings.soundEnabled]);

  const markAlertsSeen = useCallback(() => {
    setLastSeenCount(activeAlerts.length);
  }, [activeAlerts.length]);

  const unacknowledgedCount = Math.max(0, activeAlerts.length - lastSeenCount);

  return {
    settings,
    updateSettings,
    permissionStatus,
    requestBrowserPermission,
    sendTestPush,
    activeAlerts,
    unacknowledgedCount,
    markAlertsSeen,
  };
}
