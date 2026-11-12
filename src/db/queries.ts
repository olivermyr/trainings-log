import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, PlanDay, PlanDayItem } from '../domain/types';
import { db } from './db';
import type { Workout, WorkoutItem, WorkoutSet } from '../domain/types';
import { sortSets } from '../domain/workout';
import { getActiveWorkout, getPreviousPerformance, type PreviousPerformance } from './workout';

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
}

export interface WorkoutDetail {
  workout: Workout;
  planDay: PlanDay | null;
  entries: WorkoutEntry[];
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
      const previous = await getPreviousPerformance(exercise.id, workoutId);
      entries.push({ item, exercise, sets, previous });
    }
    return { workout, planDay, entries };
  }, [workoutId]);
}
