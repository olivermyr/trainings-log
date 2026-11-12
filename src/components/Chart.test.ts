import { describe, expect, it } from 'vitest';
import { niceTicks } from './Chart';

describe('niceTicks', () => {
  it('covers the range with clean steps', () => {
    expect(niceTicks(95, 112)).toEqual([95, 100, 105, 110, 115]);
  });
  it('integer mode never uses fractional steps', () => {
    expect(niceTicks(0, 7, 3, 'integer').every(Number.isInteger)).toBe(true);
  });
  it('time mode uses whole minutes or 15/30 s steps', () => {
    expect(niceTicks(150, 300, 4, 'time')).toEqual([120, 180, 240, 300]);
  });
});
