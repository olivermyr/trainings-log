import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExercise, useLoggedWorkouts } from '../db/queries';
import { localDate } from '../db/ids';
import { addDays } from '../domain/cycle';
import {
  MUSCLES,
  comparePeriods,
  exerciseSeries,
  muscleSets,
  muscleSetsByWeek,
  weekStart,
  weeklyStats,
  workoutVolume,
  type ExercisePoint,
  type LoggedWorkout,
} from '../domain/analytics';
import { dayLabel, formatDuration, formatKg, parseLocalDate } from '../domain/format';
import { formatVolume } from '../domain/stats';
import { MUSCLE_LABELS, type Exercise, type MuscleGroup } from '../domain/types';
import { ColumnChart, HBarChart, LineChart, type LinePoint } from '../components/Chart';
import { Segmented } from '../components/Form';
import { IconChevronRight } from '../components/Icons';
import { usePlanDays } from '../db/queries';
import { BackButton } from '../components/BackButton';
import { BodyView } from './Body';
import './progress.css';

type View = 'exercises' | 'volume' | 'muscles' | 'body';
type Range = '4w' | '12w' | '6m' | '1y' | 'all';

const RANGE_DAYS: Record<Range, number | null> = { '4w': 28, '12w': 84, '6m': 182, '1y': 365, all: null };
const RANGE_LABEL: Record<Range, string> = { '4w': '4W', '12w': '12W', '6m': '6M', '1y': '1Y', all: 'All' };

function rangeStart(range: Range, today: string, first: string | undefined): string {
  const days = RANGE_DAYS[range];
  const fallback = first ?? today;
  if (days == null) return fallback;
  return addDays(today, -(days - 1));
}

const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const short = (d: string) => SHORT.format(parseLocalDate(d));

export function Progress() {
  const data = useLoggedWorkouts();
  const [view, setView] = useState<View>('exercises');
  if (!data) return null;
  return (
    <div className="screen-enter">
      <h1 className="large-title">Progress</h1>
      <>
          <div className="progress-switch">
            <Segmented<View>
              label="Progress view"
              value={view}
              onChange={setView}
              options={[
                { value: 'exercises', label: 'Exercises' },
                { value: 'volume', label: 'Volume' },
                { value: 'muscles', label: 'Muscles' },
                { value: 'body', label: 'Body' },
              ]}
            />
          </div>
          {view !== 'body' && data.length === 0 && (
            <div className="empty">
              <h3>Nothing to analyse yet</h3>
              Charts and records are calculated from your logged workouts.
            </div>
          )}
          {data.length > 0 && view === 'exercises' && <ExercisesView data={data} />}
          {data.length > 0 && view === 'volume' && <VolumeView data={data} />}
          {data.length > 0 && view === 'muscles' && <MusclesView data={data} />}
          {view === 'body' && <BodyView />}
      </>
    </div>
  );
}

