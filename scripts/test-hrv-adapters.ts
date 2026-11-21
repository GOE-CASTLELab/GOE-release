import {
  captureWithHrvAdapter,
  getHrvAdapter,
  listHrvAdapters,
  registerHrvAdapter,
  runHrvAdapterSelfTest,
  validateHrvAdapter,
  validateHrvReading,
} from '../client/src/lib/hrv/adapterRegistry.js';
import { calculateSDNN, processPpgSamples } from '../client/src/lib/hrv/processing.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const shipped = listHrvAdapters().map(adapter => adapter.id).sort();
assert(JSON.stringify(shipped) === JSON.stringify(['bluetooth_rr', 'camera_ppg', 'manual']), `Unexpected shipped adapters: ${shipped}`);
for (const id of shipped) assert(getHrvAdapter(id), `Missing ${id}`);

const manual = await captureWithHrvAdapter('manual', { value: '47' });
assert(manual.rmssd === 47 && manual.source === 'manual', 'Manual adapter did not normalize its reading.');
assert(manual.sdnn == null, 'Manual adapter must not invent SDNN without intervals.');
assert((await runHrvAdapterSelfTest('manual', { value: '48' })).verified, 'Manual self-test failed.');
assert(calculateSDNN([800, 900, 1000]) === 100, 'SDNN must use sample standard deviation of accepted intervals.');

let invalidReadingRejected = false;
try { validateHrvReading({ rmssd: 0, intervals: [] }, 'invalid'); } catch { invalidReadingRejected = true; }
assert(invalidReadingRejected, 'Invalid reading passed validation.');

let invalidAdapterRejected = false;
try { validateHrvAdapter({ id: 'Bad Id' }); } catch { invalidAdapterRejected = true; }
assert(invalidAdapterRejected, 'Invalid adapter passed validation.');

registerHrvAdapter({
  id: 'test_watch',
  label: 'Test Watch',
  uiKind: 'external',
  capabilities: { spot: true, continuous: false, dailyImport: true },
  isAvailable: () => true,
  unavailableReason: () => 'Unavailable',
  capture: async () => ({ rmssd: 51, bpm: 66, intervals: [], quality: 90 }),
});
const external = await captureWithHrvAdapter('test_watch');
assert(external.source === 'test_watch' && external.rmssd === 51, 'Contributor adapter did not pass through registry.');

for (const { fps, bpm } of [{ fps: 30, bpm: 54 }, { fps: 30, bpm: 72 }, { fps: 60, bpm: 96 }]) {
  const samples = [];
  const hz = bpm / 60;
  for (let i = 0; i < fps * 60; i++) {
    const phase = 2 * Math.PI * hz * i / fps;
    samples.push({
      t: i * 1000 / fps,
      r: 120 + 6 * Math.sin(phase),
      g: 100 + 14 * Math.sin(phase) + 0.05 * Math.sin(5 * phase),
      b: 80 + 3 * Math.sin(phase),
    });
  }
  const reading = processPpgSamples(samples);
  assert(reading.ok, `Synthetic ${bpm} BPM PPG failed.`);
  assert(Math.abs(reading.bpm - bpm) <= 2, `Synthetic ${bpm} BPM read as ${reading.bpm}.`);
  assert(reading.rmssd <= 8, `Stable synthetic signal produced RMSSD ${reading.rmssd}.`);
  assert(reading.sdnn <= 8, `Stable synthetic signal produced SDNN ${reading.sdnn}.`);
}

console.log('HRV adapters: registry, validation, self-test, contributor path, and PPG fixtures pass.');
