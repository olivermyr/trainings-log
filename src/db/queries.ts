import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, PlanDay, PlanDayItem } from '../domain/types';
import { db } from './db';
import type { Workout, WorkoutItem, WorkoutSet } from '../domain/types';
import { sortSets } from '../domain/workout';
import { exerciseVolume } from '../domain/stats';
import type { CycleAnchor } from '../domain/cycle';
import type { LoggedWorkout } from '../domain/analytics';
import { getActiveWorkout, getExerciseSessions, getPreviousPerformance, getPreviousSameDay, type PreviousPerformance } from './workout';
import { detectPRs, sessionScore, type PR } from '../domain/records';

const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

export function usePlanDays(): PlanDay[] | undefined {
  return useLiveQuery(async () => (await db.planDays.orderBy('position').toArray()).filter(alive), []);
}

export interface DayEntry {
  item: PlanDayItem;
  exercise: Exercise;
}

export interface PlanDayWithExercises {
  day: PlanDay;
  entries: DayEntry[];
  exercises: Exercise[];
}

export function usePlanDay(id: string | undefined): PlanDayWithExercises | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const day = await db.planDays.get(id);
    if (!day || day.deletedAt != null) return null;
    const items = (await db.planDayItems.where('planDayId').equals(id).toArray())
      .filter(alive)
      .sort((a, b) => a.position - b.position);
    const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId));
    const entries: DayEntry[] = [];
    items.forEach((item, i) => {
      const exercise = exercises[i];
      if (exercise && alive(exercise)) entries.push({ item, exercise });
    });
    return { day, entries, exercises: entries.map((e) => e.exercise) };
  }, [id]);
}

export function useExercises(includeArchived = false): Exercise[] | undefined {
  return useLiveQuery(async () => {
    const all = (await db.exercises.toArray()).filter(alive).filter((e) => includeArchived || !e.archived);
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [includeArchived]);
}

export function useExercise(id: string | undefined): Exercise | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const e = await db.exercises.get(id);
    return e && alive(e) ? e : null;
  }, [id]);
}

/** Plan days (positions) an exercise is used on, e.g. [1, 4]. */
export function useExerciseUsage(id: string | undefined): PlanDay[] | undefined {
  return useLiveQuery(async () => {
    if (!id) return [];
    const refs = (await db.planDayItems.where('exerciseId').equals(id).toArray()).filter(alive);
    const days = (await db.planDays.bulkGet([...new Set(refs.map((r) => r.planDayId))])).filter(
      (d): d is PlanDay => !!d && alive(d),
    );
    return days.sort((a, b) => a.position - b.position);
  }, [id]);
}

/** Latest completed workout (for cycle position). */
export function useLastDoneWorkout() {
  return useLiveQuery(async () => {
    const done = (await db.workouts.where('status').equals('done').toArray()).filter(alive);
    done.sort((a, b) => (a.date === b.date ? (b.finishedAt ?? 0) - (a.finishedAt ?? 0) : a.date < b.date ? 1 : -1));
    return done[0] ?? null;
  }, []);
}

export function useWorkoutCount() {
  return useLiveQuery(async () => (await db.workouts.where('status').equals('done').toArray()).filter(alive).length, []);
}

// ---------- Workouts ----------


export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(() => getActiveWorkout(), []);
}

export interface WorkoutEntry {
  item: WorkoutItem;
  exercise: Exercise;
  sets: WorkoutSet[];
  previous: PreviousPerformance | null;
  /** Records set in this workout, compared with all earlier sessions. */
  prs: PR[];
}

export interface DayComparison {
  workout: Workout;
  volume: number;
  /** exerciseId → session score of the previous same-day workout */
  scores: Map<string, number>;
}

export interface WorkoutDetail {
  workout: Workout;
  planDay: PlanDay | null;
  entries: WorkoutEntry[];
  compare: DayComparison | null;
}

export function useWorkoutDetail(workoutId: string | undefined): WorkoutDetail | null | undefined {
  return useLiveQuery(async () => {
    if (!workoutId) return null;
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt != null) return null;
    const planDay = workout.planDayId ? ((await db.planDays.get(workout.planDayId)) ?? null) : null;
    const items = (await db.workoutItems.where('workoutId').equals(workoutId).toArray())
      .filter(alive)
      .sort((a, b) => a.position - b.position);
    const entries: WorkoutEntry[] = [];
    for (const item of items) {
      const exercise = await db.exercises.get(item.exerciseId);
      if (!exercise) continue;
      const sets = sortSets((await db.sets.where('workoutItemId').equals(item.id).toArray()).filter(alive));
      const previous = await getPreviousPerformance(exercise.id, workout);
      const prs = detectPRs(exercise, await getExerciseSessions(exercise.id, workout), sets);
      entries.push({ item, exercise, sets, previous, prs });
    }
    return { workout, planDay, entries, compare: await compareWithPrevious(workout) };
  }, [workoutId]);
}

