import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { setCycleAnchor, useExercises, usePlanDay, usePlanDays } from '../db/queries';
import { localDate } from '../db/ids';
import {
  addExerciseToDay,
  addPlanDay,
  createExercise,
  deletePlanDay,
  moveDay,
  moveDayItem,
  removeDayItem,
  updatePlanDay,
} from '../db/plan';
import { dayLabel, targetLabel } from '../domain/format';
import type { DayColor } from '../domain/types';
import { IconChevronRight } from '../components/Icons';
import { BackButton } from '../components/BackButton';
import { CommitInput, Segmented, Sheet } from '../components/Form';
import { BodyProfileSection } from './Body';
import './profile.css';

const COLORS: { value: DayColor; label: string }[] = [
  { value: 'arms', label: 'Blue' },
  { value: 'push', label: 'Purple' },
  { value: 'legs', label: 'Mint' },
];

export function Profile() {
  const days = usePlanDays();
  const navigate = useNavigate();
  const [positioning, setPositioning] = useState(false);
  const [anchored, setAnchored] = useState<string | null>(null);
  return (
    <div className="screen-enter">
      <h1 className="large-title">Profile</h1>
      <section className="section">
        <p className="eyebrow">Training plan</p>
        <div className="list">
          {days?.map((d) => (
            <Link key={d.id} to={`/profile/day/${d.id}`} className="row">
              <span className={`dot ${d.color}`} />
              <div className="row-main">
                <div className="row-title">{dayLabel(d)}</div>
                <div className="row-sub">{d.name}</div>
              </div>
              <IconChevronRight className="chevron" />
            </Link>
          ))}
          <button
            className="row action"
            onClick={async () => {
              const day = await addPlanDay('New Day', 'arms');
              navigate(`/profile/day/${day.id}?edit=1`);
            }}
          >
            Add Day
          </button>
        </div>
        <p className="footnote">Days run in this order, followed by one rest day.</p>
      </section>

      <section className="section">
        <p className="eyebrow">Cycle</p>
        <div className="list">
          <button className="row action" onClick={() => setPositioning(true)}>
            Set Today's Workout
          </button>
        </div>
        <p className="footnote">
          {anchored ? `Today is now ${anchored}. The cycle continues from there.` : 'Moves the cycle so that today starts with the chosen day.'}
        </p>
      </section>

      <Sheet open={positioning} onClose={() => setPositioning(false)} title="Today's Workout">
        <div className="list">
          {days?.map((d) => (
            <button
              key={d.id}
              className="row"
              onClick={async () => {
                await setCycleAnchor({ date: localDate(), planDayId: d.id });
                setAnchored(dayLabel(d));
                setPositioning(false);
              }}
            >
              <span className={`dot ${d.color}`} />
              <div className="row-main">
                <div className="row-title">{dayLabel(d)}</div>
                <div className="row-sub">{d.name}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="footnote">Logged workouts are not changed.</p>
      </Sheet>

      <BodyProfileSection />

      <section className="section">
        <p className="eyebrow">Library</p>
        <div className="list">
          <Link to="/profile/exercises" className="row">
            <div className="row-main">
              <div className="row-title">Exercises</div>
            </div>
            <IconChevronRight className="chevron" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export function PlanDayDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = usePlanDay(id);
  const days = usePlanDays();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(() => params.has('edit'));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (data === undefined) return null;
  if (data === null)
    return (
      <div className="empty">
        <h3>Day not found</h3>
      </div>
    );

  const { day, entries } = data;
  const count = days?.length ?? 0;

  return (
    <div className="screen-enter">
      <div className="nav-row">
        <BackButton label="Profile" />
        <button className="nav-action" onClick={() => { setEditing(!editing); setConfirmDelete(false); }}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)' }}>{dayLabel(day)}</h1>

      {editing ? (
        <section className="section">
          <p className="eyebrow">Name</p>
          <div className="list">
            <div className="row">
              <CommitInput ariaLabel="Day name" value={day.name} onCommit={(name) => name && updatePlanDay(day.id, { name })} />
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">Colour</div>
              </div>
              <Segmented label="Colour" value={day.color} options={COLORS} onChange={(color) => updatePlanDay(day.id, { color })} />
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">Position in cycle</div>
              </div>
              <div className="move-btns">
                <button aria-label="Move day earlier" disabled={day.position === 0} onClick={() => moveDay(day.id, -1)}>↑</button>
                <button aria-label="Move day later" disabled={day.position >= count - 1} onClick={() => moveDay(day.id, 1)}>↓</button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <p className="eyebrow">{day.name}</p>
      )}

      <section className="section">
        {editing && <p className="eyebrow">Exercises</p>}
        <div className="list">
          {entries.map(({ item, exercise }, i) =>
            editing ? (
              <div className="row" key={item.id}>
                <button className="remove-btn" aria-label={`Remove ${exercise.name}`} onClick={() => removeDayItem(item.id)}>
                  −
                </button>
                <div className="row-main">
                  <div className="row-title">{exercise.name}</div>
                </div>
                <div className="move-btns">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => moveDayItem(item.id, -1)}>↑</button>
                  <button aria-label="Move down" disabled={i === entries.length - 1} onClick={() => moveDayItem(item.id, 1)}>↓</button>
                </div>
              </div>
            ) : (
              <Link className="row" key={item.id} to={`/profile/exercise/${exercise.id}`}>
                <div className="row-main">
                  <div className="row-title">{exercise.name}</div>
                  <div className="row-sub num">{targetLabel(exercise)}</div>
                </div>
                <IconChevronRight className="chevron" />
              </Link>
            ),
          )}
          {entries.length === 0 && !editing && <div className="row row-sub">No exercises yet.</div>}
          {editing && (
            <button className="row action" onClick={() => setPicking(true)}>
              Add Exercise
            </button>
          )}
        </div>
      </section>

      {editing && (
        <section className="section">
          <div className="list">
            <button
              className="row destructive"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await deletePlanDay(day.id);
                navigate('/profile', { replace: true });
              }}
            >
              {confirmDelete ? 'Tap again to delete this day' : 'Delete Day'}
            </button>
          </div>
          <p className="footnote">Deleting a day keeps all past workouts.</p>
        </section>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        exclude={new Set(entries.map((e) => e.exercise.id))}
        onPick={async (exerciseId) => {
          await addExerciseToDay(day.id, exerciseId);
          setPicking(false);
        }}
      />
    </div>
  );
}

function ExercisePicker({
  open,
  onClose,
  onPick,
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  exclude: Set<string>;
}) {
  const exercises = useExercises();
  const [name, setName] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Add Exercise">
      <p className="eyebrow">New exercise</p>
      <div className="list section">
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            const ex = await createExercise(n);
            setName('');
            onPick(ex.id);
          }}
        >
          <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New exercise name" />
          <button type="submit" className="inline-action" disabled={!name.trim()}>
            Create
          </button>
        </form>
      </div>
      <p className="eyebrow">From library</p>
      <div className="list">
        {exercises
          ?.filter((e) => !exclude.has(e.id))
          .map((e) => (
            <button key={e.id} className="row" onClick={() => onPick(e.id)}>
              <div className="row-main">
                <div className="row-title">{e.name}</div>
              </div>
              <span className="row-value num">{targetLabel(e)}</span>
            </button>
          ))}
      </div>
    </Sheet>
  );
}
