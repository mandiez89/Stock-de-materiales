/**
 * ==============================================================================
 * SCRIPT DE GOOGLE SHEETS PARA CONTROL DE STOCK MP - SUGESTIÓN
 * ==============================================================================
 * Estructura de la Planilla Google Sheets:
 * 1. Hoja "Stock_Actual":
 *    Consolidado de stock por material con fórmulas de inventario continuo (Kardex):
 *    - Bultos Movimientos Netos = SUMIF(Movimientos!C:C, A2, Movimientos!G:G)
 *    - Stock Actual (Bultos)    = Stock Inicial + Movimientos Netos
 *    - Stock Actual (Unidades)  = Stock Actual (Bultos) * Unidades x Bulto
 *    - Estado de Stock          = CRITICO / PEDIR / OPTIMO / SOBRESTOCK
 *
 * 2. Hoja "Movimientos":
 *    Libro mayor de auditoría donde se registran TODAS las cargas de stock,
 *    aperturas de bultos (-1), recepciones de pedidos y ajustes físicos con
 *    fecha y hora exacta, cantidad en bultos y unidades, responsable y remito.
 *
 * 3. Hoja "Parametros_MinMax":
 *    Matriz estacional de Mínimos y Máximos de Enero a Diciembre y plazo de entrega.
 *
 * 4. Hoja "Ordenes_Compra":
 *    Registro histórico de pedidos de compra emitidos a proveedores.
 *
 * ==============================================================================
 * Instalación:
 * 1. Abre tu Google Sheet > Extensiones > Apps Script.
 * 2. Borra el código existente y pega este archivo completo. Guarda.
 * 3. Configuración del proyecto (ícono de engranaje) > Propiedades del script:
 *      ACCESS_TOKEN = una clave larga y aleatoria (se carga una vez en la app)
 *      ADMIN_PIN    = PIN de 4 dígitos para autorizar cambios administrativos
 *      ALERT_EMAIL  = (Opcional) email(s) donde recibir alertas de stock bajo
 * 4. Implementar > Nueva implementación > Aplicación web.
 *      Ejecutar como: Yo | Quién tiene acceso: Cualquier usuario
 * 5. Copia la URL (termina en /exec) y pégala en los ajustes de la app.
 * ==============================================================================
 */

var STOCK_SHEET = "Stock_Actual";
var MOVEMENTS_SHEET = "Movimientos";
var MINMAX_SHEET = "Parametros_MinMax";
var ORDERS_SHEET = "Ordenes_Compra";
var HISTORY_SHEET = "Historial_Cargas";

var STOCK_HEADERS = [
  "ID", "Categoría", "Material", "Bultos", "Unidades x Bulto", "Total Unidades",
  "Stock Mínimo", "Stock Máximo", "Estado", "Unidades a Pedir", "Fecha Actualización",
  "Actualizado (ISO)", "Datos (JSON)"
];

var MOVEMENTS_HEADERS = [
  "ID_Movimiento", "Fecha_Hora", "ID_Material", "Material", "Categoría",
  "Tipo_Operacion", "Bultos_Movidos", "Unid_x_Bto", "Unidades_Movidas",
  "Bultos_Resultante", "Unidades_Resultante", "Responsable", "Motivo_Remito", "Timestamp_ISO"
];

var MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Menú en la barra de Google Sheets para inicializar la estructura o enviar reporte por email
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("📦 Control de Stock")
      .addItem("⚡ Inicializar / Reparar Estructura de Hojas", "setupSpreadsheetStructure")
      .addItem("🔄 Recalcular Stock desde Movimientos", "recalculateStockFromMovements")
      .addSeparator()
      .addItem("📧 Enviar Reporte de Faltantes por Email Ahora", "sendManualLowStockDigest")
      .addToUi();
  } catch (e) {
    // Modo headless / API
  }
}

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
        return json({
          success: true,
          message: "Conexión OK",
          alertEmail: props.getProperty("ALERT_EMAIL") || ""
        });

      case "VERIFY_PIN":
        return json({ success: isAdmin, error: isAdmin ? undefined : "PIN incorrecto." });

      case "GET_STATE":
        return json({ 
          success: true, 
          items: readStock(), 
          minMax: readMinMax(), 
          alertEmail: props.getProperty("ALERT_EMAIL") || "",
          serverTime: new Date().toISOString() 
        });

      case "UPDATE_STOCK":
        return withLock(function () {
          var result = upsertStock(body.items || []);
          if (body.metadata && body.metadata.logHistory) logHistory(body.metadata);
          return json({ success: true, message: "Stock actualizado en Google Sheets", details: result });
        });

      case "LOG_MOVEMENT":
        return withLock(function () {
          var result = recordMovement(body.movement);
          return json({ success: true, message: "Movimiento registrado y stock actualizado", details: result });
        });

      case "RECORD_MOVEMENTS":
        return withLock(function () {
          var result = recordMovementsBatch(body.movements || []);
          return json({ success: true, message: "Movimientos registrados en Google Sheets", details: result });
        });

      case "SETUP_STRUCTURE":
        return withLock(function () {
          var result = setupSpreadsheetStructure();
          return json({ success: true, message: "Estructura de hojas inicializada", details: result });
        });

      case "SET_ALERT_CONFIG":
        return withLock(function () {
          var cfg = body.alertConfig || {};
          if (typeof cfg.alertEmail === "string") {
            props.setProperty("ALERT_EMAIL", cfg.alertEmail.trim());
          }
          if (cfg.triggerLevel) {
            props.setProperty("ALERT_TRIGGER_LEVEL", String(cfg.triggerLevel));
          }
          if (typeof cfg.muteOrderedItems === "boolean") {
            props.setProperty("ALERT_MUTE_ORDERED", cfg.muteOrderedItems ? "true" : "false");
          }
          return json({
            success: true,
            message: "Configuración de alertas guardada en Google Sheets",
            alertEmail: props.getProperty("ALERT_EMAIL") || ""
          });
        });

      case "TEST_EMAIL_ALERT":
        return withLock(function () {
          var cfg = body.alertConfig || {};
          if (typeof cfg.alertEmail === "string" && cfg.alertEmail.trim()) {
            props.setProperty("ALERT_EMAIL", cfg.alertEmail.trim());
          }
          var emailResult = sendLowStockEmailReport(body.items || readStock(), true);
          if (!emailResult.sent) {
            return json({ success: false, error: emailResult.error || "No se pudo enviar el email de prueba." });
          }
          return json({
            success: true,
            message: "Email de alerta enviado correctamente a " + emailResult.recipient,
            details: emailResult
          });
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
  if (headers && sheet.getLastRow() < 1) {
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
  }
  return sheet;
}

// Inicializa las 4 hojas de la planilla con sus encabezados oficiales
function setupSpreadsheetStructure() {
  var sheetStock = getSheet(STOCK_SHEET, STOCK_HEADERS);
  var sheetMov = getSheet(MOVEMENTS_SHEET, MOVEMENTS_HEADERS);
  var sheetMinMax = getSheet(MINMAX_SHEET, minMaxHeaders());
  var sheetOrders = getSheet(ORDERS_SHEET, ["Fecha", "Mes", "ID", "Material", "Unidades_a_Pedir"]);

  return {
    sheets: [STOCK_SHEET, MOVEMENTS_SHEET, MINMAX_SHEET, ORDERS_SHEET],
    initialized: true
  };
}

// Lectura de stock de la hoja Stock_Actual
function readStock() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(lastCol, STOCK_HEADERS.length)).getValues();
  var items = [];

  data.forEach(function (row) {
    if (!row[0]) return;
    var extra = {};
    try { extra = row[12] ? JSON.parse(row[12]) : {}; } catch (e) { extra = {}; }

    extra.id = String(row[0]);
    extra.category = String(row[1] || extra.category || "");
    extra.name = String(row[2] || extra.name || "");
    extra.bultos = Number(row[3] || 0);
    extra.unitsPerBulto = Number(row[4] || extra.unitsPerBulto || 1);
    extra.totalUnits = Number(row[5] || (extra.bultos * extra.unitsPerBulto));
    extra.minStockAdjusted = Number(row[6] || extra.minStockAdjusted || 0);
    extra.maxStockAdjusted = Number(row[7] || extra.maxStockAdjusted || 0);
    extra.status = String(row[8] || extra.status || "OPTIMO");
    extra.unitsToOrder = Number(row[9] || extra.unitsToOrder || 0);
    extra.lastUpdated = isoOf(row[11]);
    items.push(extra);
  });
  return items;
}

