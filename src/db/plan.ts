import type { DayColor, Exercise, ExerciseType, PlanDay } from '../domain/types';
import { db, type TrainingsDB } from './db';
import { meta } from './ids';

const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

async function aliveItems(database: TrainingsDB, planDayId: string) {
  return (await database.planDayItems.where('planDayId').equals(planDayId).toArray())
    .filter(alive)
    .sort((a, b) => a.position - b.position);
}

async function aliveDays(database: TrainingsDB) {
  return (await database.planDays.toArray()).filter(alive).sort((a, b) => a.position - b.position);
}

/** Rewrites positions 0..n-1 in the given order. */
async function renumber<T extends { id: string; position: number }>(
  table: { update: (id: string, changes: Partial<T> & { updatedAt: number }) => Promise<number> },
  rows: T[],
) {
  const now = Date.now();
  await Promise.all(rows.map((r, i) => (r.position === i ? null : table.update(r.id, { position: i, updatedAt: now } as never))));
}

// ---------- Days ----------

export async function addPlanDay(name: string, color: DayColor, database = db): Promise<PlanDay> {
  return database.transaction('rw', database.planDays, async () => {
    const days = await aliveDays(database);
    const day: PlanDay = { ...meta(), name, color, position: days.length };
    await database.planDays.add(day);
    return day;
  });
}

export async function updatePlanDay(id: string, changes: Partial<Pick<PlanDay, 'name' | 'color'>>, database = db) {
  await database.planDays.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deletePlanDay(id: string, database = db) {
  await database.transaction('rw', database.planDays, database.planDayItems, async () => {
    const now = Date.now();
    await database.planDays.update(id, { deletedAt: now, updatedAt: now });
    for (const it of await aliveItems(database, id)) {
      await database.planDayItems.update(it.id, { deletedAt: now, updatedAt: now });
    }
    await renumber(database.planDays, await aliveDays(database));
  });
}

export async function moveDay(id: string, delta: -1 | 1, database = db) {
  await database.transaction('rw', database.planDays, async () => {
    const days = await aliveDays(database);
    const i = days.findIndex((d) => d.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    await renumber(database.planDays, days);
  });
}

// ---------- Day items ----------

export async function addExerciseToDay(planDayId: string, exerciseId: string, database = db) {
  await database.transaction('rw', database.planDayItems, async () => {
    const items = await aliveItems(database, planDayId);
    await database.planDayItems.add({ ...meta(), planDayId, exerciseId, position: items.length });
  });
}

export async function removeDayItem(itemId: string, database = db) {
  await database.transaction('rw', database.planDayItems, async () => {
    const item = await database.planDayItems.get(itemId);
    if (!item) return;
    const now = Date.now();
    await database.planDayItems.update(itemId, { deletedAt: now, updatedAt: now });
    await renumber(database.planDayItems, await aliveItems(database, item.planDayId));
  });
}

export async function moveDayItem(itemId: string, delta: -1 | 1, database = db) {
  await database.transaction('rw', database.planDayItems, async () => {
    const item = await database.planDayItems.get(itemId);
    if (!item) return;
    const items = await aliveItems(database, item.planDayId);
    const i = items.findIndex((x) => x.id === itemId);
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    await renumber(database.planDayItems, items);
  });
}

// ---------- Exercises ----------

export function defaultsForType(type: ExerciseType): Partial<Exercise> {
  if (type === 'timed_tempo') return { targetSets: 1, tempoSeconds: 7, targetSeconds: 300, restSeconds: 180 };
  return { targetSets: 3, tempoSeconds: null, targetSeconds: null };
}

export async function createExercise(name: string, database = db): Promise<Exercise> {
  const ex: Exercise = {
    ...meta(),
    name,
    type: 'weight_reps',
    unilateral: false,
    loadFactor: 1,
    increment: 2.5,
    repMin: 8,
    repMax: 12,
    targetSets: 3,
    restSeconds: 90,
    tempoSeconds: null,
    targetSeconds: null,
    muscles: {},
    note: '',
    archived: false,
  };
  await database.exercises.add(ex);
  return ex;
}

export async function updateExercise(id: string, changes: Partial<Exercise>, database = db) {
  await database.exercises.update(id, { ...changes, updatedAt: Date.now() });
}

/**
 * Archiving keeps all history intact but removes the exercise from every plan day
 * and hides it from the library picker.
 */
export async function archiveExercise(id: string, database = db) {
  await database.transaction('rw', database.exercises, database.planDayItems, async () => {
    const now = Date.now();
    await database.exercises.update(id, { archived: true, updatedAt: now });
    const refs = (await database.planDayItems.where('exerciseId').equals(id).toArray()).filter(alive);
    const affectedDays = new Set(refs.map((r) => r.planDayId));
    for (const r of refs) await database.planDayItems.update(r.id, { deletedAt: now, updatedAt: now });
    for (const d of affectedDays) await renumber(database.planDayItems, await aliveItems(database, d));
  });
}

export async function restoreExercise(id: string, database = db) {
  await database.exercises.update(id, { archived: false, updatedAt: Date.now() });
}
