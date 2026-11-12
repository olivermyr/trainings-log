import { addDays, type CycleDay } from './cycle';

export interface DoneWorkoutRef {
  date: string;
  planDayId: string | null;
  finishedAt: number | null;
}

export type PastMark = 'rest' | 'gap';

/**
 * Classifies past days without a workout, between the first logged workout and `until` (exclusive):
 * - 'rest': the scheduled rest day right after the last plan day, or a day explicitly marked as rest
 * - 'gap':  any other day without training (the plan simply shifted)
 */
export function classifyPastDays(
  daysUnsorted: CycleDay[],
  workouts: DoneWorkoutRef[],
  explicitRest: Set<string>,
  until: string,
): Map<string, PastMark> {
  const out = new Map<string, PastMark>();
  if (workouts.length === 0) return out;
  const days = [...daysUnsorted].sort((a, b) => a.position - b.position);
  const lastDayId = days.at(-1)?.id;
  const byDate = new Map<string, DoneWorkoutRef[]>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  const first = [...byDate.keys()].sort()[0];

  let lastTrained: DoneWorkoutRef | null = null;
  for (let d = first; d < until; d = addDays(d, 1)) {
    const today = byDate.get(d);
    if (today) {
      lastTrained = [...today].sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0)).at(-1)!;
      continue;
    }
    const scheduledRest = lastTrained?.planDayId === lastDayId && d === addDays(lastTrained!.date, 1);
    out.set(d, scheduledRest || explicitRest.has(d) ? 'rest' : 'gap');
  }
  return out;
}

/** Monday-first grid of dates for a month view (always whole weeks). */
export function monthGrid(year: number, month0: number): { date: string; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, month0, 1 - offset));
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const out: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < cells; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    out.push({ date: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === month0 });
  }
  return out;
}
