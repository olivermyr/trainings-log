import type { DayColor, Exercise, ExerciseType, MuscleGroup } from '../domain/types';
import { db, type TrainingsDB } from './db';
import { meta } from './ids';

type ExerciseSeed = {
  key: string;
  name: string;
  type?: ExerciseType;
  unilateral?: boolean;
  loadFactor?: number;
  increment?: number;
  rest: number;
  muscles: Partial<Record<MuscleGroup, number>>;
};

// Default increments: dumbbells 2 kg, Smith / cable 2.5 kg, selectorised machines 5 kg.
// All values are editable in the plan editor.
const EXERCISES: ExerciseSeed[] = [
  { key: 'incCurl', name: 'Incline Dumbbell Curls', loadFactor: 2, increment: 2, rest: 90, muscles: { biceps: 1 } },
  { key: 'incHammer', name: 'Incline Dumbbell Hammer Curls', loadFactor: 2, increment: 2, rest: 90, muscles: { biceps: 1 } },
  { key: 'ohTri', name: 'Overhead Triceps Extension', increment: 2.5, rest: 90, muscles: { triceps: 1 } },
  { key: 'latMachine', name: 'Lateral Raises (Machine)', increment: 5, rest: 75, muscles: { shoulders: 1 } },
  { key: 'shPress', name: 'Shoulder Press (Machine)', increment: 5, rest: 120, muscles: { shoulders: 1, triceps: 0.5 } },
  { key: 'bench', name: 'Bench Press (Smith Machine)', increment: 2.5, rest: 150, muscles: { chest: 1, triceps: 0.5, shoulders: 0.5 } },
  { key: 'incDbBench', name: 'Incline Dumbbell Bench Press', loadFactor: 2, increment: 2, rest: 150, muscles: { chest: 1, shoulders: 0.5, triceps: 0.5 } },
  { key: 'pulldown', name: 'Lat Pulldown', increment: 5, rest: 120, muscles: { back: 1, biceps: 0.5 } },
  { key: 'wideRow', name: 'Wide Grip Cable Row', increment: 5, rest: 120, muscles: { back: 1, shoulders: 0.5, biceps: 0.5 } },
  { key: 'closeRow', name: 'Close Grip Cable Row', increment: 5, rest: 120, muscles: { back: 1, biceps: 0.5 } },
  { key: 'facePull', name: 'Face Pulls', increment: 2.5, rest: 75, muscles: { shoulders: 1, back: 0.5 } },
  { key: 'flys', name: 'Flys', increment: 5, rest: 90, muscles: { chest: 1 } },
  { key: 'preacher', name: 'Machine Bicep Preacher Curl', increment: 5, rest: 90, muscles: { biceps: 1 } },
  { key: 'saPushdown', name: 'Single Arm Triceps Pushdown', unilateral: true, increment: 2.5, rest: 60, muscles: { triceps: 1 } },
  { key: 'cableLat', name: 'Lateral Cable Raises', unilateral: true, increment: 2.5, rest: 60, muscles: { shoulders: 1 } },
  { key: 'absMachine', name: 'ABS Machine', increment: 5, rest: 60, muscles: { abs: 1 } },
  { key: 'crunches', name: 'Crunches', type: 'bodyweight_reps', increment: 0, rest: 60, muscles: { abs: 1 } },
  { key: 'twists', name: 'Russian Twists', type: 'bodyweight_reps', increment: 0, rest: 60, muscles: { abs: 1 } },
  { key: 'pallof', name: 'Pallof Press', unilateral: true, increment: 2.5, rest: 60, muscles: { abs: 1 } },
  { key: 'squat', name: 'Squats', type: 'timed_tempo', increment: 2.5, rest: 180, muscles: { legs: 1 } },
  { key: 'rdl', name: 'Romanian Deadlifts', type: 'timed_tempo', increment: 2.5, rest: 180, muscles: { legs: 1, back: 0.5 } },
  { key: 'calf', name: 'Leg Press Calf Raises', type: 'timed_tempo', increment: 5, rest: 180, muscles: { legs: 1 } },
];

const LEGS = ['squat', 'rdl', 'calf', 'absMachine', 'crunches', 'pallof'];

const DAYS: { name: string; color: DayColor; items: string[] }[] = [
  { name: 'Day 1 – Arms & Shoulders', color: 'arms', items: ['incCurl', 'incHammer', 'ohTri', 'latMachine', 'shPress'] },
  { name: 'Day 2 – Chest, Back & Abs', color: 'push', items: ['bench', 'incDbBench', 'pulldown', 'wideRow', 'facePull', 'absMachine', 'crunches', 'twists'] },
  { name: 'Day 3 – Legs & Abs', color: 'legs', items: LEGS },
  { name: 'Day 4 – Arms & Shoulders', color: 'arms', items: ['preacher', 'incHammer', 'saPushdown', 'cableLat', 'shPress'] },
  { name: 'Day 5 – Chest, Back & Abs', color: 'push', items: ['bench', 'flys', 'pulldown', 'closeRow', 'facePull', 'absMachine', 'crunches', 'twists'] },
  { name: 'Day 6 – Legs & Abs', color: 'legs', items: LEGS },
];

function buildExercise(s: ExerciseSeed, now: number): Exercise {
  const type = s.type ?? 'weight_reps';
  const timed = type === 'timed_tempo';
  return {
    ...meta(now),
    name: s.name,
    type,
    unilateral: s.unilateral ?? false,
    loadFactor: s.loadFactor ?? 1,
    increment: s.increment ?? 2.5,
    repMin: 8,
    repMax: 12,
    targetSets: timed ? 1 : 3,
    restSeconds: s.rest,
    tempoSeconds: timed ? 7 : null,
    targetSeconds: timed ? 300 : null,
    muscles: s.muscles,
    note: '',
    archived: false,
  };
}

/** Seeds the starting plan exactly once. Safe to call on every launch. */
export async function seedIfEmpty(database: TrainingsDB = db): Promise<boolean> {
  return database.transaction(
    'rw',
    [database.exercises, database.planDays, database.planDayItems, database.settings],
    async () => {
      const seeded = await database.settings.get('seeded');
      if (seeded) return false;
      const now = Date.now();
      const byKey = new Map<string, Exercise>();
      for (const s of EXERCISES) byKey.set(s.key, buildExercise(s, now));
      await database.exercises.bulkAdd([...byKey.values()]);

      for (const [i, d] of DAYS.entries()) {
        const day = { ...meta(now), name: d.name, position: i, color: d.color };
        await database.planDays.add(day);
        await database.planDayItems.bulkAdd(
          d.items.map((k, pos) => ({
            ...meta(now),
            planDayId: day.id,
            exerciseId: byKey.get(k)!.id,
            position: pos,
          })),
        );
      }
      await database.settings.put({ key: 'seeded', value: true, updatedAt: now });
      return true;
    },
  );
}
