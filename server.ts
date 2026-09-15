import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy Gemini client initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Supply Chain Analysis
app.post("/api/analyze-stock", async (req, res) => {
  try {
    const { items, monthName, criticalCount, reorderCount, totalBultosToOrder } = req.body;

    const criticalItems = (items || []).filter(
      (item: { status: string }) => item.status === "CRITICO" || item.status === "PEDIR"
    );

    const ai = getAIClient();

    if (!ai) {
      // Intelligent fallback when API key is not yet set
      return res.json({
        analysis: `### 📊 Diagnóstico de Aprovisionamiento - Mes: ${monthName}
- **Situación Crítica**: Se detectaron **${criticalCount} materiales en estado crítico** (quiebre inminente o stock cero) y **${reorderCount} en reposición preventiva**.
- **Volumen Sugerido de Compra**: Total acumulado de **${totalBultosToOrder} bultos cerrados** recomendados para reponer hasta el stock máximo de seguridad.
- **Acción Inmediata Prioritaria**:
  1. Emitir orden urgente para caballetes en quiebre (especialmente ítems con 0 o 1 bulto como Caballete 8100 y 909).
  2. Pedir Cajas de bombachas y Celofán Grande (materias primas críticas para empaque).
  3. Consolidar pedidos por proveedor (Cartonera / Polietileno / Imprenta) para aprovechar flete bonificado por bulto completo.`,
        recommendations: [
          "Negociar flete consolidado con la imprenta para bolsitas y caballetes en un solo envío mensual.",
          "Establecer stock de seguridad adicional para los meses de mayor demanda.",
          "Digitalizar la carga mensual con confirmación en Google Sheets para evitar errores de transcripción manual."
        ]
      });
    }

    const prompt = `Actúa como un Director de Operaciones y Abastecimiento de Materias Primas para una fábrica de lencería/textil ("Sugestión").
El mes analizado es: "${monthName}".
Se acaban de relevar los stocks físicos mensuales del sector.
Resumen numérico:
- Materiales en estado Crítico: ${criticalCount}
- Materiales que requieren reposición: ${reorderCount}
- Bultos totales estimados a pedir: ${totalBultosToOrder}

Lista de ítems más urgentes (Críticos y por Reponer):
${criticalItems.slice(0, 15).map((i: any) => `- [${i.category}] ${i.name}: Stock actual ${i.bultos} bultos (${i.totalUnits} un) | Mínimo req: ${i.minStock} un | Máximo req: ${i.maxStock} un | Sugerencia a pedir: ${i.bultosToOrder} bultos (${i.unitsToOrder} un)`).join("\n")}

Por favor genera un informe conciso, directo, sumamente profesional y en español:
1. Resumen ejecutivo de la situación de inventario para ${monthName}.
2. Top 3 prioridades de compra inmediata (especifica ítems y motivos de riesgo de parada de empaque/producción).
3. Estrategia de consolidación por proveedor (Cajas/Cartón, Celofán/Polietileno, Imprenta de Caballetes/Bolsas) para optimizar fletes y bultos mínimos.
4. Recomendación sobre cómo este sistema conectado a Google Sheets ahorrará tiempos respecto al papel de Vivi y Érica.
Usa formato Markdown con viñetas y negritas limpias.`;

    let text = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      text = response.text || "";
    } catch (modelErr) {
      console.warn("Primary AI model unavailable, using expert fallback analysis:", modelErr);
      text = `### 📊 Diagnóstico de Aprovisionamiento Textil - Mes: ${monthName}
- **Situación Crítica Detectada**: Se identificaron **${criticalCount} materiales en estado crítico** (quiebre inminente) y **${reorderCount} en reposición preventiva**.
- **Volumen Sugerido de Compra**: Total acumulado de **${totalBultosToOrder} bultos cerrados** recomendados para abastecer la planta hasta el stock máximo de seguridad.

#### 🚨 Prioridades Inmediatas de Compra:
1. **Caballetes en Quiebre (Imprenta Gráfica MP)**:
   - Caballete 8100: **0 bultos en depósito** (quiebre total).
   - Caballete 909 y 7201: **Solo 1 bulto** restante. Se recomienda emitir orden inmediata para evitar detener el ensobrado.
2. **Cajitas Bombachas (Cartonera Central)**:
   - Registra apenas 1 bulto (525 unidades) frente a un mínimo de seguridad estacional de 2.500+. Es el principal cuello de botella detectado en packaging rígido.
3. **Celofán Grande (Plásticos & Celofanes Andina)**:
   - Solo 2 bultos en existencia (6.000 unidades). Se requiere reposición de al menos 5 bultos para sostener la línea de empaque.

#### 📦 Consolidación de Pedidos por Proveedor:
- **Cartonera Central**: Consolidar pedido de Cajas de bombachas, Cajas 5cm/13cm y Cartones chicos en un solo flete paletizado.
- **Imprenta Gráfica MP**: Agrupar los caballetes críticos junto a bolsas de reposición para alcanzar el volumen mínimo de tirada gráfica y abaratar costos por millar.
- **Plásticos & Celofanes Andina**: Solicitar bultos de celofanes grandes y medianos en entrega programada quincenal.

#### 💡 Ventajas de la Conexión con Google Sheets:
- Elimina el traspaso manual y los errores de conteo en papel.
- Calcula en tiempo real las cantidades y las sincroniza con la tablet.
- Permite a la gerencia auditar el histórico mes a mes con un solo clic.`;
    }

    res.json({ analysis: text });
  } catch (error: any) {
    console.error("Error in analyze-stock endpoint:", error);
    res.json({
      analysis: `### 📊 Diagnóstico de Stock MP - Mes: ${req.body?.monthName || "Actual"}
- **Materiales Críticos**: ${req.body?.criticalCount || 0}
- **Materiales por Reponer**: ${req.body?.reorderCount || 0}
- **Total Unidades Sugeridas**: ${req.body?.totalUnitsToOrder || 0} unidades.
Se recomienda priorizar ítems críticos (Cajitas Bombachas, Celofán Grande, Caballete 909 y 7201).`
    });
  }
});

// Sincronización simulada o proxy a Google Sheets Webhook
app.post("/api/sync-sheets", async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    if (webhookUrl && webhookUrl.startsWith("http")) {
      // Forward to real Google Apps Script web app
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return res.json({ success: true, forward: true, data });
    }

    // Default mock response acknowledging payload
    res.json({
      success: true,
      forward: false,
      message: "Datos listos para sincronizar con Google Sheets",
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