// ---------- History ----------

export interface HistoryData {
  workouts: Workout[];
  restDates: Set<string>;
  days: PlanDay[];
}

export function useHistoryData(): HistoryData | undefined {
  return useLiveQuery(async () => {
    const workouts = (await db.workouts.where('status').equals('done').toArray())
      .filter(alive)
      .sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1));
    const restDates = new Set((await db.restDays.toArray()).filter(alive).map((r) => r.date));
    const days = (await db.planDays.toArray()).filter(alive).sort((a, b) => a.position - b.position);
    return { workouts, restDates, days };
  }, []);
}

/** Per-workout totals for lists: completed sets and tonnage. */
export function useWorkoutTotals(ids: string[]): Map<string, { sets: number; volume: number }> | undefined {
  const key = ids.join(',');
  return useLiveQuery(async () => {
    const out = new Map<string, { sets: number; volume: number }>();
    for (const id of ids) {
      const items = (await db.workoutItems.where('workoutId').equals(id).toArray()).filter(alive);
      let sets = 0;
      let volume = 0;
      for (const it of items) {
        const ex = await db.exercises.get(it.exerciseId);
        const ss = (await db.sets.where('workoutItemId').equals(it.id).toArray()).filter(
          (s) => alive(s) && s.completedAt != null,
        );
        sets += ss.length;
        if (ex) volume += exerciseVolume(ex, ss);
      }
      out.set(id, { sets, volume });
    }
    return out;
  }, [key]);
}

// ---------- Cycle anchor ----------

export function useCycleAnchor(): CycleAnchor | null | undefined {
  return useLiveQuery(async () => ((await db.settings.get('cycleAnchor'))?.value as CycleAnchor | undefined) ?? null, []);
}

export async function setCycleAnchor(anchor: CycleAnchor) {
  await db.settings.put({ key: 'cycleAnchor', value: anchor, updatedAt: Date.now() });
}

async function compareWithPrevious(workout: Workout): Promise<DayComparison | null> {
  const prev = await getPreviousSameDay(workout);
  if (!prev) return null;
  const items = (await db.workoutItems.where('workoutId').equals(prev.id).toArray()).filter(alive);
  let volume = 0;
  const scores = new Map<string, number>();
  for (const it of items) {
    const ex = await db.exercises.get(it.exerciseId);
    if (!ex) continue;
    const sets = (await db.sets.where('workoutItemId').equals(it.id).toArray()).filter(
      (s) => alive(s) && s.completedAt != null,
    );
    volume += exerciseVolume(ex, sets);
    scores.set(ex.id, sessionScore(ex, sets));
  }
  return { workout: prev, volume, scores };
}

// ---------- Analytics ----------

/** All finished workouts with their completed working sets, oldest first. */
export function useLoggedWorkouts(): LoggedWorkout[] | undefined {
  return useLiveQuery(async () => {
    const workouts = (await db.workouts.where('status').equals('done').toArray())
      .filter(alive)
      .sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1));
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const items = (await db.workoutItems.toArray()).filter(alive);
    const sets = (await db.sets.toArray()).filter((s) => alive(s) && s.completedAt != null && !s.isWarmup);
    const setsByItem = new Map<string, WorkoutSet[]>();
    for (const s of sets) setsByItem.set(s.workoutItemId, [...(setsByItem.get(s.workoutItemId) ?? []), s]);
    const itemsByWorkout = new Map<string, WorkoutItem[]>();
    for (const it of items) itemsByWorkout.set(it.workoutId, [...(itemsByWorkout.get(it.workoutId) ?? []), it]);
    return workouts.map((workout) => ({
      workout,
      entries: (itemsByWorkout.get(workout.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((it) => ({ exercise: exercises.get(it.exerciseId)!, sets: sortSets(setsByItem.get(it.id) ?? []) }))
        .filter((e) => e.exercise && e.sets.length > 0),
    }));
  }, []);
}
