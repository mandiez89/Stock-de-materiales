/**
 * ==============================================================================
 * SCRIPT DE GOOGLE SHEETS PARA CONTROL DE STOCK MP - SUGESTIÓN
 * ==============================================================================
 * Instalación:
 * 1. Abre tu Google Sheet de Stocks > Extensiones > Apps Script.
 * 2. Borra el código existente y pega este archivo completo. Guarda.
 * 3. Configuración del proyecto (ícono de engranaje) > Propiedades del script. Agrega:
 *      ACCESS_TOKEN = una clave larga y aleatoria (se carga una vez en cada tablet)
 *      ADMIN_PIN    = PIN de 4 dígitos para el portal Administrador
 * 4. Implementar > Nueva implementación > Aplicación web.
 *      Ejecutar como: Yo | Quién tiene acceso: Cualquier usuario
 * 5. Copia la URL (termina en /exec) y cárgala junto al ACCESS_TOKEN en la pestaña
 *    "Google Sheets" de la app.
 *
 * Sin ACCESS_TOKEN correcto el script rechaza toda lectura y escritura, así que
 * conocer la URL no alcanza para modificar la planilla.
 */

var STOCK_SHEET = "Stock_Actual";
var MINMAX_SHEET = "Parametros_MinMax";
var HISTORY_SHEET = "Historial_Cargas";
var ORDERS_SHEET = "Ordenes_Compra";

var STOCK_HEADERS = [
  "ID", "Categoría", "Material", "Bultos", "Unidades x Bulto", "Total Unidades",
  "Stock Mínimo", "Stock Máximo", "Estado", "Unidades a Pedir", "Fecha Actualización",
  "Actualizado (ISO)", "Datos (JSON)"
];
var MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function doGet() {
  return json({ success: false, error: "Usa POST con token de acceso." });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var accessToken = props.getProperty("ACCESS_TOKEN");
    var adminPin = props.getProperty("ADMIN_PIN");

    if (!accessToken) {
      return json({ success: false, error: "Falta configurar ACCESS_TOKEN en Propiedades del script." });
    }
    if (body.token !== accessToken) {
      return json({ success: false, error: "Token de acceso inválido." });
    }

    var isAdmin = !!adminPin && body.adminPin === adminPin;

    switch (body.action) {
      case "PING":
        return json({ success: true, message: "Conexión OK" });

      case "VERIFY_PIN":
        return json({ success: isAdmin, error: isAdmin ? undefined : "PIN incorrecto." });

      case "GET_STATE":
        return json({ success: true, items: readStock(), minMax: readMinMax(), serverTime: new Date().toISOString() });

      case "UPDATE_STOCK":
        return withLock(function () {
          var result = upsertStock(body.items || []);
          if (body.metadata && body.metadata.logHistory) logHistory(body.metadata);
          return json({ success: true, message: "Stock actualizado en Google Sheets", details: result });
        });

      case "UPDATE_MIN_MAX":
        if (!isAdmin) return json({ success: false, error: "Se requiere PIN de administrador." });
        return withLock(function () {
          return json({ success: true, message: "Parámetros Mín/Máx guardados", details: writeMinMax(body.minMaxMatrix || []) });
        });

      case "LOG_ORDER":
        if (!isAdmin) return json({ success: false, error: "Se requiere PIN de administrador." });
        return withLock(function () {
          return json({ success: true, message: "Orden de compra registrada", details: recordPurchaseOrder(body.order) });
        });
    }
    return json({ success: false, error: "Acción desconocida: " + body.action });
  } catch (err) {
    return json({ success: false, error: String(err) });
  }
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers) {
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
  }
  return sheet;
}

// Each row keeps the full item state in the JSON column, so every tablet can rebuild it.
function readStock() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, STOCK_HEADERS.length).getValues();
  var items = [];
  data.forEach(function (row) {
    if (!row[0]) return;
    var extra = {};
    try { extra = row[12] ? JSON.parse(row[12]) : {}; } catch (e) { extra = {}; }
    extra.id = String(row[0]);
    extra.bultos = Number(row[3] || 0);
    extra.unitsPerBulto = Number(row[4] || 0);
    extra.totalUnits = Number(row[5] || 0);
    extra.lastUpdated = isoOf(row[11]);
    items.push(extra);
  });
  return items;
}

