// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import assert from 'node:assert/strict';
import { birthChartSetupSchema, buildBirthChartPayload } from '../server/lib/birthChartSetup';

// astrologyTransformations imports the production storage module. The connection is lazy,
// but its boundary requires a configured URL even though this test injects fake storage.
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/not-used';
const { fetchBirthChart } = await import('../server/astrologyTransformations');

const input = birthChartSetupSchema.parse({
  birthDate: '1990-02-03',
  birthTime: '04:05',
  birthLocation: 'Test City, Canada',
  latitude: 53.5461,
  longitude: -113.4938,
  timezone: 'America/Edmonton',
});

const payload = buildBirthChartPayload(input);
assert.equal(payload.chart.chartData.chartDate, '1990-02-03T04:05:00');
assert.equal(payload.chart.chartData.houseSystemID, 1);
assert.equal(payload.chart.chartData.tz, 'America/Edmonton');
assert.equal(payload.chart.chartData.lat, 53.5461);
assert.equal(payload.chart.chartData.lng, -113.4938);
assert.deepEqual(payload.params.objects, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15]);

assert.throws(() => birthChartSetupSchema.parse({ ...input, birthDate: '1990-02-31' }));
assert.throws(() => birthChartSetupSchema.parse({ ...input, birthTime: '24:00' }));
assert.throws(() => birthChartSetupSchema.parse({ ...input, latitude: 91 }));
assert.throws(() => birthChartSetupSchema.parse({ ...input, timezone: 'Mountain Time' }));
assert.throws(() => birthChartSetupSchema.parse({ ...input, extra: 'rejected' }));

const rawChart = {
  calcResultsAvailable: true,
  chartData: payload.chart.chartData,
  houseCusps: [0, 10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340],
  objects: [
    { id: 0, lat: 0, lng: 15, speed: 1 },
    { id: 1, lat: 0, lng: 45, speed: 13 },
    { id: 11, lat: 0, lng: 75, speed: -0.1 },
  ],
};

let stored: any;
let requestCount = 0;
const fakeStorage = {
  async getBirthChart() { return stored; },
  async createBirthChart(value: any) { stored = value; return value; },
};
const fakeRequest = async (_url: string, options: RequestInit) => {
  requestCount++;
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(String(options.body)), payload);
  return rawChart;
};

await fetchBirthChart('did:dfos:test-owner', input, fakeStorage as any, fakeRequest as any);
assert.equal(requestCount, 1);
assert.equal(stored.userId, 'did:dfos:test-owner');
assert.equal(stored.transformedData.birthDate, input.birthDate);
assert.equal(stored.transformedData.birthTime, '04:05:00');
assert.equal(stored.transformedData.birthLocation, input.birthLocation);
assert.equal(stored.rawChartData, rawChart);

await fetchBirthChart('did:dfos:test-owner', input, fakeStorage as any, fakeRequest as any);
assert.equal(requestCount, 1, 'stored chart must prevent a second metered call');

console.log('birth chart setup tests passed');
