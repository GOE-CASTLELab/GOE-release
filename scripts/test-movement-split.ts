import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateYourRhythm, calculateMovementRead, calculateMovementSplit, movementReadiness,
  movementReadPhase,
  type RhythmReading, type MovementColour,
} from '../shared/movementSignal';

const reading = (date: string, rmssd: number | null, cyclePhase: string | null = 'Follicular', hrvSource: string | null = 'manual'): RhythmReading =>
  ({ date, rmssd, cyclePhase, hrvSource });
const history = [reading('2026-10-01', 50), reading('2026-10-02', 50), reading('2026-10-03', 50)];
const today = reading('2026-10-04', 60);

test('first three readings observe; fourth can be classified independently of readiness', () => {
  for (let index = 0; index < 3; index++) {
    const result = calculateYourRhythm(history[index], history, 'cycling');
    assert.equal(result.status, 'observing');
    assert.equal(result.rhythmColour, null);
    assert.equal(result.referenceCount, index);
  }
  assert.equal(calculateYourRhythm(today, history, 'cycling').rhythmColour, 'green');
});

test('mean ± population SD is inclusive yellow; values outside are green/orange', () => {
  const varied = [reading('2026-10-01', 40), reading('2026-10-02', 50), reading('2026-10-03', 60)];
  const lower = 50 - Math.sqrt(200 / 3);
  const upper = 50 + Math.sqrt(200 / 3);
  for (const value of [lower, 50, upper]) {
    const result = calculateYourRhythm({ ...today, rmssd: value }, varied, 'cycling');
    assert.equal(result.rhythmColour, 'yellow');
    assert.equal(result.mean, 50);
    assert.equal(result.lower, lower);
    assert.equal(result.upper, upper);
  }
  assert.equal(calculateYourRhythm({ ...today, rmssd: lower - 0.01 }, varied, 'cycling').rhythmColour, 'orange');
  assert.equal(calculateYourRhythm({ ...today, rmssd: upper + 0.01 }, varied, 'cycling').rhythmColour, 'green');
  assert.equal(calculateYourRhythm({ ...today, rmssd: 50 }, history, 'cycling').rhythmColour, 'yellow');
});

test('history excludes current/future readings and other sources/phases; sorting is irrelevant', () => {
  const polluted = [today, reading('2026-10-10', 1), reading('2026-09-30', 1, 'Late Luteal'),
    reading('2026-09-29', 1, 'Follicular', 'camera_ppg'), ...history].reverse();
  assert.deepEqual(calculateYourRhythm(today, polluted, 'cycling'), calculateYourRhythm(today, history, 'cycling'));
  assert.equal(calculateYourRhythm({ ...today, hrvSource: 'bluetooth_rr' }, history, 'cycling').status, 'observing');
  assert.equal(calculateYourRhythm({ ...today, hrvSource: null }, history, 'cycling').status, 'observing');
  const ovulationHistory = history.map(row => ({ ...row, cyclePhase: 'Ovulatory' }));
  assert.equal(calculateYourRhythm({ ...today, cyclePhase: 'ovulation' }, ovulationHistory, 'cycling').rhythmColour, 'green');
});

test('phase history spans cycles; recent life stages use the latest 28 readings across phases', () => {
  const older = [reading('2026-07-01', 50), reading('2026-08-01', 50), reading('2026-09-01', 50)];
  assert.equal(calculateYourRhythm(today, older, 'cycling').rhythmColour, 'green');
  for (const stage of ['perimenopause', 'postmenopause'] as const) {
    assert.equal(calculateYourRhythm(today, older, stage).status, 'recorded');
    const window = [reading('2026-09-01', 999), ...Array.from({ length: 28 }, (_, index) =>
      reading(`2026-09-${String(index + 2).padStart(2, '0')}`, 50, index % 2 ? null : 'Late Luteal'))];
    const result = calculateYourRhythm({ ...today, cyclePhase: null }, window, stage);
    assert.equal(result.referenceKind, 'recent');
    assert.equal(result.referenceCount, 28);
    assert.equal(result.mean, 50);
    assert.equal(result.rhythmColour, 'green');
  }
});

test('red requires yesterday to have been below its own established range', () => {
  const lowYesterday = reading('2026-10-04', 30);
  const lowToday = reading('2026-10-05', 20);
  assert.equal(calculateYourRhythm(lowYesterday, history, 'cycling').rhythmColour, 'orange');
  assert.equal(calculateYourRhythm(lowToday, [...history, lowYesterday], 'cycling').rhythmColour, 'red');
  assert.equal(calculateYourRhythm({ ...lowToday, date: '2026-10-06' }, [...history, lowYesterday], 'cycling').rhythmColour, 'orange');
  assert.equal(calculateYourRhythm({ ...lowToday, rmssd: 100 }, [...history, lowYesterday], 'cycling').rhythmColour, 'green');
  assert.equal(calculateYourRhythm(lowToday, [...history, { ...lowYesterday, hrvSource: 'camera_ppg' }], 'cycling').rhythmColour, 'orange');
  // A third/observing reading cannot establish a previous low day.
  assert.equal(calculateYourRhythm(lowToday, [...history.slice(0, 2), lowYesterday], 'cycling').rhythmColour, 'orange');
});