// Registra un movimiento individual en la hoja Movimientos y actualiza el stock
function recordMovement(mov) {
  if (!mov || !mov.itemId) return { written: 0 };
  var sheet = getSheet(MOVEMENTS_SHEET, MOVEMENTS_HEADERS);

  var movId = String(mov.id || ("MOV-" + Date.now()));

  // DEDUPLICACIÓN ESTRICTA:
  // Si este ID de movimiento ya existe en la hoja, se descarta para evitar filas dobles por reintentos de red
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var checkCount = Math.min(lastRow - 1, 100);
    var startRow = Math.max(2, lastRow - checkCount + 1);
    var existingIds = sheet.getRange(startRow, 1, checkCount, 1).getValues();
    for (var i = 0; i < existingIds.length; i++) {
      if (String(existingIds[i][0]).trim() === movId.trim()) {
        return { movementId: movId, rowsWritten: 0, skippedDuplicate: true };
      }
    }
  }

  var dateStr = mov.dateFormatted || new Date().toLocaleString("es-AR");
  var ts = mov.timestamp || new Date().toISOString();

  var row = [
    movId,
    dateStr,
    mov.itemId,
    mov.itemName || "",
    mov.category || "",
    mov.type || "ENTRADA",
    Number(mov.bultosDelta || 0),
    Number(mov.unitsPerBulto || 1),
    Number(mov.unitsDelta || 0),
    Number(mov.newBultos != null ? mov.newBultos : 0),
    Number(mov.newUnits != null ? mov.newUnits : 0),
    mov.responsible || "Operador Depósito",
    mov.reason || "",
    ts
  ];

  sheet.appendRow(row);

  // Sincroniza la fila correspondiente en Stock_Actual
  var stockItem = {
    id: mov.itemId,
    category: mov.category,
    name: mov.itemName,
    bultos: mov.newBultos,
    unitsPerBulto: mov.unitsPerBulto,
    totalUnits: mov.newUnits,
    lastUpdated: ts
  };
  upsertStock([stockItem]);

  return { movementId: movId, rowsWritten: 1 };
}

