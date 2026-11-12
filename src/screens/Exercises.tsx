import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useExercise, useExerciseUsage, useExercises } from '../db/queries';
import { archiveExercise, createExercise, defaultsForType, restoreExercise, updateExercise } from '../db/plan';
import { dayTag, formatDuration, formatKg, targetLabel } from '../domain/format';
import { MUSCLE_LABELS, type Exercise, type ExerciseType, type MuscleGroup } from '../domain/types';
import { IconChevronRight } from '../components/Icons';
import { CommitInput, FieldRow, Segmented, Stepper, Toggle } from '../components/Form';
import { BackButton } from '../components/BackButton';
import './profile.css';

const TYPE_LABEL: Record<ExerciseType, string> = {
  weight_reps: 'Weight',
  bodyweight_reps: 'Bodyweight',
  timed_tempo: 'Slow tempo',
};

export function ExerciseList() {
  const exercises = useExercises(true);
  const navigate = useNavigate();
  const active = exercises?.filter((e) => !e.archived) ?? [];
  const archived = exercises?.filter((e) => e.archived) ?? [];
  return (
    <div className="screen-enter">
      <BackButton label="Profile" />
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)' }}>Exercises</h1>
      <section className="section">
        <div className="list">
          <button
            className="row action"
            onClick={async () => {
              const ex = await createExercise('New Exercise');
              navigate(`/profile/exercise/${ex.id}`);
            }}
          >
            New Exercise
          </button>
          {active.map((e) => (
            <Link key={e.id} to={`/profile/exercise/${e.id}`} className="row">
              <div className="row-main">
                <div className="row-title">{e.name}</div>
                <div className="row-sub">
                  {TYPE_LABEL[e.type]} · <span className="num">{targetLabel(e)}</span>
                </div>
              </div>
              <IconChevronRight className="chevron" />
            </Link>
          ))}
        </div>
      </section>
      {archived.length > 0 && (
        <section className="section">
          <p className="eyebrow">Archived</p>
          <div className="list">
            {archived.map((e) => (
              <div key={e.id} className="row">
                <div className="row-main">
                  <div className="row-title" style={{ color: 'var(--text-2)' }}>{e.name}</div>
                </div>
                <button className="inline-action" onClick={() => restoreExercise(e.id)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const MUSCLE_OPTS = [
  { value: 0, label: '–' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
];

export function ExerciseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ex = useExercise(id);
  const usage = useExerciseUsage(id);
  const logged = useLiveQuery(async () => (id ? (await db.workoutItems.where('exerciseId').equals(id).filter((i) => i.deletedAt == null).count()) : 0), [id]);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (ex === undefined) return null;
  if (ex === null)
    return (
      <div className="empty">
        <h3>Exercise not found</h3>
      </div>
    );

  const set = (changes: Partial<Exercise>) => updateExercise(ex.id, changes);
  const timed = ex.type === 'timed_tempo';
  const weighted = ex.type !== 'bodyweight_reps';

  return (
    <div className="screen-enter">
      <BackButton label="Back" />
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)', fontSize: ex.name.length > 18 ? 28 : undefined }}>{ex.name}</h1>

      <section className="section">
        <p className="eyebrow">Name</p>
        <div className="list">
          <div className="row">
            <CommitInput ariaLabel="Exercise name" value={ex.name} onCommit={(name) => name && set({ name })} />
          </div>
        </div>
        {usage && usage.length > 0 && (
          <p className="footnote">Used on {usage.map(dayTag).join(', ')}. Changes apply everywhere.</p>
        )}
      </section>

      <section className="section">
        <p className="eyebrow">Tracking</p>
        <div className="list">
          <div className="row">
            <Segmented<ExerciseType>
              label="Exercise type"
              value={ex.type}
              options={[
                { value: 'weight_reps', label: 'Weight' },
                { value: 'bodyweight_reps', label: 'Bodyweight' },
                { value: 'timed_tempo', label: 'Slow tempo' },
              ]}
              onChange={(type) => set({ type, ...defaultsForType(type) })}
            />
          </div>
          {!timed && (
            <FieldRow label="Each side separately">
              <Toggle label="Each side separately" checked={ex.unilateral} onChange={(unilateral) => set({ unilateral })} />
            </FieldRow>
          )}
          {ex.type === 'weight_reps' && (
            <FieldRow label="Weight per dumbbell" sub="Counts double for volume">
              <Toggle label="Weight per dumbbell" checked={ex.loadFactor === 2} onChange={(on) => set({ loadFactor: on ? 2 : 1 })} />
            </FieldRow>
          )}
        </div>
        {(logged ?? 0) > 0 && (
          <p className="type-hint warn">Already logged {logged}×. Changing the type changes how past sets are counted.</p>
        )}
        <p className="type-hint">
          {timed
            ? 'One timed set. A tempo bar paces each phase.'
            : ex.type === 'bodyweight_reps'
              ? 'Reps only. Extra weight can still be logged per set.'
              : 'Weight × reps per set.'}
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">Target</p>
        <div className="list">
          <FieldRow label="Sets">
            <Stepper label="Sets" value={ex.targetSets} step={1} min={1} max={10} onChange={(targetSets) => set({ targetSets })} />
          </FieldRow>
          {timed ? (
            <>
              <FieldRow label="Target time">
                <Stepper label="Target time" value={ex.targetSeconds ?? 300} step={15} min={15} max={1800} format={formatDuration} onChange={(targetSeconds) => set({ targetSeconds })} />
              </FieldRow>
              <FieldRow label="Seconds per phase" sub="Down and up">
                <Stepper label="Seconds per phase" value={ex.tempoSeconds ?? 7} step={1} min={1} max={20} format={(v) => `${v}s`} onChange={(tempoSeconds) => set({ tempoSeconds })} />
              </FieldRow>
            </>
          ) : (
            <>
              <FieldRow label="Min reps">
                <Stepper label="Min reps" value={ex.repMin} step={1} min={1} max={ex.repMax} onChange={(repMin) => set({ repMin })} />
              </FieldRow>
              <FieldRow label="Max reps" sub="Reaching it in set 1 suggests more weight">
                <Stepper label="Max reps" value={ex.repMax} step={1} min={ex.repMin} max={100} onChange={(repMax) => set({ repMax })} />
              </FieldRow>
            </>
          )}
          {weighted && (
            <FieldRow label="Weight step">
              <Stepper label="Weight step" value={ex.increment} step={0.5} min={0.5} max={20} format={(v) => `${formatKg(v)} kg`} onChange={(increment) => set({ increment })} />
            </FieldRow>
          )}
          <FieldRow label={timed ? 'Rest after' : 'Rest between sets'}>
            <Stepper label="Rest" value={ex.restSeconds} step={15} min={0} max={600} format={formatDuration} onChange={(restSeconds) => set({ restSeconds })} />
          </FieldRow>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Muscles</p>
        <div className="list muscle-grid">
          {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((m) => (
            <FieldRow key={m} label={MUSCLE_LABELS[m]}>
              <Segmented<number>
                label={MUSCLE_LABELS[m]}
                value={ex.muscles[m] ?? 0}
                options={MUSCLE_OPTS}
                onChange={(v) => {
                  const muscles = { ...ex.muscles };
                  if (v === 0) delete muscles[m];
                  else muscles[m] = v;
                  set({ muscles });
                }}
              />
            </FieldRow>
          ))}
        </div>
        <p className="footnote">1 = primary, ½ = secondary. Used for weekly sets per muscle group.</p>
      </section>

      <section className="section">
        <p className="eyebrow">Note</p>
        <div className="list">
          <div className="row">
            <CommitInput ariaLabel="Note" multiline placeholder="Seat height, grip, cues…" value={ex.note} onCommit={(note) => set({ note })} />
          </div>
        </div>
        <p className="footnote">Shown during every workout.</p>
      </section>

      <section className="section">
        <div className="list">
          <button
            className="row destructive"
            onClick={async () => {
              if (!confirmArchive) return setConfirmArchive(true);
              await archiveExercise(ex.id);
              navigate(-1);
            }}
          >
            {confirmArchive ? 'Tap again to archive' : 'Archive Exercise'}
          </button>
        </div>
        <p className="footnote">Removes it from all days. History and records are kept.</p>
      </section>
    </div>
  );
}
