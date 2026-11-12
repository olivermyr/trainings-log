import { addDays } from './cycle';

export type MetricGroup = 'body' | 'measurements' | 'recovery';

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  group: MetricGroup;
  /** decimals shown */
  decimals: number;
  /** input hint */
  placeholder: string;
  custom?: boolean;
}

export const BUILTIN_METRICS: MetricDef[] = [
  { key: 'weight', label: 'Body weight', unit: 'kg', group: 'body', decimals: 1, placeholder: '82.4' },
  { key: 'bodyFat', label: 'Body fat', unit: '%', group: 'body', decimals: 1, placeholder: '12.5' },
  { key: 'arm', label: 'Arm', unit: 'cm', group: 'measurements', decimals: 1, placeholder: '38' },
  { key: 'chest', label: 'Chest', unit: 'cm', group: 'measurements', decimals: 1, placeholder: '104' },
  { key: 'waist', label: 'Waist', unit: 'cm', group: 'measurements', decimals: 1, placeholder: '80' },
  { key: 'thigh', label: 'Thigh', unit: 'cm', group: 'measurements', decimals: 1, placeholder: '58' },
  { key: 'restingHr', label: 'Resting heart rate', unit: 'bpm', group: 'recovery', decimals: 0, placeholder: '52' },
  { key: 'hrv', label: 'HRV', unit: 'ms', group: 'recovery', decimals: 0, placeholder: '75' },
  { key: 'sleep', label: 'Sleep', unit: 'h', group: 'recovery', decimals: 2, placeholder: '7:30' },
];

export const GROUP_LABEL: Record<MetricGroup, string> = {
  body: 'Body',
  measurements: 'Measurements',
  recovery: 'Recovery',
};

/** Parses a metric input. Sleep accepts "7:30" (h:mm) or "7.5". */
export function parseMetric(key: string, input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (t === '') return null;
  if (key === 'sleep') {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const mins = Number(m[2]);
      return mins < 60 ? Math.round((Number(m[1]) + mins / 60) * 100) / 100 : null;
    }
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatMetric(def: Pick<MetricDef, 'key' | 'decimals'>, v: number): string {
  if (def.key === 'sleep') {
    const total = Math.round(v * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  const s = v.toFixed(def.decimals);
  return def.decimals > 0 ? s.replace(/\.0+$/, '') : s;
}

export function ageFrom(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export interface Entry {
  date: string;
  value: number;
}

/** Latest value and the change since the last entry at least `days` days before it. */
export function latestWithChange(entries: Entry[], days = 28): { latest: Entry; change: number | null; since: string | null } | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted.at(-1)!;
  const cutoff = addDays(latest.date, -days);
  const base = [...sorted].reverse().find((e) => e.date <= cutoff) ?? (sorted.length > 1 ? sorted[0] : null);
  return { latest, change: base ? latest.value - base.value : null, since: base?.date ?? null };
}

export function slugKey(label: string): string {
  return 'c_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
}