// Registra una lista de movimientos en lote en la hoja Movimientos
function recordMovementsBatch(movements) {
  if (!Array.isArray(movements) || movements.length === 0) return { written: 0 };
  var sheet = getSheet(MOVEMENTS_SHEET, MOVEMENTS_HEADERS);

  var existingSet = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var checkCount = Math.min(lastRow - 1, 200);
    var startRow = Math.max(2, lastRow - checkCount + 1);
    var existingIds = sheet.getRange(startRow, 1, checkCount, 1).getValues();
    for (var i = 0; i < existingIds.length; i++) {
      existingSet[String(existingIds[i][0]).trim()] = true;
    }
  }

  var rows = [];
  var stockUpdates = [];

  movements.forEach(function (mov) {
    if (!mov || !mov.itemId) return;
    var movId = String(mov.id || ("MOV-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5)));
    if (existingSet[movId.trim()]) return;
    existingSet[movId.trim()] = true;

    var dateStr = mov.dateFormatted || new Date().toLocaleString("es-AR");
    var ts = mov.timestamp || new Date().toISOString();

    rows.push([
      movId,
      dateStr,
      mov.itemId,
      mov.itemName || "",
      mov.category || "",
      mov.type || "ENTRADA",
      Number(mov.bultosDelta || 0),
      Number(mov.unitsPerBulto || 1),
      Number(mov.unitsDelta || 0),
      Number(mov.newBultos != null ? mov.newBultos : 0),
      Number(mov.newUnits != null ? mov.newUnits : 0),
      mov.responsible || "Operador Depósito",
      mov.reason || "",
      ts
    ]);

    stockUpdates.push({
      id: mov.itemId,
      category: mov.category,
      name: mov.itemName,
      bultos: mov.newBultos,
      unitsPerBulto: mov.unitsPerBulto,
      totalUnits: mov.newUnits,
      lastUpdated: ts
    });
  });

  if (rows.length > 0) {
    rows.forEach(function (r) {
      sheet.appendRow(r);
    });
    if (stockUpdates.length > 0) {
      upsertStock(stockUpdates);
    }
  }

  return { rowsWritten: rows.length };
}

// Upsert en Stock_Actual asegurando que siempre gane la información más reciente
// y verificando si algún producto cayó a CRITICO o PEDIR para disparar alerta por Email
function upsertStock(items) {
  var sheet = getSheet(STOCK_SHEET, STOCK_HEADERS);
  sheet.getRange("L:L").setNumberFormat("@"); // Mantener timestamp ISO en texto plano
  var lastRow = sheet.getLastRow();
  var rowById = {};
  var storedTs = {};
  var existingRowById = {};

  if (lastRow >= 2) {
    var existing = sheet.getRange(2, 1, lastRow - 1, STOCK_HEADERS.length).getValues();
    existing.forEach(function (row, i) {
      if (!row[0]) return;
      var idStr = String(row[0]);
      rowById[idStr] = i + 2;
      storedTs[idStr] = isoOf(row[11]);
      existingRowById[idStr] = row;
    });
  }

  var written = 0, skipped = 0, today = new Date().toLocaleDateString("es-AR");
  var newlyLowItems = [];

  items.forEach(function (item) {
    var id = String(item.id);
    var ts = item.lastUpdated || new Date().toISOString();
    if (storedTs[id] && storedTs[id] > ts) { 
      skipped++; 
      return; 
    }

    var prevRow = existingRowById[id] || null;
    var prevExtra = {};
    if (prevRow && prevRow[12]) {
      try { prevExtra = JSON.parse(prevRow[12]); } catch (e) { prevExtra = {}; }
    }

    var bultos = item.bultos != null ? Number(item.bultos) : (prevRow ? Number(prevRow[3] || 0) : 0);
    var uPerBto = Number(item.unitsPerBulto || (prevRow ? prevRow[4] : 1) || 1);
    var totalUnits = item.totalUnits != null ? Number(item.totalUnits) : (bultos * uPerBto);
    var minAdj = item.minStockAdjusted != null ? Number(item.minStockAdjusted) : (prevRow ? Number(prevRow[6] || 0) : 0);
    var maxAdj = item.maxStockAdjusted != null ? Number(item.maxStockAdjusted) : (prevRow ? Number(prevRow[7] || 0) : 0);

    // Calcular estado automáticamente si el movimiento vino solo con bultos/unidades
    var status = item.status;
    if (!status && minAdj > 0) {
      if (totalUnits <= minAdj) status = "CRITICO";
      else if (totalUnits <= Math.round(minAdj * 1.25)) status = "PEDIR";
      else if (maxAdj > 0 && totalUnits > maxAdj) status = "SOBRESTOCK";
      else status = "OPTIMO";
    }
    status = status || (prevRow ? String(prevRow[8] || "OPTIMO") : "OPTIMO");

    var unitsToOrder = item.unitsToOrder != null
      ? Number(item.unitsToOrder)
      : ((status === "CRITICO" || status === "PEDIR") && maxAdj > totalUnits ? (maxAdj - totalUnits) : 0);

    var isOrdered = item.isOrdered != null ? !!item.isOrdered : !!prevExtra.isOrdered;
    // Si el stock subió respecto a cuando se pidió, se limpia automáticamente la marca de pedido
    if (isOrdered && prevExtra.orderedStockSnapshot != null && totalUnits > Number(prevExtra.orderedStockSnapshot)) {
      isOrdered = false;
    }

    var extra = {
      batches: item.batches !== undefined ? item.batches : (prevExtra.batches || null),
      isDirectUnits: item.isDirectUnits !== undefined ? !!item.isDirectUnits : !!prevExtra.isDirectUnits,
      allowDirectTotal: item.allowDirectTotal !== undefined ? !!item.allowDirectTotal : !!prevExtra.allowDirectTotal,
      isOrdered: isOrdered,
      orderedAt: isOrdered ? (item.orderedAt || prevExtra.orderedAt || null) : null,
      orderedStockSnapshot: isOrdered ? (item.orderedStockSnapshot != null ? item.orderedStockSnapshot : prevExtra.orderedStockSnapshot) : null,
      orderedUnits: isOrdered ? (item.orderedUnits != null ? item.orderedUnits : prevExtra.orderedUnits) : null
    };

    var cat = item.category || (prevRow ? prevRow[1] : "") || "";
    var name = item.name || (prevRow ? prevRow[2] : "") || "";

    var row = [
      id, cat, name, bultos, uPerBto, totalUnits,
      minAdj, maxAdj, status, unitsToOrder,
      today, ts, JSON.stringify(extra)
    ];

    if (rowById[id]) {
      sheet.getRange(rowById[id], 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowById[id] = sheet.getLastRow();
    }
    written++;

    // Evaluar si corresponde disparar alerta por email
    var prevStatus = prevRow ? String(prevRow[8] || "OPTIMO") : "OPTIMO";
    var prevUnits = prevRow ? Number(prevRow[5] || 0) : totalUnits;
    if ((status === "CRITICO" || status === "PEDIR") && !isOrdered) {
      if (prevStatus !== status || totalUnits < prevUnits) {
        newlyLowItems.push({
          id: id,
          category: cat,
          name: name,
          bultos: bultos,
          unitsPerBulto: uPerBto,
          totalUnits: totalUnits,
          minStockAdjusted: minAdj,
          maxStockAdjusted: maxAdj,
          status: status,
          unitsToOrder: unitsToOrder,
          isOrdered: isOrdered
        });
      }
    }
  });

  if (newlyLowItems.length > 0) {
    try {
      checkAndSendRealtimeEmailAlert(newlyLowItems);
    } catch (e) {
      // No interrumpir el guardado de stock si falla MailApp
    }
  }

  return { rowsWritten: written, skippedAsOlder: skipped, alertsTriggered: newlyLowItems.length };
}

// Evalúa reglas de enfriamiento (cooldown) y envía email automático cuando cae el stock
function checkAndSendRealtimeEmailAlert(lowItems) {
  var props = PropertiesService.getScriptProperties();
  var recipient = (props.getProperty("ALERT_EMAIL") || "").trim();
  if (!recipient) return;

  var triggerLevel = props.getProperty("ALERT_TRIGGER_LEVEL") || "CRITICO_AND_PEDIR";
  var muteOrdered = props.getProperty("ALERT_MUTE_ORDERED") !== "false";

  var notifiedJson = props.getProperty("ALERT_NOTIFIED_MAP") || "{}";
  var notifiedMap = {};
  try { notifiedMap = JSON.parse(notifiedJson); } catch (e) { notifiedMap = {}; }

  var toNotify = [];
  lowItems.forEach(function (item) {
    if (muteOrdered && item.isOrdered) return;
    if (triggerLevel === "CRITICO_ONLY" && item.status !== "CRITICO") return;

    var prev = notifiedMap[item.id];
    // Notificar si no fue notificado antes en este estado o si bajó de PEDIR a CRITICO
    if (!prev || (prev.status === "PEDIR" && item.status === "CRITICO") || item.totalUnits < prev.units) {
      toNotify.push(item);
      notifiedMap[item.id] = {
        status: item.status,
        units: item.totalUnits,
        at: new Date().toISOString()
      };
    }
  });

  if (toNotify.length === 0) return;

  props.setProperty("ALERT_NOTIFIED_MAP", JSON.stringify(notifiedMap));
  sendLowStockEmailReport(toNotify, false);
}

// Envía correo electrónico con tabla HTML limpia de materiales en CRITICO / PEDIR
function sendLowStockEmailReport(itemsList, isTest) {
  var props = PropertiesService.getScriptProperties();
  var recipient = (props.getProperty("ALERT_EMAIL") || "").trim();
  if (!recipient) {
    try {
      recipient = Session.getActiveUser().getEmail() || "";
    } catch (e) {
      recipient = "";
    }
  }
  if (!recipient) {
    return { sent: false, error: "No hay email configurado en ALERT_EMAIL." };
  }

  var triggerLevel = props.getProperty("ALERT_TRIGGER_LEVEL") || "CRITICO_AND_PEDIR";
  var filtered = (itemsList || []).filter(function (i) {
    if (i.isOrdered) return false;
    if (triggerLevel === "CRITICO_ONLY") return i.status === "CRITICO";
    return i.status === "CRITICO" || i.status === "PEDIR";
  });

  var subject = isTest
    ? "🔔 [PRUEBA] Alerta de Stock Bajo (" + filtered.length + " materiales a reponer) - Sugestión"
    : "⚠️ Alerta de Stock Bajo: " + filtered.length + " material(es) en estado CRÍTICO / PEDIR - Sugestión";

  var rowsHtml = filtered.map(function (item) {
    var badgeBg = item.status === "CRITICO" ? "#fee2e2" : "#fef3c7";
    var badgeColor = item.status === "CRITICO" ? "#991b1b" : "#92400e";
    return (
      "<tr>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#0f172a;'>" + (item.name || item.id) + "</td>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569;'>" + (item.category || "-") + "</td>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;'>" +
      "<span style='background:" + badgeBg + ";color:" + badgeColor + ";padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold;'>" + item.status + "</span>" +
      "</td>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:bold;'>" + Number(item.totalUnits || 0).toLocaleString("es-AR") + " un. (" + Number(item.bultos || 0) + " btos)</td>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#64748b;'>" + Number(item.minStockAdjusted || 0).toLocaleString("es-AR") + " un.</td>" +
      "<td style='padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:bold;color:#4f46e5;'>" + Number(item.unitsToOrder || 0).toLocaleString("es-AR") + " un.</td>" +
      "</tr>"
    );
  }).join("");

  var tableHtml = filtered.length > 0
    ? "<table style='width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;'>" +
      "<thead><tr style='background:#0f172a;color:#ffffff;text-align:left;'>" +
      "<th style='padding:10px 12px;'>Material</th>" +
      "<th style='padding:10px 12px;'>Categoría</th>" +
      "<th style='padding:10px 12px;text-align:center;'>Estado</th>" +
      "<th style='padding:10px 12px;text-align:right;'>Stock Actual</th>" +
      "<th style='padding:10px 12px;text-align:right;'>Mínimo Mes</th>" +
      "<th style='padding:10px 12px;text-align:right;'>Sugerido Pedir</th>" +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table>"
    : "<p style='padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;'>✓ Todos los materiales tienen stock óptimo o ya figuran con Pedido Realizado.</p>";

  var htmlBody =
    "<div style='font-family:sans-serif;max-width:680px;margin:0 auto;color:#1e293b;'>" +
    "<div style='background:#0f172a;color:#ffffff;padding:16px 20px;border-radius:10px 10px 0 0;'>" +
    "<h2 style='margin:0;font-size:17px;'>Sugestión • Control de Stock de Materia Prima</h2>" +
    "<p style='margin:4px 0 0;font-size:12px;color:#94a3b8;'>Reporte automático de materiales pendientes de reposición (excluye ítems ya pedidos)</p>" +
    "</div>" +
    "<div style='padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;'>" +
    "<p style='margin-top:0;font-size:13px;'>Se detectaron los siguientes insumos por debajo del punto de pedido:</p>" +
    tableHtml +
    "<p style='margin-top:16px;font-size:11px;color:#64748b;'>Fecha y hora: " + new Date().toLocaleString("es-AR") + " • Los materiales marcados como 'Pedido Realizado' en la app se silencian automáticamente.</p>" +
    "</div></div>";

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });

  return { sent: true, recipient: recipient, count: filtered.length };
}

