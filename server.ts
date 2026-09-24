import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Server-side persisted state file
const DB_FILE = path.join(process.cwd(), "server_data.json");

interface ServerState {
  items: Record<string, any>;
  orders: Array<{
    id: string;
    itemId: string;
    name: string;
    unitsToOrder: number;
    orderedAt: string;
    month?: string;
  }>;
  minMax?: any;
  lastUpdated: string;
}

function loadServerState(): ServerState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading server state:", err);
  }
  return { items: {}, orders: [], minMax: null, lastUpdated: new Date().toISOString() };
}

let serverState = loadServerState();

function saveServerState() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(serverState, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing server state:", err);
  }
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET Shared Database State (so any connected device gets the live stock & orders)
app.get("/api/shared-state", (_req, res) => {
  res.json({
    success: true,
    items: Object.values(serverState.items),
    orders: serverState.orders,
    minMax: serverState.minMax,
    lastUpdated: serverState.lastUpdated,
  });
});

// POST Mark Order directly into the shared database and optionally forward to Google Sheets
app.post("/api/mark-order", async (req, res) => {
  try {
    const { itemId, itemName, isOrdered, orderedUnits, orderedStockSnapshot, orderedAt, month, webhookUrl, accessToken } = req.body;

    const ts = new Date().toISOString();
    const existing = serverState.items[itemId] || { id: itemId };

    existing.id = itemId;
    if (itemName) existing.name = itemName;
    existing.isOrdered = !!isOrdered;
    existing.orderedAt = isOrdered ? (orderedAt || ts) : null;
    existing.orderedUnits = isOrdered ? (orderedUnits ?? 0) : null;
    existing.orderedStockSnapshot = isOrdered ? (orderedStockSnapshot ?? existing.totalUnits ?? null) : null;
    existing.lastUpdated = ts;
    serverState.items[itemId] = existing;

    // Keep active orders list clean and up to date
    serverState.orders = (serverState.orders || []).filter((o) => o.itemId !== itemId);
    if (isOrdered) {
      serverState.orders.unshift({
        id: `ord-${Date.now()}-${itemId}`,
        itemId,
        name: itemName || existing.name || itemId,
        unitsToOrder: orderedUnits || 0,
        orderedAt: orderedAt || ts,
        month: month || "",
      });
    }

    serverState.lastUpdated = ts;
    saveServerState();

    // If Google Apps Script webhook is provided, forward immediately
    if (typeof webhookUrl === "string" && webhookUrl.startsWith("https://script.google.com/")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "UPDATE_STOCK",
            token: accessToken,
            items: [existing],
          }),
          redirect: "follow",
        });

        if (isOrdered) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "LOG_ORDER",
              token: accessToken,
              order: {
                month: month || "",
                items: [{ id: itemId, name: itemName || existing.name || itemId, unitsToOrder: orderedUnits || 0 }],
              },
            }),
            redirect: "follow",
          });
        }
      } catch (webhookErr) {
        console.warn("Could not forward to Google Sheets:", webhookErr);
      }
    }

    res.json({
      success: true,
      message: isOrdered ? "Pedido guardado en la base de datos" : "Estado de pedido actualizado en la base de datos",
      item: existing,
      orders: serverState.orders,
      lastUpdated: serverState.lastUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Mark Multiple Orders in Batch (e.g. from Purchase Order modal)
app.post("/api/mark-orders-batch", async (req, res) => {
  try {
    const { orders: batchOrders, webhookUrl, accessToken } = req.body;
    if (!Array.isArray(batchOrders) || batchOrders.length === 0) {
      return res.status(400).json({ success: false, error: "No se proporcionaron pedidos para registrar." });
    }

    const ts = new Date().toISOString();
    const updatedItems: any[] = [];
    const loggedOrders: any[] = [];

    batchOrders.forEach((bo: any) => {
      if (!bo || !bo.itemId) return;
      const itemId = bo.itemId;
      const existing = serverState.items[itemId] || { id: itemId };
      existing.id = itemId;
      if (bo.itemName) existing.name = bo.itemName;
      existing.isOrdered = bo.isOrdered !== false;
      existing.orderedAt = existing.isOrdered ? (bo.orderedAt || ts) : null;
      existing.orderedUnits = existing.isOrdered ? (bo.orderedUnits ?? 0) : null;
      existing.orderedStockSnapshot = existing.isOrdered ? (bo.orderedStockSnapshot ?? existing.totalUnits ?? null) : null;
      existing.lastUpdated = ts;
      serverState.items[itemId] = existing;
      updatedItems.push(existing);

      serverState.orders = (serverState.orders || []).filter((o) => o.itemId !== itemId);
      if (existing.isOrdered) {
        const orderEntry = {
          id: `ord-${Date.now()}-${itemId}`,
          itemId,
          name: bo.itemName || existing.name || itemId,
          unitsToOrder: bo.orderedUnits || 0,
          orderedAt: bo.orderedAt || ts,
          month: bo.month || "",
        };
        serverState.orders.unshift(orderEntry);
        loggedOrders.push(orderEntry);
      }
    });

    serverState.lastUpdated = ts;
    saveServerState();

    // Forward batch to Google Sheets if configured
    if (typeof webhookUrl === "string" && webhookUrl.startsWith("https://script.google.com/")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "UPDATE_STOCK",
            token: accessToken,
            items: updatedItems,
          }),
          redirect: "follow",
        });

        if (loggedOrders.length > 0) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "LOG_ORDER",
              token: accessToken,
              order: {
                month: batchOrders[0]?.month || "",
                items: loggedOrders.map((o) => ({ id: o.itemId, name: o.name, unitsToOrder: o.unitsToOrder })),
              },
            }),
            redirect: "follow",
          });
        }
      } catch (webhookErr) {
        console.warn("Could not forward batch to Google Sheets:", webhookErr);
      }
    }

    res.json({
      success: true,
      message: `${updatedItems.length} pedidos guardados exitosamente en la base de datos`,
      count: updatedItems.length,
      orders: serverState.orders,
      lastUpdated: serverState.lastUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Sync stock counts to central server database
app.post("/api/sync-stock", (req, res) => {
  try {
    const { items } = req.body;
    if (Array.isArray(items) && items.length > 0) {
      const ts = new Date().toISOString();
      items.forEach((item: any) => {
        if (item && item.id) {
          serverState.items[item.id] = {
            ...(serverState.items[item.id] || {}),
            ...item,
            lastUpdated: item.lastUpdated || ts,
          };
        }
      });
      serverState.lastUpdated = ts;
      saveServerState();
    }
    res.json({
      success: true,
      message: "Stock guardado en base de datos central",
      count: items?.length || 0,
      lastUpdated: serverState.lastUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sincronización o proxy a Google Sheets Webhook + guarda en base de datos del servidor
app.post("/api/sync-sheets", async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;

    // Save received items into server database
    if (payload?.items && Array.isArray(payload.items)) {
      payload.items.forEach((item: any) => {
        if (item && item.id) {
          serverState.items[item.id] = {
            ...(serverState.items[item.id] || {}),
            ...item,
          };
        }
      });
      serverState.lastUpdated = new Date().toISOString();
      saveServerState();
    }

    // Only forward to Google Apps Script, otherwise this is an open proxy
    if (typeof webhookUrl === "string" && webhookUrl.startsWith("https://script.google.com/")) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      const data = await response.json();
      return res.json({ success: true, forward: true, data });
    }

    // Default response acknowledging payload saved to server DB
    res.json({
      success: true,
      forward: false,
      message: "Datos guardados en la base de datos central",
      syncedCount: payload?.items?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
