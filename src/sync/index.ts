import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { SYNC_TABLES, SYNCED_SETTINGS, applyingRemote, syncOnce } from './engine';
import { supabase, supabaseRemote } from './supabase';

export interface SyncStatus {
  email: string | null;
  state: 'signed-out' | 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncAt: number | null;
  error: string | null;
}

let status: SyncStatus = { email: null, state: 'signed-out', lastSyncAt: null, error: null };
const listeners = new Set<() => void>();
function set(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

let running: Promise<void> | null = null;
let again = false;

/** Runs one sync (coalesces concurrent calls). Never throws. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        set({ state: 'signed-out', email: null });
        return;
      }
      if (!navigator.onLine) {
        set({ state: 'offline', email: data.session.user.email ?? null });
        return;
      }
      set({ state: 'syncing', email: data.session.user.email ?? null });
      try {
        await syncOnce(db, supabaseRemote);
        set({ state: 'idle', lastSyncAt: Date.now(), error: null });
      } catch (e) {
        set({ state: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let pushTimer: number | undefined;
function schedule(delay = 2500) {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void syncNow(), delay);
}

let started = false;

/** Wires automatic sync: after local changes (debounced), on focus, when back online, and every 2 minutes. */
export function startSync() {
  if (started) return;
  started = true;
  for (const t of SYNC_TABLES) {
    const table = db.table(t);
    const onChange = (key: unknown) => {
      if (applyingRemote) return;
      if (t === 'settings' && typeof key === 'string' && !SYNCED_SETTINGS.has(key)) return;
      schedule();
    };
    table.hook('creating', (primKey) => onChange(primKey));
    table.hook('updating', (_mods, primKey) => onChange(primKey));
    table.hook('deleting', (primKey) => onChange(primKey));
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(300));
  window.addEventListener('online', () => schedule(300));
  window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), 120_000);
  supabase.auth.onAuthStateChange((event, session) => {
    set({ email: session?.user.email ?? null });
    if (event === 'SIGNED_IN') schedule(100);
    if (event === 'SIGNED_OUT') set({ state: 'signed-out', lastSyncAt: null });
  });
  void syncNow();
}
