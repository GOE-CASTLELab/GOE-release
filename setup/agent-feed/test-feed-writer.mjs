import { MOON_CENTRE_CATALOGUE } from '../../shared/moonCentreCatalogue.ts';
import assert from 'node:assert/strict';
import { calculateMovementSplit } from '../../shared/movementSignal.ts';
import {
  ASTRO_END_MARKER,
  ASTRO_START_MARKER,
  END_MARKER,
  START_MARKER,
  buildAgentContextSnapshot,
  formatFeedBlock,
  formatStaticAstrologyBlock,
  replaceMarkedBlock,
} from './feed-writer.mjs';
import {
  AGENT_CONTEXT_SCHEMA_VERSION,
  assertAgentContextSnapshot,
  getContextCard,
} from './agent-context-snapshot.ts';

const fixture = {
  now: new Date('2026-09-24T17:30:00.000Z'),
  cycleData: {
    cycleStartDate: '2026-09-01', cycleLength: 26, moonCenterStartDate: '2024-04-05',
  },
  skyData: { currentSky: [{ planet: 'Sun', sign: 'Libra', degree: "1°42'", retrograde: false }] },
  transitsData: { currentTransits: [{ transit: 'Mars trine your Mars', aspect: 'trine', exactDate: '2026-9-25', windowStart: '2026-09-20', windowEnd: '2026-09-30' }] },
  restRows: [
    { sleepDate: '2026-09-23', energyAssessment: 'Sluggish Start, Better Later', alcoholConsumed: true, createdAt: '2026-09-24T01:00:00Z' },
    { sleepDate: '2026-09-23', sleepProcess: 'Gradual Settling Down', wakingState: 'Groggy but Clearing', nightWakings: '1-2', createdAt: '2026-09-24T14:00:00Z' },
  ],
  movementToday: {
    date: '2026-09-24', rmssd: 87, sdnn: 70, hrvSource: 'camera_ppg', readinessScore: 3,
    hrvCapturedAt: '2026-09-24T14:31:06.378Z',
    signalContext: calculateMovementSplit({
      current: { date: '2026-09-24', rmssd: 87, hrvSource: 'camera_ppg', cyclePhase: 'follicular' },
      history: ['21', '22', '23'].map(day => ({ date: `2026-09-${day}`, rmssd: 50, hrvSource: 'camera_ppg', cyclePhase: 'follicular' })),
      lifeStage: 'cycling', readinessScore: 3, rest: { alcoholConsumed: true, nightWakings: '1-2' },
    }),
    latestWorkout: { date: '2026-09-24', practiceName: 'Walk', durationMinutes: 30, createdAt: '2026-09-24T16:00:00Z' },
  },
  movementLogs: [
    { date: '2026-09-24', rmssd: 87, sdnn: 70, hrvSource: 'camera_ppg', hrvCapturedAt: '2026-09-24T14:31:06.378Z' },
    { date: '2026-09-23', rmssd: 97, sdnn: 87, hrvSource: 'camera_ppg', hrvCapturedAt: '2026-09-23T14:00:00Z' },
    { date: '2026-09-22', rmssd: 72, hrvSource: 'manual', updatedAt: '2026-09-22T14:00:00Z' },
  ],
};

const snapshot = buildAgentContextSnapshot(fixture);
assert.equal(getContextCard(snapshot, 'cyclical').values.moon_centre, null);
assert.equal(getContextCard(snapshot, 'cyclical').missing.moon_centre, 'Kundalini moon centres disabled');
process.env.MOON_CENTRES_ENABLED = 'true';
const enabledSnapshot = buildAgentContextSnapshot({ ...fixture, moonPatternData: { effectiveEnabled: true, pattern: { enabled: true, anchorDate: '2026-09-24', anchorCentreId: 'vagina', anchorElapsedDays: 1.5, order: Object.keys(MOON_CENTRE_CATALOGUE), revision: 1 } } });
assert.equal(typeof getContextCard(enabledSnapshot, 'cyclical').values.moon_centre, 'string');
const unanchoredSnapshot = buildAgentContextSnapshot({ ...fixture, cycleData: {
  cycleStartDate: fixture.cycleData.cycleStartDate, cycleLength: fixture.cycleData.cycleLength,
} });
assert.equal(getContextCard(unanchoredSnapshot, 'cyclical').values.moon_centre, null);
delete process.env.MOON_CENTRES_ENABLED;
assertAgentContextSnapshot(snapshot);
assert.equal(snapshot.schemaVersion, AGENT_CONTEXT_SCHEMA_VERSION);
assert.deepEqual(snapshot.cards.map(record => record.card), [
  'cyclical', 'rest_restore', 'movement', 'astrology_energetic',
]);
assert.equal(getContextCard(snapshot, 'movement').provenance.hrv_readings.source, '/api/movement/logs');
assert.equal(getContextCard(snapshot, 'rest_restore').provenance.nervous_system_state.derivationVersion, 'rest-rising-state.v1');
assert.equal(getContextCard(snapshot, 'astrology_energetic').missing.gk_position, 'not derived — no agreed current-position method');

