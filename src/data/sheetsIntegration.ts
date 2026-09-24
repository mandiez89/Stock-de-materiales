// Source lives in apps-script/Code.gs so it can be edited as real code
import appsScriptSource from '../../apps-script/Code.gs?raw';

export const GOOGLE_APPS_SCRIPT_TEMPLATE: string = appsScriptSource;

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

