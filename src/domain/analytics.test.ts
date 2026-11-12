import { describe, expect, it } from 'vitest';
import { comparePeriods, exerciseSeries, muscleSets, weekStart, weeklyStats, type LoggedWorkout } from './analytics';
import type { Exercise, Workout, WorkoutSet } from './types';

const ex = (id: string, extra: Partial<Exercise> = {}) =>
  ({ id, type: 'weight_reps', loadFactor: 1, unilateral: false, muscles: { chest: 1, triceps: 0.5 }, ...extra }) as Exercise;
let k = 0;
const set = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}) =>
  ({ id: `s${k++}`, position: k, side: null, weight, reps, durationS: null, completedAt: 1, isWarmup: false, deletedAt: null, ...extra }) as WorkoutSet;
const wo = (date: string, entries: LoggedWorkout['entries'], mins = 60): LoggedWorkout => ({
  workout: { id: date, date, startedAt: 0, finishedAt: mins * 60_000 } as Workout,
  entries,
});

describe('analytics', () => {
  it('weekStart is Monday', () => {
    expect(weekStart('2026-11-12')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
  });

  it('exercise series: e1RM, top set, volume per session, sorted by date', () => {
    const bench = ex('b');
    const pts = exerciseSeries('b', [
      wo('2026-11-11', [{ exercise: bench, sets: [set(82.5, 10), set(82.5, 8)] }]),
      wo('2026-11-04', [{ exercise: bench, sets: [set(80, 10), set(80, 9)] }]),
    ]);
    expect(pts.map((p) => p.date)).toEqual(['2026-11-04', '2026-11-11']);
    expect(pts[1]).toMatchObject({ topWeight: 82.5, topReps: 10, e1rm: 110, volume: 82.5 * 18 });
  });

  it('compares the best of the last 4 weeks with the 4 weeks before', () => {
    const pts = [
      { date: '2026-10-01', v: 100 },
      { date: '2026-10-10', v: 104 },
      { date: '2026-10-20', v: 106 },
      { date: '2026-11-10', v: 108 },
    ];
    expect(comparePeriods(pts, ((p: { v: number }) => p.v) as never, '2026-11-12')).toEqual({ current: 108, previous: 104 });
  });

  it('weekly stats include empty weeks and average real durations', () => {
    const bench = ex('b');
    const weeks = weeklyStats(
      [wo('2026-11-02', [{ exercise: bench, sets: [set(100, 10)] }], 60), wo('2026-11-03', [], 2)],
      '2026-10-26',
      '2026-11-12',
    );
    expect(weeks.map((w) => w.week)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(weeks[1]).toMatchObject({ volume: 1000, workouts: 2, durationMin: 60 });
    expect(weeks[2].workouts).toBe(0);
  });

  it('muscle sets are weighted; unilateral pairs count once', () => {
    const bench = ex('b');
    const pushdown = ex('p', { unilateral: true, muscles: { triceps: 1 } });
    const m = muscleSets([
      wo('2026-11-10', [
        { exercise: bench, sets: [set(80, 10), set(80, 9), set(80, 8)] },
        { exercise: pushdown, sets: [set(15, 10, { position: 0, side: 'L' }), set(15, 10, { position: 0, side: 'R' })] },
      ]),
    ]);
    expect(m.chest).toBe(3);
    expect(m.triceps).toBe(1.5 + 1);
    expect(m.legs).toBe(0);
  });
});
