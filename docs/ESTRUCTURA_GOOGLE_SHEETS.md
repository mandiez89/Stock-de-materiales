# Estructura Oficial de Google Sheets para Control de Stock MP - Sugestión

Este documento detalla la arquitectura recomendada para tu planilla de Google Sheets. El sistema está diseñado bajo el principio de **Inventario Continuo (Kardex)**:
1. El **Historial de Movimientos** se almacena exclusivamente en la hoja `Movimientos` con fecha y hora exacta.
2. El **Stock Actual** se calcula automáticamente a partir de esos movimientos mediante fórmulas nativas de Google Sheets.

---

## 📋 Las 4 Hojas de tu Planilla

Tu archivo de Google Sheets se organiza en 4 hojas de trabajo:

```
[Mi_Planilla_Stock_MP]
  ├── 1. Stock_Actual         <-- Consolidado en tiempo real calculado por fórmulas
  ├── 2. Movimientos          <-- Libro mayor / Historial de todas las cargas y descuentos
  ├── 3. Parametros_MinMax    <-- Matriz estacional de mínimos/máximos mensuales
  └── 4. Ordenes_Compra       <-- Registro de órdenes emitidas a proveedores
```

---

## 1. Hoja: `Stock_Actual` (Consolidado y Existencias)

Contiene una fila por cada material (33 ítems del catálogo). Las columnas de stock **NO se editan a mano**: se calculan automáticamente sumando los movimientos.

### Columnas y Encabezados:
| Columna | Encabezado | Tipo | Descripción |
|---|---|---|---|
| **A** | `ID` | Texto | Código único del material (`caja-1`, `cel-alf`, etc.) |
| **B** | `Categoría` | Texto | `Cajas`, `Celofanes`, `Bolsitas`, `Caballetes`, `Cartones` |
| **C** | `Material` | Texto | Nombre descriptivo del producto |
| **D** | `Unidades x Bulto` | Número | Cantidad de unidades por bulto cerrado |
| **E** | `Stock Inicial (Bultos)` | Número | Recuento físico base (inventario inicial) |
| **F** | `Movimientos Netos (Bultos)` | **Fórmula** | Suma algebraica de movimientos |
| **G** | `Stock Actual (Bultos)` | **Fórmula** | Stock Inicial + Movimientos |
| **H** | `Total Unidades` | **Fórmula** | Bultos actuales × Unidades x Bulto |
| **I** | `Stock Mínimo` | Número / Ref | Mínimo de seguridad para el mes |
| **J** | `Stock Máximo` | Número / Ref | Máximo de almacenamiento |
| **K** | `Estado` | **Fórmula** | `CRITICO`, `PEDIR`, `OPTIMO` o `SOBRESTOCK` |
| **L** | `Unidades a Pedir` | **Fórmula** | Unidades faltantes para llegar al stock máximo |
| **M** | `Última Fecha` | **Fórmula** | Fecha y hora del último movimiento |
| **N** | `Actualizado (ISO)` | Texto | Timestamp de sincronización |
| **O** | `Datos (JSON)` | Texto | Partidas múltiples y metadatos técnicos |

### Fórmulas exactas para la fila 2 (arrastrables hacia abajo):

* **Columna F (Movimientos Netos en Bultos):**
  ```excel
  =SUMAR.SI(Movimientos!$C:$C; A2; Movimientos!$G:$G)
  ```
  *(En inglés: `=SUMIF(Movimientos!$C:$C, A2, Movimientos!$G:$G)`)*

* **Columna G (Stock Actual en Bultos):**
  ```excel
  =E2 + F2
  ```

* **Columna H (Total Unidades):**
  ```excel
  =G2 * D2
  ```

* **Columna K (Estado de Stock):**
  ```excel
  =SI(H2<=I2/2; "CRITICO"; SI(H2<=I2; "PEDIR"; SI(H2>J2*1.25; "SOBRESTOCK"; "OPTIMO")))
  ```
  *(En inglés: `=IF(H2<=I2/2, "CRITICO", IF(H2<=I2, "PEDIR", IF(H2>J2*1.25, "SOBRESTOCK", "OPTIMO")))`)*

