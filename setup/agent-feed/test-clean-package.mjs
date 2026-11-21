import { MOON_CENTRE_CATALOGUE } from '../../shared/moonCentreCatalogue.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runFeed = path.join(__dirname, 'run-feed.sh');
const astroStart = '<!-- STATIC-ASTROLOGY:START -->';
const astroEnd = '<!-- STATIC-ASTROLOGY:END -->';
const feedStart = '<!-- LIVE-FEED:START -->';
const feedEnd = '<!-- LIVE-FEED:END -->';

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function maskBlock(contents, start, end) {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  assert(startIndex >= 0 && endIndex > startIndex, `Expected ${start} and ${end}.`);
  return `${contents.slice(0, startIndex + start.length)}\n[managed]\n${contents.slice(endIndex)}`;
}

function maskManagedBlocks(contents) {
  return maskBlock(maskBlock(contents, astroStart, astroEnd), feedStart, feedEnd);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.trim()}`));
    });
  });
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'goe-agent-feed-package-'));
const userPath = path.join(temporaryRoot, 'USER.md');
const original = [
  '# Test person',
  'OWNER-SENTINEL-BEFORE',
  astroStart,
  'old static chart',
  astroEnd,
  'OWNER-SENTINEL-MIDDLE',
  feedStart,
  'old current read',
  feedEnd,
  'OWNER-SENTINEL-AFTER',
  '',
].join('\n');

let proofLabel = 'Initial Package Proof';
const today = localDate();
const yesterday = localDate(-1);
const cycleStart = localDate(-2);
const responses = () => ({
  '/api/cycle/data': { cycleStartDate: cycleStart, cycleLength: 28, moonCenterStartDate: localDate(-30) },
  '/api/cycle/moon-pattern': { effectiveEnabled: true, asOfDate: today, pattern: {
    enabled: true, anchorDate: today, anchorCentreId: 'hairline', anchorElapsedDays: 1.5,
    order: Object.keys(MOON_CENTRE_CATALOGUE), revision: 1,
  } },
  '/api/current-sky': { currentSky: [{ planet: 'Sun', sign: 'Scorpio', degree: '6°00\'', retrograde: false }] },
  '/api/current-transits': { currentTransits: [{ transit: 'Package proof transit', exactDate: today, windowStart: yesterday, windowEnd: localDate(1) }] },
  '/api/rest-rising/submissions': [{
    sleepDate: yesterday,
    energyAssessment: 'Steady and Clear',
    sleepProcess: 'Gradual Settling Down',
    wakingState: 'Clear and Ready',
    nightWakings: 'None',
    createdAt: `${today}T06:00:00.000Z`,
  }],
  '/api/movement/today': {
    date: today,
    rmssd: 72,
    readinessScore: 8,
    signalContext: {
      instrumentVersion: '0.2.0',
      rhythm: { status: 'recorded', colour: 'green', baseline: { mean: 64, standardDeviation: 4, minimum: 58, maximum: 70, count: 4 } },
      movement: { status: 'recorded', colour: 'green' },
    },
    latestWorkout: { date: today, practiceName: proofLabel, durationMinutes: 20, createdAt: `${today}T15:00:00.000Z` },
  },
  '/api/movement/logs': [{ date: today, rmssd: 72, sdnn: 61, hrvSource: 'package_fixture', hrvCapturedAt: `${today}T14:00:00.000Z` }],
  '/api/birth-chart': { birthChart: {
    birthDate: 'January 1, 1990',
    birthTime: '12:00 PM UTC',
    birthLocation: 'Test Fixture',
    sun: { sign: 'Capricorn', degree: '10°00\'', house: '1st' },
    rising: { sign: 'Aries', degree: '2°00\'' },
  } },
});

const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const body = responses()[pathname];
  if (body === undefined) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'fixture route missing' }));
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
});

try {
  await writeFile(userPath, original, 'utf8');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const testEnvironment = {
    ...process.env,
    AGENT_FEED_REFRESH: 'on',
    MOON_CENTRES_ENABLED: 'true',
    USER_MD_PATH: userPath,
    GOE_BASE_URL: `http://127.0.0.1:${address.port}`,
    AGENT_FEED_REFRESH_SCRIPT: runFeed,
  };

  const { refreshAgentFeedAfterSave } = await import('../../server/lib/agentFeedRefresh.ts');
  delete process.env.AGENT_FEED_REFRESH;
  assert.equal(await refreshAgentFeedAfterSave(), false, 'An absent feed switch must stay off.');
  process.env.AGENT_FEED_REFRESH = 'off';
  assert.equal(await refreshAgentFeedAfterSave(), false, 'The explicit off switch must stay off.');

  // First-install command: use the clean package's executable entry point and sync the fixed chart.
  await run('/bin/bash', [runFeed, '--sync-static'], { cwd: temporaryRoot, env: testEnvironment });
  let updated = await readFile(userPath, 'utf8');
  assert.equal(maskManagedBlocks(updated), maskManagedBlocks(original), 'The writer changed text outside its two marker blocks.');
  assert(updated.includes('Initial Package Proof'));
  assert.match(updated, /moon_centre:\s+Hairline/, 'Shipped feed reads the explicit connected pattern');
  assert(updated.includes('Test Fixture'));

  // Scheduled command: run the exact full-path invocation from outside the repository.
  proofLabel = 'Scheduled Package Proof';
  await run('/bin/bash', [runFeed], { cwd: temporaryRoot, env: testEnvironment });
  updated = await readFile(userPath, 'utf8');
  assert(updated.includes('Scheduled Package Proof'));
  assert.equal(maskManagedBlocks(updated), maskManagedBlocks(original));

  // Save-trigger seam: use the same function awaited by card-save routes.
  Object.assign(process.env, testEnvironment);
  proofLabel = 'Save Trigger Proof';
  assert.equal(await refreshAgentFeedAfterSave(), true);
  updated = await readFile(userPath, 'utf8');
  assert(updated.includes('Save Trigger Proof'));
  assert.equal(maskManagedBlocks(updated), maskManagedBlocks(original));
  assert.deepEqual(await readdir(temporaryRoot), ['USER.md'], 'The package left files beside the target USER.md.');

  console.log('Clean agent feed package: isolated USER.md, full-path schedule, save refresh, and marker boundaries pass.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}
