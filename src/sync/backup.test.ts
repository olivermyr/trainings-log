import { describe, expect, it } from 'vitest';
import { TrainingsDB } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { completeSet, createBackfillWorkout, finalizeWorkout, updateSet } from '../db/workout';
import { buildBackup, buildSetsCsv, restoreBackup } from './backup';

async function device(name: string) {
  const db = new TrainingsDB(name);
  await seedIfEmpty(db);
  return db;
}

describe('backup', () => {
  it('JSON round trip restores workouts into an empty database', async () => {
    const a = await device('bk-a');
    const day = (await a.planDays.orderBy('position').toArray())[1];
    const w = await createBackfillWorkout(day.id, '2026-11-10', a);
    // complete the first set of the first item
    const firstItem = (await a.workoutItems.where('workoutId').equals(w.id).sortBy('position'))[0];
    const first = (await a.sets.where('workoutItemId').equals(firstItem.id).sortBy('position'))[0];
    await updateSet(first.id, { weight: 80, reps: 10 }, a);
    await completeSet(first.id, a);
    await finalizeWorkout(w.id, a);

    const file = JSON.parse(JSON.stringify(await buildBackup(a)));
    const b = new TrainingsDB('bk-b');
    await restoreBackup(b, file);
    expect(await b.workouts.count()).toBe(1);
    expect(await b.exercises.count()).toBe(22);

    const csv = await buildSetsCsv(b);
    expect(csv.split('\n')[0]).toBe('date,day,exercise,set,side,weight_kg,reps,duration_s');
    expect(csv).toContain('2026-11-10,"Day 2 Chest, Back & Abs",Bench Press (Smith Machine),1,,80,10,');
  });

  it('rejects foreign files', async () => {
    await expect(restoreBackup(new TrainingsDB('bk-c'), { hello: 1 })).rejects.toThrow(/not a Trainings Log backup/);
  });
});