function RangePicker({ value, onChange, options }: { value: Range; onChange: (r: Range) => void; options: Range[] }) {
  return (
    <div className="range-row">
      <Segmented<Range> label="Time range" value={value} onChange={onChange} options={options.map((o) => ({ value: o, label: RANGE_LABEL[o] }))} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercises

function headline(ex: Exercise, pts: ExercisePoint[]): string {
  const last = pts.at(-1)!;
  if (ex.type === 'timed_tempo') return `Last ${formatDuration(last.bestTime)}${last.timeWeight ? ` @ ${formatKg(last.timeWeight)} kg` : ''}`;
  if (ex.type === 'bodyweight_reps') return `Last ${last.maxReps} reps`;
  return `Last ${formatKg(last.topWeight)} × ${last.topReps}`;
}

function ExercisesView({ data }: { data: LoggedWorkout[] }) {
  const list = useMemo(() => {
    const byId = new Map<string, Exercise>();
    for (const w of data) for (const e of w.entries) byId.set(e.exercise.id, e.exercise);
    return [...byId.values()]
      .map((ex) => ({ ex, pts: exerciseSeries(ex.id, data) }))
      .sort((a, b) => (a.pts.at(-1)!.date < b.pts.at(-1)!.date ? 1 : -1));
  }, [data]);
  return (
    <section className="section">
      <div className="list">
        {list.map(({ ex, pts }) => (
          <Link key={ex.id} to={`/progress/exercise/${ex.id}`} className="row">
            <div className="row-main">
              <div className="row-title">{ex.name}</div>
              <div className="row-sub num">
                {headline(ex, pts)} · {pts.length} {pts.length === 1 ? 'session' : 'sessions'}
              </div>
            </div>
            <IconChevronRight className="chevron" />
          </Link>
        ))}
      </div>
    </section>
  );
}

type Metric = 'e1rm' | 'weight' | 'reps' | 'time' | 'maxReps' | 'totalReps' | 'volume';

const METRICS: Record<Exercise['type'], { value: Metric; label: string }[]> = {
  weight_reps: [
    { value: 'e1rm', label: 'Est. 1RM' },
    { value: 'weight', label: 'Top weight' },
    { value: 'reps', label: 'Top reps' },
    { value: 'volume', label: 'Volume' },
  ],
  timed_tempo: [
    { value: 'time', label: 'Time' },
    { value: 'weight', label: 'Weight' },
  ],
  bodyweight_reps: [
    { value: 'maxReps', label: 'Best set' },
    { value: 'totalReps', label: 'Total reps' },
  ],
};

function metricValue(m: Metric, p: ExercisePoint): number {
  switch (m) {
    case 'e1rm':
      return p.e1rm;
    case 'weight':
      return p.topWeight;
    case 'reps':
      return p.topReps;
    case 'time':
      return p.bestTime;
    case 'maxReps':
      return p.maxReps;
    case 'totalReps':
      return p.totalReps;
    case 'volume':
      return p.volume;
  }
}

function metricFormat(m: Metric): (v: number) => string {
  if (m === 'time') return (v) => formatDuration(v);
  if (m === 'volume') return (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(Math.round(v)));
  if (m === 'reps' || m === 'maxReps' || m === 'totalReps') return (v) => String(Math.round(v));
  return (v) => formatKg(Math.round(v * 10) / 10);
}

function pointTip(ex: Exercise, m: Metric, p: ExercisePoint): string[] {
  const top = ex.type === 'timed_tempo' ? `${formatDuration(p.bestTime)} @ ${formatKg(p.timeWeight)} kg` : `${formatKg(p.topWeight)} kg × ${p.topReps}`;
  switch (m) {
    case 'e1rm':
      return [`${formatKg(p.e1rm)} kg`, `Top set ${top}`];
    case 'weight':
      return [`${formatKg(m === 'weight' && ex.type === 'timed_tempo' ? p.timeWeight : p.topWeight)} kg`, ex.type === 'timed_tempo' ? formatDuration(p.bestTime) : `× ${p.topReps}`];
    case 'reps':
      return [`${p.topReps} reps`, `at ${formatKg(p.topWeight)} kg`];
    case 'time':
      return [formatDuration(p.bestTime), `${formatKg(p.timeWeight)} kg added`];
    case 'maxReps':
      return [`${p.maxReps} reps`, 'best set'];
    case 'totalReps':
      return [`${p.totalReps} reps`, `${p.sets.length} sets`];
    case 'volume':
      return [formatVolume(p.volume), `Top set ${top}`];
  }
}

export function ExerciseProgress() {
  const { id } = useParams();
  const ex = useExercise(id);
  const data = useLoggedWorkouts();
  const [metric, setMetric] = useState<Metric | null>(null);
  const [range, setRange] = useState<Range>('all');
  const today = localDate();

  const pts = useMemo(() => (data && id ? exerciseSeries(id, data) : []), [data, id]);
  if (ex === undefined || !data) return null;
  if (ex === null)
    return (
      <div className="empty">
        <h3>Exercise not found</h3>
      </div>
    );

  const m = metric ?? METRICS[ex.type][0].value;
  const start = rangeStart(range, today, pts[0]?.date);
  const visible = pts.filter((p) => p.date >= start);
  const line: LinePoint[] = visible.map((p) => ({
    date: p.date,
    value: m === 'weight' && ex.type === 'timed_tempo' ? p.timeWeight : metricValue(m, p),
    tip: pointTip(ex, m, p),
  }));
  const fmt = metricFormat(m);
  const cmp = comparePeriods(pts, ((p: ExercisePoint) => metricValue(m, p)) as never, today);

  return (
    <div className="screen-enter">
      <BackButton label="Progress" />
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)', fontSize: ex.name.length > 18 ? 28 : undefined }}>
        {ex.name}
      </h1>

      <ExerciseTiles ex={ex} pts={pts} />

      <section className="section">
        <div className="chart-controls">
          <Segmented<Metric> label="Metric" value={m} onChange={setMetric} options={METRICS[ex.type]} />
        </div>
        {cmp.current != null && cmp.previous != null && cmp.previous > 0 && (
          <p className="chart-caption">
            Best of last 4 weeks <strong className="num">{fmt(cmp.current)}</strong>{' '}
            <Delta now={cmp.current} before={cmp.previous} /> vs the 4 weeks before
          </p>
        )}
        {line.length > 0 ? (
          <LineChart
            points={line}
            format={fmt}
            label={`${ex.name} ${m} over time`}
            goal={m === 'time' && ex.targetSeconds ? { value: ex.targetSeconds, label: `Goal ${formatDuration(ex.targetSeconds)}` } : undefined}
            zeroBased={m === 'volume' || m === 'totalReps'}
            tickMode={m === 'time' ? 'time' : m === 'reps' || m === 'maxReps' || m === 'totalReps' ? 'integer' : 'any'}
          />
        ) : (
          <div className="empty">No sessions in this range.</div>
        )}
        <RangePicker value={range} onChange={setRange} options={['12w', '6m', '1y', 'all']} />
      </section>

      <Records ex={ex} pts={pts} />

      <section className="section">
        <p className="eyebrow">Sessions</p>
        <div className="list">
          {[...pts].reverse().map((p) => (
            <Link key={p.workoutId} to={`/history/workout/${p.workoutId}`} className="row">
              <div className="row-main">
                <div className="row-title num">{short(p.date)}</div>
                <div className="row-sub num">{setsSummary(ex, p)}</div>
              </div>
              <IconChevronRight className="chevron" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function setsSummary(ex: Exercise, p: ExercisePoint): string {
  return p.sets
    .map((s) => {
      const side = s.side ?? '';
      if (ex.type === 'timed_tempo') return `${formatDuration(s.durationS ?? 0)}${s.weight ? ` @ ${formatKg(s.weight)}` : ''}`;
      if (ex.type === 'bodyweight_reps') return `${side}${s.reps}`;
      return `${side}${formatKg(s.weight)}×${s.reps}`;
    })
    .join('  ');
}

function ExerciseTiles({ ex, pts }: { ex: Exercise; pts: ExercisePoint[] }) {
  const best = <K extends keyof ExercisePoint>(k: K) =>
    pts.reduce((a, p) => ((p[k] as number) > (a[k] as number) ? p : a), pts[0]);
  if (pts.length === 0) return null;
  let tiles: { label: string; value: string; sub?: string }[];
  if (ex.type === 'timed_tempo') {
    const heaviest = best('timeWeight');
    const atHeaviest = pts.filter((p) => p.timeWeight === heaviest.timeWeight);
    const longest = atHeaviest.reduce((a, p) => (p.bestTime > a.bestTime ? p : a), atHeaviest[0]);
    tiles = [
      { label: 'Best time', value: formatDuration(longest.bestTime), sub: `@ ${formatKg(longest.timeWeight)} kg` },
      { label: 'Goal', value: formatDuration(ex.targetSeconds ?? 300), sub: `${Math.min(100, Math.round((longest.bestTime / (ex.targetSeconds ?? 300)) * 100))}% reached` },
      { label: 'Sessions', value: String(pts.length) },
    ];
  } else if (ex.type === 'bodyweight_reps') {
    const b = best('maxReps');
    tiles = [
      { label: 'Best set', value: `${b.maxReps}`, sub: 'reps' },
      { label: 'Best total', value: `${best('totalReps').totalReps}`, sub: 'reps' },
      { label: 'Sessions', value: String(pts.length) },
    ];
  } else {
    const e = best('e1rm');
    const h = best('topWeight');
    tiles = [
      { label: 'Est. 1RM', value: `${formatKg(e.e1rm)}`, sub: 'kg' },
      { label: 'Heaviest', value: `${formatKg(h.topWeight)}`, sub: `kg × ${h.topReps}` },
      { label: 'Sessions', value: String(pts.length) },
    ];
  }
  return (
    <div className="stats">
      {tiles.map((t) => (
        <div key={t.label}>
          <span className="stat-label">{t.label}</span>
          <span className="stat-value num">{t.value}</span>
          {t.sub && <span className="stat-sub num">{t.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function Records({ ex, pts }: { ex: Exercise; pts: ExercisePoint[] }) {
  if (pts.length === 0) return null;
  // Best reps per weight (weight_reps / bodyweight) or best time per weight (timed).
  const perWeight = new Map<number, { value: number; date: string }>();
  for (const p of pts) {
    for (const s of p.sets) {
      const w = s.weight ?? 0;
      const v = ex.type === 'timed_tempo' ? (s.durationS ?? 0) : (s.reps ?? 0);
      const cur = perWeight.get(w);
      if (!cur || v > cur.value) perWeight.set(w, { value: v, date: p.date });
    }
  }
  const rows = [...perWeight.entries()].sort((a, b) => b[0] - a[0]).slice(0, 8);
  const vol = pts.reduce((a, p) => (p.volume > a.volume ? p : a), pts[0]);
  return (
    <section className="section">
      <p className="eyebrow">{ex.type === 'timed_tempo' ? 'Best time by weight' : 'Best reps by weight'}</p>
      <div className="list">
        {rows.map(([w, r]) => (
          <div key={w} className="row">
            <div className="row-main num">{ex.type === 'bodyweight_reps' && w === 0 ? 'Bodyweight' : `${formatKg(w)} kg`}</div>
            <span className="row-value num">
              <strong className="rec-value">{ex.type === 'timed_tempo' ? formatDuration(r.value) : `${r.value} reps`}</strong> · {short(r.date)}
            </span>
          </div>
        ))}
        {ex.type === 'weight_reps' && vol.volume > 0 && (
          <div className="row">
            <div className="row-main">Most volume in a session</div>
            <span className="row-value num">
              <strong className="rec-value">{formatVolume(vol.volume)}</strong> · {short(vol.date)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const pct = Math.round(((now - before) / before) * 100);
  return <span className={`delta num${pct > 0 ? ' up' : ''}`}>{`${pct > 0 ? '+' : ''}${pct}%`}</span>;
}

// ---------------------------------------------------------------------------
// Volume

function VolumeView({ data }: { data: LoggedWorkout[] }) {
  const [range, setRange] = useState<Range>('12w');
  const days = usePlanDays();
  const today = localDate();
  const start = rangeStart(range, today, data[0]?.workout.date);
  const weeks = useMemo(() => weeklyStats(data, start < data[0].workout.date ? weekStart(data[0].workout.date) : start, today), [data, start, today]);
  const thisWeek = weeks.at(-1);
  const lastWeek = weeks.at(-2);
  const inRange = data.filter((w) => w.workout.date >= start);
  const durations = weeks.flatMap((w) => (w.durationMin != null ? [w.durationMin] : []));
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const dayById = new Map((days ?? []).map((d) => [d.id, d]));
  const weekLabel = (w: string) => (w === weekStart(today) ? 'This wk' : short(w));

  return (
    <>
      <div className="stats">
        <div>
          <span className="stat-label">This week</span>
          <span className="stat-value num">{thisWeek && thisWeek.volume > 0 ? formatVolume(thisWeek.volume) : '–'}</span>
          {lastWeek && lastWeek.volume > 0 && <span className="stat-sub num">Last week {formatVolume(lastWeek.volume)}</span>}
        </div>
        <div>
          <span className="stat-label">Workouts</span>
          <span className="stat-value num">{thisWeek?.workouts ?? 0}</span>
          <span className="stat-sub">this week</span>
        </div>
        <div>
          <span className="stat-label">Avg duration</span>
          <span className="stat-value num">{avgDuration ? `${Math.round(avgDuration)}` : '–'}</span>
          {avgDuration && <span className="stat-sub">min</span>}
        </div>
      </div>

      <section className="section">
        <p className="eyebrow">Volume per week</p>
        <ColumnChart
          label="Volume per week"
          format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
          columns={weeks.map((w) => ({
            key: w.week,
            label: weekLabel(w.week),
            value: w.volume,
            tip: [formatVolume(w.volume), `Week of ${short(w.week)}`, `${w.workouts} ${w.workouts === 1 ? 'workout' : 'workouts'}`],
          }))}
        />
      </section>

      <section className="section">
        <p className="eyebrow">Workouts per week</p>
        <ColumnChart
          label="Workouts per week"
          integer
          height={140}
          format={(v) => String(v)}
          columns={weeks.map((w) => ({
            key: w.week,
            label: weekLabel(w.week),
            value: w.workouts,
            tip: [`${w.workouts} ${w.workouts === 1 ? 'workout' : 'workouts'}`, `Week of ${short(w.week)}`],
          }))}
        />
      </section>

      <section className="section">
        <p className="eyebrow">Volume per workout</p>
        <ColumnChart
          label="Volume per workout"
          format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
          columns={inRange.map((w) => {
            const d = w.workout.planDayId ? dayById.get(w.workout.planDayId) : undefined;
            return {
              key: w.workout.id,
              label: short(w.workout.date),
              value: workoutVolume(w),
              tip: [formatVolume(workoutVolume(w)), d ? `${dayLabel(d)} · ${d.name}` : 'Workout', short(w.workout.date)],
            };
          })}
        />
        <p className="footnote">Volume = weight × reps of completed sets (dumbbells × 2). Slow-tempo and bodyweight sets are not included.</p>
      </section>

      <RangePicker value={range} onChange={setRange} options={['4w', '12w', '6m', '1y', 'all']} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Muscles

function MusclesView({ data }: { data: LoggedWorkout[] }) {
  const [range, setRange] = useState<Range>('4w');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const today = localDate();
  // Average over COMPLETE weeks only (the running week would dilute it).
  const thisWeek = weekStart(today);
  const firstWeek = weekStart(data[0].workout.date);
  const n = RANGE_DAYS[range] == null ? null : RANGE_DAYS[range]! / 7;
  let start = n == null ? firstWeek : addDays(thisWeek, -7 * n);
  if (start < firstWeek) start = firstWeek;
  const weeksInRange = Math.max(1, Math.round((parseLocalDate(thisWeek).getTime() - parseLocalDate(start).getTime()) / (7 * 86_400_000)));
  const complete = data.filter((w) => w.workout.date >= start && w.workout.date < thisWeek);
  const hasComplete = start < thisWeek;
  const totals = muscleSets(hasComplete ? complete : data.filter((w) => w.workout.date >= thisWeek));
  const rows = MUSCLES.map((m) => ({ m, perWeek: totals[m] / weeksInRange })).sort((a, b) => b.perWeek - a.perWeek);
  const weekly = muscleSetsByWeek(data, muscle, start, today);

  return (
    <>
      <section className="section">
        <p className="eyebrow">{hasComplete ? `Sets per week · average of ${weeksInRange} complete ${weeksInRange === 1 ? 'week' : 'weeks'}` : 'Sets this week'}</p>
        <HBarChart
          label="Weighted sets per week by muscle group"
          selected={muscle}
          onSelect={(k) => setMuscle(k as MuscleGroup)}
          rows={rows.map(({ m, perWeek }) => ({
            key: m,
            label: MUSCLE_LABELS[m],
            value: perWeek,
            display: perWeek >= 10 ? perWeek.toFixed(0) : perWeek.toFixed(1).replace(/\.0$/, ''),
          }))}
        />
        <p className="footnote">
          Completed working sets; a primary muscle counts 1, a secondary ½. Muscles do not all need the same volume — this shows
          the distribution, not a target.
        </p>
      </section>

      <section className="section">
        <p className="eyebrow">{MUSCLE_LABELS[muscle]} · sets per week</p>
        <ColumnChart
          label={`${MUSCLE_LABELS[muscle]} sets per week`}
          integer
          height={150}
          format={(v) => String(v)}
          columns={weekly.map((w) => ({
            key: w.week,
            label: w.week === weekStart(today) ? 'This wk' : short(w.week),
            value: w.sets,
            tip: [`${w.sets.toFixed(1).replace(/\.0$/, '')} sets`, `Week of ${short(w.week)}`],
          }))}
        />
      </section>

      <RangePicker value={range} onChange={setRange} options={['4w', '12w', '6m', 'all']} />

    </>
  );
}
