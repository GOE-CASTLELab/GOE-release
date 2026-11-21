import assert from 'node:assert/strict';
import { MOON_CENTRE_CATALOGUE, type MoonCentreId } from '../shared/moonCentreCatalogue';
import { calculateMoonCenter, calculateMoonCenterBlend } from '../shared/cycleCore';
import { moonPatternFromDay, MOON_CENTRE_DURATION_DAYS } from '../shared/moonPattern';

// Legacy timing oracle, with a supplied SYNTHETIC sequence in place of the old
// hardcoded array. No private anchor or personal order is included in this test.
const date = (value: string, hour = 12) => new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`);
const utcDay = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
const addDays = (value: string, count: number) => {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
};
const oldRead = (sample: Date, originalAnchor: string, sequence: MoonCentreId[]) => {
  const elapsed = Math.floor(utcDay(sample) - utcDay(date(originalAnchor)));
  if (elapsed < 0) return { current: null, blend: null };
  const exactPosition = elapsed / 2.5;
  const index = Math.floor(exactPosition) % 11;
  const current = MOON_CENTRE_CATALOGUE[sequence[index]].name;
  const next = MOON_CENTRE_CATALOGUE[sequence[(index + 1) % 11]].name;
  return { current, blend: exactPosition % 1 >= 0.7 ? `${current}/${next}` : current };
};
const ids = Object.keys(MOON_CENTRE_CATALOGUE) as MoonCentreId[];
const sequences = [ids, [...ids].reverse(), ...[3, 5, 7, 9].map(step => ids.map((_, index) => ids[(index * step) % 11]))];
assert.equal(MOON_CENTRE_DURATION_DAYS, 2.5);
let cases = 0;
for (const sequence of sequences) {
  // Includes leap-day, spring DST and autumn DST windows in several timezones.
  for (const originalAnchor of ['2024-02-20', '2024-03-01', '2024-10-20', '2024-12-28']) {
    for (const rebaseDay of [0, 1, 2, 3, 7, 28, 55, 367]) {
      const anchorDate = addDays(originalAnchor, rebaseDay);
      const explicit = {
        enabled: true,
        anchorDate,
        anchorCentreId: sequence[Math.floor(rebaseDay / 2.5) % 11],
        anchorElapsedDays: rebaseDay % 2.5,
        order: sequence,
      };
      for (const offset of [...Array.from({ length: 112 }, (_, index) => index), 365, 730, 1825]) {
        for (const hour of [0, 12, 23]) {
          const sample = date(addDays(anchorDate, offset), hour);
          const expected = oldRead(sample, originalAnchor, sequence);
          assert.equal(calculateMoonCenter(sample, explicit).current, expected.current);
          assert.equal(calculateMoonCenterBlend(sample, explicit), expected.blend);
          cases++;
        }
      }
    }
    // The simple day-2 entry reproduces an existing 1.5-day remainder, including
    // the next calendar day's transition, without asking the person for arithmetic.
    const anchorDate = addDays(originalAnchor, 4);
    const fromDay = moonPatternFromDay({ enabled: true, anchorDate,
      anchorCentreId: sequence[1], dayInCentre: 2, order: sequence });
    for (let offset = 0; offset < 56; offset++) {
      const sample = date(addDays(anchorDate, offset));
      assert.equal(calculateMoonCenter(sample, fromDay).current, oldRead(sample, originalAnchor, sequence).current);
      assert.equal(calculateMoonCenterBlend(sample, fromDay), oldRead(sample, originalAnchor, sequence).blend);
    }
  }
}
console.log(`Moon timing: ${cases} old-formula/rebased-pattern samples match, plus day-entry equivalence; 2.5 days, whole local dates and transition blends preserved (${process.env.TZ || 'system timezone'}).`);
