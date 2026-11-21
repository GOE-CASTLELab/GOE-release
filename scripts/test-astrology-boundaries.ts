import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateSkyBoundaries,
  calculateTransitInfluenceRange,
  geocentricEclipticLongitude,
} from "../server/lib/astrologyBoundaries";
import { transformCurrentSkyData, transformTransitsData } from "../server/astrologyTransformations";

function isoDay(value: string | undefined): string {
  assert.ok(value);
  return value.slice(0, 10);
}

function dayDifference(actual: string, expected: string): number {
  return Math.abs(new Date(actual).getTime() - new Date(`${expected}T12:00:00Z`).getTime()) / 86_400_000;
}

// Independent AstroApp sky fixture: October 27, 2026 at noon Los Angeles time.
// The local ephemeris must agree before calculating boundaries.
const skyMercury = geocentricEclipticLongitude(2, new Date("2026-10-27T19:00:00Z"));
assert.ok(Math.abs(skyMercury - 230.11610178138477) < 0.01);

// Mercury's Oct–Nov 2026 station dates, including the current retrograde interval.
const mercury = calculateSkyBoundaries(2, new Date("2026-11-04T19:00:00Z"));
assert.ok(mercury.retrogradeRange);
assert.ok(dayDifference(mercury.retrogradeRange.start, "2026-10-24") < 1);
assert.ok(dayDifference(mercury.retrogradeRange.end, "2026-11-13") < 1);
assert.deepEqual(
  {
    crossesSignBoundary: mercury.retrogradeMovement?.crossesSignBoundary,
    directSign: mercury.retrogradeMovement?.directSign,
    nextSign: mercury.retrogradeMovement?.nextSign,
  },
  { crossesSignBoundary: false, directSign: "Scorpio", nextSign: "Sagittarius" },
);
assert.ok(dayDifference(mercury.retrogradeMovement!.nextSignAt, "2026-12-06") < 1);
assert.deepEqual(
  { nextSign: mercury.signMovement?.nextSign, direction: mercury.signMovement?.direction },
  { nextSign: "Sagittarius", direction: "forward" },
);

// Venus crossed backward from Scorpio into Libra during its active retrograde,
// then turns direct in Libra and re-enters Scorpio.
const venus = calculateSkyBoundaries(3, new Date("2026-11-04T19:00:00Z"));
assert.deepEqual(
  {
    crossesSignBoundary: venus.retrogradeMovement?.crossesSignBoundary,
    crossingSign: venus.retrogradeMovement?.crossingSign,
    directSign: venus.retrogradeMovement?.directSign,
    nextSign: venus.retrogradeMovement?.nextSign,
  },
  { crossesSignBoundary: true, crossingSign: "Libra", directSign: "Libra", nextSign: "Scorpio" },
);
assert.ok(dayDifference(venus.retrogradeMovement!.crossingAt!, "2026-10-25") < 1);
assert.ok(dayDifference(venus.retrogradeMovement!.nextSignAt, "2026-12-04") < 1);

const chironSky = transformCurrentSkyData({
  chironMovement: JSON.parse(fs.readFileSync(new URL('./fixtures/chiron-provider.json', import.meta.url), 'utf8')).verifiedMovement,
  calcResultsAvailable: true,
  chartData: { chartDate: "2026-11-04T12:00:00Z" },
  houseCusps: [],
  objects: [{ id: 15, lat: 0, lng: 27.9, speed: -0.02 }],
}, new Date("2026-11-04T19:00:00Z"));
assert.deepEqual(
  {
    crossingSign: chironSky[0].retrogradeMovement?.crossingSign,
    directSign: chironSky[0].retrogradeMovement?.directSign,
    nextSign: chironSky[0].retrogradeMovement?.nextSign,
  },
  { crossingSign: "Aries", directSign: "Aries", nextSign: "Taurus" },
);

// Uranus entered Gemini, then crossed backward into Taurus in November 2025.
const uranusReentry = calculateSkyBoundaries(7, new Date("2025-11-04T19:00:00Z"));
assert.equal(isoDay(uranusReentry.signRange?.start), "2025-07-07");
assert.equal(isoDay(uranusReentry.signRange?.end), "2025-11-08");