const extendedSnapshot = structuredClone(snapshot);
getContextCard(extendedSnapshot, 'movement').values.future_field = 'can be added inside the card record';
assert.doesNotThrow(() => assertAgentContextSnapshot(extendedSnapshot));

const block = formatFeedBlock(snapshot);
assert(block.includes('Schema: 0.1.0'));
assert(block.includes('nervous_system_state:   Resourced'));
assert(block.includes('2026-09-24 | RMSSD 87 ms | SDNN 70 ms | source camera_ppg'));
assert(block.includes('mean 50 ms | SD 0 ms | range 50–50 ms | 3 prior source-matched readings'));
assert(block.includes('readiness:              2026-09-24 | sluggish | score 3/10'));
assert(block.includes('overnight_recovery:     sleep 2026-09-23 | Low'));
assert(block.includes('your_rhythm:            2026-09-24 | green'));
assert(block.includes('movement_read:          2026-09-24 | red'));
assert(block.includes('movement_recorded:      2026-09-24 | Walk | 30 minutes'));
assert(block.includes('gk_position:            not derived — no agreed current-position method'));

const missingSnapshot = buildAgentContextSnapshot({ ...fixture, restRows: [], movementToday: null, movementLogs: [] });
const splitContext = calculateMovementSplit({
  current: { date: '2026-09-24', rmssd: 80, hrvSource: 'manual', cyclePhase: 'follicular' },
  history: ['21', '22', '23'].map(day => ({ date: `2026-09-${day}`, rmssd: 50, hrvSource: 'manual', cyclePhase: 'follicular' })),
  lifeStage: 'cycling', readinessScore: 8, rest: { alcoholConsumed: true, nightSweats: true, nightWakings: '1-2' },
});
const splitSnapshot = buildAgentContextSnapshot({ ...fixture, movementToday: { ...fixture.movementToday,
  readinessScore: 8, rhythmColour: 'green', movementColour: 'orange', signalContext: splitContext } });
const splitBlock = formatFeedBlock(splitSnapshot);
assert(splitBlock.includes('your_rhythm:            2026-09-24 | green'));
assert(splitBlock.includes('movement_read:          2026-09-24 | orange'));
assert(!splitBlock.includes('combined_signal:'), 'The feed contains only the independent reads.');
assert.equal(getContextCard(splitSnapshot, 'movement').provenance.movement_read.derivationVersion, 'readiness-rest-points.v1');
const missing = formatFeedBlock(missingSnapshot);
assert.equal(getContextCard(missingSnapshot, 'movement').missing.hrv_readings, 'not recorded');
assert(missing.includes('energy_assessment:      not recorded'));
assert(missing.includes('nervous_system_state:   no saved Rest/Rising fields to derive it from'));
assert(missing.includes('    - not recorded'));
assert(missing.includes('your_rhythm:            not calculated for today'));

const chartBlock = formatStaticAstrologyBlock({ birthChart: {
  birthDate: 'January 15, 1990', birthTime: '9:30 AM EST', birthLocation: 'Toronto, Canada',
  sun: { sign: 'Aries', degree: "12°11'", house: '1st' },
  rising: { sign: 'Cancer', degree: "19°13'" },
} });
assert(chartBlock.includes('House system: Placidus'));
assert(chartBlock.includes("- Sun: Aries 12°11' — 1st house"));

const original = `before\n${ASTRO_START_MARKER}\nold chart\n${ASTRO_END_MARKER}\nmiddle\n${START_MARKER}\nold feed\n${END_MARKER}\nafter\n`;
let updated = replaceMarkedBlock(original, START_MARKER, END_MARKER, block);
updated = replaceMarkedBlock(updated, ASTRO_START_MARKER, ASTRO_END_MARKER, chartBlock);
assert(updated.startsWith('before\n'));
assert(updated.endsWith('after\n'));
assert(updated.includes('middle\n'));
assert(!updated.includes('old chart'));
assert(!updated.includes('old feed'));

console.log('Agent feed: card fields, missing-data labels, static astrology, and marker preservation pass.');
