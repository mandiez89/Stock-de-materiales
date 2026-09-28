export type MaterialCategory = 'Cajas' | 'Celofanes' | 'Bolsitas' | 'Caballetes' | 'Cartones';

export type MaterialStatus = 'CRITICO' | 'PEDIR' | 'OPTIMO' | 'SOBRESTOCK';

export type UserRole = 'operator' | 'admin';

export type MovementType = 'ENTRADA' | 'ABRIR_BULTO' | 'SALIDA' | 'AJUSTE' | 'RECEPCION_PEDIDO';

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  category: MaterialCategory;
  type: MovementType;
  timestamp: string; // ISO 8601 string: e.g. "2026-09-28T16:15:30.000Z"
  dateFormatted: string; // e.g. "28/09/2026, 16:15:30"
  bultosDelta: number; // e.g. -1, +1, +5
  unitsDelta: number; // e.g. -500, +500, +2500
  previousBultos: number;
  newBultos: number;
  previousUnits: number;
  newUnits: number;
  unitsPerBulto: number;
  batchId?: string;
  responsible: string; // "Operador Depósito" | "Administrador"
  reason?: string; // e.g. "Apertura para empaque", "Entrada de stock (+1 bto)", "Recuento manual", etc.
}

export interface MonthMinMax {
  min: number;
  max: number;
}

export interface BultoBatch {
  id: string;
  bultos: number;
  unitsPerBulto: number;
  label?: string;
}

export interface MaterialItem {
  id: string;
  category: MaterialCategory;
  name: string;
  bultos: number;
  unitsPerBulto: number;
  totalUnits: number;
  // Multiple batch lines for products with diverse package quantities (e.g. 30 de 65 un. y 15 de 85 un.)
  batches?: BultoBatch[];
  isDirectUnits?: boolean; // True if loaded directly in total units without bultos
  allowDirectTotal?: boolean; // Controls whether user has explicitly unlocked direct total entry
  minStockBase: number;
  maxStockBase: number;
  // Supplier lead time in days for reorder point calculation
  supplierLeadTimeDays?: number;
  // Order tracking status (when purchase order is placed)
  isOrdered?: boolean;
  orderedAt?: string;
  orderedStockSnapshot?: number; // Stock at time of ordering, auto-clears when stock increases
  orderedUnits?: number;
  // Specific min/max configured for each month (1 to 12) directly or via Google Sheets
  monthlyMinMax?: Record<number, MonthMinMax>;
  minStockAdjusted: number;
  maxStockAdjusted: number;
  unitsToOrder: number;
  bultosToOrder: number;
  status: MaterialStatus;
  notes?: string;
  lastUpdated?: string;
}

export interface MonthlyFactor {
  month: number;
  name: string;
  shortName: string;
  factor: number;
  seasonName: string;
  description: string;
}

