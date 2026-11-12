/**
 * Training cycle: Day 1 → … → Day N → rest day → Day 1 …
 *
 * The next workout is derived from the last COMPLETED workout, never from the weekday.
 * A day without training simply shifts everything back by one day (order is preserved).
 * The rest day after the last plan day is "used up" by the first calendar day after it.
 */

export interface CycleDay {
  id: string;
  position: number;
}

export interface LastDone {
  planDayId: string | null;
  date: string; // YYYY-MM-DD
}

export type Slot =
  | { date: string; kind: 'workout'; planDayId: string }
  | { date: string; kind: 'rest' };

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Index into the cycle [day0, day1, …, dayN-1, REST] of the next slot,
 * plus whether that rest slot falls on `from`.
 */
function nextIndex(days: CycleDay[], last: LastDone | null, from: string): number {
  if (!last || last.planDayId == null) return 0;
  const idx = days.findIndex((d) => d.id === last.planDayId);
  if (idx === -1) return 0;
  if (idx < days.length - 1) return idx + 1;
  // Last plan day done: rest day is the first calendar day after it, if still ahead.
  return from === addDays(last.date, 1) ? days.length : 0;
}

/**
 * Projects the schedule for `count` calendar days starting at `from`.
 * `from` should be today, or tomorrow if a workout was already completed today.
 */
export function projectSchedule(
  daysUnsorted: CycleDay[],
  last: LastDone | null,
  from: string,
  count: number,
): Slot[] {
  const days = [...daysUnsorted].sort((a, b) => a.position - b.position);
  if (days.length === 0) return [];
  const cycleLen = days.length + 1; // + rest
  let i = nextIndex(days, last, from);
  const out: Slot[] = [];
  for (let n = 0; n < count; n++) {
    const date = addDays(from, n);
    out.push(i === days.length ? { date, kind: 'rest' } : { date, kind: 'workout', planDayId: days[i].id });
    i = (i + 1) % cycleLen;
  }
  return out;
}

/** The next plan day to train (skipping a pending rest day). */
export function nextPlanDayId(days: CycleDay[], last: LastDone | null, from: string): string | null {
  const slots = projectSchedule(days, last, from, 2);
  const w = slots.find((s) => s.kind === 'workout');
  return w && w.kind === 'workout' ? w.planDayId : null;
}
