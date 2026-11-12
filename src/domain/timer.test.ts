import { describe, expect, it } from 'vitest';
import { countdownText, extendRest, remainingMs, restProgress, startRest, tempoState } from './timer';

describe('rest timer', () => {
  const t0 = 1_000_000;
  it('derives remaining time from timestamps', () => {
    const t = startRest(t0, 90, 'Bench');
    expect(remainingMs(t, t0 + 30_000)).toBe(60_000);
    expect(restProgress(t, t0 + 45_000)).toBe(0.5);
    // still correct after a long "screen lock"
    expect(remainingMs(t, t0 + 200_000)).toBeLessThan(0);
  });
  it('extends a running timer and restarts an expired one', () => {
    const t = startRest(t0, 60, 'x');
    expect(extendRest(t, 30, t0 + 10_000).endsAt).toBe(t0 + 90_000);
    const expired = extendRest(t, 30, t0 + 100_000);
    expect(expired.endsAt).toBe(t0 + 130_000);
    expect(expired.startedAt).toBe(t0 + 100_000);
  });
  it('rounds the countdown up', () => {
    expect(countdownText(59_001)).toBe('1:00');
    expect(countdownText(1)).toBe('0:01');
    expect(countdownText(-500)).toBe('0:00');
  });
});

describe('tempo stopwatch', () => {
  const sw = { setId: 's', startedAt: 10_000 };
  it('shows the lead-in before start', () => {
    expect(tempoState(sw, 8_000, 7).phase).toBe('lead-in');
  });
  it('alternates 7 s down / 7 s up and counts reps', () => {
    expect(tempoState(sw, 10_000 + 3_500, 7)).toMatchObject({ phase: 'down', phaseProgress: 0.5, reps: 0 });
    expect(tempoState(sw, 10_000 + 7_000, 7)).toMatchObject({ phase: 'up', phaseProgress: 0, reps: 0 });
    expect(tempoState(sw, 10_000 + 14_000, 7)).toMatchObject({ phase: 'down', reps: 1 });
    expect(tempoState(sw, 10_000 + 150_000, 7).reps).toBe(10); // 2:30 → 10 full reps
  });
});
