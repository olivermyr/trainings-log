import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlanDay, usePlanDays } from '../db/queries';
import { splitDayName, targetLabel } from '../domain/format';
import { IconChevronLeft, IconChevronRight } from '../components/Icons';

export function Profile() {
  const days = usePlanDays();
  return (
    <div className="screen-enter">
      <h1 className="large-title">Profile</h1>
      <section className="section">
        <p className="eyebrow">Training plan</p>
        <div className="list">
          {days?.map((d) => {
            const { short, title } = splitDayName(d.name);
            return (
              <Link key={d.id} to={`/profile/day/${d.id}`} className="row indent">
                <span className={`dot ${d.color}`} style={{ marginRight: 12 }} />
                <div className="row-main">
                  <div className="row-title">{short}</div>
                  {title && <div className="row-sub">{title}</div>}
                </div>
                <IconChevronRight className="chevron" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function PlanDayDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = usePlanDay(id);
  if (data === undefined) return null;
  if (data === null)
    return (
      <div className="empty">
        <h3>Day not found</h3>
      </div>
    );
  const { short, title } = splitDayName(data.day.name);
  return (
    <div className="screen-enter">
      <button className="back" onClick={() => navigate(-1)}>
        <IconChevronLeft /> Profile
      </button>
      <h1 className="large-title" style={{ marginTop: 'var(--s-2)' }}>{short}</h1>
      <section className="section">
        <p className="eyebrow">{title}</p>
        <div className="list">
          {data.exercises.map((e) => (
            <div className="row" key={e.id}>
              <div className="row-main">
                <div className="row-title">{e.name}</div>
                <div className="row-sub">
                  {e.type === 'timed_tempo'
                    ? `Slow tempo · ${e.tempoSeconds}s down / ${e.tempoSeconds}s up`
                    : `Rest ${Math.floor(e.restSeconds / 60)}:${String(e.restSeconds % 60).padStart(2, '0')}`}
                </div>
              </div>
              <span className="row-value num">{targetLabel(e)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