// Per-item upsert: an item is only written when it is newer than what the sheet has,
// so a tablet with stale data cannot overwrite another tablet's newer count.
function upsertStock(items) {
  var sheet = getSheet(STOCK_SHEET, STOCK_HEADERS);
  sheet.getRange("L:L").setNumberFormat("@"); // keep timestamps as plain text
  var lastRow = sheet.getLastRow();
  var rowById = {};
  var storedTs = {};
  if (lastRow >= 2) {
    var existing = sheet.getRange(2, 1, lastRow - 1, STOCK_HEADERS.length).getValues();
    existing.forEach(function (row, i) {
      if (!row[0]) return;
      rowById[String(row[0])] = i + 2;
      storedTs[String(row[0])] = isoOf(row[11]);
    });
  }

  var written = 0, skipped = 0, today = new Date().toLocaleDateString("es-AR");
  items.forEach(function (item) {
    var id = String(item.id);
    var ts = item.lastUpdated || new Date().toISOString();
    if (storedTs[id] && storedTs[id] > ts) { skipped++; return; }

    var extra = {
      batches: item.batches || null,
      isDirectUnits: !!item.isDirectUnits,
      allowDirectTotal: !!item.allowDirectTotal,
      isOrdered: !!item.isOrdered,
      orderedAt: item.orderedAt || null,
      orderedStockSnapshot: item.orderedStockSnapshot == null ? null : item.orderedStockSnapshot,
      orderedUnits: item.orderedUnits == null ? null : item.orderedUnits
    };
    var row = [
      id, item.category, item.name, item.bultos, item.unitsPerBulto, item.totalUnits,
      item.minStockAdjusted, item.maxStockAdjusted, item.status, item.unitsToOrder || 0,
      today, ts, JSON.stringify(extra)
    ];
    if (rowById[id]) {
      sheet.getRange(rowById[id], 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowById[id] = sheet.getLastRow();
    }
    written++;
  });
  return { rowsWritten: written, skippedAsOlder: skipped };
}

function logHistory(metadata) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET);
  if (!sheet) {
    sheet = getSheet(HISTORY_SHEET, ["Fecha", "Responsable", "Mes", "Ítems Críticos", "Unidades a Pedir", "Notas"]);
  }
  sheet.appendRow([
    metadata.date || new Date().toLocaleDateString("es-AR"),
    metadata.responsible || "Operador Depósito",
    metadata.month || "",
    metadata.criticalCount || 0,
    metadata.totalUnitsToOrder || 0,
    metadata.notes || "Carga digital desde tablet"
  ]);
}

function minMaxHeaders() {
  var headers = ["ID", "Categoría", "Material"];
  MONTHS.forEach(function (m) { headers.push("Min_" + m); headers.push("Max_" + m); });
  headers.push("Plazo_Proveedor_Dias");
  return headers;
}

// Returns id -> { months: {1: {min, max}, ...}, leadDays }
function readMinMax() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MINMAX_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var width = Math.max(sheet.getLastColumn(), 27);
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var matrix = {};
  data.forEach(function (row) {
    if (!row[0]) return;
    var months = {};
    for (var m = 1; m <= 12; m++) {
      var minCol = 3 + (m - 1) * 2;
      months[m] = { min: Number(row[minCol] || 0), max: Number(row[minCol + 1] || 0) };
    }
    var lead = row[27];
    matrix[String(row[0])] = { months: months, leadDays: lead === "" || lead == null ? null : Number(lead) };
  });
  return matrix;
}

function writeMinMax(list) {
  var headers = minMaxHeaders();
  var sheet = getSheet(MINMAX_SHEET, headers);
  var rows = list.map(function (item) {
    var row = [item.id, item.category, item.name];
    for (var m = 1; m <= 12; m++) {
      var val = (item.monthlyMinMax && item.monthlyMinMax[m]) || { min: item.minStockBase, max: item.maxStockBase };
      row.push(val.min, val.max);
    }
    row.push(item.supplierLeadTimeDays == null ? "" : item.supplierLeadTimeDays);
    return row;
  });
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return { rowsWritten: rows.length };
}

function recordPurchaseOrder(order) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet) sheet = getSheet(ORDERS_SHEET, ["Fecha", "Mes", "ID", "Material", "Unidades a Pedir"]);
  var items = (order && order.items) || [];
  var date = new Date().toLocaleString("es-AR");
  items.forEach(function (i) {
    sheet.appendRow([date, order.month || "", i.id, i.name, i.unitsToOrder]);
  });
  return { rowsWritten: items.length };
}

// Sheets may auto-convert ISO strings into dates; normalize back to ISO for comparisons
function isoOf(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  return String(value);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
