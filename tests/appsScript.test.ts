import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

// Minimal in-memory stand-in for the Google Apps Script services the script uses
class FakeSheet {
  rows: any[][] = [];
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return Math.max(0, ...this.rows.map((r) => r.length));
  }
  getRange(a: any, col?: number, numRows = 1, numCols = 1) {
    const sheet = this;
    if (typeof a === 'string') return { setNumberFormat() {} };
    const row = a;
    return {
      setValues(values: any[][]) {
        values.forEach((v, i) => {
          sheet.rows[row - 1 + i] = sheet.rows[row - 1 + i] || [];
          v.forEach((cell, j) => (sheet.rows[row - 1 + i][col! - 1 + j] = cell));
        });
        return this;
      },
      getValues() {
        return Array.from({ length: numRows }, (_, i) =>
          Array.from({ length: numCols }, (_, j) => sheet.rows[row - 1 + i]?.[col! - 1 + j] ?? '')
        );
      },
      clearContent() {
        for (let i = 0; i < numRows; i++) sheet.rows[row - 1 + i] = [];
      },
      setBackground() {
        return this;
      },
      setFontColor() {
        return this;
      },
      setFontWeight() {
        return this;
      },
    };
  }
  appendRow(v: any[]) {
    this.rows.push([...v]);
  }
}

function loadScript(props: Record<string, string>) {
  const sheets: Record<string, FakeSheet> = {};
  const ss = {
    getSheetByName: (n: string) => sheets[n] || null,
    insertSheet: (n: string) => (sheets[n] = new FakeSheet()),
  };
  const context: any = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }),
    },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(resolve(__dirname, '../apps-script/Code.gs'), 'utf8'), context);
  const post = (body: any) => context.doPost({ postData: { contents: JSON.stringify(body) } });
  return { post, sheets };
}

const item = (bultos: number, lastUpdated: string) => ({
  id: 'caja',
  category: 'Cajas',
  name: 'Caja',
  bultos,
  unitsPerBulto: 10,
  totalUnits: bultos * 10,
  minStockAdjusted: 1,
  maxStockAdjusted: 2,
  status: 'OPTIMO',
  unitsToOrder: 0,
  lastUpdated,
  batches: [{ id: 'b1', bultos, unitsPerBulto: 10 }],
});

describe('Apps Script', () => {
  let api: ReturnType<typeof loadScript>;
  beforeEach(() => {
    api = loadScript({ ACCESS_TOKEN: 'secret', ADMIN_PIN: '9999' });
  });

  it('rejects requests without the access token', () => {
    expect(api.post({ action: 'GET_STATE' }).success).toBe(false);
    expect(api.post({ action: 'GET_STATE', token: 'wrong' }).success).toBe(false);
  });

  it('refuses to run when ACCESS_TOKEN is not configured', () => {
    const open = loadScript({});
    expect(open.post({ action: 'PING', token: '' }).success).toBe(false);
  });

  it('verifies the admin PIN server-side and protects admin writes', () => {
    expect(api.post({ action: 'VERIFY_PIN', token: 'secret', adminPin: '1111' }).success).toBe(false);
    expect(api.post({ action: 'VERIFY_PIN', token: 'secret', adminPin: '9999' }).success).toBe(true);
    expect(api.post({ action: 'UPDATE_MIN_MAX', token: 'secret', minMaxMatrix: [] }).success).toBe(false);
    expect(api.post({ action: 'UPDATE_MIN_MAX', token: 'secret', adminPin: '9999', minMaxMatrix: [] }).success).toBe(true);
  });

  it('round-trips stock and keeps the newest write per item', () => {
    api.post({ action: 'UPDATE_STOCK', token: 'secret', items: [item(5, '2026-09-02T10:00:00.000Z')] });
    // A tablet with an older count must not overwrite the newer one
    const stale = api.post({ action: 'UPDATE_STOCK', token: 'secret', items: [item(1, '2026-09-01T10:00:00.000Z')] });
    expect(stale.details.skippedAsOlder).toBe(1);

    const state = api.post({ action: 'GET_STATE', token: 'secret' });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ id: 'caja', bultos: 5, lastUpdated: '2026-09-02T10:00:00.000Z' });
    expect(state.items[0].batches).toEqual([{ id: 'b1', bultos: 5, unitsPerBulto: 10 }]);

    api.post({ action: 'UPDATE_STOCK', token: 'secret', items: [item(8, '2026-09-03T10:00:00.000Z')] });
    const after = api.post({ action: 'GET_STATE', token: 'secret' });
    expect(after.items).toHaveLength(1);
    expect(after.items[0].bultos).toBe(8);
  });

  it('only logs history when asked to', () => {
    api.post({ action: 'UPDATE_STOCK', token: 'secret', items: [], metadata: { month: 'Sep' } });
    expect(api.sheets['Historial_Cargas']).toBeUndefined();
    api.post({ action: 'UPDATE_STOCK', token: 'secret', items: [], metadata: { month: 'Sep', logHistory: true } });
    expect(api.sheets['Historial_Cargas'].rows).toHaveLength(2);
  });

  it('round-trips the min/max matrix with lead time', () => {
    const minMaxItem = { id: 'caja', category: 'Cajas', name: 'Caja', monthlyMinMax: { 1: { min: 3, max: 7 } }, minStockBase: 1, maxStockBase: 2, supplierLeadTimeDays: 12 };
    api.post({ action: 'UPDATE_MIN_MAX', token: 'secret', adminPin: '9999', minMaxMatrix: [minMaxItem] });
    const state = api.post({ action: 'GET_STATE', token: 'secret' });
    expect(state.minMax.caja.months[1]).toEqual({ min: 3, max: 7 });
    expect(state.minMax.caja.months[2]).toEqual({ min: 1, max: 2 });
    expect(state.minMax.caja.leadDays).toBe(12);
  });
});
