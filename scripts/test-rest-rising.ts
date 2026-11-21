import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  formatLocalTime,
  mergeRestRisingRows,
  previousDateString,
  restCycleBucket,
  timeToHHMM,
} from '../shared/restRisingCore';
import { getRecoveryQuality } from '../server/lib/recovery';

assert.equal(restCycleBucket('Menstruation'), 'menstruation');
assert.equal(restCycleBucket('Follicular'), 'follicular');
assert.equal(restCycleBucket('Ovulatory'), 'ovulation');
assert.equal(restCycleBucket('Early Luteal'), 'luteal');
assert.equal(restCycleBucket('Late Luteal'), 'luteal');
assert.equal(restCycleBucket('Unknown'), null);

assert.equal(previousDateString('2026-09-20'), '2026-09-19');
assert.equal(previousDateString('2026-03-01'), '2026-02-28');
assert.equal(previousDateString('2024-03-01'), '2024-02-29');
assert.equal(previousDateString('2026-01-01'), '2025-12-31');

assert.equal(timeToHHMM('08:15:00'), '08:15');
assert.equal(formatLocalTime('08:15:00'), '8:15 AM');
assert.equal(formatLocalTime('00:15:00'), '12:15 AM');
assert.equal(formatLocalTime('12:15:00'), '12:15 PM');

const storageSource = await readFile(new URL('../server/storage.ts', import.meta.url), 'utf8');
const restReadMethod = storageSource.match(/async getRestRisingSubmissions[\s\S]*?async createRestRisingSubmission/)?.[0] || '';
assert(restReadMethod && !restReadMethod.includes('.delete('), 'Rest/Rising reads must not delete history.');
const cardPatternDoc = await readFile(new URL('../docs/goe-card-build-pattern.md', import.meta.url), 'utf8');
assert(cardPatternDoc.includes('Rest & Rising Cycle placeholder contract'), 'Placeholder contract must be documented.');

const rising = {
  id: 'rise',
  sleepDate: '2026-09-19',
  submissionDate: '2026-09-20',
  submissionType: 'rise',
  riseTime: '08:15:00',
  nightWakings: '3+',
  nightSweats: true,
  alcoholConsumed: null,
  createdAt: new Date('2026-09-20T08:00:00Z'),
};
const rest = {
  id: 'rest',
  sleepDate: '2026-09-19',
  submissionDate: '2026-09-19',
  submissionType: 'rest',
  restTime: '00:15:00',
  nightWakings: null,
  nightSweats: null,
  alcoholConsumed: true,
  createdAt: new Date('2026-09-19T23:00:00Z'),
};

for (const rows of [[rest, rising], [rising, rest]]) {
  const merged = mergeRestRisingRows(rows as any[])!;
  assert.equal(merged.sleepDate, '2026-09-19');
  assert.equal(merged.restTime, '00:15:00');
  assert.equal(merged.riseTime, '08:15:00');
  assert.equal(merged.nightWakings, '3+');
  assert.equal(merged.nightSweats, true);
  assert.equal(merged.alcoholConsumed, true);
  assert.equal(getRecoveryQuality(merged), 'low');
}

const { refreshTodayMovementSignal } = await import('../server/routes/movement');
const { closeDatabaseConnection } = await import('../server/db');

let persisted: any = null;
const movementRows = [72, 58, 103, 79, 48, 40, 72, 56, 152].map((rmssd, index) => ({
  date: `2026-09-${String(20 - index).padStart(2, '0')}`,
  rmssd,
  hrvSource: 'camera_ppg',
}));
const fakeStorage = {
  getUser: async () => ({ lifeStage: 'cycling' }),
  getUserProfile: async () => ({ timezone: 'America/Edmonton' }),
  getMovementLog: async () => ({
    id: 'movement',
    date: '2026-09-20',
    rmssd: 72,
    sdnn: 56,
    hrvSource: 'camera_ppg',
    readinessScore: 2,
    cyclePhase: 'follicular', cycleDay: 8,
  }),
  getMovementLogs: async () => movementRows,
  getRestRisingSubmissionForSleepDate: async (_userId: string, sleepDate: string) => {
    assert.equal(sleepDate, '2026-09-19');
    return mergeRestRisingRows([rest, rising] as any[]);
  },
  upsertMovementMorning: async (data: any) => {
    persisted = data;
    return { id: 'movement', ...data };
  },
};

try {
  const refreshed = await refreshTodayMovementSignal(fakeStorage, 'owner', '2026-09-20');
  assert.equal(refreshed.movementColour, 'red');
  assert.equal(persisted.movementColour, 'red');
  assert.equal(persisted.signalContext.movement.restPoints, 5);
  console.log('Rest/Rising: retention helpers, four-phase normalization, time display, merged recovery, and Movement refresh pass.');
} finally {
  await closeDatabaseConnection();
}
