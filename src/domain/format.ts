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

/** "Day 2 – Chest, Back & Abs" → { short: "Day 2", title: "Chest, Back & Abs" } */
export function splitDayName(name: string): { short: string; title: string } {
  const m = name.match(/^(.+?)\s+[–-]\s+(.+)$/);
  return m ? { short: m[1], title: m[2] } : { short: name, title: '' };
}