test('phase-boundary red compares each day with its own phase, including year rollover', () => {
  const rows = [reading('2026-12-01', 50), reading('2026-12-02', 50), reading('2026-12-03', 50),
    reading('2026-12-04', 100, 'Late Luteal'), reading('2026-12-05', 100, 'Late Luteal'),
    reading('2026-12-06', 100, 'Late Luteal'), reading('2026-12-31', 70, 'Late Luteal')];
  assert.equal(calculateYourRhythm(reading('2027-01-01', 30), rows, 'cycling').rhythmColour, 'red');
});

test('missing/invalid HRV and absent cycling phase produce no invented colour', () => {
  for (const rmssd of [null, 0, -1, NaN, Infinity]) {
    assert.equal(calculateYourRhythm({ ...today, rmssd }, history, 'cycling').status, 'missing');
  }
  for (const phase of [null, 'Unknown', 'luteal']) {
    const result = calculateYourRhythm({ ...today, cyclePhase: phase }, history, null);
    assert.equal(result.status, 'phase-unavailable');
    assert.equal(result.rhythmColour, null);
  }
  assert.throws(() => calculateYourRhythm({ ...today, date: '2026-02-30' }, history, 'cycling'), /valid profile-local date/);
  assert.throws(() => calculateYourRhythm(today, [...history, history[0]], 'cycling'), /one daily anchor/);
  assert.equal(calculateYourRhythm(today, [...history, reading('2026-09-30', NaN)], 'cycling').referenceCount, 3);
});

test('all ten stored readiness values have exactly one approved word and colour', () => {
  const expected = ['red', 'red', 'red', 'orange', 'orange', 'yellow', 'yellow', 'green', 'green', 'green'];
  const words = { green: 'motivated', yellow: 'rising', orange: 'easing', red: 'sluggish' };
  expected.forEach((colour, index) => assert.deepEqual(movementReadiness(index + 1), { colour, word: words[colour as MovementColour] }));
  for (const score of [null, undefined, 0, 11, 4.5, NaN, Infinity]) assert.equal(movementReadiness(score), null);
});

test('all 120 readiness × Rest/Rising combinations respect exact points and red floor', () => {
  const expectedColours: MovementColour[] = ['green', 'yellow', 'orange', 'red'];
  for (let score = 1; score <= 10; score++) {
    for (const alcoholConsumed of [false, true]) for (const nightSweats of [false, true]) {
      for (const nightWakings of ['0', '1-2', '3+'] as const) {
        const points = Number(alcoholConsumed) + 2 * Number(nightSweats) + ['0', '1-2', '3+'].indexOf(nightWakings);
        const drop = points < 3 ? 0 : points === 3 ? 1 : 2;
        const base = score >= 8 ? 0 : score >= 6 ? 1 : score >= 4 ? 2 : 3;
        const result = calculateMovementRead(score, { alcoholConsumed, nightSweats, nightWakings });
        assert.equal(result.restPoints, points);
        assert.equal(result.requestedDrop, drop);
        assert.equal(result.movementColour, expectedColours[Math.min(3, base + drop)]);
        assert.equal(result.appliedDrop, Math.min(drop, 3 - base));
        assert.equal(result.restLogged, true);
      }
    }
  }
});

test('missing Rest is distinct from recorded zero flags; missing readiness has no Movement colour', () => {
  for (const rest of [null, undefined, {}, { alcoholConsumed: null, nightSweats: null, nightWakings: null }]) {
    const result = calculateMovementRead(8, rest);
    assert.equal(result.restLogged, false);
    assert.equal(result.movementColour, 'green');
  }
  assert.equal(calculateMovementRead(8, { alcoholConsumed: false }).restLogged, true);
  assert.equal(calculateMovementRead(8, { nightWakings: '0' }).restLogged, true);
  const flags = { alcoholConsumed: true, nightSweats: true, nightWakings: '1-2' as const };
  assert.deepEqual(calculateMovementRead(8, flags).restFlags, ['alcohol', 'night sweats', '1–2 night wakings']);
  assert.equal(calculateMovementRead(null, flags).movementColour, null);
  assert.equal(calculateMovementRead(null, flags).appliedDrop, 0);
});

test('split fields cannot alter each other; comparison uses readiness before Rest modifiers', () => {
  const input = { current: today, history, lifeStage: 'cycling' as const, readinessScore: 8,
    rest: { alcoholConsumed: true, nightSweats: true, nightWakings: '1-2' as const } };
  const result = calculateMovementSplit(input);
  assert.equal(result.instrumentVersion, '0.3.0');
  assert.equal(result.rhythm.rhythmColour, 'green');
  assert.equal(result.movement.movementColour, 'orange');
  assert.equal(result.readinessAgainstRhythm, 'aligns');
  assert.deepEqual(calculateMovementSplit({ ...input, readinessScore: 1, rest: null }).rhythm, result.rhythm);
  assert.deepEqual(calculateMovementSplit({ ...input, current: { ...today, rmssd: null }, history: [], lifeStage: 'postmenopause' }).movement, result.movement);
  assert.equal(calculateMovementSplit({ ...input, readinessScore: 1 }).readinessAgainstRhythm, 'below');
  assert.equal(calculateMovementSplit({ ...input, current: { ...today, rmssd: 30 } }).readinessAgainstRhythm, 'above');
  assert.equal(calculateMovementSplit({ ...input, readinessScore: null }).readinessAgainstRhythm, 'not-logged');
  assert.equal(calculateMovementSplit({ ...input, history: [] }).readinessAgainstRhythm, null);
  assert.equal(movementReadPhase('perimenopause', 'Early Luteal'), 'early luteal');
  assert.equal(movementReadPhase('postmenopause', 'Early Luteal'), null);
  assert.equal(movementReadPhase('cycling', null), null);
});
