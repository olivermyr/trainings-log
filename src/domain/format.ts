import type { Exercise } from './types';

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Short target description, e.g. "3 × 8–12", "1 × 5:00", "3 × 8–12 / side". */
export function targetLabel(e: Exercise): string {
  if (e.type === 'timed_tempo') return `${e.targetSets} × ${formatDuration(e.targetSeconds ?? 0)}`;
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
  return `${e.targetSets} × ${reps}${e.unilateral ? ' / side' : ''}`;
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const weekdayShort = (date: string) => WEEKDAY.format(parseLocalDate(date));
export const dayMonth = (date: string) => DAY_MONTH.format(parseLocalDate(date));

/** Plan days are numbered by their position, so reordering keeps "Day 1…N" consistent. */
export const dayLabel = (d: { position: number }) => `Day ${d.position + 1}`;
export const dayTag = (d: { position: number }) => `D${d.position + 1}`;

export function formatKg(n: number | null | undefined): string {
  if (n == null) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '');
}

/** Compact one-line summary of a session, e.g. "80 kg × 10 · 9 · 8". Unilateral: left side shown. */
export function compactSets(
  e: Pick<Exercise, 'type'>,
  sets: { side: 'L' | 'R' | null; weight: number | null; reps: number | null; durationS: number | null }[],
): string {
  const ss = sets.filter((s) => s.side !== 'R');
  if (ss.length === 0) return '';
  if (e.type === 'timed_tempo') {
    const s = ss[0];
    return `${formatDuration(s.durationS ?? 0)}${s.weight ? ` @ ${formatKg(s.weight)} kg` : ''}`;
  }
  if (e.type === 'bodyweight_reps' && ss.every((s) => !s.weight)) return `${ss.map((s) => s.reps).join(' · ')} reps`;
  const sameWeight = ss.every((s) => s.weight === ss[0].weight);
  if (sameWeight) return `${formatKg(ss[0].weight)} kg × ${ss.map((s) => s.reps).join(' · ')}`;
  return ss.map((s) => `${formatKg(s.weight)}×${s.reps}`).join(' · ');
}
