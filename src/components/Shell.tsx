import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useActiveWorkout, usePlanDay } from '../db/queries';
import { dayLabel, formatDuration } from '../domain/format';
import { useNow } from './useNow';
import { useWakeLock } from './useWakeLock';
import { useRestTimer } from '../db/timers';
import { countdownText, remainingMs } from '../domain/timer';
import '../screens/workout.css';
import { IconHistory, IconProfile, IconProgress, IconToday } from './Icons';

const TABS = [
  { to: '/', label: 'Today', Icon: IconToday, end: true },
  { to: '/history', label: 'History', Icon: IconHistory, end: false },
  { to: '/progress', label: 'Progress', Icon: IconProgress, end: false },
  { to: '/profile', label: 'Profile', Icon: IconProfile, end: false },
];

export function Shell() {
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="sidebar-title">Trainings Log</div>
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <MiniBar />

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={26} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Shows the running workout above the tab bar; tap returns to it. */
function MiniBar() {
  const active = useActiveWorkout();
  const day = usePlanDay(active?.planDayId ?? undefined);
  const navigate = useNavigate();
  const rest = useRestTimer();
  const now = useNow(rest ? 250 : 1000);
  useWakeLock(!!active);
  if (!active) return null;
  const left = rest ? remainingMs(rest, now) : null;
  return (
    <button className="mini-bar" onClick={() => navigate('/workout')} aria-label="Return to workout">
      <span className={`dot ${day?.day.color ?? ''}`} />
      <span className="mini-main">
        <span className="mini-title">{day ? `${dayLabel(day.day)} · ${day.day.name}` : 'Workout'}</span>
        <span className="mini-sub" style={{ display: 'block' }}>
          {left == null ? 'In progress' : left > 0 ? 'Resting' : 'Rest over'}
        </span>
      </span>
      <span className={`mini-time num${left != null && left <= 0 ? ' over' : ''}`}>
        {left != null ? (left > 0 ? countdownText(left) : 'Go') : formatDuration(Math.max(0, (now - active.startedAt) / 1000))}
      </span>
    </button>
  );
}
