import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDate } from '../db/ids';
import { useActiveWorkout, useCycleAnchor, useLastDoneWorkout, usePlanDay, usePlanDays } from '../db/queries';
import { startWorkout } from '../db/workout';
import { Sheet } from '../components/Form';
import { addDays, projectSchedule, type Slot } from '../domain/cycle';
import { parseLocalDate, dayLabel, dayTag, targetLabel, weekdayShort } from '../domain/format';
import type { PlanDay } from '../domain/types';
import { IconMoon } from '../components/Icons';
import './today.css';

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export function Today() {
  const today = localDate();
  const days = usePlanDays();
  const last = useLastDoneWorkout();
  const anchor = useCycleAnchor();

  const doneToday = last?.date === today;
  const from = doneToday ? addDays(today, 1) : today;

  const slots = useMemo<Slot[]>(() => {
    if (!days || last === undefined || anchor === undefined) return [];
    return projectSchedule(days, last ? { planDayId: last.planDayId, date: last.date } : null, from, 7, anchor);
  }, [days, last, from, anchor]);

  const dayById = useMemo(() => new Map((days ?? []).map((d) => [d.id, d])), [days]);
  const nextWorkout = slots.find((s) => s.kind === 'workout');
  const restToday = slots[0]?.kind === 'rest' && slots[0].date === today;
  const next = usePlanDay(nextWorkout?.kind === 'workout' ? nextWorkout.planDayId : undefined);
  const active = useActiveWorkout();
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);

  const start = async (planDayId: string) => {
    await startWorkout(planDayId);
    navigate('/workout');
  };

  if (!days) return null;

  return (
    <div className="screen-enter">
      <p className="today-date">{LONG_DATE.format(parseLocalDate(today))}</p>
      <h1 className="large-title" style={{ marginTop: 0 }}>Today</h1>

      {restToday && (
        <div className="rest-banner">
          <IconMoon size={20} />
          <span>Rest day — next up below.</span>
        </div>
      )}
      {doneToday && !restToday && <div className="rest-banner done">Workout done today.</div>}

      <WeekStrip slots={slots} dayById={dayById} today={today} />

      {next && (
        <section className="section">
          <p className="eyebrow">Next workout</p>
          <div className="next-head">
            <span className={`dot ${next.day.color}`} />
            <span className="next-short">{dayLabel(next.day)}</span>
            {nextWorkout && nextWorkout.date !== today && (
              <span className="next-when">{weekdayShort(nextWorkout.date)}</span>
            )}
          </div>
          <h2 className="next-title">{next.day.name}</h2>
          {active ? (
            <button className="btn-primary today-cta" onClick={() => navigate('/workout')}>
              Resume Workout
            </button>
          ) : (
            <button className="btn-primary today-cta" onClick={() => start(next.day.id)}>
              Start Workout
            </button>
          )}
          <div className="list">
            {next.exercises.map((e) => (
              <div className="row" key={e.id}>
                <div className="row-main">
                  <div className="row-title">{e.name}</div>
                </div>
                <span className="row-value num">{targetLabel(e)}</span>
              </div>
            ))}
          </div>
          {!active && (
            <button className="link-btn" onClick={() => setChoosing(true)}>
              Train a different day
            </button>
          )}
        </section>
      )}

      <Sheet open={choosing} onClose={() => setChoosing(false)} title="Choose Day">
        <div className="list">
          {days.map((d) => (
            <button key={d.id} className="row" onClick={() => start(d.id)}>
              <span className={`dot ${d.color}`} />
              <div className="row-main">
                <div className="row-title">{dayLabel(d)}</div>
                <div className="row-sub">{d.name}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="footnote">The cycle continues after the day you train.</p>
      </Sheet>
    </div>
  );
}

function WeekStrip({ slots, dayById, today }: { slots: Slot[]; dayById: Map<string, PlanDay>; today: string }) {
  if (slots.length === 0) return null;
  return (
    <section className="section">
      <p className="eyebrow">Coming up</p>
      <div className="week">
        {slots.map((s) => {
          const day = s.kind === 'workout' ? dayById.get(s.planDayId) : undefined;
          return (
            <div key={s.date} className={`week-cell${s.date === today ? ' is-today' : ''}`}>
              <span className="week-wd">{weekdayShort(s.date).slice(0, 2)}</span>
              <span className="week-num num">{parseLocalDate(s.date).getDate()}</span>
              {day ? (
                <span className={`week-tag ${day.color}`}>{dayTag(day)}</span>
              ) : (
                <span className="week-tag rest">Rest</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
