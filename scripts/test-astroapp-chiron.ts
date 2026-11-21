import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ensureChironMovement,
  skyInstant,
  validChironMovement,
  CHIRON_REQUEST_LIMIT,
  type AstroAppRequest,
} from "../server/lib/astroAppChiron";
import { transformCurrentSkyData } from "../server/astrologyTransformations";
import { withAstrologyDisplayDates } from "../server/lib/astrologyDisplayDates";

const fixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/chiron-provider.json", import.meta.url),
    "utf8",
  ),
);
let requests = 0;
const replay: AstroAppRequest = async (url, options) => {
  requests++;
  const body = JSON.parse(String(options.body));
  if (url.endsWith("/chart")) {
    assert.deepEqual(body.params.objects, [15]);
    assert.equal(body.chart.chartData.tz, "UTC");
    const result = fixture.charts[body.chart.chartData.chartDate];
    assert.ok(
      result,
      `Unverified provider sample: ${body.chart.chartData.chartDate}`,
    );
    return result;
  }
  assert.equal(url, "https://astroapp.com/astro/apis/ingresses");
  assert.equal(body.params.ingressPlanetId, 15);
  assert.equal(body.params.eventTypeId, 1);
  const result = fixture.ingresses[body.params.isNext];
  assert.equal(body.targetChart.chartDate, result.targetDate);
  return result;
};
const [first, concurrent] = await Promise.all([
  ensureChironMovement(fixture.initial, replay),
  ensureChironMovement(fixture.initial, replay),
]);
assert.deepEqual(first.chironMovement, fixture.verifiedMovement);
assert.deepEqual(concurrent, first);
assert.equal(
  requests,
  45,
  "Concurrent refreshes share one provider calculation",
);
assert.ok(requests < CHIRON_REQUEST_LIMIT);
for (const station of [
  first.chironMovement.retrogradeStation,
  first.chironMovement.directStation,
]) {
  assert.ok(
    Date.parse(station.after.at) - Date.parse(station.before.at) <= 60_000,
  );
  assert.notEqual(station.before.speed < 0, station.after.speed < 0);
}
const rows = transformCurrentSkyData(first);
const chiron = rows.find((row) => row.planet === "Chiron")!;
assert.equal(chiron.retrogradeMovement?.crossingAt, "2026-09-18T01:53:15.003Z");
assert.equal(chiron.retrogradeMovement?.nextSignAt, "2027-04-14T14:56:23.595Z");
assert.equal(chiron.retrogradeMovement?.directAt, "2027-01-06T11:00:30.000Z");
const local = withAstrologyDisplayDates([chiron], "America/Edmonton")[0];
assert.equal(
  local.displayDates[chiron.retrogradeMovement!.crossingAt!].long,
  "September 17",
);
assert.equal(
  local.displayDates[chiron.retrogradeMovement!.directAt].long,
  "January 6",
);
assert.equal(
  local.displayDates[chiron.retrogradeMovement!.nextSignAt].long,
  "April 14",
);
const utc = withAstrologyDisplayDates([chiron], "UTC")[0];
assert.equal(
  utc.displayDates[chiron.retrogradeMovement!.crossingAt!].long,
  "September 18",
);

const noCalls: AstroAppRequest = async () => {
  throw new Error("Unexpected provider request");
};
await ensureChironMovement(first, noCalls);
const nextDay = {
  ...fixture.initial,
  chartData: { ...fixture.initial.chartData, chartDate: "2026-11-05T12:00:00" },
};
assert.deepEqual(
  (await ensureChironMovement(nextDay, noCalls, first.chironMovement))
    .chironMovement,
  first.chironMovement,
);
assert.equal(
  validChironMovement(first.chironMovement, new Date("2027-11-04T12:00:00Z")),
  false,
);
assert.equal(
  validChironMovement(
    { ...first.chironMovement, version: "old" },
    new Date("2026-11-04T12:00:00Z"),
  ),
  false,
);
assert.equal(
  (
    await ensureChironMovement(
      { ...first, objects: [{ id: 15, lng: 30, speed: 0.1 }] },
      noCalls,
    )
  ).chironMovement,
  undefined,
);
assert.equal(
  (await ensureChironMovement({ ...first, objects: [] }, noCalls))
    .chironMovement,
  undefined,
);
await assert.rejects(
  ensureChironMovement(fixture.initial, async () => {
    throw new Error("Provider unavailable");
  }),
  /Provider unavailable/,
);
await assert.rejects(
  ensureChironMovement(fixture.initial, async () => ({ objects: [] })),
  /no valid Chiron/,
);
assert.equal(
  transformCurrentSkyData(fixture.initial).find(
    (row) => row.planet === "Chiron",
  )?.retrogradeMovement,
  undefined,
  "No fixed-date fallback survives",
);

