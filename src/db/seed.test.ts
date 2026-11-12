import { describe, expect, it } from 'vitest';
import { TrainingsDB } from './db';
import { seedIfEmpty } from './seed';

describe('seed', () => {
  it('creates the starting plan exactly once', async () => {
    const db = new TrainingsDB('seed-test');
    expect(await seedIfEmpty(db)).toBe(true);
    expect(await seedIfEmpty(db)).toBe(false);

    expect(await db.exercises.count()).toBe(22);
    expect(await db.planDays.count()).toBe(6);

    const days = await db.planDays.orderBy('position').toArray();
    const day2Items = await db.planDayItems.where('planDayId').equals(days[1].id).count();
    expect(day2Items).toBe(8);

    // Shared exercises are one entity: Day 1 and Day 4 both reference the same Hammer Curls.
    const hammer = await db.exercises.where('name').equals('Incline Dumbbell Hammer Curls').first();
    const refs = await db.planDayItems.where('exerciseId').equals(hammer!.id).count();
    expect(refs).toBe(2);

    const squat = await db.exercises.where('name').equals('Squats').first();
    expect(squat).toMatchObject({ type: 'timed_tempo', targetSets: 1, tempoSeconds: 7, targetSeconds: 300 });
    db.close();
  });
});
