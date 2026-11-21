import assert from 'node:assert/strict';
import express from 'express';
import { MOON_CENTRE_CATALOGUE, type MoonCentreId } from '../shared/moonCentreCatalogue';
import { calculateMoonCenter, calculateMoonCenterBlend } from '../shared/cycleCore';
import { moonPatternFromDay, connectMoonPatternSchema, MOON_PATTERN_DERIVATION, MoonPatternConflict } from '../shared/moonPattern';
import { buildCycleContext } from '../server/lib/cycleContext';

process.env.DATABASE_URL = 'postgresql://unused@127.0.0.1:1/unused';
process.env.OWNER_ID = 'moon-test-owner';
process.env.AGENT_FEED_REFRESH = 'off';
process.env.MOON_CENTRES_ENABLED = 'true';
const { registerCycleRoutes } = await import('../server/routes/cycle');
const { registerRestRoutes } = await import('../server/routes/rest');
const { storage: routeStorage } = await import('../server/storage');
const { pool } = await import('../server/db');
const { connectMoonPattern, MOON_PATTERN_QUERY_KEY, MOON_PATTERN_UPDATED_EVENT } = await import('../client/src/lib/moonPatternClientState');
const { queryClient } = await import('../client/src/lib/queryClient');

// Alphabetic order is a synthetic fixture only, never an executable default.
const order = Object.keys(MOON_CENTRE_CATALOGUE) as MoonCentreId[];
const entry = { enabled: true, anchorDate: '2026-03-07', anchorCentreId: 'vagina' as const, dayInCentre: 2 as const, order };
const pattern = moonPatternFromDay(entry);
const date = (day: string) => new Date(`${day}T12:00:00`);
assert.equal(calculateMoonCenter(date('2026-03-07'), pattern).current, 'Vagina');
assert.equal(calculateMoonCenter(date('2026-03-08'), pattern).current, 'Breasts', 'day 2 advances tomorrow, across DST');
assert.equal(calculateMoonCenter(date('2026-03-06'), pattern).current, null);
assert.equal(calculateMoonCenter(date('2026-03-07'), { ...pattern, enabled: false }).current, null);
assert.equal(calculateMoonCenter(date('2026-03-07'), '2026-03-01' as any).current, null);
assert.equal(calculateMoonCenterBlend(date('2026-03-07'), { ...pattern, anchorElapsedDays: 1.75 }), 'Vagina/Breasts');
assert.equal(calculateMoonCenterBlend(date('2026-03-07'), { ...pattern, anchorElapsedDays: 1.749 }), 'Vagina');
assert.equal(calculateMoonCenter(date('2026-05-01'), pattern).current, 'Vagina', '55 days is two full rotations');
const rotated = [...order.slice(5), ...order.slice(0, 5)];
assert.equal(calculateMoonCenter(date('2026-03-08'), { ...pattern, order: rotated }).current, 'Breasts');
const revisedOrder = [...order].reverse();
assert.equal(calculateMoonCenter(date('2026-03-08'), { ...pattern, order: revisedOrder }).current, 'Navel');
for (const input of [
  { ...entry, anchorDate: '0000-01-01' }, { ...entry, anchorDate: '2026-02-30' }, { ...entry, anchorDate: '2026-2-03' },
  { ...entry, dayInCentre: 3 }, { ...entry, anchorCentreId: 'unknown' },
  { ...entry, order: order.slice(1) }, { ...entry, order: [...order.slice(1), order[1]] },
  { ...entry, anchorElapsedDays: 1.5 }, { ...pattern, anchorElapsedDays: 2.5 },
]) assert.equal(connectMoonPatternSchema.safeParse({ expectedRevision: 0, pattern: input }).success, false);
const publishContext = buildCycleContext(null, { ...pattern, revision: 1 }, '2026-03-07');
assert.equal(publishContext?.cycleDay, null);
assert.equal(publishContext?.moonCenterCurrent, 'Vagina');
assert.equal(publishContext?.moonPatternRevision, `${MOON_PATTERN_DERIVATION}:1`);