function sendManualLowStockDigest() {
  var res = sendLowStockEmailReport(readStock(), false);
  try {
    SpreadsheetApp.getUi().alert(
      res.sent
        ? "Reporte enviado con éxito a: " + res.recipient + " (" + res.count + " materiales)."
        : "No se pudo enviar: " + (res.error || "Verifica la propiedad ALERT_EMAIL.")
    );
  } catch (e) {}
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

// Lee matriz de Mínimos y Máximos mensuales
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

// Guarda matriz de Mínimos y Máximos mensuales
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

// Registra órdenes de compra en Ordenes_Compra
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

// Recalcula el stock consolidado sumando todos los movimientos de la hoja Movimientos
function recalculateStockFromMovements() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var movSheet = ss.getSheetByName(MOVEMENTS_SHEET);
  var stockSheet = ss.getSheetByName(STOCK_SHEET);
  if (!movSheet || !stockSheet) {
    return { success: false, error: "Faltan hojas Movimientos o Stock_Actual" };
  }

  var movLastRow = movSheet.getLastRow();
  var stockLastRow = stockSheet.getLastRow();
  if (stockLastRow < 2) return { success: true, updated: 0 };

  // Agrupar movimientos por ID_Material
  var totals = {};
  if (movLastRow >= 2) {
    var movData = movSheet.getRange(2, 1, movLastRow - 1, MOVEMENTS_HEADERS.length).getValues();
    movData.forEach(function (row) {
      var id = String(row[2]); // Columna C: ID_Material
      if (!id) return;
      if (!totals[id]) totals[id] = { bultos: 0, units: 0, lastTs: "" };
      totals[id].bultos += Number(row[6] || 0); // Columna G: Bultos_Movidos
      totals[id].units += Number(row[8] || 0);  // Columna I: Unidades_Movidas
      var ts = isoOf(row[13]);
      if (!totals[id].lastTs || ts > totals[id].lastTs) totals[id].lastTs = ts;
    });
  }

  // Actualizar Stock_Actual
  var stockData = stockSheet.getRange(2, 1, stockLastRow - 1, STOCK_HEADERS.length).getValues();
  var updated = 0;
  stockData.forEach(function (row, idx) {
    var id = String(row[0]);
    if (!id || !totals[id]) return;

    var newBultos = Math.max(0, totals[id].bultos);
    var uPerBto = Number(row[4] || 1);
    var newUnits = totals[id].units > 0 ? totals[id].units : (newBultos * uPerBto);

    // Escribir Bultos (col D = 4) y Total Unidades (col F = 6)
    stockSheet.getRange(idx + 2, 4).setValue(newBultos);
    stockSheet.getRange(idx + 2, 6).setValue(newUnits);
    if (totals[id].lastTs) {
      stockSheet.getRange(idx + 2, 12).setValue(totals[id].lastTs);
    }
    updated++;
  });

  return { success: true, materialsUpdated: updated };
}

function isoOf(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  return String(value);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
