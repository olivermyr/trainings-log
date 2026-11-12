import { useLiveQuery } from 'dexie-react-hooks';
import { BUILTIN_METRICS, slugKey, type MetricDef } from '../domain/body';
import type { BodyEntry } from '../domain/types';
import { db, type TrainingsDB } from './db';
import { meta } from './ids';

const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

export interface BodyProfile {
  heightCm: number | null;
  birthDate: string | null;
  sex: 'male' | 'female' | null;
}

const EMPTY_PROFILE: BodyProfile = { heightCm: null, birthDate: null, sex: null };

export function useBodyProfile(): BodyProfile | undefined {
  return useLiveQuery(async () => ({ ...EMPTY_PROFILE, ...((await db.settings.get('bodyProfile'))?.value as Partial<BodyProfile>) }), []);
}

export async function updateBodyProfile(changes: Partial<BodyProfile>, database: TrainingsDB = db) {
  const cur = ((await database.settings.get('bodyProfile'))?.value as BodyProfile | undefined) ?? EMPTY_PROFILE;
  await database.settings.put({ key: 'bodyProfile', value: { ...cur, ...changes }, updatedAt: Date.now() });
}

/** Built-in metrics followed by custom ones (custom are measurements). */
export function useMetricDefs(): MetricDef[] | undefined {
  return useLiveQuery(async () => {
    const custom = (await db.bodyMetricDefs.toArray()).filter(alive);
    return [
      ...BUILTIN_METRICS,
      ...custom.map((c) => ({ key: c.key, label: c.label, unit: c.unit, group: 'measurements' as const, decimals: 1, placeholder: '', custom: true })),
    ];
  }, []);
}

export async function addCustomMetric(label: string, unit: string, database: TrainingsDB = db): Promise<string | null> {
  const key = slugKey(label);
  if (key === 'c_' || BUILTIN_METRICS.some((m) => m.key === key)) return null;
  const existing = (await database.bodyMetricDefs.where('key').equals(key).toArray()).filter(alive);
  if (existing.length) return key;
  await database.bodyMetricDefs.add({ ...meta(), key, label: label.trim(), unit: unit.trim() || 'cm', custom: true });
  return key;
}

export async function removeCustomMetric(key: string, database: TrainingsDB = db) {
  const now = Date.now();
  for (const d of await database.bodyMetricDefs.where('key').equals(key).toArray()) {
    await database.bodyMetricDefs.update(d.id, { deletedAt: now, updatedAt: now });
  }
}

/** One value per metric and day: saving again on the same day replaces the value. */
export async function saveBodyValues(date: string, values: Record<string, number>, database: TrainingsDB = db) {
  await database.transaction('rw', database.bodyEntries, async () => {
    const now = Date.now();
    for (const [metricKey, value] of Object.entries(values)) {
      const existing = (await database.bodyEntries.where('[metricKey+date]').equals([metricKey, date]).toArray()).filter(alive);
      if (existing.length) {
        await database.bodyEntries.update(existing[0].id, { value, updatedAt: now });
        for (const dup of existing.slice(1)) await database.bodyEntries.update(dup.id, { deletedAt: now, updatedAt: now });
      } else {
        await database.bodyEntries.add({ ...meta(now), date, metricKey, value });
      }
    }
  });
}

export async function deleteBodyEntry(id: string, database: TrainingsDB = db) {
  const now = Date.now();
  await database.bodyEntries.update(id, { deletedAt: now, updatedAt: now });
}

export function useBodyEntries(): Map<string, BodyEntry[]> | undefined {
  return useLiveQuery(async () => {
    const all = (await db.bodyEntries.toArray()).filter(alive).sort((a, b) => (a.date < b.date ? -1 : 1));
    const map = new Map<string, BodyEntry[]>();
    for (const e of all) map.set(e.metricKey, [...(map.get(e.metricKey) ?? []), e]);
    return map;
  }, []);
}
