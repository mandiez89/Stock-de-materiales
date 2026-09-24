import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { MaterialItem } from '../types';
import { callSheets, getSheetsConfig, isSheetsConfigured } from '../services/sheetsSync';
import { applyRemoteMinMax, applyRemoteStock, RemoteMinMax, RemoteStockItem } from './stockState';

export type SyncStatus = 'disabled' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

export interface SheetsSyncState {
  configured: boolean;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  pendingCount: number;
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
  /** Sends every item now and records a history row in the sheet. */
  syncNow: (metadata?: Record<string, unknown>) => Promise<boolean>;
  pull: () => Promise<void>;
  /** Re-reads connection settings after they change in the Sheets tab. */
  refreshConfig: () => void;
}

const DIRTY_KEY = 'sugestion_dirty_ids';
const MINMAX_DIRTY_KEY = 'sugestion_minmax_dirty';
const AUTOSYNC_KEY = 'sugestion_autosync_sheets';
const LAST_SYNC_KEY = 'sugestion_last_sheets_sync_time';
const PUSH_DEBOUNCE_MS = 1200;
const PULL_INTERVAL_MS = 60_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

const nowLabel = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Two-way sync with Google Sheets:
 * - push: items edited on this device (dirty) are sent, debounced; the script keeps the newest per item.
 * - pull: on start, every minute, on focus and when back online, newer remote items replace local ones
 *   unless they have unsent local edits.
 */
export function useSheetsSync(params: {
  setRawItems: Dispatch<SetStateAction<MaterialItem[]>>;
  computedItems: MaterialItem[];
  dirtyIds: Set<string>;
  setDirtyIds: Dispatch<SetStateAction<Set<string>>>;
  minMaxDirty: boolean;
  monthName: string;
}): SheetsSyncState {
  const { setRawItems, computedItems, dirtyIds, setDirtyIds, minMaxDirty, monthName } = params;

  const [configured, setConfigured] = useState(() => isSheetsConfigured());
  const [autoSync, setAutoSyncState] = useState<boolean>(() => load(AUTOSYNC_KEY, true));
  const [status, setStatus] = useState<SyncStatus>(configured ? 'idle' : 'disabled');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => load<string | null>(LAST_SYNC_KEY, null));

  // Refs so async callbacks always see the latest values
  const computedRef = useRef(computedItems);
  computedRef.current = computedItems;
  const dirtyRef = useRef(dirtyIds);
  dirtyRef.current = dirtyIds;
  const minMaxDirtyRef = useRef(minMaxDirty);
  minMaxDirtyRef.current = minMaxDirty;
  const inFlight = useRef(false);
  const rerun = useRef(false);

  const markSynced = () => {
    const label = nowLabel();
    setLastSyncedAt(label);
    store(LAST_SYNC_KEY, label);
    setError(null);
    setStatus('synced');
  };

  const fail = (message: string) => {
    setError(message);
    setStatus('error');
  };

  const push = useCallback(
    async (items: MaterialItem[], metadata?: Record<string, unknown>): Promise<boolean> => {
      if (inFlight.current) {
        rerun.current = true;
        return false;
      }
      inFlight.current = true;
      setStatus('syncing');
      try {
        const sent = new Map(items.map((i) => [i.id, i.lastUpdated]));
        const result = await callSheets('UPDATE_STOCK', { items, metadata });
        if (!result.success) {
          fail(result.message);
          return false;
        }
        // Only clear items that were not edited again while the request was in flight
        const current = new Map(computedRef.current.map((i) => [i.id, i.lastUpdated]));
        setDirtyIds((prev) => {
          const next = new Set(prev);
          sent.forEach((ts, id) => {
            if (current.get(id) === ts) next.delete(id);
          });
          return next;
        });
        markSynced();
        return true;
      } finally {
        inFlight.current = false;
        if (rerun.current) {
          rerun.current = false;
          const pending = computedRef.current.filter((i) => dirtyRef.current.has(i.id));
          if (pending.length > 0) void push(pending);
        }
      }
    },
    [setDirtyIds]
  );

  const pull = useCallback(async () => {
    if (!isSheetsConfigured()) return;
    const result = await callSheets('GET_STATE');
    if (!result.success) {
      fail(result.message);
      return;
    }
    const remoteItems: RemoteStockItem[] = result.details?.items || [];
    const remoteMinMax: RemoteMinMax | null = result.details?.minMax || null;
    setRawItems((prev) => {
      let next = applyRemoteStock(prev, remoteItems, dirtyRef.current).items;
      if (!minMaxDirtyRef.current) next = applyRemoteMinMax(next, remoteMinMax);
      return next;
    });
    if (dirtyRef.current.size === 0) markSynced();
  }, [setRawItems]);

  // Debounced auto-push of local edits
  useEffect(() => {
    if (!configured || !autoSync || dirtyIds.size === 0) return;
    setStatus((s) => (s === 'syncing' ? s : 'pending'));
    const timer = setTimeout(() => {
      const pending = computedRef.current.filter((i) => dirtyRef.current.has(i.id));
      if (pending.length > 0) void push(pending);
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [configured, autoSync, dirtyIds, computedItems, push]);

  // Periodic pull, plus on focus and reconnection
  useEffect(() => {
    if (!configured) return;
    void pull();
    const interval = setInterval(() => void pull(), PULL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    const onOnline = () => {
      void pull();
      const pending = computedRef.current.filter((i) => dirtyRef.current.has(i.id));
      if (pending.length > 0) void push(pending);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [configured, pull, push]);

  const setAutoSync = (value: boolean) => {
    setAutoSyncState(value);
    store(AUTOSYNC_KEY, value);
  };

  const syncNow = useCallback(
    async (metadata?: Record<string, unknown>) => {
      if (!isSheetsConfigured()) {
        fail('Google Sheets no está configurado en este dispositivo.');
        return false;
      }
      const items = computedRef.current;
      return push(items, {
        date: new Date().toLocaleDateString('es-AR'),
        month: monthName,
        criticalCount: items.filter((i) => i.status === 'CRITICO').length,
        totalUnitsToOrder: items.reduce((acc, i) => acc + i.unitsToOrder, 0),
        responsible: 'Operador Depósito',
        ...metadata,
        logHistory: true,
      });
    },
    [push, monthName]
  );

  const refreshConfig = useCallback(() => {
    const ok = isSheetsConfigured(getSheetsConfig());
    setConfigured(ok);
    setError(null);
    setStatus(ok ? 'idle' : 'disabled');
  }, []);

  return {
    configured,
    status: configured ? status : 'disabled',
    error,
    lastSyncedAt,
    pendingCount: dirtyIds.size,
    autoSync,
    setAutoSync,
    syncNow,
    pull,
    refreshConfig,
  };
}

export function loadDirtyIds(): Set<string> {
  return new Set(load<string[]>(DIRTY_KEY, []));
}

export function saveDirtyIds(ids: Set<string>) {
  store(DIRTY_KEY, [...ids]);
}

export function loadMinMaxDirty(): boolean {
  return load(MINMAX_DIRTY_KEY, false);
}

export function saveMinMaxDirty(value: boolean) {
  store(MINMAX_DIRTY_KEY, value);
}
