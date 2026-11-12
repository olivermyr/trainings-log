import { addRestTime, clearRestTimer, startRestTimer, useRestTimer } from '../db/timers';
import { countdownText, remainingMs, restProgress } from '../domain/timer';
import { useNow } from './useNow';
import './rest.css';

/** Bottom rest panel inside the workout. Purely visual signal when the rest is over. */
export function RestPanel({ manualSeconds, manualLabel }: { manualSeconds: number; manualLabel: string }) {
  const timer = useRestTimer();
  const now = useNow(250);
  if (timer === undefined) return null;

  if (!timer) {
    return (
      <button className="rest-start" onClick={() => startRestTimer(manualSeconds, manualLabel)}>
        Rest {countdownText(manualSeconds * 1000)}
      </button>
    );
  }

  const left = remainingMs(timer, now);
  const over = left <= 0;
  return (
    <div className={`rest-panel${over ? ' over' : ''}`} role="timer" aria-live="off">
      <div className="rest-bar">
        <span style={{ transform: `scaleX(${restProgress(timer, now)})` }} />
      </div>
      <div className="rest-row">
        <div className="rest-info">
          <span className="rest-label">{over ? 'Rest over' : 'Rest'}</span>
          <span className="rest-time num">{over ? `+${countdownText(-left)}` : countdownText(left)}</span>
        </div>
        {!over && (
          <button className="rest-btn" onClick={() => addRestTime(30)}>
            +30s
          </button>
        )}
        <button className="rest-btn primary" onClick={() => clearRestTimer()}>
          {over ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
