import { useLiveQuery } from 'dexie-react-hooks';
import { extendRest, startRest, type RestTimer, type Stopwatch, LEAD_IN_MS } from '../domain/timer';
import type { Exercise, WorkoutSet } from '../domain/types';
import { db } from './db';

/** Timers live in the settings table so they survive reloads and app suspension. */
const REST = 'restTimer';
const STOPWATCH = 'stopwatch';

async function put(key: string, value: unknown) {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

export function useRestTimer(): RestTimer | null | undefined {
  return useLiveQuery(async () => ((await db.settings.get(REST))?.value as RestTimer | null) ?? null, []);
}

export function useStopwatch(): Stopwatch | null | undefined {
  return useLiveQuery(async () => ((await db.settings.get(STOPWATCH))?.value as Stopwatch | null) ?? null, []);
}

export async function startRestTimer(seconds: number, label: string) {
  if (seconds <= 0) return clearRestTimer();
  await put(REST, startRest(Date.now(), seconds, label));
}

export async function addRestTime(seconds: number) {
  const t = (await db.settings.get(REST))?.value as RestTimer | null;
  if (t) await put(REST, extendRest(t, seconds, Date.now()));
}

export async function clearRestTimer() {
  await db.settings.delete(REST);
}

export async function startStopwatch(setId: string) {
  await clearRestTimer();
  await put(STOPWATCH, { setId, startedAt: Date.now() + LEAD_IN_MS } satisfies Stopwatch);
}

export async function clearStopwatch() {
  await db.settings.delete(STOPWATCH);
}

/**
 * Decides whether completing `set` should start the rest timer.
 * Unilateral exercises rest only after BOTH sides of a set are done.
 */
export async function maybeStartRestAfter(set: WorkoutSet, exercise: Exercise) {
  if (exercise.unilateral && set.side) {
    const siblings = (await db.sets.where('workoutItemId').equals(set.workoutItemId).toArray()).filter(
      (s) => s.deletedAt == null && s.position === set.position && s.id !== set.id,
    );
    if (siblings.some((s) => s.completedAt == null)) return;
  }
  await startRestTimer(exercise.restSeconds, exercise.name);
}
