import { describe, expect, it } from 'vitest';
import { computeMaterialCalculations, computeStockStatus } from '../src/data/initialData';
import {
  applyRemoteMinMax,
  applyRemoteStock,
  mergeMinMaxEdits,
  mergeSavedItems,
  normalizeRawItem,
} from '../src/state/stockState';
import { MaterialItem } from '../src/types';

const base = (over: Partial<MaterialItem> = {}): MaterialItem => ({
  id: 'a',
  category: 'Cajas',
  name: 'Caja A',
  bultos: 10,
  unitsPerBulto: 100,
  totalUnits: 1000,
  minStockBase: 1000,
  maxStockBase: 3000,
  minStockAdjusted: 0,
  maxStockAdjusted: 0,
  unitsToOrder: 0,
  bultosToOrder: 0,
  status: 'OPTIMO',
  ...over,
});

describe('computeStockStatus', () => {
  it('flags critical at or below half of the minimum and orders up to max', () => {
    expect(computeStockStatus(500, 1000, 3000)).toEqual({ status: 'CRITICO', unitsToOrder: 2500 });
  });
  it('asks to reorder below the minimum', () => {
    expect(computeStockStatus(900, 1000, 3000)).toEqual({ status: 'PEDIR', unitsToOrder: 2100 });
  });
  it('anticipates the order with supplier lead time', () => {
    // 1000/30 per day * 15 days = 500 buffer -> reorder point 1500
    expect(computeStockStatus(1400, 1000, 3000, 15).status).toBe('PEDIR');
    expect(computeStockStatus(1600, 1000, 3000, 15).status).toBe('OPTIMO');
  });
  it('detects overstock above 125% of max', () => {
    expect(computeStockStatus(3800, 1000, 3000)).toEqual({ status: 'SOBRESTOCK', unitsToOrder: 0 });
  });
  it('does not flag items without a configured minimum', () => {
    expect(computeStockStatus(0, 0, 0)).toEqual({ status: 'OPTIMO', unitsToOrder: 0 });
  });
});

describe('computeMaterialCalculations', () => {
  it('sums every batch and rounds bultos to order up with the first batch size', () => {
    const item = base({
      batches: [
        { id: 'b1', bultos: 2, unitsPerBulto: 100 },
        { id: 'b2', bultos: 3, unitsPerBulto: 50 },
      ],
    });
    const c = computeMaterialCalculations(item, 1, 9);
    expect(c.totalUnits).toBe(350);
    expect(c.bultos).toBe(5);
    expect(c.status).toBe('CRITICO');
    expect(c.unitsToOrder).toBe(2650);
    expect(c.bultosToOrder).toBe(27);
  });
  it('uses the month-specific min/max when present', () => {
    const item = base({ monthlyMinMax: { 9: { min: 1500, max: 8000 } } });
    const c = computeMaterialCalculations(item, 1, 9);
    expect(c.minStockAdjusted).toBe(1500);
    expect(c.status).toBe('PEDIR');
  });
  it('keeps a directly loaded total instead of the batch sum', () => {
    const item = base({ isDirectUnits: true, totalUnits: 1234, batches: [{ id: 'b1', bultos: 1, unitsPerBulto: 100 }] });
    expect(computeMaterialCalculations(item, 1, 9).totalUnits).toBe(1234);
  });
});

describe('normalizeRawItem', () => {
  it('clears the ordered flag once stock went up', () => {
    const item = base({ isOrdered: true, orderedAt: 'x', orderedStockSnapshot: 900 });
    const n = normalizeRawItem(item, 9);
    expect(n.isOrdered).toBe(false);
    expect(n.orderedStockSnapshot).toBeUndefined();
  });
});

describe('mergeSavedItems', () => {
  it('keeps saved counts by id and adds new catalog items', () => {
    const catalog = [base({ id: 'a' }), base({ id: 'new', bultos: 7 })];
    const merged = mergeSavedItems(catalog, [{ ...base({ id: 'a', bultos: 99 }) }, base({ id: 'removed' })]);
    expect(merged.map((i) => [i.id, i.bultos])).toEqual([
      ['a', 99],
      ['new', 7],
    ]);
  });
  it('ignores garbage', () => {
    const catalog = [base()];
    expect(mergeSavedItems(catalog, 'nope')).toBe(catalog);
  });
});

describe('applyRemoteStock', () => {
  const local = [base({ id: 'a', bultos: 1, lastUpdated: '2026-09-01T10:00:00.000Z' })];

  it('takes newer remote stock and maps null to undefined', () => {
    const { items, changed } = applyRemoteStock(
      local,
      [{ id: 'a', bultos: 5, orderedAt: null, lastUpdated: '2026-09-02T10:00:00.000Z' }],
      new Set()
    );
    expect(changed).toBe(1);
    expect(items[0].bultos).toBe(5);
    expect('orderedAt' in items[0] && items[0].orderedAt).toBeFalsy();
  });
  it('ignores older remote stock', () => {
    const { changed } = applyRemoteStock(local, [{ id: 'a', bultos: 5, lastUpdated: '2026-08-01T00:00:00.000Z' }], new Set());
    expect(changed).toBe(0);
  });
  it('never overwrites items with unsent local edits', () => {
    const { items } = applyRemoteStock(
      local,
      [{ id: 'a', bultos: 5, lastUpdated: '2027-01-01T00:00:00.000Z' }],
      new Set(['a'])
    );
    expect(items[0].bultos).toBe(1);
  });
});

describe('min/max helpers', () => {
  it('applies the remote matrix and lead time', () => {
    const [i] = applyRemoteMinMax([base()], { a: { months: { 1: { min: 1, max: 2 } }, leadDays: 20 } });
    expect(i.monthlyMinMax).toEqual({ 1: { min: 1, max: 2 } });
    expect(i.supplierLeadTimeDays).toBe(20);
  });
  it('merges only configuration from edits, never stock', () => {
    const edited = base({ bultos: 0, monthlyMinMax: { 1: { min: 9, max: 9 } }, supplierLeadTimeDays: 3 });
    const [i] = mergeMinMaxEdits([base({ bultos: 10 })], [edited]);
    expect(i.bultos).toBe(10);
    expect(i.supplierLeadTimeDays).toBe(3);
    expect(i.monthlyMinMax).toEqual({ 1: { min: 9, max: 9 } });
  });
});
