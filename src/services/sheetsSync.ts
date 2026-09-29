import { MaterialItem } from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  details?: any;
}

// Connection settings live only on each device (never in the bundle): the URL alone
// is not enough to write to the sheet, the Apps Script also checks ACCESS_TOKEN.
const URL_KEY = 'sugestion_webhook_url';
const TOKEN_KEY = 'sugestion_access_token';
const ADMIN_PIN_KEY = 'sugestion_admin_pin';

function readStorage(storage: Storage, key: string): string {
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // storage unavailable (private mode)
  }
}

export interface SheetsConfig {
  webhookUrl: string;
  accessToken: string;
}

export function getSheetsConfig(): SheetsConfig {
  return {
    webhookUrl: readStorage(localStorage, URL_KEY).trim(),
    accessToken: readStorage(localStorage, TOKEN_KEY).trim(),
  };
}

export function saveSheetsConfig(config: SheetsConfig) {
  writeStorage(localStorage, URL_KEY, config.webhookUrl.trim());
  writeStorage(localStorage, TOKEN_KEY, config.accessToken.trim());
}

export function isSheetsConfigured(config: SheetsConfig = getSheetsConfig()): boolean {
  return !!config.webhookUrl && !!config.accessToken;
}

// Admin PIN is kept for the browser session only, to authorize admin writes
export function getSessionAdminPin(): string {
  return readStorage(sessionStorage, ADMIN_PIN_KEY);
}

export function setSessionAdminPin(pin: string) {
  writeStorage(sessionStorage, ADMIN_PIN_KEY, pin);
}

export type SheetsAction = 
  | 'PING' 
  | 'VERIFY_PIN' 
  | 'GET_STATE' 
  | 'UPDATE_STOCK' 
  | 'UPDATE_MIN_MAX' 
  | 'LOG_ORDER' 
  | 'LOG_MOVEMENT' 
  | 'RECORD_MOVEMENTS' 
  | 'SETUP_STRUCTURE';

export interface SheetsPayload {
  metadata?: any;
  items?: MaterialItem[];
  minMaxMatrix?: MaterialItem[];
  order?: any;
  movement?: any;
  movements?: any[];
  adminPin?: string;
}

/**
 * Calls the Google Apps Script web app. Sent as text/plain to avoid a CORS preflight,
 * Apps Script parses e.postData.contents as JSON.
 */
export async function callSheets(
  action: SheetsAction,
  payload: SheetsPayload = {},
  config: SheetsConfig = getSheetsConfig()
): Promise<SyncResult> {
  const { webhookUrl: url, accessToken } = config;

  if (!url || !accessToken) {
    return {
      success: false,
      message: 'La sincronización en la nube no está configurada en este dispositivo. Configúrala desde los Ajustes de Nube en el panel Administrador.',
    };
  }

  if (!url.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'La URL no parece ser un Webhook de Google Apps Script válido. Debe comenzar con: https://script.google.com/macros/s/.../exec',
    };
  }

  const body = { ...payload, action, token: accessToken, adminPin: payload.adminPin ?? getSessionAdminPin() };

  // 1. Priorizar el proxy del servidor (/api/sync-sheets).
  // En navegadores, las llamadas directas POST a Google Apps Script retornan redirección HTTP 302
  // hacia script.googleusercontent.com, lo que provoca que el navegador lance un error CORS
  // LUEGO de que Apps Script ya ejecutó la acción. La reintento en catch provocaba que la misma
  // fila se grabase dos veces en Google Sheets.
  // Node.js sigue la redirección sin problemas de CORS y devuelve la respuesta limpia en un único request.
  try {
    const proxyRes = await fetch('/api/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: url, payload: body }),
    });
    if (proxyRes.ok) {
      const fb = await proxyRes.json();
      if (fb.forward && fb.data) return interpret(fb.data);
      if (fb.data) return interpret(fb.data);
    }
  } catch {
    // Si el proxy no responde (entorno estático sin Node.js), continúa a intento directo
  }

  // 2. Intento directo como alternativa si no hay backend activo
  let text: string;
  let ok: boolean;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    text = await response.text();
    ok = response.ok;
  } catch (networkError: any) {
    return {
      success: false,
      message: `Sin conexión con Google Sheets: ${networkError?.message || 'error de red'}.`,
    };
  }

  if (
    text.trim().startsWith('<') ||
    text.includes('The page cannot') ||
    text.includes('accounts.google.com')
  ) {
    return {
      success: false,
      message:
        'Google devolvió una página web en vez de datos. En Apps Script: Implementar > Administrar implementaciones > Editar > Acceso: "Cualquier usuario".',
    };
  }

  try {
    return interpret(JSON.parse(text));
  } catch {
    return {
      success: false,
      message: ok ? 'Respuesta no reconocida de Google Sheets.' : `Error HTTP de Google Sheets: ${text.slice(0, 120)}`,
    };
  }
}

function interpret(data: any): SyncResult {
  if (data && data.success === true) {
    return { success: true, message: data.message || 'Sincronizado con Google Sheets.', details: data };
  }
  return { success: false, message: `Google Sheets: ${data?.error || 'respuesta inválida'}`, details: data };
}
