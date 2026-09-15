import { MaterialItem } from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Robust synchronization with Google Sheets Webhook
 * Compatible with Vercel (static deployment) and local environments.
 */
export async function syncWithGoogleSheets(
  webhookUrl: string | null | undefined,
  payload: {
    action: string;
    metadata?: any;
    items?: MaterialItem[];
    minMaxMatrix?: MaterialItem[];
    order?: any;
  }
): Promise<SyncResult> {
  const url = (webhookUrl || localStorage.getItem('sugestion_webhook_url') || '').trim();

  if (!url) {
    return {
      success: false,
      message: 'No has ingresado la URL del Webhook de Google Sheets. Ve a la pestaña "Google Sheets" y pega el enlace de tu Aplicación Web.',
    };
  }

  if (!url.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'La URL ingresada no parece ser un Webhook de Google Apps Script válido. Debe comenzar con: https://script.google.com/macros/s/.../exec',
    };
  }

  try {
    // We send payload as text/plain to prevent CORS preflight (OPTIONS) errors on Google Apps Script
    // and let Apps Script's doPost(e) parse e.postData.contents as JSON.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await response.text();

    // Check if Google returned an HTML page (error, login redirect, or permission blocked)
    if (
      text.trim().startsWith('<') ||
      text.includes('The page cannot') ||
      text.includes('Google Drive – Page Not Found') ||
      text.includes('accounts.google.com')
    ) {
      return {
        success: false,
        message:
          'Google Sheets devolvió una página web de error en vez de procesar los datos. Esto ocurre si en Apps Script la implementación no tiene permiso de acceso para "Cualquiera" (Anyone). Ve a Apps Script > Implementar > Administrar implementaciones > Editar > Acceso: "Cualquiera" > Guardar.',
      };
    }

    try {
      const data = JSON.parse(text);
      if (data.success !== false) {
        return {
          success: true,
          message: data.message || 'Sincronizado con éxito en tu Google Sheet.',
          details: data,
        };
      } else {
        return {
          success: false,
          message: `Error informado por Google Sheets: ${data.error || 'Desconocido'}`,
        };
      }
    } catch {
      // If response text is not JSON but status is OK, consider it succeeded
      if (response.ok) {
        return {
          success: true,
          message: 'Datos enviados y procesados correctamente en Google Sheets.',
        };
      }
      return {
        success: false,
        message: `Respuesta no reconocida de Google Sheets: ${text.slice(0, 120)}...`,
      };
    }
  } catch (networkError: any) {
    // If it's a CORS error, Google Apps Script often successfully executes the doPost even if the browser blocks the response
    console.warn('Network or CORS warning when calling Google Apps Script:', networkError);
    
    // Attempt secondary fallback via Vercel serverless /api/sync-sheets if available
    try {
      const fallbackRes = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url, payload }),
      });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData.success) {
          return {
            success: true,
            message: 'Sincronizado con éxito en tu Google Sheet mediante el servicio de reenvío.',
          };
        }
      }
    } catch {
      // ignore secondary fallback error
    }

    return {
      success: false,
      message: `Error de conexión con Google Sheets: ${networkError.message || 'Sin conexión'}. Revisa que la URL termine en /exec y tenga permisos públicos.`,
    };
  }
}
