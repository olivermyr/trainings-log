import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkout, useExercises, useWorkoutDetail, type WorkoutEntry } from '../db/queries';
import {
  addExerciseToWorkout,
  addSet,
  applyWeightToOpenSets,
  completeSet,
  discardWorkout,
  finishWorkout,
  removeLastSet,
  removeWorkoutItem,
  updateSet,
  updateWorkoutItemNote,
} from '../db/workout';
import { dayLabel, dayMonth, formatDuration, formatKg, targetLabel, weekdayShort } from '../domain/format';
import { parseNumber, previousFor, progressionSuggestion } from '../domain/workout';
import type { Exercise, WorkoutSet } from '../domain/types';
import { CommitInput, Sheet } from '../components/Form';
import { IconChevronDown } from '../components/Icons';
import { useNow } from '../components/useNow';
import { useWakeLock } from '../components/useWakeLock';
import { RestPanel } from '../components/RestPanel';
import { maybeStartRestAfter, useStopwatch } from '../db/timers';
import { StopwatchOverlay } from './Stopwatch';
import './workout.css';

export function WorkoutScreen() {
  const active = useActiveWorkout();
  const navigate = useNavigate();
  const detail = useWorkoutDetail(active?.id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const now = useNow(1000);
  const sw = useStopwatch();
  const [timedSetId, setTimedSetId] = useState<string | null>(null);
  useWakeLock(!!active);
  // Keep the overlay open after the stopwatch stops, even if the app was reloaded while it ran.
  useEffect(() => {
    if (sw?.setId) setTimedSetId(sw.setId);
  }, [sw?.setId]);

  useEffect(() => {
    if (active === null) navigate('/', { replace: true });
  }, [active, navigate]);

  // Expand the first unfinished exercise when nothing is expanded yet.
  const firstOpen = useMemo(
    () => detail?.entries.find((e) => e.sets.some((s) => s.completedAt == null))?.item.id ?? null,
    [detail],
  );
  useEffect(() => {
    if (expanded === null && firstOpen) setExpanded(firstOpen);
  }, [firstOpen, expanded]);

  if (!active || !detail) return null;
  const { workout, planDay, entries } = detail;

  // A running stopwatch always re-opens its overlay (e.g. after a reload).
  const overlaySetId = sw?.setId ?? timedSetId;
  const overlayEntry = overlaySetId ? entries.find((e) => e.sets.some((s) => s.id === overlaySetId)) : undefined;
  const overlaySet = overlayEntry?.sets.find((s) => s.id === overlaySetId);
  const expandedEntry = entries.find((e) => e.item.id === expanded);

  const openSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.completedAt == null).length, 0);
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.completedAt != null).length, 0);

  const afterComplete = (itemId: string, remainingInItem: number) => {
    if (remainingInItem > 0) return;
    const idx = entries.findIndex((e) => e.item.id === itemId);
    const next = [...entries.slice(idx + 1), ...entries.slice(0, idx)].find(
      (e) => e.item.id !== itemId && e.sets.some((s) => s.completedAt == null),
    );
    setExpanded(next?.item.id ?? null);
  };

  return (
    <div className="workout screen-enter">
      <header className="workout-bar">
        <button className="icon-btn" aria-label="Minimize workout" onClick={() => navigate('/')}>
          <IconChevronDown />
        </button>
        <span className="workout-clock num">{formatDuration(Math.max(0, (now - workout.startedAt) / 1000))}</span>
        <button className="finish-btn" onClick={() => setFinishing(true)}>
          Finish
        </button>
      </header>

      <div className="workout-body">
        <p className="workout-eyebrow">
          {planDay && <span className={`dot ${planDay.color}`} />}
          {planDay ? dayLabel(planDay) : 'Workout'}
        </p>
        <h1 className="workout-title">{planDay?.name ?? 'Free workout'}</h1>

        {entries.map((entry) => (
          <ExerciseBlock
            key={entry.item.id}
            entry={entry}
            expanded={expanded === entry.item.id}
            onToggle={() => setExpanded(expanded === entry.item.id ? null : entry.item.id)}
            onCompleted={(remaining) => afterComplete(entry.item.id, remaining)}
            onOpenTimed={setTimedSetId}
          />
        ))}

        <button className="add-exercise" onClick={() => setAdding(true)}>
          Add Exercise
        </button>
      </div>

      {!overlaySet && (
        <RestPanel manualSeconds={expandedEntry?.exercise.restSeconds ?? 90} manualLabel={expandedEntry?.exercise.name ?? 'Rest'} />
      )}

      {overlaySet && overlayEntry && (
        <StopwatchOverlay
          set={overlaySet}
          exercise={overlayEntry.exercise}
          last={overlayEntry.previous?.sets[0]?.durationS ?? null}
          onClose={(saved) => {
            setTimedSetId(null);
            if (saved) {
              const remaining = overlayEntry.sets.filter((x) => x.completedAt == null && x.id !== overlaySet.id).length;
              afterComplete(overlayEntry.item.id, remaining);
            }
          }}
        />
      )}

      <AddExerciseSheet
        open={adding}
        exclude={new Set(entries.map((e) => e.exercise.id))}
        onClose={() => setAdding(false)}
        onPick={async (id) => {
          await addExerciseToWorkout(workout.id, id);
          setAdding(false);
        }}
      />

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finish Workout">
        {doneSets === 0 ? (
          <p className="sheet-text">No sets completed yet. There is nothing to save.</p>
        ) : (
          <p className="sheet-text">
            {doneSets} {doneSets === 1 ? 'set' : 'sets'} completed.
            {openSets > 0 && ` ${openSets} unfinished ${openSets === 1 ? 'set' : 'sets'} will not be saved.`}
          </p>
        )}
        <div className="sheet-actions">
          {doneSets > 0 && (
            <button
              className="btn-primary"
              onClick={async () => {
                if (await finishWorkout(workout.id)) navigate('/', { replace: true });
              }}
            >
              Finish Workout
            </button>
          )}
          <DiscardButton
            onDiscard={async () => {
              await discardWorkout(workout.id);
              navigate('/', { replace: true });
            }}
          />
        </div>
      </Sheet>
    </div>
  );
}

