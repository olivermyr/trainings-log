import { addDays } from './cycle';
import { e1rm } from './records';
import { exerciseVolume } from './stats';
import type { Exercise, MuscleGroup, Workout, WorkoutSet } from './types';

export interface LoggedEntry {
  exercise: Exercise;
  /** completed working sets only */
  sets: WorkoutSet[];
}

export interface LoggedWorkout {
  workout: Workout;
  entries: LoggedEntry[];
}

/** Monday of the week as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

// ---------- Per exercise ----------

export interface ExercisePoint {
  date: string;
  workoutId: string;
  e1rm: number;
  topWeight: number;
  topReps: number;
  maxReps: number;
  totalReps: number;
  volume: number;
  bestTime: number;
  timeWeight: number;
  sets: WorkoutSet[];
}

export function exerciseSeries(exerciseId: string, workouts: LoggedWorkout[]): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const { workout, entries } of workouts) {
    for (const { exercise: ex, sets } of entries) {
      if (ex.id !== exerciseId || sets.length === 0) continue;
      let best = 0;
      let topWeight = 0;
      let topReps = 0;
      let bestTime = 0;
      let timeWeight = 0;
      for (const s of sets) {
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        if (ex.type === 'weight_reps' && s.weight != null && s.reps != null) best = Math.max(best, e1rm(w, r));
        if (w > topWeight || (w === topWeight && r > topReps)) {
          topWeight = w;
          topReps = r;
        }
        const t = s.durationS ?? 0;
        if (w > timeWeight || (w === timeWeight && t > bestTime)) {
          timeWeight = w;
          bestTime = t;
        }
      }
      out.push({
        date: workout.date,
        workoutId: workout.id,
        e1rm: Math.round(best * 10) / 10,
        topWeight,
        topReps,
        maxReps: Math.max(0, ...sets.map((s) => s.reps ?? 0)),
        totalReps: sets.reduce((n, s) => n + (s.reps ?? 0), 0),
        volume: exerciseVolume(ex, sets),
        bestTime,
        timeWeight,
        sets,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Best value of a metric in the last `days` vs the `days` before that. null = no data in a window. */
export function comparePeriods(
  points: { date: string }[],
  value: (p: never) => number,
  today: string,
  days = 28,
): { current: number | null; previous: number | null } {
  const curStart = addDays(today, -(days - 1));
  const prevStart = addDays(curStart, -days);
  const v = value as (p: { date: string }) => number;
  const max = (xs: { date: string }[]) => (xs.length ? Math.max(...xs.map(v)) : null);
  return {
    current: max(points.filter((p) => p.date >= curStart && p.date <= today)),
    previous: max(points.filter((p) => p.date >= prevStart && p.date < curStart)),
  };
}

// ---------- Weekly ----------

export interface WeekStat {
  week: string;
  volume: number;
  workouts: number;
  durationMin: number | null; // average, only workouts with a real duration
}

/** One entry per week from the first week in range to the week of `today` (empty weeks included). */
export function weeklyStats(workouts: LoggedWorkout[], fromDate: string, today: string): WeekStat[] {
  const map = new Map<string, { volume: number; workouts: number; durations: number[] }>();
  for (let w = weekStart(fromDate); w <= weekStart(today); w = addDays(w, 7)) map.set(w, { volume: 0, workouts: 0, durations: [] });
  for (const { workout, entries } of workouts) {
    const wk = map.get(weekStart(workout.date));
    if (!wk) continue;
    wk.workouts++;
    wk.volume += entries.reduce((v, e) => v + exerciseVolume(e.exercise, e.sets), 0);
    if (workout.finishedAt && workout.finishedAt - workout.startedAt > 5 * 60_000) {
      wk.durations.push((workout.finishedAt - workout.startedAt) / 60_000);
    }
  }
  return [...map.entries()].map(([week, s]) => ({
    week,
    volume: s.volume,
    workouts: s.workouts,
    durationMin: s.durations.length ? s.durations.reduce((a, b) => a + b, 0) / s.durations.length : null,
  }));
}

export function workoutVolume(w: LoggedWorkout): number {
  return w.entries.reduce((v, e) => v + exerciseVolume(e.exercise, e.sets), 0);
}

// ---------- Muscles ----------

export const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs'];

/**
 * Weighted working sets per muscle group: each completed set counts its muscle weight
 * (1 primary, ½ secondary). Unilateral sets count once per pair (L+R = one set).
 */
export function muscleSets(workouts: LoggedWorkout[]): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<MuscleGroup, number>;
  for (const { entries } of workouts) {
    for (const { exercise, sets } of entries) {
      const n = exercise.unilateral ? new Set(sets.map((s) => s.position)).size : sets.length;
      for (const [m, w] of Object.entries(exercise.muscles) as [MuscleGroup, number][]) out[m] += n * w;
    }
  }
  return out;
}

export function muscleSetsByWeek(workouts: LoggedWorkout[], muscle: MuscleGroup, fromDate: string, today: string) {
  const weeks = weeklyStats([], fromDate, today).map((w) => w.week);
  return weeks.map((week) => ({
    week,
    sets: muscleSets(workouts.filter((w) => weekStart(w.workout.date) === week))[muscle],
  }));
}
