export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { webhookUrl, payload } = req.body || {};

    if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('https://script.google.com/')) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      const text = await response.text();

      try {
        const data = JSON.parse(text);
        return res.status(200).json({ success: true, forward: true, data });
      } catch {
        if (text.includes('The page cannot') || text.startsWith('<')) {
          return res.status(400).json({
            success: false,
            error: 'Google devolvió una página HTML en lugar de JSON. Verifica los permisos de acceso en Google Apps Script (debe ser "Cualquiera").',
          });
        }
        return res.status(200).json({ success: true, forward: true, raw: text });
      }
    }

    return res.status(200).json({
      success: true,
      forward: false,
      message: 'Datos recibidos correctamente en el servidor.',
      syncedCount: payload?.items?.length || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Error en el servidor' });
  }
}
