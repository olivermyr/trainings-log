import { describe, expect, it } from 'vitest';
import { ageFrom, formatMetric, latestWithChange, parseMetric, slugKey } from './body';

describe('body metrics', () => {
  it('parses sleep as h:mm or decimal hours', () => {
    expect(parseMetric('sleep', '7:30')).toBe(7.5);
    expect(parseMetric('sleep', '7,25')).toBe(7.25);
    expect(parseMetric('sleep', '7:75')).toBeNull();
    expect(formatMetric({ key: 'sleep', decimals: 2 }, 7.5)).toBe('7:30');
  });
  it('rejects empty, zero and negative values', () => {
    expect(parseMetric('weight', '')).toBeNull();
    expect(parseMetric('weight', '0')).toBeNull();
    expect(parseMetric('weight', '-3')).toBeNull();
    expect(parseMetric('weight', '82,4')).toBe(82.4);
  });
  it('formats decimals', () => {
    expect(formatMetric({ key: 'weight', decimals: 1 }, 82)).toBe('82');
    expect(formatMetric({ key: 'weight', decimals: 1 }, 82.44)).toBe('82.4');
    expect(formatMetric({ key: 'hrv', decimals: 0 }, 74.6)).toBe('75');
  });
  it('computes age correctly around the birthday', () => {
    expect(ageFrom('2007-11-13', '2026-11-12')).toBe(18);
    expect(ageFrom('2007-11-12', '2026-11-12')).toBe(19);
  });
  it('change vs ~4 weeks earlier, falling back to the first entry', () => {
    const r = latestWithChange([
      { date: '2026-09-01', value: 84 },
      { date: '2026-10-10', value: 83 },
      { date: '2026-11-12', value: 82 },
    ]);
    expect(r).toMatchObject({ latest: { value: 82 }, change: -1, since: '2026-10-10' });
    expect(latestWithChange([{ date: '2026-11-01', value: 80 }, { date: '2026-11-10', value: 81 }])).toMatchObject({ change: 1, since: '2026-11-01' });
    expect(latestWithChange([{ date: '2026-11-10', value: 81 }])!.change).toBeNull();
  });
  it('slugs custom keys', () => {
    expect(slugKey('Calf (left)')).toBe('c_calf_left');
  });
});
