import { describe, expect, it } from 'vitest';
import { TrainingsDB } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import { createBackfillWorkout, completeSet, finalizeWorkout, updateSet } from '../db/workout';
import { syncOnce, type Remote, type RemoteRow } from './engine';

/** In-memory stand-in for the Supabase `records` table + push_records RPC semantics. */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRow & { server_ts: string }>();
  private clock = 0;
  async push(rows: RemoteRow[]) {
    for (const r of rows) {
      const k = `${r.table_name}/${r.id}`;
      const cur = this.rows.get(k);
      if (!cur || cur.updated_at < r.updated_at) {
        this.rows.set(k, { ...structuredClone(r), server_ts: String(++this.clock).padStart(10, '0') });
      }
    }
  }
  async pull(since: string | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => since == null || r.server_ts > since)
      .sort((a, b) => (a.server_ts < b.server_ts ? -1 : 1))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
  async count() {
    return this.rows.size;
  }
}

let n = 0;
const newDevice = async () => {
  const db = new TrainingsDB(`sync-${n++}`);
  await seedIfEmpty(db);
  return db;
};
const alive = <T extends { deletedAt: number | null }>(x: T) => x.deletedAt == null;

async function logBench(db: TrainingsDB, date: string, weight: number) {
  const day2 = (await db.planDays.orderBy('position').toArray())[1];
  const w = await createBackfillWorkout(day2.id, date, db);
  const bench = (await db.exercises.where('name').equals('Bench Press (Smith Machine)').first())!;
  const item = (await db.workoutItems.where('workoutId').equals(w.id).toArray()).find((i) => i.exerciseId === bench.id)!;
  const s = (await db.sets.where('workoutItemId').equals(item.id).toArray())[0];
  await updateSet(s.id, { weight, reps: 10 }, db);
  await completeSet(s.id, db);
  await finalizeWorkout(w.id, db);
  return w;
}

describe('sync engine', () => {
  it('first device uploads everything; a fresh second device replaces its starter plan with the account data', async () => {
    const remote = new FakeRemote();
    const phone = await newDevice();
    await logBench(phone, '2026-11-10', 80);
    const r1 = await syncOnce(phone, remote);
    expect(r1.pushed).toBeGreaterThan(30);

    const mac = await newDevice(); // has its own seeded plan with different ids
    await syncOnce(mac, remote);
    expect(await mac.exercises.count()).toBe(22); // no duplicates
    expect(await mac.planDays.count()).toBe(6);
    const w = (await mac.workouts.toArray()).filter(alive);
    expect(w).toHaveLength(1);
    expect(w[0].date).toBe('2026-11-10');
  });

  it('changes flow both ways and the newer edit wins', async () => {
    const remote = new FakeRemote();
    const phone = await newDevice();
    const w = await logBench(phone, '2026-11-10', 80);
    await syncOnce(phone, remote);
    const mac = await newDevice();
    await syncOnce(mac, remote);

    // edit on the Mac
    await mac.workouts.update(w.id, { note: 'from mac', updatedAt: Date.now() + 1000 });
    await syncOnce(mac, remote);
    await syncOnce(phone, remote);
    expect((await phone.workouts.get(w.id))!.note).toBe('from mac');

    // an older edit on the phone does not overwrite it
    await phone.workouts.update(w.id, { note: 'stale', updatedAt: 1 });
    await syncOnce(phone, remote);
    await syncOnce(mac, remote);
    expect((await mac.workouts.get(w.id))!.note).toBe('from mac');
  });

  it('deletions (soft) propagate', async () => {
    const remote = new FakeRemote();
    const phone = await newDevice();
    const w = await logBench(phone, '2026-11-10', 80);
    await syncOnce(phone, remote);
    const mac = await newDevice();
    await syncOnce(mac, remote);
    await phone.workouts.update(w.id, { deletedAt: Date.now(), updatedAt: Date.now() + 5 });
    await syncOnce(phone, remote);
    await syncOnce(mac, remote);
    expect((await mac.workouts.get(w.id))!.deletedAt).not.toBeNull();
  });

  it('device-only settings (timers, seed flag) are not synced; user settings are', async () => {
    const remote = new FakeRemote();
    const phone = await newDevice();
    await logBench(phone, '2026-11-10', 80);
    await phone.settings.put({ key: 'restTimer', value: { endsAt: 1 }, updatedAt: Date.now() });
    await phone.settings.put({ key: 'cycleAnchor', value: { date: '2026-11-12', planDayId: 'x' }, updatedAt: Date.now() });
    await syncOnce(phone, remote);
    const keys = [...remote.rows.values()].filter((r) => r.table_name === 'settings').map((r) => r.id);
    expect(keys).toEqual(['cycleAnchor']);
  });

  it('second sync only pushes what changed', async () => {
    const remote = new FakeRemote();
    const phone = await newDevice();
    await syncOnce(phone, remote);
    await new Promise((r) => setTimeout(r, 5));
    await logBench(phone, '2026-11-11', 82.5);
    const r = await syncOnce(phone, remote);
    expect(r.pushed).toBeGreaterThan(0);
    expect(r.pushed).toBeLessThan(40);
  });
});
