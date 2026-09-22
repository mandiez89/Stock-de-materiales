export type MaterialCategory = 'Cajas' | 'Celofanes' | 'Bolsitas' | 'Caballetes' | 'Cartones';

export type MaterialStatus = 'CRITICO' | 'PEDIR' | 'OPTIMO' | 'SOBRESTOCK';

export type UserRole = 'operator' | 'admin';

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

export interface InventoryRecord {
  id: string;
  date: string;
  responsible: string;
  periodName: string;
  totalItems: number;
  criticalCount: number;
  reorderCount: number;
  totalBultosToOrder: number;
  items: MaterialItem[];
  notes?: string;
}

export interface GoogleSheetsConfig {
  sheetUrl: string;
  spreadsheetId: string;
  sheetTab: string;
  scriptWebhookUrl: string;
  autoSync: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'connected' | 'error';
}

