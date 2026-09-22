export interface OrderItemData {
  name: string;
  unitsToOrder: number;
}

/**
 * Genera el texto formal para solicitar cotización y reposición de un material individual.
 */
export function formatSingleOrderItemText(item: OrderItemData): string {
  return `Estimados,

Solicito cotización y reposición del siguiente material:

Producto: ${item.name}
Cantidad solicitada: ${item.unitsToOrder.toLocaleString('es-AR')} unidades

Les agradecería confirmar:
- Cotización
- Plazo estimado de entrega

Quedo atento a su respuesta.

Muchas gracias.`;
}

/**
 * Genera el texto formal para solicitar cotización y reposición de una lista de materiales.
 * Si es un único material, respeta la redacción singular. Si son varios, los lista ordenadamente.
 */
export function formatMultipleOrdersText(items: OrderItemData[]): string {
  if (items.length === 0) return '';
  
  if (items.length === 1) {
    return formatSingleOrderItemText(items[0]);
  }

  const productsBlock = items
    .map(
      (item) =>
        `Producto: ${item.name}\nCantidad solicitada: ${item.unitsToOrder.toLocaleString('es-AR')} unidades`
    )
    .join('\n\n');

  return `Estimados,

Solicito cotización y reposición de los siguientes materiales:

${productsBlock}

Les agradecería confirmar:
- Cotización
- Plazo estimado de entrega

Quedo atento a su respuesta.

Muchas gracias.`;
}
