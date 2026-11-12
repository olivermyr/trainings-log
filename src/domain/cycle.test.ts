import { describe, expect, it } from 'vitest';
import { addDays, nextPlanDayId, projectSchedule } from './cycle';

const days = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `d${n}`, position: n - 1 }));
const kinds = (s: ReturnType<typeof projectSchedule>) =>
  s.map((x) => (x.kind === 'rest' ? 'R' : x.planDayId));

describe('cycle', () => {
  it('addDays crosses month and year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('starts at Day 1 without history', () => {
    expect(kinds(projectSchedule(days, null, '2026-11-12', 8))).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'R', 'd1']);
  });

  it('continues after the last completed day', () => {
    const s = projectSchedule(days, { planDayId: 'd2', date: '2026-11-10' }, '2026-11-12', 3);
    expect(kinds(s)).toEqual(['d3', 'd4', 'd5']);
  });

  it('a missed day shifts the plan instead of skipping a workout', () => {
    // Day 2 done Monday, nothing Tuesday/Wednesday → Day 3 is still next on Thursday.
    expect(nextPlanDayId(days, { planDayId: 'd2', date: '2026-11-09' }, '2026-11-12')).toBe('d3');
  });

  it('rest day follows Day 6 on the next calendar day', () => {
    const s = projectSchedule(days, { planDayId: 'd6', date: '2026-11-11' }, '2026-11-12', 3);
    expect(kinds(s)).toEqual(['R', 'd1', 'd2']);
    expect(nextPlanDayId(days, { planDayId: 'd6', date: '2026-11-11' }, '2026-11-12')).toBe('d1');
  });

  it('rest day is used up once a day has passed', () => {
    const s = projectSchedule(days, { planDayId: 'd6', date: '2026-11-09' }, '2026-11-12', 2);
    expect(kinds(s)).toEqual(['d1', 'd2']);
  });

  it('falls back to Day 1 if the last plan day was deleted', () => {
    expect(nextPlanDayId(days, { planDayId: 'gone', date: '2026-11-11' }, '2026-11-12')).toBe('d1');
  });
});
