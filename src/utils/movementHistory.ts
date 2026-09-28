import { StockMovement } from '../types';

export function formatMovementDate(dateOrIso?: string | Date): string {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatMovementShortDate(dateOrIso?: string | Date): string {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatMovementTimeOnly(dateOrIso?: string | Date): string {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatMovementRelative(dateOrIso?: string | Date): string {
  const d = dateOrIso ? new Date(dateOrIso) : new Date();
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return 'Recién';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Hace instantes';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatMovementShortDate(d);
}

export function generateMovementId(): string {
  return `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function exportMovementsToCSV(movements: StockMovement[]): string {
  const headers = [
    'ID',
    'Fecha y Hora',
    'Material',
    'Categoría',
    'Tipo Movimiento',
    'Bultos Movidos',
    'Unidades Movidas',
    'Bultos Anteriores',
    'Bultos Nuevos',
    'Stock Anterior (Unidades)',
    'Stock Nuevo (Unidades)',
    'Responsable',
    'Motivo / Nota',
  ];

  const escapeCSV = (value: unknown): string => {
    const str = String(value ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = movements.map((m) => [
    escapeCSV(m.id),
    escapeCSV(m.dateFormatted || formatMovementDate(m.timestamp)),
    escapeCSV(m.itemName),
    escapeCSV(m.category),
    escapeCSV(m.type),
    m.bultosDelta > 0 ? `+${m.bultosDelta}` : `${m.bultosDelta}`,
    m.unitsDelta > 0 ? `+${m.unitsDelta}` : `${m.unitsDelta}`,
    m.previousBultos,
    m.newBultos,
    m.previousUnits,
    m.newUnits,
    escapeCSV(m.responsible),
    escapeCSV(m.reason || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// Initial movements based on typical warehouse operation in packaging
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-init-1',
    itemId: 'caja-1',
    itemName: 'Caja 1 Bombones',
    category: 'Cajas',
    type: 'ABRIR_BULTO',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
    dateFormatted: formatMovementDate(new Date(Date.now() - 35 * 60 * 1000)),
    bultosDelta: -1,
    unitsDelta: -500,
    previousBultos: 15,
    newBultos: 14,
    previousUnits: 7500,
    newUnits: 7000,
    unitsPerBulto: 500,
    responsible: 'Operador Depósito',
    reason: 'Apertura de bulto para línea de empaque',
  },
  {
    id: 'mov-init-2',
    itemId: 'cel-alf',
    itemName: 'Celofán Alfajor 12x12',
    category: 'Celofanes',
    type: 'ENTRADA',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    dateFormatted: formatMovementDate(new Date(Date.now() - 3 * 3600 * 1000)),
    bultosDelta: 5,
    unitsDelta: 5000,
    previousBultos: 5,
    newBultos: 10,
    previousUnits: 5000,
    newUnits: 10000,
    unitsPerBulto: 1000,
    responsible: 'Operador Depósito',
    reason: 'Carga rápida (+5 btos) - Recepción de fábrica',
  },
  {
    id: 'mov-init-3',
    itemId: 'bol-15x25',
    itemName: 'Bolsita Polipropileno 15x25',
    category: 'Bolsitas',
    type: 'ABRIR_BULTO',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hours ago
    dateFormatted: formatMovementDate(new Date(Date.now() - 5 * 3600 * 1000)),
    bultosDelta: -1,
    unitsDelta: -1000,
    previousBultos: 8,
    newBultos: 7,
    previousUnits: 8000,
    newUnits: 7000,
    unitsPerBulto: 1000,
    responsible: 'Operador Depósito',
    reason: 'Apertura para fraccionamiento',
  },
  {
    id: 'mov-init-4',
    itemId: 'cab-1300',
    itemName: 'Caballete 1300',
    category: 'Caballetes',
    type: 'ENTRADA',
    timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), // Yesterday
    dateFormatted: formatMovementDate(new Date(Date.now() - 26 * 3600 * 1000)),
    bultosDelta: 1,
    unitsDelta: 525,
    previousBultos: 17,
    newBultos: 18,
    previousUnits: 8925,
    newUnits: 9450,
    unitsPerBulto: 525,
    responsible: 'Administrador',
    reason: 'Entrada de 1 bulto cerrado',
  },
  {
    id: 'mov-init-5',
    itemId: 'caja-2',
    itemName: 'Caja 2 Especial',
    category: 'Cajas',
    type: 'AJUSTE',
    timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 days ago
    dateFormatted: formatMovementDate(new Date(Date.now() - 48 * 3600 * 1000)),
    bultosDelta: -2,
    unitsDelta: -700,
    previousBultos: 8,
    newBultos: 6,
    previousUnits: 2800,
    newUnits: 2100,
    unitsPerBulto: 350,
    responsible: 'Administrador',
    reason: 'Ajuste por recuento físico mensual',
  },
];
