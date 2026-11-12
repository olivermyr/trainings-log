import type { TrainingsDB } from '../db/db';

/**
 * Sync engine: the device database is the source of truth, the server holds a copy per user.
 * - push: every local row changed since the last push (by its client `updatedAt`)
 * - pull: every remote row changed since the last pull (by the server's `server_ts`)
 * - conflicts: last write wins on `updatedAt` (enforced on both sides)
 * The remote is injected, so the engine is tested without a network.
 */

export const SYNC_TABLES = [
  'exercises',
  'planDays',
  'planDayItems',
  'workouts',
  'workoutItems',
  'sets',
  'restDays',
  'bodyEntries',
  'bodyMetricDefs',
  'settings',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Settings that belong to the user (synced). Timers, seed flag and sync state stay on the device. */
export const SYNCED_SETTINGS = new Set(['cycleAnchor', 'bodyProfile']);

export interface RemoteRow {
  table_name: SyncTable;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  server_ts?: string;
}

export interface Remote {
  push(rows: RemoteRow[]): Promise<void>;
  /** Rows with server_ts > since (ascending), at most `limit`. */
  pull(since: string | null, limit: number): Promise<RemoteRow[]>;
  count(): Promise<number>;
}

export interface SyncState {
  lastPush: number; // local ms
  lastPull: string | null; // server timestamp
  initialized: boolean;
}

const STATE_KEY = 'sync.state';

export async function readState(db: TrainingsDB): Promise<SyncState> {
  return ((await db.settings.get(STATE_KEY))?.value as SyncState | undefined) ?? { lastPush: 0, lastPull: null, initialized: false };
}

async function writeState(db: TrainingsDB, s: SyncState) {
  await db.settings.put({ key: STATE_KEY, value: s, updatedAt: 0 });
}

const idOf = (table: SyncTable, row: Record<string, unknown>) => String(table === 'settings' ? row.key : row.id);

function toRemote(table: SyncTable, row: Record<string, unknown>): RemoteRow {
  return {
    table_name: table,
    id: idOf(table, row),
    data: row,
    updated_at: Number(row.updatedAt ?? 0),
    deleted_at: (row.deletedAt as number | null | undefined) ?? null,
  };
}

/** Local rows changed after `since`. */
export async function collectChanges(db: TrainingsDB, since: number): Promise<RemoteRow[]> {
  const out: RemoteRow[] = [];
  for (const t of SYNC_TABLES) {
    const table = db.table(t);
    let rows: Record<string, unknown>[];
    if (t === 'settings') {
      rows = (await table.toArray()).filter((r) => SYNCED_SETTINGS.has(String(r.key)));
    } else {
      rows = await table.where('updatedAt').above(since).toArray();
    }
    for (const r of rows) if (Number(r.updatedAt ?? 0) > since) out.push(toRemote(t, r));
  }
  return out;
}

/** True while remote rows are written locally (so change hooks don't schedule a push for them). */
export let applyingRemote = false;

/** Applies remote rows locally if they are newer. Returns how many rows changed. */
export async function applyRemote(db: TrainingsDB, rows: RemoteRow[]): Promise<number> {
  let changed = 0;
  applyingRemote = true;
  try {
  await db.transaction('rw', SYNC_TABLES.map((t) => db.table(t)), async () => {
    for (const r of rows) {
      if (!(SYNC_TABLES as readonly string[]).includes(r.table_name)) continue;
      if (r.table_name === 'settings' && !SYNCED_SETTINGS.has(r.id)) continue;
      const table = db.table(r.table_name);
      const local = (await table.get(r.id)) as Record<string, unknown> | undefined;
      if (!local || Number(local.updatedAt ?? 0) < r.updated_at) {
        await table.put(r.data);
        changed++;
      }
    }
  });
  } finally {
    applyingRemote = false;
  }
  return changed;
}

/** Wipes the locally seeded plan (used when a fresh device joins an account that already has data). */
async function clearLocal(db: TrainingsDB) {
  await db.transaction('rw', SYNC_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNC_TABLES) {
      if (t === 'settings') {
        for (const k of SYNCED_SETTINGS) await db.settings.delete(k);
      } else {
        await db.table(t).clear();
      }
    }
  });
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const BATCH = 500;

export async function syncOnce(db: TrainingsDB, remote: Remote): Promise<SyncResult> {
  let state = await readState(db);

  if (!state.initialized) {
    const remoteCount = await remote.count();
    const localWorkouts = await db.workouts.count();
    if (remoteCount > 0 && localWorkouts === 0) {
      // New device, account already has data: drop the local starter plan to avoid duplicates.
      await clearLocal(db);
    }
    state = { lastPush: 0, lastPull: null, initialized: true };
  }

  // Push
  const startedAt = Date.now();
  const changes = await collectChanges(db, state.lastPush);
  for (let i = 0; i < changes.length; i += BATCH) await remote.push(changes.slice(i, i + BATCH));
  state.lastPush = startedAt - 1; // rows written in the same millisecond are re-sent next time (harmless)

  // Pull
  let pulled = 0;
  for (;;) {
    const rows = await remote.pull(state.lastPull, 1000);
    if (rows.length === 0) break;
    pulled += await applyRemote(db, rows);
    state.lastPull = rows.at(-1)!.server_ts ?? state.lastPull;
    if (rows.length < 1000) break;
  }

  await writeState(db, state);
  return { pushed: changes.length, pulled };
}
