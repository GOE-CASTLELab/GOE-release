import assert from 'node:assert/strict';
import { getDaysToNextPhase, getMoonPhase, getNextMajorMoonPhase } from '../client/src/lib/moonPhase.js';

const september13 = new Date('2026-09-13T16:15:00Z');
assert.deepEqual(getMoonPhase(september13), {
  name: 'Waxing Crescent',
  emoji: '🌒',
});

const next = getNextMajorMoonPhase(september13);
assert.equal(next.name, 'Full Moon');
assert.ok(
  Math.abs(next.date.getTime() - Date.parse('2026-09-26T16:49:00Z')) < 2 * 60_000,
  `expected the September full moon near the USNO time; received ${next.date.toISOString()}`,
);
assert.equal(getDaysToNextPhase(september13, 'America/Edmonton'), 'Full Moon in 13 days');

// The same astronomical instant falls on different civil dates in these two zones.
const beforeSeptemberNewMoon = new Date('2026-09-10T12:00:00Z');
assert.equal(getDaysToNextPhase(beforeSeptemberNewMoon, 'America/Edmonton'), 'New Moon today');
assert.equal(getDaysToNextPhase(beforeSeptemberNewMoon, 'Europe/London'), 'New Moon tomorrow');

console.log('Moon phase tests passed');