const fallback = new Date("2000-01-01T00:00:00Z");
assert.equal(
  skyInstant(
    { chartDate: "2026-11-04T12:00:00", tz: "America/Los_Angeles", jd: 0 },
    fallback,
  ).toISOString(),
  "2026-11-04T20:00:00.000Z",
);
assert.equal(
  skyInstant(
    { chartDate: "2026-07-04T12:00:00", tz: "America/Los_Angeles", jd: 0 },
    fallback,
  ).toISOString(),
  "2026-07-04T19:00:00.000Z",
);
assert.equal(
  skyInstant(
    { chartDate: "2026-11-04T12:00:00Z", tz: "America/Los_Angeles" },
    fallback,
  ).toISOString(),
  "2026-11-04T12:00:00.000Z",
);
assert.equal(
  skyInstant({ jd: 2461349.0 }, fallback).toISOString(),
  "2026-11-04T12:00:00.000Z",
);
console.log(
  "AstroApp Chiron: live-response replay, exact ingresses, bracketed stations, cache reuse, concurrency, failure and timezone checks pass.",
);

// A different year's in-sign retrograde proves this is not a renamed 2026 table.
const epoch = Date.parse("2030-06-01T12:00:00Z");
const dayMs = 86_400_000;
const longitude = (day: number) => 15 + day ** 3 / 300 - day;
let low = 20,
  high = 30;
for (let i = 0; i < 50; i++) {
  const mid = (low + high) / 2;
  if (longitude(mid) < 30) low = mid;
  else high = mid;
}
const ingressDay = (low + high) / 2;
const synthetic = {
  calcResultsAvailable: true,
  chartData: { chartDate: new Date(epoch).toISOString(), tz: "UTC" },
  houseCusps: [],
  objects: [{ id: 15, lng: 15, lat: 0, speed: -1 }],
};
const syntheticRequest: AstroAppRequest = async (url, options) => {
  const payload = JSON.parse(String(options.body));
  if (url.endsWith("/chart")) {
    const date = `${payload.chart.chartData.chartDate}Z`;
    const days = (Date.parse(date) - epoch) / dayMs;
    return {
      chartData: { chartDate: date },
      objects: [{ id: 15, lng: longitude(days), speed: days ** 2 / 100 - 1 }],
    };
  }
  return {
    results: [-1, 1].map((direction) => ({
      objectId1: 15,
      eventType: 1,
      exactJD: (epoch + direction * ingressDay * dayMs) / dayMs + 2440587.5,
      exactLng: direction === 1 ? 30 : 0,
    })),
  };
};
const inSign = await ensureChironMovement(synthetic, syntheticRequest);
assert.equal(inSign.chironMovement!.movement.crossesSignBoundary, false);
assert.equal(inSign.chironMovement!.movement.crossingAt, undefined);
assert.equal(inSign.chironMovement!.movement.directSign, "Aries");
assert.equal(inSign.chironMovement!.movement.nextSign, "Taurus");
assert.ok(
  Math.abs(
    Date.parse(inSign.chironMovement!.movement.directAt) - (epoch + 10 * dayMs),
  ) <= 60_000,
);
let boundedCalls = 0;
await assert.rejects(
  ensureChironMovement(synthetic, async (_url, options) => {
    boundedCalls++;
    const payload = JSON.parse(String(options.body));
    return {
      chartData: payload.chart.chartData,
      objects: [{ id: 15, lng: 15, speed: -1 }],
    };
  }),
  /not bracketed within 256 days/,
);
assert.equal(boundedCalls, 16);
console.log(
  "Different-year in-sign movement and bounded failed station search pass.",
);
