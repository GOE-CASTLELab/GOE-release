import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queryClient } from '../client/src/lib/queryClient';
import {
  CYCLE_DATA_UPDATED_EVENT,
  CYCLE_QUERY_KEY,
  cycleDataFromUpdateEvent,
  publishCycleData,
} from '../client/src/lib/cycleClientState';

const eventTarget = new EventTarget();
Object.defineProperty(globalThis, 'window', { value: eventTarget, configurable: true });

const prior = { cycleStartDate: '2026-09-26', cycleLength: 25, periodData: [] };
const dayOne = {
  ...prior,
  cycleStartDate: '2026-10-20',
  periodData: [{ startDate: '2026-10-20', endDate: null }],
};
const received: unknown[] = [];
eventTarget.addEventListener(CYCLE_DATA_UPDATED_EVENT, event => {
  received.push(cycleDataFromUpdateEvent(event));
});

publishCycleData(dayOne);
assert.deepEqual(queryClient.getQueryData(CYCLE_QUERY_KEY), dayOne);
assert.deepEqual(received.at(-1), dayOne);

publishCycleData(prior);
assert.deepEqual(queryClient.getQueryData(CYCLE_QUERY_KEY), prior);
assert.deepEqual(received.at(-1), prior);

const hookSource = readFileSync('client/src/hooks/useCycleData.ts', 'utf8');
const homeSource = readFileSync('client/src/components/OrbHomeScreen.jsx', 'utf8');
const hookMutation = hookSource.slice(hookSource.indexOf('const updateCycleData = async'));
const homeMutation = homeSource.slice(homeSource.indexOf('const handlePeriodAction = async'));
assert(hookMutation.indexOf('publishCycleData(updated);') < hookMutation.indexOf("apiRequest('PUT', '/api/cycle/data'"));
assert(homeMutation.includes("fetch('/api/cycle/action'"));
assert(homeMutation.indexOf("fetch('/api/cycle/action'") < homeMutation.indexOf('publishCycleData(saved);'));
assert(hookSource.includes("apiRequest('POST', '/api/cycle/action'"));
assert(hookSource.includes('publishCycleData(previous);'));
assert(homeSource.includes('publishCycleData(cycleApiData);'));

console.log('Cycle live update: shared cache/event publication and failure rollback pass.');
