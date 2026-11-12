import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addCustomMetric,
  deleteBodyEntry,
  removeCustomMetric,
  saveBodyValues,
  updateBodyProfile,
  useBodyEntries,
  useBodyProfile,
  useMetricDefs,
} from '../db/body';
import { localDate } from '../db/ids';
import { GROUP_LABEL, ageFrom, formatMetric, latestWithChange, parseMetric, type MetricDef, type MetricGroup } from '../domain/body';
import { parseLocalDate } from '../domain/format';
import { LineChart } from '../components/Chart';
import { FieldRow, Segmented, Sheet } from '../components/Form';
import { IconChevronRight } from '../components/Icons';
import { BackButton } from '../components/BackButton';
import './body.css';

const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const short = (d: string) => SHORT.format(parseLocalDate(d));

/** Body tab inside Progress. Optional by design: empty until something is logged. */
export function BodyView() {
  const defs = useMetricDefs();
  const entries = useBodyEntries();
  const [logging, setLogging] = useState(false);
  if (!defs || !entries) return null;
  const groups: MetricGroup[] = ['body', 'measurements', 'recovery'];
  const hasAny = [...entries.values()].some((e) => e.length > 0);

  return (
    <>
      <button className="btn-primary" style={{ marginBottom: 'var(--s-6)' }} onClick={() => setLogging(true)}>
        Log Measurements
      </button>
      {!hasAny && <p className="footnote" style={{ margin: '0 0 var(--s-6)' }}>Optional. Log only what you track — every value is saved on its own.</p>}

      {groups.map((g) => (
        <section key={g} className="section">
          <p className="eyebrow">{GROUP_LABEL[g]}</p>
          <div className="list">
            {defs
              .filter((d) => d.group === g)
              .map((d) => {
                const r = latestWithChange(entries.get(d.key) ?? []);
                return (
                  <Link key={d.key} to={`/progress/body/${d.key}`} className="row">
                    <div className="row-main">
                      <div className="row-title">{d.label}</div>
                      {r && <div className="row-sub num">{short(r.latest.date)}{r.change != null && r.since && ` · ${signed(d, r.change)} since ${short(r.since)}`}</div>}
                    </div>
                    <span className="row-value num">{r ? `${formatMetric(d, r.latest.value)} ${d.unit}` : '–'}</span>
                    <IconChevronRight className="chevron" />
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
      <AddCustomMetric />
      <LogSheet open={logging} onClose={() => setLogging(false)} defs={defs} />
    </>
  );
}

function signed(d: MetricDef, v: number) {
  if (Math.abs(v) < 1e-9) return '±0';
  return `${v > 0 ? '+' : '−'}${formatMetric(d, Math.abs(v))}`;
}

function AddCustomMetric() {
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState('cm');
  return (
    <section className="section">
      <p className="eyebrow">Custom measurement</p>
      <div className="list">
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await addCustomMetric(label, unit)) setLabel('');
          }}
        >
          <input className="field" placeholder="e.g. Calf" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Measurement name" />
          <input className="field unit-field" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
          <button type="submit" className="inline-action" disabled={!label.trim()}>
            Add
          </button>
        </form>
      </div>
    </section>
  );
}

function LogSheet({ open, onClose, defs }: { open: boolean; onClose: () => void; defs: MetricDef[] }) {
  const [date, setDate] = useState(localDate());
  const [values, setValues] = useState<Record<string, string>>({});
  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of defs) {
      const v = parseMetric(d.key, values[d.key] ?? '');
      if (v != null) out[d.key] = v;
    }
    return out;
  }, [values, defs]);
  const invalid = defs.filter((d) => (values[d.key] ?? '').trim() !== '' && parsed[d.key] == null);
  const count = Object.keys(parsed).length;

  return (
    <Sheet open={open} onClose={onClose} title="Log Measurements">
      <div className="list section">
        <FieldRow label="Date">
          <input type="date" className="date-input" value={date} max={localDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </FieldRow>
      </div>
      {(['body', 'measurements', 'recovery'] as MetricGroup[]).map((g) => (
        <div key={g}>
          <p className="eyebrow">{GROUP_LABEL[g]}</p>
          <div className="list section">
            {defs
              .filter((d) => d.group === g)
              .map((d) => (
                <label key={d.key} className="row metric-input">
                  <span className="row-main row-title">{d.label}</span>
                  <input
                    className={`set-input num${invalid.includes(d) ? ' invalid' : ''}`}
                    inputMode={d.key === 'sleep' ? 'text' : 'decimal'}
                    placeholder={d.placeholder}
                    value={values[d.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [d.key]: e.target.value })}
                  />
                  <span className="metric-unit">{d.unit}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
      <button
        className="btn-primary"
        disabled={count === 0 || invalid.length > 0}
        onClick={async () => {
          await saveBodyValues(date, parsed);
          setValues({});
          onClose();
        }}
      >
        {invalid.length > 0 ? `Check ${invalid[0].label}` : count === 0 ? 'Enter at least one value' : `Save ${count} ${count === 1 ? 'value' : 'values'}`}
      </button>
      <p className="footnote">A value for a day that already has one replaces it.</p>
    </Sheet>
  );
}

export function BodyMetricDetail() {
  const { key } = useParams();
  const navigate = useNavigate();
  const defs = useMetricDefs();
  const all = useBodyEntries();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!defs || !all) return null;
  const def = defs.find((d) => d.key === key);
  if (!def)
    return (
      <div className="empty">
        <h3>Measurement not found</h3>
      </div>
    );
  const entries = all.get(def.key) ?? [];
  const fmt = (v: number) => formatMetric(def, v);

  return (
    <div className="screen-enter">
      <BackButton label="Progress" />
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)' }}>{def.label}</h1>

      {entries.length > 0 ? (
        <section className="section">
          <LineChart
            label={`${def.label} over time`}
            format={fmt}
            tickMode={def.key === 'restingHr' || def.key === 'hrv' ? 'integer' : 'any'}
            points={entries.map((e) => ({ date: e.date, value: e.value, tip: [`${fmt(e.value)} ${def.unit}`] }))}
          />
        </section>
      ) : (
        <div className="empty">No values yet. Use “Log Measurements”.</div>
      )}

      {entries.length > 0 && (
        <section className="section">
          <p className="eyebrow">Entries</p>
          <div className="list">
            {[...entries].reverse().map((e) => (
              <div key={e.id} className="row">
                <div className="row-main num">{LONG.format(parseLocalDate(e.date))}</div>
                <span className="row-value num">
                  {fmt(e.value)} {def.unit}
                </span>
                <button
                  className={`entry-delete${confirm === e.id ? ' armed' : ''}`}
                  aria-label={confirm === e.id ? 'Tap again to delete' : 'Delete entry'}
                  onClick={() => (confirm === e.id ? deleteBodyEntry(e.id) : setConfirm(e.id))}
                >
                  {confirm === e.id ? 'Delete' : '−'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {def.custom && (
        <section className="section">
          <div className="list">
            <button
              className="row destructive"
              onClick={async () => {
                if (!confirmRemove) return setConfirmRemove(true);
                await removeCustomMetric(def.key);
                navigate(-1);
              }}
            >
              {confirmRemove ? 'Tap again to remove' : 'Remove Measurement'}
            </button>
          </div>
          <p className="footnote">Logged values are kept.</p>
        </section>
      )}
    </div>
  );
}

/** Profile section: static body data. */
export function BodyProfileSection() {
  const p = useBodyProfile();
  const today = localDate();
  if (!p) return null;
  return (
    <section className="section">
      <p className="eyebrow">Body</p>
      <div className="list">
        <FieldRow label="Height">
          <span className="inline-number">
            <input
              key={p.heightCm ?? 'none'}
              className="set-input num"
              inputMode="numeric"
              aria-label="Height in cm"
              placeholder="–"
              defaultValue={p.heightCm ?? ''}
              onBlur={(e) => {
                const v = parseMetric('height', e.target.value);
                updateBodyProfile({ heightCm: v != null && v >= 100 && v <= 250 ? Math.round(v) : null });
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <span className="inline-suffix">cm</span>
          </span>
        </FieldRow>
        <FieldRow label="Birth date" sub={p.birthDate ? `${ageFrom(p.birthDate, today)} years` : undefined}>
          <input
            type="date"
            className="date-input"
            aria-label="Birth date"
            value={p.birthDate ?? ''}
            max={today}
            onChange={(e) => updateBodyProfile({ birthDate: e.target.value || null })}
          />
        </FieldRow>
        <FieldRow label="Sex">
          <Segmented<'male' | 'female' | 'none'>
            label="Sex"
            value={p.sex ?? 'none'}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            onChange={(v) => updateBodyProfile({ sex: v === 'none' ? null : v })}
          />
        </FieldRow>
      </div>
      <p className="footnote">Part of your backup when signed in.</p>
    </section>
  );
}
