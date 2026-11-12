import type { TrainingsDB } from '../db/db';
import { localDate } from '../db/ids';
import type { Exercise, PlanDay, Workout, WorkoutItem, WorkoutSet } from '../domain/types';
import { SYNCED_SETTINGS, SYNC_TABLES, applyRemote, type RemoteRow, type SyncTable } from './engine';

export interface BackupFile {
  app: 'trainings-log';
  version: 1;
  exportedAt: string;
  tables: Partial<Record<SyncTable, Record<string, unknown>[]>>;
}

export async function buildBackup(db: TrainingsDB): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const t of SYNC_TABLES) {
    const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
    tables[t] = t === 'settings' ? rows.filter((r) => SYNCED_SETTINGS.has(String(r.key))) : rows;
  }
  return { app: 'trainings-log', version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Merges a backup into the local database; for every row the newer version wins. */
export async function restoreBackup(db: TrainingsDB, file: unknown): Promise<number> {
  const b = file as BackupFile;
  if (!b || b.app !== 'trainings-log' || b.version !== 1 || typeof b.tables !== 'object') {
    throw new Error('This is not a Trainings Log backup file.');
  }
  const rows: RemoteRow[] = [];
  for (const t of SYNC_TABLES) {
    for (const r of b.tables[t] ?? []) {
      const id = String(t === 'settings' ? r.key : r.id);
      if (!id || id === 'undefined') continue;
      rows.push({ table_name: t, id, data: r, updated_at: Number(r.updatedAt ?? 0), deleted_at: (r.deletedAt as number) ?? null });
    }
  }
  return applyRemote(db, rows);
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per completed working set — opens directly in Excel / Numbers. */
export async function buildSetsCsv(db: TrainingsDB): Promise<string> {
  const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;
  const workouts = new Map(((await db.workouts.toArray()) as Workout[]).filter((w) => alive(w) && w.status === 'done').map((w) => [w.id, w]));
  const days = new Map(((await db.planDays.toArray()) as PlanDay[]).map((d) => [d.id, d]));
  const items = new Map(((await db.workoutItems.toArray()) as WorkoutItem[]).filter(alive).map((i) => [i.id, i]));
  const exercises = new Map(((await db.exercises.toArray()) as Exercise[]).map((e) => [e.id, e]));
  const lines: string[] = [['date', 'day', 'exercise', 'set', 'side', 'weight_kg', 'reps', 'duration_s'].join(',')];
  const sets = ((await db.sets.toArray()) as WorkoutSet[]).filter((s) => alive(s) && s.completedAt != null);
  const rows = sets
    .map((s) => {
      const it = items.get(s.workoutItemId);
      const w = it && workouts.get(it.workoutId);
      if (!it || !w) return null;
      const day = w.planDayId ? days.get(w.planDayId) : undefined;
      return {
        sort: `${w.date}|${w.startedAt}|${String(it.position).padStart(3, '0')}|${String(s.position).padStart(3, '0')}|${s.side ?? ''}`,
        cells: [w.date, day ? `Day ${day.position + 1} ${day.name}` : '', exercises.get(it.exerciseId)?.name ?? '', s.position + 1, s.side ?? '', s.weight ?? '', s.reps ?? '', s.durationS ?? ''],
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => (a.sort < b.sort ? -1 : 1));
  for (const r of rows) lines.push(r.cells.map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

/** Shares (iOS share sheet) or downloads a file. */
export async function deliverFile(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const backupName = (ext: string) => `trainings-log-${localDate()}.${ext}`;