let period: any = { userId: 'moon-test-owner', cycleStartDate: '2026-03-01', cycleLength: 28, moonCenterStartDate: '2026-01-01', periodData: [{ startDate: '2026-03-01', endDate: null }] };
const originalPeriod = JSON.stringify(period);
const patterns = new Map<string, any>();
const testStorage = {
  getUserProfile: async () => ({ timezone: 'UTC' }),
  getCycleData: async () => period,
  getMoonPattern: async (userId: string) => patterns.get(userId),
  connectMoonPattern: async (userId: string, input: any) => {
    const parsed = connectMoonPatternSchema.parse(input);
    const current = patterns.get(userId);
    if ((current?.revision || 0) !== parsed.expectedRevision) throw new MoonPatternConflict();
    const saved = { ...parsed.pattern, revision: parsed.expectedRevision + 1 };
    patterns.set(userId, saved);
    return saved;
  },
  getCycleContext: async (userId: string) => buildCycleContext(period, patterns.get(userId), '2026-03-07'),
};
const app = express();
app.use(express.json());
registerCycleRoutes(app, () => testStorage as any);
routeStorage.getMoonPattern = userId => testStorage.getMoonPattern(userId);
routeStorage.getUserProfile = async () => ({ timezone: 'UTC' }) as any;
routeStorage.getDailyInsight = async () => ({ aiWisdom: 'Synthetic cached practice',
  input: { moonPatternRevision: `${MOON_PATTERN_DERIVATION}:1` } }) as any;
registerRestRoutes(app);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const originalFetch = globalThis.fetch;
const events: any[] = [];
const target = new EventTarget();
Object.defineProperty(globalThis, 'window', { value: target, configurable: true });
target.addEventListener(MOON_PATTERN_UPDATED_EVENT, event => events.push((event as CustomEvent).detail));
globalThis.fetch = ((url: any, options?: any) => originalFetch(typeof url === 'string' && url.startsWith('/') ? `${base}${url}` : url, options)) as typeof fetch;
const get = async () => (await originalFetch(`${base}/api/cycle/moon-pattern`)).json();
try {
  assert.equal((await get()).pattern, null);
  const saved = await connectMoonPattern({ expectedRevision: 0, pattern: entry });
  assert.equal(saved.pattern?.revision, 1);
  assert.equal(saved.pattern?.anchorElapsedDays, 1.5);
  assert.deepEqual(queryClient.getQueryData(MOON_PATTERN_QUERY_KEY), saved);
  assert.equal(events.length, 1);
  const cachedBefore = await (await originalFetch(`${base}/api/rest-practice/today`)).json();
  assert.equal(cachedBefore.fromCache, true, 'matching connection revision can read cached practice');
  assert.deepEqual((await get()).pattern, saved.pattern, 'reload preserves explicit connection');
  const draft = { ...entry, order: revisedOrder };
  assert.deepEqual((await get()).pattern?.order, order, 'editing a workshop draft cannot change active connection');
  const changed = await connectMoonPattern({ expectedRevision: 1, pattern: draft });
  assert.equal(changed.pattern?.revision, 2);
  const cachedAfter = await (await originalFetch(`${base}/api/rest-practice/today`)).json();
  assert.equal(cachedAfter.fromCache, false, 'revision hides stale practice without generation');
  await assert.rejects(connectMoonPattern({ expectedRevision: 1, pattern: entry }), /409/);
  assert.equal(events.length, 2, 'failed connect never broadcasts or replaces active');
  assert.deepEqual(queryClient.getQueryData(MOON_PATTERN_QUERY_KEY), changed);
  const invalid = await originalFetch(`${base}/api/cycle/moon-pattern`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 2, pattern: { ...entry, anchorDate: '2026-02-30' } }) });
  assert.equal(invalid.status, 400);
  assert.equal((await get()).pattern.revision, 2);
  assert.equal(JSON.stringify(period), originalPeriod, 'moon saves never mutate period data');
  assert.equal(await testStorage.getMoonPattern('other-owner'), undefined, 'owners isolated');
  const forged = await originalFetch(`${base}/api/cycle/moon-pattern`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'other-owner', expectedRevision: 2, pattern: entry }) });
  assert.equal(forged.status, 400);
  patterns.clear();
  assert.equal((await get()).pattern, null);
  period = undefined;
  await connectMoonPattern({ expectedRevision: 0, pattern: entry });
  const context = await testStorage.getCycleContext('moon-test-owner');
  assert.equal(context.cycleDay, null);
  assert.ok(context.moonCenterCurrent, 'no menstrual record required');
  process.env.MOON_CENTRES_ENABLED = 'false';
  assert.equal((await get()).effectiveEnabled, false);
  assert.equal((await testStorage.getCycleContext('moon-test-owner')).moonCenter, null);
  console.log('Moon pattern: core boundaries, strict day/elapsed validation, connect/reload/revise/conflict, client broadcast, owner isolation, and period independence pass.');
} finally {
  globalThis.fetch = originalFetch;
  queryClient.clear();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
