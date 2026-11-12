import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { requestPersistentStorage } from './db/db';
import { seedIfEmpty } from './db/seed';
import { Shell } from './components/Shell';
import { Today } from './screens/Today';
import { ExerciseProgress, Progress } from './screens/Progress';
import { PlanDayDetail, Profile } from './screens/Profile';
import { ExerciseEditor, ExerciseList } from './screens/Exercises';
import { WorkoutEditScreen, WorkoutScreen } from './screens/Workout';
import { History } from './screens/History';
import { WorkoutDetail } from './screens/WorkoutDetail';
import './styles/tokens.css';
import './styles/base.css';

// Hash routing: works on any static host without server rewrites.
const router = createHashRouter([
  { path: '/workout', element: <WorkoutScreen /> },
  { path: '/history/workout/:id/edit', element: <WorkoutEditScreen /> },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/history', element: <History /> },
      { path: '/history/workout/:id', element: <WorkoutDetail /> },
      { path: '/summary/:id', element: <WorkoutDetail summary /> },
      { path: '/progress', element: <Progress /> },
      { path: '/progress/exercise/:id', element: <ExerciseProgress /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/day/:id', element: <PlanDayDetail /> },
      { path: '/profile/exercises', element: <ExerciseList /> },
      { path: '/profile/exercise/:id', element: <ExerciseEditor /> },
    ],
  },
]);

async function boot() {
  if (import.meta.env.DEV) {
    // Test hooks for local end-to-end scripts only; stripped from production builds.
    const api = await import('./db/workout');
    Object.assign(window, { __db: (await import('./db/db')).db, __api: api });
  }
  await seedIfEmpty();
  void requestPersistentStorage();
  registerSW({ immediate: true });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void boot();
