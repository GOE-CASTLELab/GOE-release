// GOE HRV source processing.
// Camera PPG produces pulse-to-pulse intervals (PRV); Bluetooth devices supply R-R intervals.

export function calculateRMSSD(intervals) {
  if (!Array.isArray(intervals) || intervals.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < intervals.length; i++) {
    diffs.push(intervals[i] - intervals[i - 1]);
  }
  return Math.round(Math.sqrt(diffs.reduce((sum, value) => sum + value * value, 0) / diffs.length));
}

// SDNN is the sample standard deviation of the accepted NN intervals (ms).
// Using n - 1 keeps this estimate consistent with a finite recording sample.
export function calculateSDNN(intervals) {
  if (!Array.isArray(intervals) || intervals.length < 2) return null;
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (intervals.length - 1);
  return Math.round(Math.sqrt(variance));
}

export function parseBluetoothRRIntervals(dataView) {
  const flags = dataView.getUint8(0);
  const hrFormat = flags & 0x01;
  const rrPresent = (flags >> 4) & 0x01;
  let offset = hrFormat ? 3 : 2;
  const intervals = [];
  if (rrPresent) {
    while (offset + 1 < dataView.byteLength) {
      intervals.push(Math.round(dataView.getUint16(offset, true) * 1000 / 1024));
      offset += 2;
    }
  }
  return intervals;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function movingAverage(values, radius) {
  const output = new Array(values.length);
  let sum = 0;
  let left = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    while (left < i - radius) sum -= values[left++];
    output[i] = sum / (i - left + 1);
  }
  return output;
}

function resample(samples, channel, sampleRate = 30) {
  if (samples.length < 2) return { values: [], times: [] };
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const step = 1000 / sampleRate;
  const values = [];
  const times = [];
  let sourceIndex = 1;
  for (let t = start; t <= end; t += step) {
    while (sourceIndex < samples.length - 1 && samples[sourceIndex].t < t) sourceIndex++;
    const before = samples[sourceIndex - 1];
    const after = samples[sourceIndex];
    const span = Math.max(1, after.t - before.t);
    const ratio = Math.max(0, Math.min(1, (t - before.t) / span));
    values.push(before[channel] + (after[channel] - before[channel]) * ratio);
    times.push(t);
  }
  return { values, times };
}

function standardize(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
  const sd = Math.sqrt(variance) || 1;
  return values.map(value => (value - mean) / sd);
}

function selectChannel(samples) {
  const candidates = ['r', 'g', 'b'];
  let selected = 'g';
  let best = -Infinity;
  for (const channel of candidates) {
    const values = samples.map(sample => sample[channel]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const saturationPenalty = mean < 8 || mean > 247 ? 0.05 : 1;
    const score = (Math.sqrt(variance) / Math.max(1, mean)) * saturationPenalty;
    if (score > best) {
      best = score;
      selected = channel;
    }
  }
  return selected;
}

function detectIntervals(signal, times, polarity = 1) {
  const peaks = [];
  const threshold = 0.12;
  let lastPeakTime = -Infinity;
  for (let i = 2; i < signal.length - 2; i++) {
    const value = signal[i] * polarity;
    const isPeak = value > threshold && value >= signal[i - 1] * polarity && value > signal[i + 1] * polarity;
    if (!isPeak) continue;
    const previous = signal[i - 1] * polarity;
    const next = signal[i + 1] * polarity;
    const denominator = previous - 2 * value + next;
    const offset = denominator === 0 ? 0 : Math.max(-1, Math.min(1, 0.5 * (previous - next) / denominator));
    const sampleStep = (times[i + 1] - times[i - 1]) / 2;
    const peakTime = times[i] + offset * sampleStep;
    if (peakTime - lastPeakTime < 380) {
      if (peaks.length && value > peaks[peaks.length - 1].value) {
        peaks[peaks.length - 1] = { t: peakTime, value };
        lastPeakTime = peakTime;
      }
      continue;
    }
    peaks.push({ t: peakTime, value });
    lastPeakTime = peakTime;
  }

  const rawIntervals = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = Math.round(peaks[i].t - peaks[i - 1].t);
    if (interval >= 400 && interval <= 1500) rawIntervals.push(interval);
  }
  if (!rawIntervals.length) return { intervals: [], peaks };

  const centre = median(rawIntervals);
  const intervals = rawIntervals.filter(value => Math.abs(value - centre) <= Math.max(180, centre * 0.22));
  return { intervals, peaks };
}

function candidateScore(candidate) {
  if (candidate.intervals.length < 2) return -Infinity;
  const centre = median(candidate.intervals);
  const spread = candidate.intervals.reduce((sum, value) => sum + Math.abs(value - centre), 0) / candidate.intervals.length;
  return candidate.intervals.length - spread / Math.max(1, centre);
}

export function processPpgSamples(samples, { minimumIntervals = 20 } = {}) {
  if (!Array.isArray(samples) || samples.length < 120) {
    return { ok: false, reason: 'Not enough camera data', quality: 0 };
  }

  const channel = selectChannel(samples);
  const { values, times } = resample(samples, channel, 30);
  const baseline = movingAverage(values, 45);
  const highPassed = values.map((value, index) => value - baseline[index]);
  const smoothed = movingAverage(highPassed, 2);
  const signal = standardize(smoothed);

  const positive = detectIntervals(signal, times, 1);
  const negative = detectIntervals(signal, times, -1);
  const selected = candidateScore(positive) >= candidateScore(negative) ? positive : negative;
  const intervals = selected.intervals;

  const durationSeconds = Math.max(1, (times[times.length - 1] - times[0]) / 1000);
  const expectedFrames = durationSeconds * 30;
  const cadence = Math.min(1, samples.length / expectedFrames);
  const intervalCoverage = Math.min(1, intervals.length / Math.max(minimumIntervals, durationSeconds * 0.65));
  const quality = Math.round(100 * cadence * intervalCoverage);
  const rmssd = calculateRMSSD(intervals);
  const sdnn = calculateSDNN(intervals);
  const centre = median(intervals);
  const bpm = centre ? Math.round(60000 / centre) : null;

  const stride = Math.max(1, Math.floor(signal.length / 160));
  const waveform = signal.filter((_, index) => index % stride === 0).slice(-160);
  const peakTimes = selected.peaks.map(peak => peak.t);

  if (intervals.length < minimumIntervals || rmssd == null || sdnn == null || bpm == null) {
    return { ok: false, reason: 'The camera did not hold a clear rhythm long enough to calculate HRV.', quality, waveform, channel, intervals, peakTimes, bpm };
  }

  return { ok: true, rmssd, sdnn, bpm, intervals, quality, waveform, channel, peakTimes };
}
