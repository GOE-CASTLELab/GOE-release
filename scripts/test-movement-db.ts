import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { movementLogs } from '../shared/schema';
import { calculateMovementSplit } from '../shared/movementSignal';

// Generate a fresh Movement table from the shipping Drizzle schema.
// Every INSERT/UPDATE below resolves to pg_temp.movement_logs, never public data.
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const sql = execFileSync('./node_modules/.bin/drizzle-kit', ['export', '--dialect', 'postgresql', '--schema', './shared/schema.ts'], { encoding: 'utf8' });
  const ddl = sql.match(/CREATE TABLE "movement_logs" \([\s\S]*?\n\);/)?.[0];
  assert(ddl, 'Fresh-install export includes Movement');
  assert(!ddl.includes('"colour_signal"'), 'Fresh installs contain only the split fields');
  await client.query(ddl.replace('CREATE TABLE', 'CREATE TEMP TABLE').replace(/\);$/, ') ON COMMIT DROP;'));
  const columns = await client.query("SELECT attname FROM pg_attribute WHERE attrelid = 'pg_temp.movement_logs'::regclass AND attnum > 0 AND NOT attisdropped");
  const names = columns.rows.map(row => row.attname);
  for (const name of ['rhythm_colour', 'movement_colour', 'movement_instrument_version', 'signal_context']) assert(names.includes(name));
  assert(!names.includes('colour_signal'));
  const database = drizzle(client);
  const snapshot = { ...calculateMovementSplit({
    current: { date: '2026-10-05', rmssd: 80, hrvSource: 'manual', cyclePhase: 'follicular' },
    history: ['01', '02', '03'].map(day => ({ date: `2026-10-${day}`, rmssd: 50, hrvSource: 'manual', cyclePhase: 'follicular' })),
    lifeStage: 'cycling', readinessScore: 8, rest: { alcoholConsumed: true, nightSweats: true, nightWakings: '1-2' },
  }), lifeStage: 'cycling' as const, cycleDay: 9, cyclePhase: 'follicular' };
  const [anchor] = await database.insert(movementLogs).values({ userId: 'fixture-a', date: '2026-10-05',
    rmssd: 80, readinessScore: 8, notes: 'retained' }).returning();
  assert.equal(anchor.signalContext, null);
  await database.insert(movementLogs).values({ userId: 'fixture-b', date: '2026-10-05', movementColour: 'red' });
  await database.update(movementLogs).set({ rhythmColour: 'green', movementColour: 'orange',
    movementInstrumentVersion: '0.3.0', signalContext: snapshot }).where(eq(movementLogs.id, anchor.id));
  const [saved] = await database.select().from(movementLogs).where(eq(movementLogs.userId, 'fixture-a'));
  assert.equal(saved.rhythmColour, 'green');
  assert.equal(saved.movementColour, 'orange');
  assert.equal(saved.movementInstrumentVersion, '0.3.0');
  assert.deepEqual(saved.signalContext, snapshot);

  assert.equal(saved.notes, 'retained');
  const [other] = await database.select().from(movementLogs).where(eq(movementLogs.userId, 'fixture-b'));
  assert.equal(other.signalContext, null);
  assert.equal(other.movementColour, 'red');
  console.log('Movement Postgres: two colours, JSON snapshot roundtrip, fresh-install schema and owner-scoped reads pass in a temporary table.');
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