function DiscardButton({ onDiscard }: { onDiscard: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button className="btn-plain danger" onClick={() => (confirm ? onDiscard() : setConfirm(true))}>
      {confirm ? 'Tap again to discard everything' : 'Discard Workout'}
    </button>
  );
}

// ---------------------------------------------------------------------------

function ExerciseBlock({
  entry,
  expanded,
  onToggle,
  onCompleted,
  onOpenTimed,
}: {
  entry: WorkoutEntry;
  expanded: boolean;
  onToggle: () => void;
  onCompleted: (remainingInItem: number) => void;
  onOpenTimed: (setId: string) => void;
}) {
  const { item, exercise: ex, sets, previous } = entry;
  const done = sets.filter((s) => s.completedAt != null).length;
  const allDone = sets.length > 0 && done === sets.length;
  const suggestion = previous ? progressionSuggestion(ex, previous.sets) : null;
  const openWeights = sets.filter((s) => s.completedAt == null).map((s) => s.weight);
  const suggestionApplied = suggestion != null && openWeights.length > 0 && openWeights.every((w) => w === suggestion.weight);
  const timed = ex.type === 'timed_tempo';
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <section className={`ex${expanded ? ' open' : ''}`}>
      <button className="ex-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="ex-head-main">
          <div className="ex-name">{ex.name}</div>
          <div className="ex-meta num">
            {targetLabel(ex)}
            {previous && !expanded && <> · Last {summarizeSets(ex, previous.sets)}</>}
          </div>
        </div>
        <span className={`ex-progress num${allDone ? ' done' : ''}`}>{allDone ? '✓' : `${done}/${sets.length}`}</span>
      </button>

      {expanded && (
        <div className="ex-body">
          {ex.note && <p className="ex-note">{ex.note}</p>}

          {previous && (
            <p className="ex-last">
              Last time · {weekdayShort(previous.workout.date)} {dayMonth(previous.workout.date)}
            </p>
          )}

          {suggestion && !suggestionApplied && (
            <button className="suggest" onClick={() => applyWeightToOpenSets(item.id, suggestion.weight)}>
              <span>
                <strong className="num">Try {formatKg(suggestion.weight)} kg</strong>
                <span className="suggest-reason">{suggestion.reason}</span>
              </span>
              <span className="suggest-apply">Apply</span>
            </button>
          )}

          <div className={`sets${timed ? ' timed' : ''}`}>
            <div className="sets-head">
              <span>Set</span>
              <span>Last</span>
              <span>{ex.type === 'bodyweight_reps' ? '+kg' : 'kg'}</span>
              <span>{timed ? 'Time' : 'Reps'}</span>
              <span />
            </div>
            {sets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                exercise={ex}
                prev={previous ? previousFor(previous.sets, s.position, s.side) : undefined}
                onCompleted={() => onCompleted(sets.filter((x) => x.completedAt == null && x.id !== s.id).length)}
                onOpenTimed={() => onOpenTimed(s.id)}
              />
            ))}
          </div>

          <div className="ex-actions">
            {!timed && (
              <>
                <button onClick={() => addSet(item.id, ex)}>+ Add Set</button>
                <button disabled={sets.length === 0} onClick={() => removeLastSet(item.id)}>
                  − Remove Set
                </button>
              </>
            )}
            <button onClick={() => setNoteOpen(!noteOpen)}>{item.note ? 'Edit Note' : 'Note'}</button>
          </div>

          {(noteOpen || item.note) && (
            <div className="ex-note-edit">
              <CommitInput
                ariaLabel="Note for this workout"
                multiline
                placeholder="Note for today…"
                value={item.note}
                autoFocus={noteOpen && !item.note}
                onCommit={(note) => updateWorkoutItemNote(item.id, note)}
              />
            </div>
          )}

          {done === 0 && (
            <button className="ex-remove" onClick={() => (confirmRemove ? removeWorkoutItem(item.id) : setConfirmRemove(true))}>
              {confirmRemove ? 'Tap again to remove from today' : 'Remove from today'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function summarizeSets(ex: Exercise, sets: WorkoutSet[]): string {
  if (ex.type === 'timed_tempo') {
    const s = sets[0];
    return s ? `${formatDuration(s.durationS ?? 0)}${s.weight ? ` @ ${formatKg(s.weight)} kg` : ''}` : '';
  }
  const top = sets.filter((s) => s.side !== 'R')[0];
  if (!top) return '';
  return ex.type === 'bodyweight_reps' && !top.weight ? `${top.reps} reps` : `${formatKg(top.weight)} × ${top.reps}`;
}

function prevLabel(ex: Exercise, p: WorkoutSet | { weight: number | null; reps: number | null; durationS: number | null } | undefined) {
  if (!p) return '–';
  if (ex.type === 'timed_tempo') return formatDuration(p.durationS ?? 0);
  if (ex.type === 'bodyweight_reps' && !p.weight) return `${p.reps ?? '–'}`;
  return `${formatKg(p.weight)}×${p.reps ?? '–'}`;
}

// ---------------------------------------------------------------------------

function SetRow({
  set,
  exercise: ex,
  prev,
  onCompleted,
  onOpenTimed,
}: {
  set: WorkoutSet;
  exercise: Exercise;
  prev: ReturnType<typeof previousFor>;
  onCompleted: () => void;
  onOpenTimed: () => void;
}) {
  const completed = set.completedAt != null;
  const [editing, setEditing] = useState(false);
  const locked = completed && !editing;
  const timed = ex.type === 'timed_tempo';
  const repsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  const label = `${set.position + 1}${set.side ?? ''}`;

  const tryComplete = async () => {
    if (completed) {
      setEditing(false);
      return;
    }
    if (timed) {
      if (set.durationS == null) return onOpenTimed();
    } else {
      if (ex.type === 'weight_reps' && set.weight == null) return weightRef.current?.focus();
      if (set.reps == null) return repsRef.current?.focus();
    }
    (document.activeElement as HTMLElement | null)?.blur();
    await completeSet(set.id);
    void maybeStartRestAfter(set, ex);
    onCompleted();
  };

  return (
    <div className={`set-row${completed ? ' completed' : ''}${editing ? ' editing' : ''}`}>
      <span className="set-num num">{label}</span>
      <span className="set-prev num">{prevLabel(ex, prev)}</span>
      {locked ? (
        <button className="set-locked num" onClick={() => setEditing(true)} aria-label={`Edit set ${label}`}>
          <span>{ex.type === 'bodyweight_reps' && !set.weight ? '–' : formatKg(set.weight)}</span>
          <span>{timed ? formatDuration(set.durationS ?? 0) : set.reps}</span>
        </button>
      ) : (
        <>
          <NumberField
            inputRef={weightRef}
            label={`Set ${label} weight`}
            value={set.weight}
            format={(v) => formatKg(v)}
            parse={parseNumber}
            mode="decimal"
            placeholder={ex.type === 'bodyweight_reps' ? '–' : prev?.weight != null ? formatKg(prev.weight) : 'kg'}
            onChange={(weight) => updateSet(set.id, { weight })}
          />
          {timed ? (
            <button className={`time-btn num${set.durationS == null ? ' start' : ''}`} onClick={onOpenTimed} aria-label={`Set ${label} time`}>
              {set.durationS == null ? 'Start' : formatDuration(set.durationS)}
            </button>
          ) : (
            <NumberField
              inputRef={repsRef}
              label={`Set ${label} reps`}
              value={set.reps}
              format={(v) => String(v)}
              parse={(t) => {
                const n = parseNumber(t);
                return n == null ? null : Math.round(n);
              }}
              mode="numeric"
              placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
              onChange={(reps) => updateSet(set.id, { reps })}
            />
          )}
        </>
      )}
      <button
        className={`check${completed ? ' on' : ''}`}
        aria-label={completed ? (editing ? `Done editing set ${label}` : `Set ${label} completed`) : `Complete set ${label}`}
        onClick={tryComplete}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </button>
    </div>
  );
}

/** Input that keeps a local draft while focused and writes parsed values immediately. */
function NumberField({
  value,
  onChange,
  format,
  parse,
  mode,
  placeholder,
  label,
  inputRef,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  format: (v: number) => string;
  parse: (t: string) => number | null;
  mode: 'decimal' | 'numeric' | 'text';
  placeholder: string;
  label: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : format(value));
  return (
    <input
      ref={inputRef}
      className="set-input num"
      inputMode={mode === 'text' ? 'numeric' : mode}
      aria-label={label}
      placeholder={placeholder}
      value={shown}
      onFocus={(e) => {
        setDraft(shown);
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        let t = e.target.value;
        // Time fields: typing "230" becomes "2:30" for one-handed entry.
        if (mode === 'text' && /^\d{3,4}$/.test(t)) t = `${t.slice(0, -2)}:${t.slice(-2)}`;
        setDraft(t);
        const v = parse(t);
        if (v !== null || t.trim() === '') onChange(v);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function AddExerciseSheet({
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
  return (
    <Sheet open={open} onClose={onClose} title="Add Exercise">
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
      <p className="footnote">Only added to today. Edit the plan under Profile.</p>
    </Sheet>
  );
}
