import { beforeEach, describe, expect, it } from 'vitest';
import { TrainingsDB } from './db';
import { seedIfEmpty } from './seed';
import {
  addExerciseToDay,
  addPlanDay,
  archiveExercise,
  createExercise,
  deletePlanDay,
  moveDay,
  moveDayItem,
  removeDayItem,
} from './plan';

let db: TrainingsDB;
let n = 0;
const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;
const days = async () => (await db.planDays.toArray()).filter(alive).sort((a, b) => a.position - b.position);
const items = async (dayId: string) =>
  (await db.planDayItems.where('planDayId').equals(dayId).toArray()).filter(alive).sort((a, b) => a.position - b.position);
const names = async (dayId: string) =>
  Promise.all((await items(dayId)).map(async (i) => (await db.exercises.get(i.exerciseId))!.name));

beforeEach(async () => {
  db = new TrainingsDB(`plan-test-${n++}`);
  await seedIfEmpty(db);
});

describe('plan editing', () => {
  it('moves an exercise within a day and keeps positions contiguous', async () => {
    const d1 = (await days())[0];
    const first = (await items(d1.id))[0];
    await moveDayItem(first.id, 1, db);
    expect((await names(d1.id)).slice(0, 2)).toEqual(['Incline Dumbbell Hammer Curls', 'Incline Dumbbell Curls']);
    expect((await items(d1.id)).map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
    // moving the first item further up is a no-op
    await moveDayItem((await items(d1.id))[0].id, -1, db);
    expect((await items(d1.id)).map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it('removes and adds exercises', async () => {
    const d1 = (await days())[0];
    await removeDayItem((await items(d1.id))[1].id, db);
    expect(await names(d1.id)).not.toContain('Incline Dumbbell Hammer Curls');
    expect((await items(d1.id)).map((i) => i.position)).toEqual([0, 1, 2, 3]);
    const ex = await createExercise('Cable Curl', db);
    await addExerciseToDay(d1.id, ex.id, db);
    expect((await names(d1.id)).at(-1)).toBe('Cable Curl');
  });

  it('adds, reorders and deletes days', async () => {
    const day = await addPlanDay('Extra', 'legs', db);
    expect(day.position).toBe(6);
    await moveDay(day.id, -1, db);
    expect((await days()).map((d) => d.name).slice(4)).toEqual(['Chest, Back & Abs', 'Extra', 'Legs & Abs']);
    await deletePlanDay(day.id, db);
    expect((await days()).map((d) => d.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('archiving removes an exercise from every day but keeps the exercise', async () => {
    const bench = await db.exercises.where('name').equals('Bench Press (Smith Machine)').first();
    await archiveExercise(bench!.id, db);
    const [, d2, , , d5] = await days();
    expect(await names(d2.id)).not.toContain('Bench Press (Smith Machine)');
    expect(await names(d5.id)).not.toContain('Bench Press (Smith Machine)');
    expect((await items(d2.id)).map((i) => i.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect((await db.exercises.get(bench!.id))!.archived).toBe(true);
  });
});
