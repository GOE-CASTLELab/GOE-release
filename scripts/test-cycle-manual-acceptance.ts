import 'dotenv/config';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// This is an isolated acceptance check: it creates one temporary local database,
// uses the real cycle HTTP route and DatabaseStorage, then removes every test file
// and the database. It never reads or writes an owner's record.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the isolated manual-cycle acceptance test.');
}
const sourceUrl = new URL(process.env.DATABASE_URL);
const socketHost = sourceUrl.searchParams.get('host');
if (!(socketHost === '/tmp' || ['localhost', '127.0.0.1', '::1'].includes(sourceUrl.hostname))) {
  throw new Error('The isolated manual-cycle acceptance test runs only against a local PostgreSQL server.');
}

const databaseName = `goe_cycle_acceptance_${process.pid}_${Date.now()}`;
if (!/^goe_cycle_acceptance_[0-9_]+$/.test(databaseName)) throw new Error('Unsafe test database name.');
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const ownerId = 'cycle-acceptance-owner';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goe-cycle-acceptance-'));

const require = createRequire(import.meta.url);
const pg = require('pg');
const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
let server: ReturnType<express.Express['listen']> | undefined;

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const setupDb = new pg.Pool({ connectionString: testUrl.toString(), max: 1 });
  try {
    await setupDb.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE users (
        id varchar PRIMARY KEY,
        email varchar UNIQUE,
        first_name varchar,
        last_name varchar,
        profile_image_url varchar,
        life_stage varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE cycle_data (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        cycle_start_date date NOT NULL,
        cycle_length integer NOT NULL DEFAULT 28,
        moon_center_start_date date,
        period_end_date date,
        period_data jsonb,
        last_updated timestamp DEFAULT now()
      );
      CREATE TABLE moon_patterns (
        user_id varchar PRIMARY KEY REFERENCES users(id),
        pattern jsonb NOT NULL,
        revision integer NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE moon_pattern_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        revision integer NOT NULL,
        effective_date date NOT NULL,
        pattern jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        UNIQUE (user_id, revision)
      );
      INSERT INTO users (id) VALUES ('${ownerId}');
    `);
  } finally {
    await setupDb.end();
  }

  process.env.DATABASE_URL = testUrl.toString();
  process.env.OWNER_ID = ownerId;
  process.env.AGENT_FEED_REFRESH = 'off';
  process.env.LOCAL_STORAGE_DIR = root;
  const { registerCycleRoutes } = await import('../server/routes/cycle');
  const { storage } = await import('../server/storage');
  const { closeDatabaseConnection } = await import('../server/db');

  const app = express();
  app.use(express.json());
  registerCycleRoutes(app, () => storage);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const call = async (method: string, body?: unknown, route = 'data') => {
    const response = await fetch(`http://127.0.0.1:${port}/api/cycle/${route}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    return value;
  };

  const history = [
    { startDate: '2026-08-03', endDate: '2026-08-07' },
    { startDate: '2026-09-02', endDate: '2026-09-06' },
    { startDate: '2026-10-01', endDate: null },
  ];
  const firstSave = await call('PUT', {
    cycleStartDate: '2026-10-01', cycleLength: 29, periodEndDate: null, periodData: history,
  });
  assert.equal(firstSave.cycleStartDate, '2026-10-01');
  assert.equal(firstSave.cycleLength, 29);
  assert.deepEqual(firstSave.periodData, history);

  const firstReload = await call('GET');
  assert.deepEqual(firstReload.periodData, history);

  const extended = await call('POST', { action: 'cycle_extended', date: '2026-10-05' }, 'action');
  assert.equal(extended.cycleLength, 30);
  assert.deepEqual(extended.periodData.at(-1).extensions, [{ date: '2026-10-05', previousCycleLength: 29, resultingCycleLength: 30 }]);
  const ended = await call('POST', { action: 'period_ended', date: '2026-10-06' }, 'action');
  assert.equal(ended.periodEndDate, '2026-10-06');
  assert.equal(ended.periodData.at(-1).endDate, '2026-10-06');
  const started = await call('POST', { action: 'period_started', date: '2026-10-30' }, 'action');
  assert.equal(started.cycleStartDate, '2026-10-30');
  assert.deepEqual(started.periodData.at(-1), { startDate: '2026-10-30', endDate: null, extensions: [] });

  const refreshed = await call('GET');
  assert.equal(refreshed.cycleStartDate, '2026-10-30');
  assert.equal(refreshed.cycleLength, 30);
  assert.equal(refreshed.periodEndDate, null);
  assert.equal(refreshed.periodData.length, 4);
  assert.deepEqual(refreshed.periodData.slice(0, 2), history.slice(0, 2));
  assert.deepEqual(refreshed.periodData.at(-2).extensions, [{ date: '2026-10-05', previousCycleLength: 29, resultingCycleLength: 30 }]);

  const order = ['eyebrows', 'cheeks', 'lips', 'earlobes', 'nape-of-neck', 'breasts', 'clitoris', 'inner-thighs', 'navel', 'vagina', 'hairline'];
  await call('PUT', { expectedRevision: 0, pattern: { enabled: true, anchorDate: '2026-10-30', anchorCentreId: 'eyebrows', anchorElapsedDays: 0.5, order } }, 'moon-pattern');
  await call('PUT', { expectedRevision: 1, pattern: { enabled: true, anchorDate: '2026-10-30', anchorCentreId: 'cheeks', anchorElapsedDays: 0.5, order: [...order.slice(1), order[0]] } }, 'moon-pattern');
  const moonHistory = await storage.getMoonPatternHistory(ownerId);
  assert.deepEqual(moonHistory.map(entry => entry.revision), [1, 2]);
  assert.equal(moonHistory[0].pattern.anchorCentreId, 'eyebrows');
  assert.equal(moonHistory[1].pattern.anchorCentreId, 'cheeks');

  console.log('Manual cycle acceptance: event history and append-only moon-pattern revisions: pass.');
  await closeDatabaseConnection();
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
  fs.rmSync(root, { recursive: true, force: true });
}
