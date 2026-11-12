import { setVolume } from './stats';
import type { Exercise, WorkoutSet } from './types';

/** Epley estimate. 1 rep = the weight itself. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export type RecordKind = 'weight' | 'e1rm' | 'repsAtWeight' | 'volume' | 'reps' | 'time';

export const RECORD_LABEL: Record<RecordKind, string> = {
  weight: 'Heaviest weight',
  e1rm: 'Best estimated 1RM',
  repsAtWeight: 'Most reps at this weight',
  volume: 'Most volume',
  reps: 'Most reps',
  time: 'Longest time',
};

export interface PR {
  kind: RecordKind;
  /** null for exercise-level records (volume). */
  setId: string | null;
  value: number;
  previous: number;
  /** Weight the record refers to (repsAtWeight, time). */
  atWeight?: number;
}

type S = Pick<WorkoutSet, 'id' | 'weight' | 'reps' | 'durationS' | 'completedAt' | 'isWarmup' | 'deletedAt'>;

const counted = (s: S) => s.completedAt != null && !s.isWarmup && s.deletedAt == null;

interface Bests {
  weight: number;
  e1rm: number;
  volume: number;
  reps: number;
  repsAtWeight: Map<number, number>;
  timeAtWeight: Map<number, number>;
}

/** Best values across previous sessions (each session = the sets of one workout). */
export function bestsFrom(ex: Exercise, sessions: S[][]): Bests {
  const b: Bests = { weight: 0, e1rm: 0, volume: 0, reps: 0, repsAtWeight: new Map(), timeAtWeight: new Map() };
  for (const sets of sessions) {
    let vol = 0;
    for (const s of sets.filter(counted)) {
      vol += setVolume(ex, s as WorkoutSet);
      const w = s.weight ?? 0;
      if (ex.type === 'timed_tempo') {
        if (s.durationS != null) b.timeAtWeight.set(w, Math.max(b.timeAtWeight.get(w) ?? 0, s.durationS));
        b.weight = Math.max(b.weight, w);
        continue;
      }
      if (s.reps == null) continue;
      b.reps = Math.max(b.reps, s.reps);
      b.repsAtWeight.set(w, Math.max(b.repsAtWeight.get(w) ?? 0, s.reps));
      if (ex.type === 'weight_reps' && s.weight != null) {
        b.weight = Math.max(b.weight, s.weight);
        b.e1rm = Math.max(b.e1rm, e1rm(s.weight, s.reps));
      }
    }
    b.volume = Math.max(b.volume, vol);
  }
  return b;
}

/**
 * PRs set in `current` compared to all earlier sessions.
 * The very first session of an exercise sets a baseline and produces no PRs (no noise on day one).
 * Each record kind is attributed to the single best set of the session.
 */
export function detectPRs(ex: Exercise, previousSessions: S[][], current: S[]): PR[] {
  const hasHistory = previousSessions.some((ss) => ss.some(counted));
  if (!hasHistory) return [];
  const prev = bestsFrom(ex, previousSessions);
  const sets = current.filter(counted);
  const out: PR[] = [];
  const best = <T>(items: T[], score: (t: T) => number) =>
    items.reduce<T | null>((a, t) => (a == null || score(t) > score(a) ? t : a), null);

  if (ex.type === 'timed_tempo') {
    const timed = sets.filter((s) => s.durationS != null);
    const heaviest = best(timed, (s) => s.weight ?? 0);
    if (heaviest && (heaviest.weight ?? 0) > prev.weight) {
      out.push({ kind: 'weight', setId: heaviest.id, value: heaviest.weight ?? 0, previous: prev.weight });
    }
    for (const s of timed) {
      const w = s.weight ?? 0;
      const before = prev.timeAtWeight.get(w);
      if (before != null && s.durationS! > before) {
        out.push({ kind: 'time', setId: s.id, value: s.durationS!, previous: before, atWeight: w });
      }
    }
    return out;
  }

  const withReps = sets.filter((s) => s.reps != null);
  if (ex.type === 'weight_reps') {
    const weighted = withReps.filter((s) => s.weight != null);
    const heaviest = best(weighted, (s) => s.weight!);
    if (heaviest && heaviest.weight! > prev.weight)
      out.push({ kind: 'weight', setId: heaviest.id, value: heaviest.weight!, previous: prev.weight });
    const top = best(weighted, (s) => e1rm(s.weight!, s.reps!));
    if (top && e1rm(top.weight!, top.reps!) > prev.e1rm + 1e-9)
      out.push({ kind: 'e1rm', setId: top.id, value: round1(e1rm(top.weight!, top.reps!)), previous: round1(prev.e1rm) });
  } else {
    const most = best(withReps, (s) => s.reps!);
    if (most && most.reps! > prev.reps) out.push({ kind: 'reps', setId: most.id, value: most.reps!, previous: prev.reps });
  }

  // Most reps at a weight that was used before (best set per weight only).
  const byWeight = new Map<number, S>();
  for (const s of withReps) {
    const w = s.weight ?? 0;
    const cur = byWeight.get(w);
    if (!cur || s.reps! > cur.reps!) byWeight.set(w, s);
  }
  for (const [w, s] of byWeight) {
    const before = prev.repsAtWeight.get(w);
    if (before != null && s.reps! > before)
      out.push({ kind: 'repsAtWeight', setId: s.id, value: s.reps!, previous: before, atWeight: w });
  }

  if (ex.type === 'weight_reps') {
    const vol = sets.reduce((v, s) => v + setVolume(ex, s as WorkoutSet), 0);
    if (vol > prev.volume && prev.volume > 0) out.push({ kind: 'volume', setId: null, value: vol, previous: prev.volume });
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Single comparable score per exercise session for "better/worse than last time". */
export function sessionScore(ex: Exercise, sets: S[]): number {
  const c = sets.filter(counted);
  if (ex.type === 'timed_tempo') return Math.max(0, ...c.map((s) => (s.durationS ?? 0) + (s.weight ?? 0) * 60));
  if (ex.type === 'bodyweight_reps') return c.reduce((n, s) => n + (s.reps ?? 0), 0);
  return Math.max(0, ...c.map((s) => (s.weight != null && s.reps != null ? e1rm(s.weight, s.reps) : 0)));
}
