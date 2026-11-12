import type { Exercise, WorkoutSet } from './types';

/**
 * Tonnage of completed working sets: weight × reps × loadFactor.
 * Unilateral sides are separate sets, so both sides add up naturally.
 * Timed and bodyweight sets without extra weight contribute nothing (tracked separately).
 */
export function setVolume(ex: Exercise, s: Pick<WorkoutSet, 'weight' | 'reps' | 'completedAt' | 'isWarmup' | 'deletedAt'>): number {
  if (s.completedAt == null || s.isWarmup || s.deletedAt != null) return 0;
  if (ex.type === 'timed_tempo') return 0;
  if (s.weight == null || s.reps == null) return 0;
  return s.weight * s.reps * ex.loadFactor;
}

export function exerciseVolume(ex: Exercise, sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + setVolume(ex, s), 0);
}

export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}
