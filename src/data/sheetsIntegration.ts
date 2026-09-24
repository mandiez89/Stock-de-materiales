// Source lives in apps-script/Code.gs so it can be edited as real code
import appsScriptSource from '../../apps-script/Code.gs?raw';

export const GOOGLE_APPS_SCRIPT_TEMPLATE: string = appsScriptSource;

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

