import { describe, expect, it } from 'vitest';
import { classifyPastDays, monthGrid } from './history';
import { exerciseVolume } from './stats';
import type { Exercise, WorkoutSet } from './types';

const days = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `d${n}`, position: n - 1 }));
const w = (date: string, planDayId: string) => ({ date, planDayId, finishedAt: 1 });

describe('classifyPastDays', () => {
  it('marks the day after Day 6 as rest and other empty days as gaps', () => {
    const m = classifyPastDays(
      days,
      [w('2026-11-01', 'd5'), w('2026-11-02', 'd6'), w('2026-11-04', 'd1'), w('2026-11-07', 'd2')],
      new Set(['2026-11-06']),
      '2026-11-09',
    );
    expect(m.get('2026-11-03')).toBe('rest'); // after Day 6
    expect(m.get('2026-11-05')).toBe('gap');
    expect(m.get('2026-11-06')).toBe('rest'); // explicit
    expect(m.get('2026-11-08')).toBe('gap');
    expect(m.has('2026-11-04')).toBe(false); // trained
    expect(m.has('2026-11-09')).toBe(false); // until is exclusive
  });
});

describe('monthGrid', () => {
  it('builds whole Monday-first weeks', () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g[0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(g[6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(g.length % 7).toBe(0);
    expect(g.at(-1)!.date).toBe('2026-12-06');
  });
});

describe('volume', () => {
  const base = { completedAt: 1, isWarmup: false, deletedAt: null } as unknown as WorkoutSet;
  it('weight × reps × loadFactor, only completed sets, timed excluded', () => {
    const db = { type: 'weight_reps', loadFactor: 2 } as Exercise;
    expect(
      exerciseVolume(db, [
        { ...base, weight: 14, reps: 10 },
        { ...base, weight: 14, reps: 8 },
        { ...base, weight: 14, reps: 8, completedAt: null },
      ]),
    ).toBe(14 * 10 * 2 + 14 * 8 * 2);
    const timed = { type: 'timed_tempo', loadFactor: 1 } as Exercise;
    expect(exerciseVolume(timed, [{ ...base, weight: 20, reps: null, durationS: 150 }])).toBe(0);
  });
});
