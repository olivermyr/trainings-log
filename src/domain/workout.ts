import type { Exercise, Side, WorkoutSet } from './types';

/** Minimal set shape used by the pure logic below. */
export interface SetValues {
  position: number;
  side: Side;
  weight: number | null;
  reps: number | null;
  durationS: number | null;
}

const sideOrder = (s: Side) => (s === 'L' ? 0 : s === 'R' ? 1 : 0);

export function sortSets<T extends { position: number; side: Side }>(sets: T[]): T[] {
  return [...sets].sort((a, b) => a.position - b.position || sideOrder(a.side) - sideOrder(b.side));
}

/** Only completed working sets count as "performance". */
export function performedSets<T extends WorkoutSet>(sets: T[]): T[] {
  return sortSets(sets.filter((s) => s.deletedAt == null && s.completedAt != null && !s.isWarmup));
}

function sidesFor(e: Exercise): Side[] {
  return e.unilateral && e.type !== 'timed_tempo' ? ['L', 'R'] : [null];
}

/** Find the previous value for a given slot: same position+side, else the last set of that side. */
export function previousFor(prev: SetValues[], position: number, side: Side): SetValues | undefined {
  const sameSide = prev.filter((p) => p.side === side);
  return sameSide.find((p) => p.position === position) ?? sameSide.at(-1);
}

/**
 * Initial sets for a new workout: target number of sets, prefilled with the values of the
 * last time this exercise was performed (same set number and side where possible).
 */
export function buildInitialSets(e: Exercise, prev: SetValues[]): SetValues[] {
  const count = Math.max(e.targetSets, 1);
  const out: SetValues[] = [];
  for (let position = 0; position < count; position++) {
    for (const side of sidesFor(e)) {
      const p = previousFor(prev, position, side);
      if (e.type === 'timed_tempo') {
        out.push({ position, side, weight: p?.weight ?? 0, reps: null, durationS: null });
      } else {
        out.push({ position, side, weight: p?.weight ?? null, reps: p?.reps ?? null, durationS: null });
      }
    }
  }
  return out;
}

/** Values for an added set: copy the last existing set of each side. */
export function nextSetValues(e: Exercise, existing: SetValues[]): SetValues[] {
  const sorted = sortSets(existing);
  const position = sorted.length ? sorted.at(-1)!.position + 1 : 0;
  return sidesFor(e).map((side) => {
    const last = [...sorted].reverse().find((s) => s.side === side);
    return {
      position,
      side,
      weight: last?.weight ?? (e.type === 'timed_tempo' ? 0 : null),
      reps: e.type === 'timed_tempo' ? null : (last?.reps ?? null),
      durationS: null,
    };
  });
}

export interface Suggestion {
  weight: number;
  reason: string;
}

/**
 * Double progression:
 * - weight_reps: set 1 reached the top of the rep range → previous weight + increment
 *   (unilateral: the weaker side decides).
 * - timed_tempo: target time reached → previous weight + increment.
 */
export function progressionSuggestion(e: Exercise, prev: SetValues[]): Suggestion | null {
  if (prev.length === 0) return null;
  if (e.type === 'weight_reps') {
    const first = prev.filter((p) => p.position === Math.min(...prev.map((x) => x.position)));
    if (first.length === 0 || first.some((p) => p.weight == null || p.reps == null)) return null;
    const minReps = Math.min(...first.map((p) => p.reps!));
    if (minReps < e.repMax) return null;
    const weight = Math.max(...first.map((p) => p.weight!));
    return { weight: round(weight + e.increment), reason: `${minReps} reps in set 1 last time` };
  }
  if (e.type === 'timed_tempo' && e.targetSeconds) {
    const best = prev.find((p) => (p.durationS ?? 0) >= e.targetSeconds!);
    if (!best) return null;
    return { weight: round((best.weight ?? 0) + e.increment), reason: 'Target time reached last time' };
  }
  return null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Parse user input like "82,5" or "82.5". Empty → null. */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "2:30" → 150, "150" → 150, "" → null. */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (t === '') return null;
  const m = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
