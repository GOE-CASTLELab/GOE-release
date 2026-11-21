import { MOON_CENTRE_CATALOGUE } from '../shared/moonCentreCatalogue';
import { moonPatternFromDay } from '../shared/moonPattern';
import assert from 'node:assert/strict';

// No database calls: exercise the real context publisher against saved-input cases.
process.env.DATABASE_URL ||= 'postgresql://unused@127.0.0.1:1/unused';
const { DatabaseStorage } = await import('../server/storage');
const { pool } = await import('../server/db');
const { assembleCrossCardContext, renderCrossCardContext } = await import('../server/cardContext');
const storage = new DatabaseStorage();
let saved: any = { cycleStartDate: '2026-10-01', cycleLength: 28,
  moonCenterStartDate: '2026-10-01', asOfDate: '2026-10-04' };
storage.getCycleData = async () => saved;
let pattern: any;
storage.getMoonPattern = async () => pattern;
storage.getUserProfile = async () => ({ timezone: 'UTC' }) as any;
try {
  delete process.env.MOON_CENTRES_ENABLED;
  const disabled = await storage.getCycleContext('synthetic');
  assert.equal(disabled.moonCenter, null);
  assert.equal(disabled.cycleDay, 4);
  assert.ok(disabled.lunarPhase);
  const context = () => assembleCrossCardContext({ storage: {
    getCycleContext: id => storage.getCycleContext(id),
  }, userId: 'synthetic', cardType: 'general', message: 'My cycle today',
    resolveDate: async () => '2026-10-04' });
  assert.doesNotMatch(renderCrossCardContext(await context()) || '', /moon centre/i);
  process.env.MOON_CENTRES_ENABLED = 'true';
  assert.equal((await storage.getCycleContext('synthetic')).moonCenter, null, 'legacy anchor does not infer pattern');
  pattern = { ...moonPatternFromDay({ enabled: true, anchorDate: '2026-10-04', anchorCentreId: 'vagina',
    dayInCentre: 2, order: Object.keys(MOON_CENTRE_CATALOGUE) as any }), revision: 1 };
  assert.equal((await storage.getCycleContext('synthetic')).moonCenter, 'Vagina');
  assert.match(renderCrossCardContext(await context()) || '', /moon centre: Vagina/i);
  saved = undefined;
  pattern = { ...pattern, anchorDate: new Date().toISOString().slice(0, 10) };
  assert.equal((await storage.getCycleContext('synthetic')).cycleDay, null);
  assert.match(renderCrossCardContext(await context()) || '', /moon centre: Vagina/i);
  pattern = undefined;
  assert.equal(await storage.getCycleContext('synthetic'), undefined, 'no owner seed sequence');
  console.log('Moon-centre context: explicit patterns only, moon-only context, and no owner seed; cycle and lunar phase preserved.');
} finally {
  delete process.env.MOON_CENTRES_ENABLED;
  await pool.end();
}
