/**
 * Timers store absolute timestamps, never a ticking counter. That keeps them correct across
 * screen lock, navigation, app suspension and reloads: remaining time is always derived from "now".
 */

export interface RestTimer {
  startedAt: number;
  endsAt: number;
  label: string;
}

export function startRest(now: number, seconds: number, label: string): RestTimer {
  return { startedAt: now, endsAt: now + seconds * 1000, label };
}

export function remainingMs(t: RestTimer, now: number): number {
  return t.endsAt - now;
}

/** 0..1 progress of the rest period. */
export function restProgress(t: RestTimer, now: number): number {
  const total = t.endsAt - t.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - t.startedAt) / total));
}

export function extendRest(t: RestTimer, seconds: number, now: number): RestTimer {
  // Extending an expired timer restarts from now.
  const base = Math.max(t.endsAt, now);
  return { ...t, endsAt: base + seconds * 1000, startedAt: t.endsAt < now ? now : t.startedAt };
}

/** Countdown text that rounds UP, so "0:01" is shown until the very end. */
export function countdownText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Slow-tempo stopwatch ----------

export interface Stopwatch {
  setId: string;
  /** Moment the clock reaches 0:00 (after the lead-in countdown). */
  startedAt: number;
}

export const LEAD_IN_MS = 3000;

export interface TempoState {
  /** Elapsed ms since start (negative during lead-in). */
  elapsedMs: number;
  phase: 'lead-in' | 'down' | 'up';
  /** 0..1 fill of the tempo bar within the current phase. */
  phaseProgress: number;
  /** Completed full reps (down + up). */
  reps: number;
}

export function tempoState(sw: Stopwatch, now: number, tempoSeconds: number): TempoState {
  const elapsedMs = now - sw.startedAt;
  if (elapsedMs < 0) return { elapsedMs, phase: 'lead-in', phaseProgress: 0, reps: 0 };
  const phaseMs = tempoSeconds * 1000;
  const phaseIndex = Math.floor(elapsedMs / phaseMs);
  return {
    elapsedMs,
    phase: phaseIndex % 2 === 0 ? 'down' : 'up',
    phaseProgress: (elapsedMs % phaseMs) / phaseMs,
    reps: Math.floor(elapsedMs / (2 * phaseMs)),
  };
}
