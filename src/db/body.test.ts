import { describe, expect, it } from 'vitest';
import { TrainingsDB } from './db';
import { addCustomMetric, saveBodyValues, updateBodyProfile } from './body';

describe('body storage', () => {
  it('upserts one value per metric and day', async () => {
    const db = new TrainingsDB('body-test');
    await saveBodyValues('2026-11-12', { weight: 82.4, hrv: 70 }, db);
    await saveBodyValues('2026-11-12', { weight: 82.1 }, db);
    await saveBodyValues('2026-11-13', { weight: 82.0 }, db);
    const w = await db.bodyEntries.where('metricKey').equals('weight').toArray();
    expect(w.map((e) => [e.date, e.value]).sort()).toEqual([['2026-11-12', 82.1], ['2026-11-13', 82]]);
    expect(await db.bodyEntries.where('metricKey').equals('hrv').count()).toBe(1);
  });
  it('custom metrics get a stable key and no duplicates', async () => {
    const db = new TrainingsDB('body-test-2');
    expect(await addCustomMetric('Calf', 'cm', db)).toBe('c_calf');
    expect(await addCustomMetric('calf', 'cm', db)).toBe('c_calf');
    expect(await db.bodyMetricDefs.count()).toBe(1);
    expect(await addCustomMetric('  ', 'cm', db)).toBeNull();
  });
  it('profile merges updates', async () => {
    const db = new TrainingsDB('body-test-3');
    await updateBodyProfile({ heightCm: 198 }, db);
    await updateBodyProfile({ sex: 'male' }, db);
    expect((await db.settings.get('bodyProfile'))!.value).toEqual({ heightCm: 198, birthDate: null, sex: 'male' });
  });
});