* **Columna L (Unidades a Pedir):**
  ```excel
  =SI(O(K2="CRITICO"; K2="PEDIR"); MAX(0; J2 - H2); 0)
  ```

* **Columna M (Última Fecha y Hora de Carga):**
  ```excel
  =SI.ERROR(MAXIFS(Movimientos!$B:$B; Movimientos!$C:$C; A2); "-")
  ```

---

## 2. Hoja: `Movimientos` (Libro Mayor Kardex Auditado)

Esta hoja es el **historial cronológico completo**. Cada vez que en la tablet o en el sistema se abre un bulto (`-1`), se carga stock (`+1`, `+5`, `+10`), llega un pedido o se hace un recuento físico, se añade automáticamente una fila aquí.

### Columnas y Encabezados:
| Col | Encabezado | Ejemplo | Significado |
|---|---|---|---|
| **A** | `ID_Movimiento` | `MOV-1727611200-ab12` | Identificador único del evento |
| **B** | `Fecha_Hora` | `29/09/2026 10:15:30` | Fecha y hora exacta registrada |
| **C** | `ID_Material` | `cel-alf` | Código que vincula con `Stock_Actual!A` |
| **D** | `Material` | `Celofán Alfajor 12x12` | Nombre para lectura visual inmediata |
| **E** | `Categoría` | `Celofanes` | Familia de producto |
| **F** | `Tipo_Operacion` | `ENTRADA` / `ABRIR_BULTO` / `RECEPCION_PEDIDO` / `AJUSTE` | Operación realizada |
| **G** | `Bultos_Movidos` | `+5` ó `-1` ó `+10` | Variación en bultos (Positivo = entra, Negativo = sale) |
| **H** | `Unid_x_Bto` | `1000` | Unidades por bulto del material |
| **I** | `Unidades_Movidas`| `+5000` ó `-1000` | Variación en unidades (`G × H`) |
| **J** | `Bultos_Resultante`| `15` | Stock de bultos tras la operación |
| **K** | `Unidades_Resultante`| `15000` | Stock de unidades tras la operación |
| **L** | `Responsable` | `Operador Depósito` | Usuario / operador que ejecutó la acción |
| **M** | `Motivo_Remito` | `Carga rápida fábrica / Remito 8421` | Nota, remito o motivo del movimiento |
| **N** | `Timestamp_ISO` | `2026-09-29T13:15:30.000Z` | Formato universal para ordenamiento |

### Formato Condicional Recomendado para la Hoja `Movimientos`:
* **Columna G (Bultos_Movidos):**
  * Si es `> 0`: Fondo verde claro (`#dcfce7`), texto verde oscuro (`#166534`).
  * Si es `< 0`: Fondo rojo/rosa claro (`#ffe4e6`), texto rojo oscuro (`#9f1239`).

---

## 3. Hoja: `Parametros_MinMax` (Estacionalidad Mensual)

Permite que el stock mínimo y máximo varíe de acuerdo a la demanda de cada mes (ej. temporada alta en Pascua o Día de la Madre).

### Encabezados:
`ID`, `Categoría`, `Material`, `Min_Ene`, `Max_Ene`, `Min_Feb`, `Max_Feb`, ..., `Min_Dic`, `Max_Dic`, `Plazo_Proveedor_Dias`

---

## 4. Hoja: `Ordenes_Compra` (Historial de Compras)

Registro de cada pedido enviado a proveedores con:
* `Fecha`, `Mes`, `ID`, `Material`, `Unidades_a_Pedir`

---

## 🚀 Inicialización Automática con Apps Script

No tienes que crear las hojas a mano una por una:
1. En tu Google Sheet, ve a **Extensiones > Apps Script**.
2. Pega el código de `apps-script/Code.gs` y guarda.
3. Al recargar la planilla, aparecerá un menú arriba llamado **"📦 Control de Stock"**.
4. Haz clic en **"⚡ Inicializar / Reparar Estructura de Hojas"** y el script creará las hojas automáticamente con todos los encabezados y formatos.
