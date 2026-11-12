import type { Exercise, Workout, WorkoutItem, WorkoutSet } from '../domain/types';
import { buildInitialSets, nextSetValues, performedSets, sortSets, type SetValues } from '../domain/workout';
import { db, type TrainingsDB } from './db';
import { localDate, meta } from './ids';

const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

export interface PreviousPerformance {
  workout: Workout;
  sets: WorkoutSet[];
}

/**
 * The last completed performance of an exercise, across ALL plan days
 * (Bench Press on Day 5 shows Bench Press from Day 2 if that was more recent).
 */
export async function getPreviousPerformance(
  exerciseId: string,
  excludeWorkoutId: string | null = null,
  database: TrainingsDB = db,
): Promise<PreviousPerformance | null> {
  const items = (await database.workoutItems.where('exerciseId').equals(exerciseId).toArray()).filter(
    (i) => alive(i) && i.workoutId !== excludeWorkoutId,
  );
  if (items.length === 0) return null;
  const workouts = await database.workouts.bulkGet([...new Set(items.map((i) => i.workoutId))]);
  const done = new Map(
    workouts.filter((w): w is Workout => !!w && alive(w) && w.status === 'done').map((w) => [w.id, w]),
  );
  const candidates = items
    .filter((i) => done.has(i.workoutId))
    .map((i) => ({ item: i, workout: done.get(i.workoutId)! }))
    .sort((a, b) =>
      a.workout.date === b.workout.date
        ? (b.workout.finishedAt ?? 0) - (a.workout.finishedAt ?? 0)
        : a.workout.date < b.workout.date
          ? 1
          : -1,
    );
  for (const c of candidates) {
    const sets = performedSets(await database.sets.where('workoutItemId').equals(c.item.id).toArray());
    if (sets.length) return { workout: c.workout, sets };
  }
  return null;
}

