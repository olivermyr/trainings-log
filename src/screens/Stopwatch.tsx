import { useState } from 'react';
import { clearStopwatch, maybeStartRestAfter, startStopwatch, useStopwatch } from '../db/timers';
import { completeSet, updateSet } from '../db/workout';
import { formatDuration, formatKg } from '../domain/format';
import { tempoState } from '../domain/timer';
import type { Exercise, WorkoutSet } from '../domain/types';
import { parseDuration, parseNumber } from '../domain/workout';
import { useNow } from '../components/useNow';
import './stopwatch.css';

/**
 * Full-screen stopwatch for slow-tempo sets.
 * The running state is persisted (start timestamp), so a reload or screen lock never loses the set.
 */
export function StopwatchOverlay({
  set,
  exercise: ex,
  last,
  best,
  manualOnly = false,
  onClose,
}: {
  set: WorkoutSet;
  exercise: Exercise;
  last: number | null;
  best: number | null;
  manualOnly?: boolean;
  onClose: (saved: boolean) => void;
}) {
  const sw = useStopwatch();
  const running = sw?.setId === set.id;
  const now = useNow(running ? 50 : 1000);
  const target = ex.targetSeconds ?? 300;
  const tempo = ex.tempoSeconds ?? 7;
  const hasResult = !running && set.durationS != null;

  const stop = async () => {
    if (!sw) return;
    const secs = Math.max(0, Math.round((Date.now() - sw.startedAt) / 1000));
    await updateSet(set.id, { durationS: secs });
    await clearStopwatch();
  };

  const save = async () => {
    if (set.completedAt) return onClose(false);
    await completeSet(set.id);
    if (!manualOnly) await maybeStartRestAfter(set, ex);
    onClose(true);
  };

  if (running && sw) {
    const st = tempoState(sw, now, tempo);
    const elapsedS = Math.max(0, st.elapsedMs / 1000);
    const hit = elapsedS >= target;
    const beatBest = best != null && elapsedS > best && !hit;
    return (
      <div className={`sw sw-running${hit ? ' hit' : ''}`} role="dialog" aria-label={`${ex.name} stopwatch`}>
        <div className="sw-top">
          <span className="sw-name">{ex.name}</span>
          <span className="sw-reps num">{beatBest && <span className="sw-pr">New best · </span>}
            {st.reps} reps</span>
        </div>

        {st.phase === 'lead-in' ? (
          <div className="sw-leadin num">{Math.ceil(-st.elapsedMs / 1000)}</div>
        ) : (
          <div className="sw-clock num">{formatDuration(Math.floor(elapsedS))}</div>
        )}

        <div className="sw-progress" aria-hidden="true">
          <span className="sw-progress-fill" style={{ width: `${Math.min(100, (elapsedS / target) * 100)}%` }} />
          {best != null && best < target && <span className="sw-mark" style={{ left: `${(best / target) * 100}%` }} />}
        </div>
        <div className="sw-progress-labels num">
          <span>{best != null ? `Best ${formatDuration(best)}` : ''}</span>
          <span>Goal {formatDuration(target)}</span>
        </div>

        <div className={`tempo ${st.phase}`}>
          <div className="tempo-label">{st.phase === 'lead-in' ? 'Get ready' : st.phase === 'down' ? 'Down' : 'Up'}</div>
          <div className="tempo-track">
            <span
              className="tempo-fill"
              style={{
                transform: `scaleX(${st.phase === 'up' ? 1 - st.phaseProgress : st.phase === 'down' ? st.phaseProgress : 0})`,
              }}
            />
          </div>
          <div className="tempo-sub num">
            {st.phase === 'lead-in' ? '' : `${Math.ceil(tempo - st.phaseProgress * tempo)}s`}
          </div>
        </div>

        <button className="sw-stop" onClick={stop}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="sw" role="dialog" aria-label={`${ex.name} set`}>
      <div className="sw-top">
        <button className="sw-close" onClick={() => onClose(false)}>
          Close
        </button>
      </div>
      <h2 className="sw-title">{ex.name}</h2>
      <p className="sw-subtitle num">
        Goal {formatDuration(target)} · {tempo}s down / {tempo}s up
        {last != null && ` · Last ${formatDuration(last)}`}
        {best != null && best !== last && ` · Best ${formatDuration(best)}`}
      </p>

      <div className="list sw-fields">
        <div className="row">
          <div className="row-main">
            <div className="row-title">Added weight</div>
          </div>
          <InlineNumber
            value={set.weight}
            suffix="kg"
            label="Added weight"
            parse={parseNumber}
            format={(v) => formatKg(v)}
            onChange={(weight) => updateSet(set.id, { weight: weight ?? 0 })}
          />
        </div>
        {hasResult && (
          <div className="row">
            <div className="row-main">
              <div className="row-title">Time</div>
            </div>
            <InlineNumber
              value={set.durationS}
              label="Time"
              parse={parseDuration}
              format={(v) => formatDuration(v)}
              onChange={(durationS) => updateSet(set.id, { durationS })}
            />
          </div>
        )}
      </div>

      {hasResult ? (
        <div className="sw-actions">
          <div className={`sw-result num${(set.durationS ?? 0) >= target ? ' hit' : ''}`}>{formatDuration(set.durationS ?? 0)}</div>
          <button className="btn-primary" onClick={save}>
            {set.completedAt ? 'Done' : 'Save Set'}
          </button>
          {!set.completedAt && !manualOnly && (
            <button className="btn-plain" onClick={() => startStopwatch(set.id)}>
              Redo
            </button>
          )}
        </div>
      ) : (
        <div className="sw-actions">
          {!manualOnly && (
            <button className="sw-start" onClick={() => startStopwatch(set.id)}>
              Start
            </button>
          )}
          <ManualTime initiallyOpen={manualOnly} onSave={(durationS) => updateSet(set.id, { durationS })} />
        </div>
      )}
    </div>
  );
}

function ManualTime({ onSave, initiallyOpen = false }: { onSave: (s: number) => void; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [text, setText] = useState('');
  if (!open)
    return (
      <button className="btn-plain small" onClick={() => setOpen(true)}>
        Enter time manually
      </button>
    );
  const parsed = parseDuration(text);
  return (
    <form
      className="sw-manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed != null) onSave(parsed);
      }}
    >
      <input
        className="set-input num"
        inputMode="numeric"
        autoFocus
        placeholder="m:ss"
        aria-label="Time"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(/^\d{3,4}$/.test(t) ? `${t.slice(0, -2)}:${t.slice(-2)}` : t);
        }}
      />
      <button type="submit" className="inline-action" disabled={parsed == null}>
        Use
      </button>
    </form>
  );
}

function InlineNumber({
  value,
  onChange,
  parse,
  format,
  label,
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  parse: (t: string) => number | null;
  format: (v: number) => string;
  label: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : format(value));
  return (
    <span className="inline-number">
      <input
        className="set-input num"
        inputMode="decimal"
        aria-label={label}
        value={shown}
        onFocus={(e) => {
          setDraft(shown);
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parse(e.target.value);
          if (v != null) onChange(v);
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix && <span className="inline-suffix">{suffix}</span>}
    </span>
  );
}