// 0°/360° wrapping: Neptune's first continuous Aries interval begins in Jan 2026.
const neptune = calculateSkyBoundaries(8, new Date("2026-02-01T19:00:00Z"));
assert.equal(isoDay(neptune.signRange?.start), "2026-01-26");

const mercuryTransit = {
  eventType: 1,
  objectId1: 5,
  objectId2: 2,
  aspectAngle: 60,
  exactDate1: "2026-11-4",
  exactJD: 2461349.4249560935,
  exactLng: 221.75715879651716,
};
const influence = calculateTransitInfluenceRange(mercuryTransit, 5);
assert.ok(influence);
assert.equal(isoDay(influence.start), "2026-10-31");
assert.equal(isoDay(influence.end), "2026-11-09");

// The calculated edges are actual 5° orb crossings, not a planet-to-days lookup.
for (const edge of [influence.start, influence.end]) {
  const longitude = geocentricEclipticLongitude(2, new Date(edge));
  const distance = Math.abs(((longitude - mercuryTransit.exactLng + 540) % 360) - 180);
  assert.ok(Math.abs(distance - 5) < 0.001);
}

// Two Saturn exact passes inside one uninterrupted orb become one influence range
// with both exact dates retained.
const multiPass = transformTransitsData({
  results: [
    {
      eventType: 1,
      objectId1: 11,
      objectId2: 6,
      aspectAngle: 60,
      exactDate1: "2026-12-4",
      exactJD: 2461378.7034136723,
      exactLng: 7.973083369714402,
    },
    {
      eventType: 1,
      objectId1: 11,
      objectId2: 6,
      aspectAngle: 60,
      exactDate1: "2026-12-17",
      exactJD: 2461392.2631756556,
      exactLng: 7.973083369714402,
    },
  ],
}, new Date("2026-11-04T19:00:00Z"));
assert.equal(multiPass.length, 1);
assert.equal(multiPass[0].exactDates.length, 2);
assert.equal(multiPass[0].rangeKind, "influence");

// House-cusp events are not relabelled as natal-planet transits.
const cuspEvent = transformTransitsData({
  results: [{
    eventType: 3,
    objectId1: 7,
    objectId2: 1,
    aspectAngle: 120,
    exactDate1: "2026-11-4",
    exactJD: 2461349.289744512,
    exactLng: 49.223177101474334,
  }],
}, new Date("2026-11-04T19:00:00Z"));
assert.deepEqual(cuspEvent, []);

console.log("Astrology boundary tests passed (ephemeris agreement, stations, re-entry, wrap, orb, multi-pass, event types).");

// Historical regeneration uses the requested day, independent of the machine clock.
const { generateCurrentTransitsPrompt } = await import('../server/goePrompts');
const placements = Object.fromEntries(['rising','sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','midheaven'].map(name => [name, { sign: 'Aries', degree: '0°', house: '1' }]));
const datedPrompt = generateCurrentTransitsPrompt({ ...placements, birthDate: '2000-01-01', birthTime: '12:00', birthLocation: 'Test' } as any, [], '2026-10-27');
assert.ok(datedPrompt.messages[0].content.includes("TODAY'S DATE: October 27, 2026"));

const localDatePrompt = generateCurrentTransitsPrompt({ ...placements, birthDate: '2000-01-01', birthTime: '12:00', birthLocation: 'Test' } as any, [{ transit: 'Moon conjunction your Mars', aspect: 'conjunction', transitingPlanet: 'Moon', natalPlanet: 'Mars', exactDate: '2026-10-28', exactDates: ['2026-10-28T01:00:00Z', '2026-11-04T01:00:00Z'] }], '2026-10-27', 'America/Edmonton');
assert.ok(localDatePrompt.messages[0].content.includes('EXACT: October 27, 2026 · November 3, 2026'));

// Browser and server timezone databases can differ; API labels carry the instance's rules.
const { withAstrologyDisplayDates } = await import('../server/lib/astrologyDisplayDates');
const eventMoment = '2026-11-30T06:03:42.486Z';
const [displayed] = withAstrologyDisplayDates([{ exactDates: [eventMoment] }], 'America/Edmonton');
assert.equal(displayed.displayDates[eventMoment].short, new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Edmonton' }).format(new Date(eventMoment)));
assert.equal(displayed.displayTimeZone, 'America/Edmonton');
assert.deepEqual(displayed.exactDates, [eventMoment]);
