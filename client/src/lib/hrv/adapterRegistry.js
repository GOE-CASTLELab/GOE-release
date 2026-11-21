import { captureBluetoothRR, captureCameraPpg } from './sources';

const REQUIRED_CAPABILITIES = ['spot', 'continuous', 'dailyImport'];
const registry = new Map();

export function validateHrvReading(reading, sourceId) {
  if (!reading || typeof reading !== 'object') throw new Error(`${sourceId} returned no HRV reading.`);
  if (!Number.isFinite(reading.rmssd) || reading.rmssd <= 0) throw new Error(`${sourceId} returned an invalid RMSSD.`);
  if (reading.sdnn != null && (!Number.isFinite(reading.sdnn) || reading.sdnn < 0)) throw new Error(`${sourceId} returned an invalid SDNN.`);
  if (!Array.isArray(reading.intervals)) throw new Error(`${sourceId} must return an intervals array.`);
  if (reading.quality != null && (!Number.isFinite(reading.quality) || reading.quality < 0 || reading.quality > 100)) {
    throw new Error(`${sourceId} returned quality outside 0–100.`);
  }
  return {
    ...reading,
    source: sourceId,
    capturedAt: reading.capturedAt || new Date().toISOString(),
  };
}

export function validateHrvAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new Error('HRV adapter must be an object.');
  if (!/^[a-z][a-z0-9_]*$/.test(adapter.id || '')) throw new Error('HRV adapter id must be snake_case.');
  if (!adapter.label || typeof adapter.label !== 'string') throw new Error(`${adapter.id} needs a label.`);
  if (typeof adapter.capture !== 'function') throw new Error(`${adapter.id} needs capture(options).`);
  if (typeof adapter.isAvailable !== 'function') throw new Error(`${adapter.id} needs isAvailable().`);
  for (const capability of REQUIRED_CAPABILITIES) {
    if (typeof adapter.capabilities?.[capability] !== 'boolean') {
      throw new Error(`${adapter.id} must declare capabilities.${capability}.`);
    }
  }
  return adapter;
}

export function registerHrvAdapter(adapter) {
  const valid = validateHrvAdapter(adapter);
  if (registry.has(valid.id)) throw new Error(`HRV adapter already registered: ${valid.id}`);
  registry.set(valid.id, valid);
  return valid;
}

export function getHrvAdapter(id) {
  return registry.get(id) || null;
}

export function listHrvAdapters() {
  return [...registry.values()];
}

export function hrvAdapterAvailability() {
  return Object.fromEntries(listHrvAdapters().map(adapter => [adapter.id, Boolean(adapter.isAvailable())]));
}

export async function captureWithHrvAdapter(id, options = {}) {
  const adapter = getHrvAdapter(id);
  if (!adapter) throw new Error(`Unknown HRV source: ${id}`);
  if (!adapter.isAvailable()) throw new Error(adapter.unavailableReason?.() || `${adapter.label} is unavailable here.`);
  const reading = await adapter.capture(options);
  return validateHrvReading(reading, adapter.id);
}

export async function runHrvAdapterSelfTest(id, options = {}) {
  const reading = await captureWithHrvAdapter(id, options);
  saveDefaultHrvSource(id);
  return { adapterId: id, verified: true, reading };
}

export function getDefaultHrvSource() {
  const configured = import.meta.env.VITE_DEFAULT_HRV_SOURCE;
  const fallback = registry.has(configured) ? configured : 'camera_ppg';
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem('goe:hrv-source');
  return registry.has(saved) ? saved : fallback;
}

export function saveDefaultHrvSource(source) {
  if (typeof window !== 'undefined' && registry.has(source)) {
    window.localStorage.setItem('goe:hrv-source', source);
  }
}

function secureBrowser() {
  return typeof window !== 'undefined' && window.isSecureContext;
}

registerHrvAdapter({
  id: 'camera_ppg',
  label: 'Camera',
  uiKind: 'camera',
  capabilities: { spot: true, continuous: false, dailyImport: false },
  isAvailable: () => Boolean(secureBrowser() && navigator.mediaDevices?.getUserMedia),
  unavailableReason: () => 'Camera reading needs GOE’s secure address.',
  capture: captureCameraPpg,
});

registerHrvAdapter({
  id: 'bluetooth_rr',
  label: 'Bluetooth',
  uiKind: 'bluetooth',
  capabilities: { spot: true, continuous: true, dailyImport: false },
  isAvailable: () => Boolean(secureBrowser() && navigator.bluetooth),
  unavailableReason: () => 'Bluetooth reading needs GOE’s secure address in a compatible browser.',
  capture: captureBluetoothRR,
});

registerHrvAdapter({
  id: 'manual',
  label: 'Manual',
  uiKind: 'manual',
  capabilities: { spot: true, continuous: false, dailyImport: false },
  isAvailable: () => true,
  capture: async ({ value } = {}) => {
    const rmssd = Number.parseInt(value, 10);
    if (!Number.isFinite(rmssd) || rmssd <= 0) throw new Error('Enter the RMSSD shown by your source.');
    return { rmssd, bpm: null, intervals: [], quality: null, capturedAt: new Date().toISOString() };
  },
});
