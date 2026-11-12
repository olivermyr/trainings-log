import { NavLink, Outlet } from 'react-router-dom';
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
