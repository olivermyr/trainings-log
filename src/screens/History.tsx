import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCycleAnchor, useHistoryData, useWorkoutTotals } from '../db/queries';
import { createBackfillWorkout, toggleRestDay } from '../db/workout';
import { localDate } from '../db/ids';
import { addDays, projectSchedule } from '../domain/cycle';
import { classifyPastDays, monthGrid } from '../domain/history';
import { dayLabel, parseLocalDate } from '../domain/format';
import { formatVolume } from '../domain/stats';
import type { PlanDay, Workout } from '../domain/types';
import { IconChevronLeft, IconChevronRight } from '../components/Icons';
import { Sheet } from '../components/Form';
import './history.css';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function History() {
  const data = useHistoryData();
  const anchor = useCycleAnchor();
  const navigate = useNavigate();
  const today = localDate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [logging, setLogging] = useState(false);

  const model = useMemo(() => {
    if (!data || anchor === undefined) return null;
    const { workouts, restDates, days } = data;
    const byDate = new Map<string, Workout[]>();
    for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
    const past = classifyPastDays(days, workouts, restDates, today);
    for (const d of restDates) if (d < today && !byDate.has(d)) past.set(d, 'rest');
    const last = workouts.at(-1) ?? null;
    const from = last?.date === today ? addDays(today, 1) : today;
    const planned = new Map<string, PlanDay | 'rest'>();
    const dayById = new Map(days.map((d) => [d.id, d]));
    for (const s of projectSchedule(days, last ? { planDayId: last.planDayId, date: last.date } : null, from, 70, anchor)) {
      if (s.kind === 'rest') planned.set(s.date, 'rest');
      else {
        const d = dayById.get(s.planDayId);
        if (d) planned.set(s.date, d);
      }
    }
    return { byDate, past, planned, dayById, days, restDates };
  }, [data, today, anchor]);

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
  const monthWorkouts = useMemo(
    () => (data?.workouts ?? []).filter((w) => w.date.startsWith(monthPrefix)).reverse(),
    [data, monthPrefix],
  );
  const totals = useWorkoutTotals(monthWorkouts.map((w) => w.id));

  if (!model) return null;

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const selWorkouts = model.byDate.get(selected) ?? [];
  const selPlanned = selected >= today ? model.planned.get(selected) : undefined;
  const selPast = model.past.get(selected);
  const canLog = selected <= today;
  const isExplicitRest = model.restDates.has(selected);

  return (
    <div className="screen-enter">
      <h1 className="large-title">History</h1>

      <div className="history-layout">
        <section className="section cal">
          <div className="cal-head">
            <button className="cal-nav" aria-label="Previous month" onClick={() => shift(-1)}>
              <IconChevronLeft />
            </button>
            <span className="cal-title">{MONTH.format(new Date(cursor.y, cursor.m, 1))}</span>
            <button className="cal-nav" aria-label="Next month" onClick={() => shift(1)}>
              <IconChevronRight width={22} height={22} />
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="cal-wd">
                {w}
              </span>
            ))}
            {grid.map(({ date, inMonth }) => {
              const done = model.byDate.get(date);
              const planned = date >= today && !done ? model.planned.get(date) : undefined;
              const past = model.past.get(date);
              return (
                <button
                  key={date}
                  className={[
                    'cal-cell',
                    inMonth ? '' : 'out',
                    date === today ? 'today' : '',
                    date === selected ? 'sel' : '',
                  ].join(' ')}
                  onClick={() => setSelected(date)}
                  aria-label={LONG.format(parseLocalDate(date))}
                >
                  <span className="cal-num num">{Number(date.slice(8))}</span>
                  <span className="cal-marks">
                    {done?.map((w) => (
                      <span key={w.id} className={`mark done ${model.dayById.get(w.planDayId ?? '')?.color ?? ''}`} />
                    ))}
                    {planned && planned !== 'rest' && <span className={`mark planned ${planned.color}`} />}
                    {!done && past === 'gap' && <span className="mark gap" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="cal-legend">
            <span><i className="mark done arms" /> Done</span>
            <span><i className="mark planned arms" /> Planned</span>
            <span><i className="mark gap" /> Missed</span>
          </div>
        </section>

        <div>
          <section className="section">
            <p className="eyebrow">{selected === today ? 'Today' : LONG.format(parseLocalDate(selected))}</p>
            <div className="list">
              {selWorkouts.map((w) => (
                <WorkoutRow key={w.id} w={w} day={model.dayById.get(w.planDayId ?? '')} />
              ))}
              {selWorkouts.length === 0 && selPlanned && (
                <div className="row">
                  {selPlanned === 'rest' ? (
                    <div className="row-main row-sub">Rest day</div>
                  ) : (
                    <>
                      <span className={`dot ${selPlanned.color}`} />
                      <div className="row-main">
                        <div className="row-title">Planned · {dayLabel(selPlanned)}</div>
                        <div className="row-sub">{selPlanned.name}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {selWorkouts.length === 0 && !selPlanned && (
                <div className="row row-sub">
                  {selPast === 'rest' ? 'Rest day' : selPast === 'gap' ? 'No workout' : 'Nothing logged'}
                </div>
              )}
              {canLog && (
                <button className="row action" onClick={() => setLogging(true)}>
                  {selWorkouts.length ? 'Log Another Workout' : 'Log Workout'}
                </button>
              )}
              {canLog && selWorkouts.length === 0 && selected < today && (
                <button className="row action" onClick={() => toggleRestDay(selected)}>
                  {isExplicitRest ? 'Unmark Rest Day' : 'Mark as Rest Day'}
                </button>
              )}
            </div>
          </section>

          <section className="section">
            <p className="eyebrow">{MONTH.format(new Date(cursor.y, cursor.m, 1))}</p>
            {monthWorkouts.length === 0 ? (
              <div className="empty" style={{ padding: 'var(--s-5)' }}>
                No workouts this month.
              </div>
            ) : (
              <div className="list">
                {monthWorkouts.map((w) => (
                  <WorkoutRow key={w.id} w={w} day={model.dayById.get(w.planDayId ?? '')} totals={totals?.get(w.id)} withDate />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet open={logging} onClose={() => setLogging(false)} title={`Log · ${LONG.format(parseLocalDate(selected))}`}>
        <div className="list">
          {model.days.map((d) => (
            <button
              key={d.id}
              className="row"
              onClick={async () => {
                const w = await createBackfillWorkout(d.id, selected);
                setLogging(false);
                navigate(`/history/workout/${w.id}/edit`);
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
        <p className="footnote">Values are prefilled from the workouts before this date.</p>
      </Sheet>
    </div>
  );
}

const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function WorkoutRow({
  w,
  day,
  totals,
  withDate,
}: {
  w: Workout;
  day?: PlanDay;
  totals?: { sets: number; volume: number };
  withDate?: boolean;
}) {
  return (
    <Link to={`/history/workout/${w.id}`} className="row">
      <span className={`dot ${day?.color ?? ''}`} />
      <div className="row-main">
        <div className="row-title">
          {withDate ? `${SHORT.format(parseLocalDate(w.date))} · ` : ''}
          {day ? dayLabel(day) : 'Workout'}
        </div>
        <div className="row-sub">
          {day?.name ?? ''}
          {totals && (
            <span className="num">
              {' '}
              · {totals.sets} {totals.sets === 1 ? 'set' : 'sets'}{totals.volume > 0 ? ` · ${formatVolume(totals.volume)}` : ''}
            </span>
          )}
        </div>
      </div>
      <IconChevronRight className="chevron" />
    </Link>
  );
}
