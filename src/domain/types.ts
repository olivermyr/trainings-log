export type ExerciseType = 'weight_reps' | 'bodyweight_reps' | 'timed_tempo';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'abs';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  abs: 'Abs',
};

/** Fields every synced record carries. */
export interface SyncMeta {
  id: string;
  updatedAt: number; // epoch ms
  deletedAt: number | null; // soft delete
}

export interface Exercise extends SyncMeta {
  name: string;
  type: ExerciseType;
  unilateral: boolean;
  /** Multiplier for volume, e.g. 2 for bilateral dumbbell work (weight entered per dumbbell). */
  loadFactor: number;
  /** Weight step for progression suggestions (kg). */
  increment: number;
  repMin: number;
  repMax: number;
  targetSets: number;
  restSeconds: number;
  /** timed_tempo only: seconds per phase (down / up). */
  tempoSeconds: number | null;
  /** timed_tempo only: target set duration in seconds. */
  targetSeconds: number | null;
  muscles: Partial<Record<MuscleGroup, number>>;
  note: string;
  archived: boolean;
}

export type DayColor = 'arms' | 'push' | 'legs';

export interface PlanDay extends SyncMeta {
  name: string;
  position: number;
  color: DayColor;
}

export interface PlanDayItem extends SyncMeta {
  planDayId: string;
  exerciseId: string;
  position: number;
}

export type WorkoutStatus = 'active' | 'done';

export interface Workout extends SyncMeta {
  planDayId: string | null;
  /** Local calendar date YYYY-MM-DD the workout counts for. */
  date: string;
  startedAt: number;
  finishedAt: number | null;
  note: string;
  status: WorkoutStatus;
}

export interface WorkoutItem extends SyncMeta {
  workoutId: string;
  exerciseId: string;
  position: number;
  note: string;
}

export type Side = 'L' | 'R' | null;

export interface WorkoutSet extends SyncMeta {
  workoutItemId: string;
  position: number;
  side: Side;
  weight: number | null;
  reps: number | null;
  durationS: number | null;
  isWarmup: boolean;
  completedAt: number | null;
}

export interface RestDay extends SyncMeta {
  date: string;
  note: string;
}

export interface BodyEntry extends SyncMeta {
  date: string;
  metricKey: string;
  value: number;
}

export interface BodyMetricDef extends SyncMeta {
  key: string;
  label: string;
  unit: string;
  custom: boolean;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}
