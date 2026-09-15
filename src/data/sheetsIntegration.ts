export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * ==============================================================================
 * SCRIPT DE GOOGLE SHEETS PARA CONTROL DE STOCK MP - SUGESTIÓN
 * ==============================================================================
 * Instrucciones:
 * 1. Abre tu Google Sheet de Stocks.
 * 2. Ve a Extensiones > Apps Script.
 * 3. Borra el código existente y pega este archivo completo.
 * 4. Haz clic en "Implementar" > "Nueva implementación".
 * 5. Selecciona Tipo: "Aplicación web".
 * 6. En "Quién tiene acceso", selecciona "Cualquier usuario" (Anyone).
 * 7. Copia la URL de la aplicación web y pégala en la interfaz web de Control de Stock.
 */

function doGet(e) {
  return handleResponse(readStockSheet());
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    
    if (body.action === "UPDATE_STOCK") {
      const result = updateStockSheet(body.items, body.metadata);
      return handleResponse({ success: true, message: "Stock actualizado en Google Sheets", details: result });
    }

    if (body.action === "GET_MIN_MAX") {
      const minMaxData = readMinMaxSheet();
      return handleResponse({ success: true, minMaxData: minMaxData });
    }

    if (body.action === "UPDATE_MIN_MAX") {
      const result = updateMinMaxSheet(body.minMaxMatrix);
      return handleResponse({ success: true, message: "Parámetros Mín/Máx mensuales guardados en Google Sheets", details: result });
    }
    
    if (body.action === "LOG_ORDER") {
      const result = recordPurchaseOrder(body.order);
      return handleResponse({ success: true, message: "Orden de compra asentada en Google Sheets", details: result });
    }

    return handleResponse({ success: true, message: "Webhook recibido con éxito" });
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() });
  }
}

function readMinMaxSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Parametros_MinMax");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  
  // Matrix format: id -> { 1: {min, max}, 2: {min, max}, ... 12: {min, max} }
  const matrix = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[0];
    if (!id) continue;
    matrix[id] = {};
    for (let m = 1; m <= 12; m++) {
      const minCol = 3 + (m - 1) * 2;
      const maxCol = minCol + 1;
      matrix[id][m] = {
        min: Number(row[minCol] || 0),
        max: Number(row[maxCol] || 0)
      };
    }
  }
  return matrix;
}

function updateMinMaxSheet(minMaxList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Parametros_MinMax");
  if (!sheet) {
    sheet = ss.insertSheet("Parametros_MinMax");
  }
  
  const headers = ["ID", "Categoría", "Material"];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  monthNames.forEach(function(m) {
    headers.push("Min_" + m);
    headers.push("Max_" + m);
  });
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#312e81").setFontColor("#ffffff").setFontWeight("bold");

  if (minMaxList && minMaxList.length > 0) {
    const rows = minMaxList.map(function(item) {
      const row = [item.id, item.category, item.name];
      for (let m = 1; m <= 12; m++) {
        const val = (item.monthlyMinMax && item.monthlyMinMax[m]) ? item.monthlyMinMax[m] : { min: item.minStockBase, max: item.maxStockBase };
        row.push(val.min);
        row.push(val.max);
      }
      return row;
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  return { rowsWritten: minMaxList ? minMaxList.length : 0 };
}


function readStockSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Stock_Actual") || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    items.push({
      id: row[0],
      categoria: row[1],
      material: row[2],
      bultos: Number(row[3] || 0),
      unidadesXBulto: Number(row[4] || 0),
      totalUnidades: Number(row[5] || 0),
      stockMinimo: Number(row[6] || 0),
      stockMaximo: Number(row[7] || 0),
      estado: row[8],
      bultosAPedir: Number(row[9] || 0)
    });
  }
  return { items: items, updated: new Date().toISOString() };
}

function updateStockSheet(items, metadata) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Stock_Actual");
  if (!sheet) {
    sheet = ss.insertSheet("Stock_Actual");
  }
  
  // Headers
  sheet.getRange("A1:K1").setValues([[
    "ID", "Categoría", "Material", "Bultos", "Unidades x Bulto", 
    "Total Unidades", "Stock Mínimo", "Stock Máximo", "Estado", "Unidades a Pedir", "Fecha Actualización"
  ]]);
  sheet.getRange("A1:K1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");

  const rows = items.map(function(item) {
    return [
      item.id,
      item.category,
      item.name,
      item.bultos,
      item.unitsPerBulto,
      item.totalUnits,
      item.minStockAdjusted,
      item.maxStockAdjusted,
      item.status,
      item.unitsToOrder || 0,
      new Date().toLocaleDateString("es-AR")
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 11).setValues(rows);
  }
  
  // Historial sheet
  let histSheet = ss.getSheetByName("Historial_Cargas");
  if (!histSheet) {
    histSheet = ss.insertSheet("Historial_Cargas");
    histSheet.appendRow(["Fecha", "Responsable", "Mes", "Ítems Críticos", "Unidades a Pedir", "Notas"]);
    histSheet.getRange("A1:F1").setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
  }
  
  if (metadata) {
    histSheet.appendRow([
      metadata.date || new Date().toLocaleDateString(),
      metadata.responsible || "Operador Depósito",
      metadata.month || "Mes actual",
      metadata.criticalCount || 0,
      metadata.totalUnitsToOrder || 0,
      metadata.notes || "Carga digital desde tablet"
    ]);
  }
  
  return { rowsWritten: rows.length };
}

function handleResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const SHEETS_ARCHITECTURE_OPTIONS = [
  {
    id: 'option-webhook',
    title: 'Opción 1: Google Sheets como Base de Datos con Webhook (Recomendada)',
    tag: 'Más Rápida, Fácil y 100% Gratuita',
    description: 'Conectamos la interfaz web directamente a tu Google Sheet mediante un Webhook de Google Apps Script. No requiere servidores pagos ni credenciales complejas de Google Cloud.',
    pros: [
      'Sin costo adicional: Utiliza tu cuenta de Google actual.',
      'Vivi y Érica o el encargado pueden seguir viendo y editando la planilla en Google Sheets en vivo.',
      'La interfaz web lee y escribe automáticamente en la planilla con 1 clic.',
      'Crea pestañas automáticas de "Stock Actual", "Historial de Cargas" y "Órdenes de Compra".'
    ],
    cons: ['Requiere pegar el script una sola vez en el menú Extensiones > Apps Script.'],
    complexity: 'Simple (Configuración en 3 minutos)'
  },
  {
    id: 'option-hybrid',
    title: 'Opción 2: Sistema Híbrido (Google Form para Carga + Dashboard Web)',
    tag: 'Carga Móvil sin Errores',
    description: 'El personal de depósito carga los bultos una vez al mes desde un formulario optimizado para celular (o la app web), las respuestas van a Google Sheets y el Dashboard Web calcula los pedidos.',
    pros: [
      'Ideal si el personal del depósito se conecta con el teléfono caminando por los pasillos.',
      'Fácil validación para que no pongan letras en lugar de números.',
      'Histórico automático mes a mes en Google Sheets sin pisar datos anteriores.'
    ],
    cons: ['El formulario estándar de Google Form puede ser largo para 52 ítems a menos que se use la interfaz web.'],
    complexity: 'Media'
  },
  {
    id: 'option-api',
    title: 'Opción 3: Integración Directa con Google Sheets API (Google Cloud OAuth)',
    tag: 'Enterprise & Automatización Total',
    description: 'Sincronización bidireccional inmediata mediante OAuth 2.0 y Google Sheets API v4.',
    pros: [
      'Sincronización instantánea celda por celda.',
      'Control granular de permisos por usuario de Google Workspace.'
    ],
    cons: ['Requiere configurar un proyecto en Google Cloud Console con pantalla de consentimiento.'],
    complexity: 'Avanzada'
  }
];

export function exportInventoryToCSV(items: any[], monthName: string, responsible: string, date: string): string {
  const headers = [
    'Categoría',
    'Material / Ítem',
    'Bultos',
    'Unidades x Bulto',
    'Total Unidades',
    'Stock Mínimo (Ajustado)',
    'Stock Máximo (Ajustado)',
    'Estado',
    'Unidades a Pedir',
    'Bultos a Pedir',
    'Notas / Alerta'
  ];

  const rows = items.map(item => [
    `"${item.category}"`,
    `"${item.name}"`,
    item.bultos,
    item.unitsPerBulto,
    item.totalUnits,
    item.minStockAdjusted,
    item.maxStockAdjusted,
    `"${item.status}"`,
    item.unitsToOrder,
    item.bultosToOrder,
    `"${(item.notes || '').replace(/"/g, '""')}"`
  ]);

  const metaHeader = [
    `"PLANILLA DE CONTROL DE STOCK MP - SUGESTIÓN"`,
    `"Mes: ${monthName}"`,
    `"Fecha Relevamiento: ${date}"`,
    `"Responsables: ${responsible}"`
  ].join('\n');

  return `${metaHeader}\n\n${headers.join(',')}\n${rows.map(r => r.join(',')).join('\n')}`;
}

export function exportMinMaxToCSV(items: any[]): string {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const headers = ['ID', 'Categoría', 'Material'];
  monthNames.forEach(m => {
    headers.push(`Min_${m}`);
    headers.push(`Max_${m}`);
  });

  const rows = items.map(item => {
    const row = [`"${item.id}"`, `"${item.category}"`, `"${item.name}"`];
    for (let m = 1; m <= 12; m++) {
      const val = (item.monthlyMinMax && item.monthlyMinMax[m]) 
        ? item.monthlyMinMax[m] 
        : { min: item.minStockBase, max: item.maxStockBase };
      row.push(val.min);
      row.push(val.max);
    }
    return row.join(',');
  });

  const meta = `"PARAMETROS DE STOCK MINIMO Y MAXIMO MENSUAL POR PRODUCTO - SUGESTION"\n"Copia o importa este archivo directamente en la hoja 'Parametros_MinMax' de tu Google Sheet"\n`;
  return `${meta}\n${headers.join(',')}\n${rows.join('\n')}`;
}

