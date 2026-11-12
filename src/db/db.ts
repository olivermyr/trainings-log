import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyEntry,
  BodyMetricDef,
  Exercise,
  PlanDay,
  PlanDayItem,
  RestDay,
  SettingRow,
  Workout,
  WorkoutItem,
  WorkoutSet,
} from '../domain/types';

export class TrainingsDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  planDays!: EntityTable<PlanDay, 'id'>;
  planDayItems!: EntityTable<PlanDayItem, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutItems!: EntityTable<WorkoutItem, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  restDays!: EntityTable<RestDay, 'id'>;
  bodyEntries!: EntityTable<BodyEntry, 'id'>;
  bodyMetricDefs!: EntityTable<BodyMetricDef, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'trainings-log') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, updatedAt',
      planDays: 'id, position, updatedAt',
      planDayItems: 'id, planDayId, exerciseId, updatedAt',
      workouts: 'id, date, status, planDayId, startedAt, updatedAt',
      workoutItems: 'id, workoutId, exerciseId, updatedAt',
      sets: 'id, workoutItemId, updatedAt',
      restDays: 'id, date, updatedAt',
      bodyEntries: 'id, date, metricKey, [metricKey+date], updatedAt',
      bodyMetricDefs: 'id, key, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new TrainingsDB();

/** Ask the browser to protect our storage from eviction (important on iOS). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
  return false;
}