export async function getActiveWorkout(database: TrainingsDB = db): Promise<Workout | null> {
  const active = (await database.workouts.where('status').equals('active').toArray()).filter(alive);
  return active.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

async function createItemWithSets(
  database: TrainingsDB,
  workoutId: string,
  exercise: Exercise,
  position: number,
  now: number,
) {
  const item: WorkoutItem = { ...meta(now), workoutId, exerciseId: exercise.id, position, note: '' };
  await database.workoutItems.add(item);
  const prev = await getPreviousPerformance(exercise.id, workoutId, database);
  const values = buildInitialSets(exercise, prev?.sets ?? []);
  await database.sets.bulkAdd(values.map((v) => toSet(v, item.id, now)));
  return item;
}

function toSet(v: SetValues, workoutItemId: string, now: number): WorkoutSet {
  return { ...meta(now), workoutItemId, ...v, isWarmup: false, completedAt: null };
}

/** Starts a workout for a plan day, or returns the already active one. */
export async function startWorkout(planDayId: string, database: TrainingsDB = db): Promise<Workout> {
  return database.transaction(
    'rw',
    [database.workouts, database.workoutItems, database.sets, database.planDayItems, database.exercises],
    async () => {
      const existing = await getActiveWorkout(database);
      if (existing) return existing;
      const now = Date.now();
      const workout: Workout = {
        ...meta(now),
        planDayId,
        date: localDate(new Date(now)),
        startedAt: now,
        finishedAt: null,
        note: '',
        status: 'active',
      };
      await database.workouts.add(workout);
      const planItems = (await database.planDayItems.where('planDayId').equals(planDayId).toArray())
        .filter(alive)
        .sort((a, b) => a.position - b.position);
      const exercises = await database.exercises.bulkGet(planItems.map((p) => p.exerciseId));
      let pos = 0;
      for (const ex of exercises) {
        if (ex && alive(ex)) await createItemWithSets(database, workout.id, ex, pos++, now);
      }
      return workout;
    },
  );
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string, database: TrainingsDB = db) {
  await database.transaction('rw', [database.workouts, database.workoutItems, database.sets, database.exercises], async () => {
    const ex = await database.exercises.get(exerciseId);
    if (!ex) return;
    const items = (await database.workoutItems.where('workoutId').equals(workoutId).toArray()).filter(alive);
    const pos = items.reduce((m, i) => Math.max(m, i.position + 1), 0);
    await createItemWithSets(database, workoutId, ex, pos, Date.now());
  });
}

export async function removeWorkoutItem(itemId: string, database: TrainingsDB = db) {
  await database.transaction('rw', database.workoutItems, database.sets, async () => {
    const now = Date.now();
    await database.workoutItems.update(itemId, { deletedAt: now, updatedAt: now });
    const sets = await database.sets.where('workoutItemId').equals(itemId).toArray();
    for (const s of sets) await database.sets.update(s.id, { deletedAt: now, updatedAt: now });
  });
}

export async function updateSet(
  id: string,
  changes: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'completedAt'>>,
  database: TrainingsDB = db,
) {
  await database.sets.update(id, { ...changes, updatedAt: Date.now() });
}

export async function completeSet(id: string, database: TrainingsDB = db) {
  await updateSet(id, { completedAt: Date.now() }, database);
}

export async function addSet(itemId: string, exercise: Exercise, database: TrainingsDB = db) {
  await database.transaction('rw', database.sets, async () => {
    const existing = (await database.sets.where('workoutItemId').equals(itemId).toArray()).filter(alive);
    const now = Date.now();
    await database.sets.bulkAdd(nextSetValues(exercise, existing).map((v) => toSet(v, itemId, now)));
  });
}

/** Removes the last set (both sides for unilateral exercises). */
export async function removeLastSet(itemId: string, database: TrainingsDB = db) {
  await database.transaction('rw', database.sets, async () => {
    const existing = sortSets((await database.sets.where('workoutItemId').equals(itemId).toArray()).filter(alive));
    if (existing.length === 0) return;
    const lastPos = existing.at(-1)!.position;
    const now = Date.now();
    for (const s of existing.filter((x) => x.position === lastPos)) {
      await database.sets.update(s.id, { deletedAt: now, updatedAt: now });
    }
  });
}

/** Sets the weight of all not-yet-completed sets of an item (used by "apply suggestion"). */
export async function applyWeightToOpenSets(itemId: string, weight: number, database: TrainingsDB = db) {
  await database.transaction('rw', database.sets, async () => {
    const now = Date.now();
    const sets = (await database.sets.where('workoutItemId').equals(itemId).toArray()).filter(
      (s) => alive(s) && s.completedAt == null,
    );
    for (const s of sets) await database.sets.update(s.id, { weight, updatedAt: now });
  });
}

export async function updateWorkoutItemNote(itemId: string, note: string, database: TrainingsDB = db) {
  await database.workoutItems.update(itemId, { note, updatedAt: Date.now() });
}

/**
 * Finishes a workout: unfinished sets are dropped so they never show up as "last time".
 * Returns false if nothing was completed (caller should offer discard instead).
 */
export async function finishWorkout(workoutId: string, database: TrainingsDB = db): Promise<boolean> {
  return database.transaction('rw', [database.workouts, database.workoutItems, database.sets], async () => {
    const items = (await database.workoutItems.where('workoutId').equals(workoutId).toArray()).filter(alive);
    const now = Date.now();
    let completed = 0;
    for (const it of items) {
      const sets = (await database.sets.where('workoutItemId').equals(it.id).toArray()).filter(alive);
      for (const s of sets) {
        if (s.completedAt == null) await database.sets.update(s.id, { deletedAt: now, updatedAt: now });
        else completed++;
      }
    }
    if (completed === 0) return false;
    await database.workouts.update(workoutId, { status: 'done', finishedAt: now, updatedAt: now });
    return true;
  });
}

export async function discardWorkout(workoutId: string, database: TrainingsDB = db) {
  await database.transaction('rw', [database.workouts, database.workoutItems, database.sets], async () => {
    const now = Date.now();
    const items = await database.workoutItems.where('workoutId').equals(workoutId).toArray();
    for (const it of items) {
      await database.workoutItems.update(it.id, { deletedAt: now, updatedAt: now });
      const sets = await database.sets.where('workoutItemId').equals(it.id).toArray();
      for (const s of sets) await database.sets.update(s.id, { deletedAt: now, updatedAt: now });
    }
    await database.workouts.update(workoutId, { deletedAt: now, updatedAt: now });
  });
}
