# Trainings Log

A personal strength-training log, built as an offline-first PWA for iPhone (and usable on desktop).

**Live:** https://olivermyr.github.io/trainings-log/ — open in Safari → Share → *Add to Home Screen*.

## Features
- Training plan with a flexible cycle (Day 1–6 + rest day; missed days shift the plan, today's day can be set manually)
- Fast workout logging: values prefilled from the last time an exercise was done, progression suggestions, per-side sets, rest timer, full-screen stopwatch with tempo bar for slow sets
- Personal records detected automatically, summary after each workout
- History calendar, editing and backfilling past workouts
- Progress: per-exercise trends (est. 1RM, weight, reps, time), weekly volume, weighted sets per muscle group, body metrics
- Cloud backup & multi-device sync (Supabase, email-code login), JSON/CSV export and restore

## Tech
React 19 · TypeScript · Vite · vite-plugin-pwa · Dexie (IndexedDB) · Supabase · Vitest

All data lives on the device first (works fully offline). Sync uses one `records` table with row-level security and last-write-wins on `updatedAt`.

```
src/
  domain/      pure logic (cycle, workout prefill & progression, records, analytics, body, stats) — unit tested
  db/          Dexie schema, seed, queries (live), mutations
  sync/        sync engine (remote injected, tested with an in-memory fake), Supabase client, backup
  components/  shell, form controls, charts, timers
  screens/     Today, Workout (+Stopwatch), History, WorkoutDetail, Progress, Body, Profile, Exercises, Account
```

## Development
```bash
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # type-check + production build
```
Pushing to `main` runs tests and deploys to GitHub Pages.

Project status and decisions: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
