import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, PlanDay } from '../domain/types';
import { db } from './db';

const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

export function usePlanDays(): PlanDay[] | undefined {
  return useLiveQuery(async () => (await db.planDays.orderBy('position').toArray()).filter(alive), []);
}

export interface PlanDayWithExercises {
  day: PlanDay;
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
    return { day, exercises: exercises.filter((e): e is Exercise => !!e && alive(e)) };
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
