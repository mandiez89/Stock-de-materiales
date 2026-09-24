import { MaterialItem, MonthMinMax } from '../types';
import { computeMaterialCalculations } from '../data/initialData';

// Fields that describe the physical count / order state of an item (synced as "stock")
type StockFields = Pick<
  MaterialItem,
  | 'batches'
  | 'bultos'
  | 'unitsPerBulto'
  | 'totalUnits'
  | 'isDirectUnits'
  | 'allowDirectTotal'
  | 'isOrdered'
  | 'orderedAt'
  | 'orderedStockSnapshot'
  | 'orderedUnits'
  | 'lastUpdated'
>;

export type RemoteStockItem = { id: string } & { [K in keyof StockFields]?: StockFields[K] | null };

export type RemoteMinMax = Record<string, { months: Record<number, MonthMinMax>; leadDays: number | null }>;

/** Restores saved items over the catalog by id, so catalog changes keep existing counts. */
export function mergeSavedItems(catalog: MaterialItem[], saved: unknown): MaterialItem[] {
  if (!Array.isArray(saved)) return catalog;
  const savedById = new Map<string, MaterialItem>();
  for (const s of saved) {
    if (s && typeof s === 'object' && typeof (s as MaterialItem).id === 'string') {
      savedById.set((s as MaterialItem).id, s as MaterialItem);
    }
  }
  return catalog.map((item) => {
    const s = savedById.get(item.id);
    return s ? { ...item, ...s } : item;
  });
}

/**
 * Recomputes derived stock fields after an edit and clears the "ordered" flag once
 * stock went up (material arrived), so raw state and every view agree.
 */
export function normalizeRawItem(item: MaterialItem, monthNumber: number): MaterialItem {
  const c = computeMaterialCalculations(item, 1, monthNumber);
  return {
    ...item,
    bultos: c.bultos,
    totalUnits: c.totalUnits,
    isOrdered: c.isOrdered,
    orderedAt: c.orderedAt,
    orderedStockSnapshot: c.orderedStockSnapshot,
  };
}

const isNewer = (a?: string, b?: string) => !!a && (!b || a > b);

/**
 * Applies stock from Google Sheets. Remote wins only when it is newer and the item has
 * no local edits waiting to be sent.
 */
export function applyRemoteStock(
  local: MaterialItem[],
  remote: RemoteStockItem[],
  dirtyIds: ReadonlySet<string>
): { items: MaterialItem[]; changed: number } {
  const byId = new Map(remote.map((r) => [String(r.id), r]));
  let changed = 0;
  const items = local.map((item) => {
    const r = byId.get(item.id);
    if (!r || dirtyIds.has(item.id) || !isNewer(r.lastUpdated ?? undefined, item.lastUpdated)) return item;
    changed++;
    const next: MaterialItem = { ...item };
    (Object.keys(r) as (keyof RemoteStockItem)[]).forEach((key) => {
      if (key === 'id') return;
      // null from the sheet means "not set"
      (next as any)[key] = r[key] === null ? undefined : r[key];
    });
    if (next.batches === undefined) delete next.batches;
    return next;
  });
  return { items, changed };
}

/** Applies the per-month min/max matrix (and supplier lead time) read from Google Sheets. */
export function applyRemoteMinMax(local: MaterialItem[], matrix: RemoteMinMax | null | undefined): MaterialItem[] {
  if (!matrix) return local;
  return local.map((item) => {
    const r = matrix[item.id];
    if (!r) return item;
    return {
      ...item,
      monthlyMinMax: r.months,
      supplierLeadTimeDays: r.leadDays ?? item.supplierLeadTimeDays,
    };
  });
}

/** Takes only the min/max configuration from edited items, leaving stock untouched. */
export function mergeMinMaxEdits(local: MaterialItem[], edited: MaterialItem[]): MaterialItem[] {
  const byId = new Map(edited.map((e) => [e.id, e]));
  return local.map((item) => {
    const e = byId.get(item.id);
    return e ? { ...item, monthlyMinMax: e.monthlyMinMax, supplierLeadTimeDays: e.supplierLeadTimeDays } : item;
  });
}
