import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkoutDetail } from '../db/queries';
import { discardWorkout, updateWorkout } from '../db/workout';
import { dayLabel, formatDuration, formatKg, parseLocalDate } from '../domain/format';
import { exerciseVolume, formatVolume } from '../domain/stats';
import { RECORD_LABEL, sessionScore, type PR } from '../domain/records';
import type { Exercise, WorkoutSet } from '../domain/types';
import { CommitInput } from '../components/Form';
import { BackButton } from './Profile';
import './detail.css';

const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Read view of a finished workout. With `summary`, it is shown right after finishing. */
export function WorkoutDetail({ summary = false }: { summary?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = useWorkoutDetail(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (detail === undefined) return null;
  if (detail === null)
    return (
      <div className="empty">
        <h3>Workout not found</h3>
      </div>
    );

  const { workout, planDay, entries, compare } = detail;
  const prGroups = entries.filter((e) => e.prs.length > 0).map((e) => ({ exercise: e.exercise, prs: e.prs }));
  const performed = entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completedAt != null) }))
    .filter((e) => e.sets.length > 0);
  const totalSets = performed.reduce((n, e) => n + e.sets.length, 0);
  const volume = performed.reduce((v, e) => v + exerciseVolume(e.exercise, e.sets), 0);
  const durationS =
    workout.finishedAt && workout.finishedAt - workout.startedAt > 60_000
      ? (workout.finishedAt - workout.startedAt) / 1000
      : null;

  return (
    <div className="screen-enter">
      {summary ? (
        <div className="nav-row">
          <span />
          <button className="nav-action" style={{ fontWeight: 600 }} onClick={() => navigate('/', { replace: true })}>
            Done
          </button>
        </div>
      ) : (
        <BackButton label="History" />
      )}

      <p className="today-date" style={{ marginTop: 'var(--s-2)' }}>
        {summary ? 'Workout complete' : LONG.format(parseLocalDate(workout.date))}
      </p>
      <h1 className="large-title" style={{ marginTop: 0 }}>
        {planDay ? `${dayLabel(planDay)} · ${planDay.name}` : 'Workout'}
      </h1>

      <div className="stats">
        <div>
          <span className="stat-label">Duration</span>
          <span className="stat-value num">{durationS ? formatDuration(Math.round(durationS / 60) * 60).replace(/:00$/, ' min') : '–'}</span>
        </div>
        <div>
          <span className="stat-label">Sets</span>
          <span className="stat-value num">{totalSets}</span>
        </div>
        <div>
          <span className="stat-label">Volume</span>
          <span className="stat-value num">{volume > 0 ? formatVolume(volume) : '–'}</span>
          {compare && compare.volume > 0 && volume > 0 && <Delta now={volume} before={compare.volume} />}
        </div>
      </div>
      {compare && planDay && (
        <p className="compare-note">
          Compared with {dayLabel(planDay)} on {SHORT.format(parseLocalDate(compare.workout.date))}
        </p>
      )}

      {prGroups.length > 0 && (
        <section className="section">
          <p className="eyebrow">Personal records</p>
          <div className="list">
            {prGroups.map(({ exercise, prs }) => (
              <div key={exercise.id} className="row pr-row">
                <span className="pr-chip">PR</span>
                <div className="row-main">
                  <div className="row-title">{exercise.name}</div>
                  {prs.map((pr) => (
                    <div key={pr.kind + (pr.setId ?? '')} className="pr-line num">
                      <span>{RECORD_LABEL[pr.kind]}</span>
                      <span>
                        <strong>{prValue(pr, exercise)}</strong>
                        <span className="pr-prev"> {pr.previous > 0 ? `(was ${prValue({ ...pr, value: pr.previous }, exercise)})` : ''}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {performed.map(({ item, exercise, sets }) => (
        <section key={item.id} className="section">
          <p className="eyebrow eyebrow-row">
            <span>{exercise.name}</span>
            {compare?.scores.has(exercise.id) && <Trend now={sessionScore(exercise, sets)} before={compare.scores.get(exercise.id)!} />}
          </p>
          <div className="list">
            {sets.map((s) => (
              <div key={s.id} className="row detail-set">
                <span className="set-num num">{s.position + 1}{s.side ?? ''}</span>
                <span className="row-main num">{setText(exercise, s)}</span>
              </div>
            ))}
            {item.note && <div className="row row-sub detail-note">{item.note}</div>}
          </div>
        </section>
      ))}

      <section className="section">
        <p className="eyebrow">Notes</p>
        <div className="list">
          <div className="row">
            <CommitInput
              ariaLabel="Workout note"
              multiline
              placeholder="How did it go?"
              value={workout.note}
              onCommit={(note) => updateWorkout(workout.id, { note })}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="list">
          <button className="row action" onClick={() => navigate(`/history/workout/${workout.id}/edit`)}>
            Edit Workout
          </button>
          <button
            className="row destructive"
            onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await discardWorkout(workout.id);
              navigate(summary ? '/' : '/history', { replace: true });
            }}
          >
            {confirmDelete ? 'Tap again to delete this workout' : 'Delete Workout'}
          </button>
        </div>
      </section>
    </div>
  );
}

function setText(ex: Exercise, s: WorkoutSet): string {
  if (ex.type === 'timed_tempo') return `${formatDuration(s.durationS ?? 0)}${s.weight ? ` · ${formatKg(s.weight)} kg` : ''}`;
  if (ex.type === 'bodyweight_reps') return `${s.reps} reps${s.weight ? ` · +${formatKg(s.weight)} kg` : ''}`;
  return `${formatKg(s.weight)} kg × ${s.reps}`;
}

function Delta({ now, before }: { now: number; before: number }) {
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <span className={`delta num${pct > 0 ? ' up' : pct < 0 ? ' down' : ''}`}>
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  );
}

function Trend({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  const eps = Math.max(0.01, before * 0.005);
  if (Math.abs(diff) < eps) return <span className="trend">= Same</span>;
  return <span className={`trend ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '↑ Better' : '↓ Lower'}</span>;
}

function prValue(pr: PR, ex: Exercise): string {
  switch (pr.kind) {
    case 'weight':
    case 'e1rm':
      return `${formatKg(pr.value)} kg`;
    case 'volume':
      return formatVolume(pr.value);
    case 'repsAtWeight':
      return ex.type === 'bodyweight_reps' && !pr.atWeight ? `${pr.value} reps` : `${pr.value} × ${formatKg(pr.atWeight ?? 0)} kg`;
    case 'reps':
      return `${pr.value} reps`;
    case 'time':
      return `${formatDuration(pr.value)}${pr.atWeight ? ` @ ${formatKg(pr.atWeight)} kg` : ''}`;
  }
}
