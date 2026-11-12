import { describe, expect, it } from 'vitest';
import { detectPRs, e1rm } from './records';
import type { Exercise } from './types';

let n = 0;
const set = (weight: number | null, reps: number | null, durationS: number | null = null) => ({
  id: `s${n++}`,
  weight,
  reps,
  durationS,
  completedAt: 1,
  isWarmup: false,
  deletedAt: null,
});
const bench = { type: 'weight_reps', loadFactor: 1 } as Exercise;

describe('records', () => {
  it('Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(80, 10)).toBeCloseTo(106.67, 1);
  });

  it('no PRs on the very first session', () => {
    expect(detectPRs(bench, [], [set(80, 10)])).toEqual([]);
  });

  it('detects heavier weight, better e1RM and more volume', () => {
    const prev = [[set(80, 10), set(80, 9), set(80, 8)]];
    const cur = [set(82.5, 10), set(82.5, 9), set(82.5, 8)];
    const kinds = detectPRs(bench, prev, cur).map((p) => p.kind).sort();
    expect(kinds).toEqual(['e1rm', 'volume', 'weight']);
    const w = detectPRs(bench, prev, cur).find((p) => p.kind === 'weight')!;
    expect(w).toMatchObject({ setId: cur[0].id, value: 82.5, previous: 80 });
  });

  it('more reps at the same weight', () => {
    const prev = [[set(80, 10), set(80, 9)]];
    const cur = [set(80, 11), set(80, 9)];
    const prs = detectPRs(bench, prev, cur);
    expect(prs.find((p) => p.kind === 'repsAtWeight')).toMatchObject({ value: 11, previous: 10, atWeight: 80, setId: cur[0].id });
    expect(prs.some((p) => p.kind === 'weight')).toBe(false);
  });

  it('no PR when performance drops', () => {
    expect(detectPRs(bench, [[set(80, 12), set(80, 11)]], [set(80, 10), set(80, 9)])).toEqual([]);
  });

  it('only completed sets count', () => {
    const open = { ...set(100, 10), completedAt: null };
    expect(detectPRs(bench, [[set(80, 10)]], [open])).toEqual([]);
  });

  it('slow tempo: longer time at the same weight, and first heavier weight', () => {
    const squat = { type: 'timed_tempo', loadFactor: 1 } as Exercise;
    const prev = [[set(0, null, 150)], [set(0, null, 170)]];
    expect(detectPRs(squat, prev, [set(0, null, 185)])).toEqual([
      expect.objectContaining({ kind: 'time', value: 185, previous: 170, atWeight: 0 }),
    ]);
    const heavier = detectPRs(squat, prev, [set(2.5, null, 90)]);
    expect(heavier.map((p) => p.kind)).toEqual(['weight']);
  });

  it('bodyweight: most reps', () => {
    const crunch = { type: 'bodyweight_reps', loadFactor: 1 } as Exercise;
    const prs = detectPRs(crunch, [[set(null, 20)]], [set(null, 25)]);
    expect(prs.map((p) => p.kind).sort()).toEqual(['reps', 'repsAtWeight']);
  });
});
