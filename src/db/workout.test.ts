import { beforeEach, describe, expect, it } from 'vitest';
import { TrainingsDB } from './db';
import { seedIfEmpty } from './seed';
import {
  addSet,
  completeSet,
  discardWorkout,
  finishWorkout,
  getPreviousPerformance,
  removeLastSet,
  startWorkout,
  updateSet,
} from './workout';
import { progressionSuggestion, sortSets } from '../domain/workout';

let db: TrainingsDB;
let n = 0;
const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;
const days = async () => (await db.planDays.toArray()).filter(alive).sort((a, b) => a.position - b.position);
const exByName = async (name: string) => (await db.exercises.where('name').equals(name).first())!;

async function itemSets(workoutId: string, exerciseName: string) {
  const ex = await exByName(exerciseName);
  const item = (await db.workoutItems.where('workoutId').equals(workoutId).toArray()).find(
    (i) => i.exerciseId === ex.id && alive(i),
  )!;
  return { item, ex, sets: sortSets((await db.sets.where('workoutItemId').equals(item.id).toArray()).filter(alive)) };
}

/** Logs a workout: values per exercise name → list of [weight, reps]. */
async function logWorkout(dayIndex: number, values: Record<string, [number, number][]>) {
  const w = await startWorkout((await days())[dayIndex].id, db);
  for (const [name, rows] of Object.entries(values)) {
    const { sets } = await itemSets(w.id, name);
    for (const [i, [weight, reps]] of rows.entries()) {
      await updateSet(sets[i].id, { weight, reps }, db);
      await completeSet(sets[i].id, db);
    }
  }
  await finishWorkout(w.id, db);
  return w;
}

beforeEach(async () => {
  db = new TrainingsDB(`workout-test-${n++}`);
  await seedIfEmpty(db);
});

describe('workout tracking', () => {
  it('starts with empty sets the first time', async () => {
    const w = await startWorkout((await days())[1].id, db);
    const { sets } = await itemSets(w.id, 'Bench Press (Smith Machine)');
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.weight == null && s.reps == null)).toBe(true);
  });

  it('only one active workout at a time', async () => {
    const a = await startWorkout((await days())[0].id, db);
    const b = await startWorkout((await days())[1].id, db);
    expect(b.id).toBe(a.id);
  });

  it('prefills from the last performance of the same exercise across days (Day 2 → Day 5)', async () => {
    await logWorkout(1, { 'Bench Press (Smith Machine)': [[80, 10], [80, 9], [80, 8]] });
    const w5 = await startWorkout((await days())[4].id, db);
    const { sets } = await itemSets(w5.id, 'Bench Press (Smith Machine)');
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[80, 10], [80, 9], [80, 8]]);
    expect(sets.every((s) => s.completedAt == null)).toBe(true);
  });

  it('uses the most recent performance', async () => {
    await logWorkout(1, { 'Bench Press (Smith Machine)': [[80, 10], [80, 9], [80, 8]] });
    await logWorkout(4, { 'Bench Press (Smith Machine)': [[80, 11], [80, 10], [80, 9]] });
    const prev = await getPreviousPerformance((await exByName('Bench Press (Smith Machine)')).id, null, db);
    expect(prev!.sets.map((s) => s.reps)).toEqual([11, 10, 9]);
  });

  it('finishing drops unfinished sets so they never become "last time"', async () => {
    await logWorkout(1, { 'Bench Press (Smith Machine)': [[80, 10], [80, 9]] }); // only 2 of 3 done
    const prev = await getPreviousPerformance((await exByName('Bench Press (Smith Machine)')).id, null, db);
    expect(prev!.sets).toHaveLength(2);
    // next time: 3 target sets, the 3rd copies the last performed set
    const w = await startWorkout((await days())[4].id, db);
    const { sets } = await itemSets(w.id, 'Bench Press (Smith Machine)');
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[80, 10], [80, 9], [80, 9]]);
  });

  it('a workout with no completed sets cannot be finished; discard removes it', async () => {
    const w = await startWorkout((await days())[0].id, db);
    expect(await finishWorkout(w.id, db)).toBe(false);
    await discardWorkout(w.id, db);
    expect((await db.workouts.get(w.id))!.deletedAt).not.toBeNull();
  });

  it('unilateral exercises get L/R per set and prefill per side', async () => {
    const w = await startWorkout((await days())[3].id, db);
    const { sets } = await itemSets(w.id, 'Single Arm Triceps Pushdown');
    expect(sets.map((s) => `${s.position}${s.side}`)).toEqual(['0L', '0R', '1L', '1R', '2L', '2R']);
    const vals: [number, number][] = [[15, 12], [15, 10], [15, 11], [15, 9], [15, 10], [15, 8]];
    for (const [i, s] of sets.entries()) {
      await updateSet(s.id, { weight: vals[i][0], reps: vals[i][1] }, db);
      await completeSet(s.id, db);
    }
    await finishWorkout(w.id, db);
    const w2 = await startWorkout((await days())[3].id, db);
    const next = await itemSets(w2.id, 'Single Arm Triceps Pushdown');
    expect(next.sets.map((s) => s.reps)).toEqual([12, 10, 11, 9, 10, 8]);
    // weaker side in set 1 = 10 < 12 → no suggestion
    const prev = await getPreviousPerformance(next.ex.id, w2.id, db);
    expect(progressionSuggestion(next.ex, prev!.sets)).toBeNull();
  });

  it('suggests more weight when set 1 hits the top of the range', async () => {
    await logWorkout(1, { 'Bench Press (Smith Machine)': [[80, 12], [80, 10], [80, 9]] });
    const ex = await exByName('Bench Press (Smith Machine)');
    const prev = await getPreviousPerformance(ex.id, null, db);
    expect(progressionSuggestion(ex, prev!.sets)).toEqual({ weight: 82.5, reason: '12 reps in set 1 last time' });
  });

  it('timed slow-tempo set: one set, weight defaults to 0, suggestion at target time', async () => {
    const w = await startWorkout((await days())[2].id, db);
    const { sets, ex } = await itemSets(w.id, 'Squats');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ weight: 0, durationS: null, side: null });
    await updateSet(sets[0].id, { durationS: 300 }, db);
    await completeSet(sets[0].id, db);
    await finishWorkout(w.id, db);
    const prev = await getPreviousPerformance(ex.id, null, db);
    expect(progressionSuggestion(ex, prev!.sets)?.weight).toBe(2.5);
  });

  it('adds and removes sets (pairs for unilateral)', async () => {
    const w = await startWorkout((await days())[3].id, db);
    const { item, ex } = await itemSets(w.id, 'Single Arm Triceps Pushdown');
    await addSet(item.id, ex, db);
    expect((await itemSets(w.id, ex.name)).sets).toHaveLength(8);
    await removeLastSet(item.id, db);
    await removeLastSet(item.id, db);
    expect((await itemSets(w.id, ex.name)).sets).toHaveLength(4);
  });
});
