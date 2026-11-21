import { calculateRMSSD, calculateSDNN, parseBluetoothRRIntervals, processPpgSamples } from './processing';

export function hrvReadingFromLog(log) {
  if (!log?.rmssd) return null;
  const intervals = Array.isArray(log.hrvIntervals) ? log.hrvIntervals : [];
  const sorted = intervals.filter(value => typeof value === 'number').sort((a, b) => a - b);
  const middle = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  return {
    rmssd: log.rmssd,
    sdnn: log.sdnn ?? null,
    bpm: middle ? Math.round(60000 / middle) : null,
    intervals,
    source: log.hrvSource || 'manual',
    quality: log.hrvQuality ?? null,
    capturedAt: log.hrvCapturedAt || null,
  };
}

export async function captureBluetoothRR({ durationSeconds = 60, onProgress, onWaveform, signal } = {}) {
  if (!window.isSecureContext || !navigator.bluetooth) {
    throw new Error('Bluetooth reading needs GOE’s secure address in a compatible browser.');
  }

  const intervals = [];
  let characteristic = null;
  let device = null;
  const handleData = event => {
    const next = parseBluetoothRRIntervals(event.target.value);
    intervals.push(...next);
    onWaveform?.(intervals.slice(-40).map(value => (value - 900) / 250));
  };

  try {
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    characteristic = await service.getCharacteristic('heart_rate_measurement');
    characteristic.addEventListener('characteristicvaluechanged', handleData);
    await characteristic.startNotifications();

    const startedAt = Date.now();
    while ((Date.now() - startedAt) / 1000 < durationSeconds) {
      if (signal?.aborted) throw new DOMException('Reading cancelled', 'AbortError');
      const elapsed = (Date.now() - startedAt) / 1000;
      onProgress?.(Math.max(0, Math.ceil(durationSeconds - elapsed)));
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    const rmssd = calculateRMSSD(intervals);
    const sdnn = calculateSDNN(intervals);
    if (rmssd == null) throw new Error('The device did not supply enough R-R intervals.');
    const sorted = [...intervals].sort((a, b) => a - b);
    const middle = sorted[Math.floor(sorted.length / 2)] || 0;
    return {
      rmssd,
      sdnn,
      bpm: middle ? Math.round(60000 / middle) : null,
      intervals,
      source: 'bluetooth_rr',
      quality: Math.min(100, Math.round(intervals.length / 0.6)),
      capturedAt: new Date().toISOString(),
    };
  } finally {
    if (characteristic) {
      characteristic.removeEventListener('characteristicvaluechanged', handleData);
      await characteristic.stopNotifications().catch(() => {});
    }
    device?.gatt?.disconnect?.();
  }
}

function isTouchPhoneOrTablet() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function preferredPhysicalRearCamera(devices) {
  const rear = devices.filter(device => device.kind === 'videoinput' && /back|rear/i.test(device.label));
  return rear.find(device => /^(back|rear) camera$/i.test(device.label.trim()))
    || rear.find(device => !/dual|triple|ultra|telephoto|composite/i.test(device.label))
    || null;
}

async function openCamera() {
  const base = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, min: 24 } };
  let stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...base, facingMode: { ideal: 'environment' } } });
  let track = stream.getVideoTracks()[0];
  let illumination = 'ambient';

  // iOS may satisfy facingMode with a logical multi-camera that changes lenses when one
  // is covered. Once permission reveals labels, reopen one physical rear camera by id.
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const physicalRear = preferredPhysicalRearCamera(devices);
    if (physicalRear && physicalRear.deviceId !== track.getSettings?.().deviceId) {
      const lockedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...base, deviceId: { exact: physicalRear.deviceId } },
      });
      stream.getTracks().forEach(item => item.stop());
      stream = lockedStream;
      track = stream.getVideoTracks()[0];
    }
  } catch {
    // The initial working stream remains the fallback when labels are not exposed.
  }

  try {
    const capabilities = track.getCapabilities?.() || {};
    if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      illumination = 'torch';
    } else if (isTouchPhoneOrTablet()) {
      const frontStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...base, facingMode: 'user' } });
      stream.getTracks().forEach(item => item.stop());
      stream = frontStream;
      track = stream.getVideoTracks()[0];
      illumination = 'screen';
    }
  } catch {
    // Keep the working camera stream when torch/front-camera controls are unavailable.
  }

  return { stream, track, illumination };
}

export async function captureCameraPpg({ durationSeconds = 60, settleSeconds = 5, onProgress, onWaveform, onBpm, onMode, onStream, signal } = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera reading needs GOE’s secure address.');
  }

  const { stream, track, illumination } = await openCamera();
  onMode?.(illumination);
  onStream?.(stream);
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const samples = [];
  let stopped = false;
  let callbackId = null;

  const stop = () => {
    stopped = true;
    if (callbackId != null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callbackId);
    stream.getTracks().forEach(item => item.stop());
    video.pause();
    video.srcObject = null;
  };

  try {
    await video.play();
    const startedAt = performance.now();
    let lastPreview = 0;

    await new Promise((resolve, reject) => {
      const frame = now => {
        if (stopped) return;
        if (signal?.aborted) return reject(new DOMException('Reading cancelled', 'AbortError'));
        const elapsed = (now - startedAt) / 1000;
        const readingElapsed = Math.max(0, elapsed - settleSeconds);
        onProgress?.(Math.max(0, Math.ceil(durationSeconds - readingElapsed)));

        if (video.readyState >= 2 && video.videoWidth > 0) {
          context.drawImage(video, 0, 0, 48, 48);
          const pixels = context.getImageData(0, 0, 48, 48).data;
          let r = 0; let g = 0; let b = 0;
          const count = pixels.length / 4;
          for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
          }
          if (elapsed >= settleSeconds) samples.push({ t: performance.timeOrigin + now, r: r / count, g: g / count, b: b / count });
        }

        if (now - lastPreview >= 500 && samples.length >= 150) {
          lastPreview = now;
          const preview = processPpgSamples(samples.slice(-450), { minimumIntervals: 4 });
          if (preview.waveform) onWaveform?.(preview.waveform);
          if (preview.bpm) onBpm?.(preview.bpm);
        }

        if (readingElapsed >= durationSeconds) return resolve();
        if (video.requestVideoFrameCallback) callbackId = video.requestVideoFrameCallback(frame);
        else callbackId = requestAnimationFrame(frame);
      };
      if (video.requestVideoFrameCallback) callbackId = video.requestVideoFrameCallback(frame);
      else callbackId = requestAnimationFrame(frame);
    });

    let result = processPpgSamples(samples);
    if (!result.ok && samples.length) {
      // A finger adjustment can spoil the full minute even when a later section is clean.
      // Recover from the best continuous 30-second section rather than discarding it all.
      const windowMs = 30_000;
      const stepMs = 5_000;
      const first = samples[0].t;
      const last = samples[samples.length - 1].t;
      const candidates = [];
      for (let start = first; start + windowMs <= last + 250; start += stepMs) {
        const segment = samples.filter(sample => sample.t >= start && sample.t <= start + windowMs);
        const candidate = processPpgSamples(segment, { minimumIntervals: 18 });
        if (candidate.ok) candidates.push(candidate);
      }
      if (candidates.length) {
        result = candidates.sort((a, b) => b.quality - a.quality || b.intervals.length - a.intervals.length)[0];
      }
    }
    if (!result.ok) throw new Error(result.reason || 'The camera could not find a clear rhythm.');
    return {
      ...result,
      source: 'camera_ppg',
      capturedAt: new Date().toISOString(),
      illumination,
    };
  } finally {
    stop();
    try { await track.applyConstraints({ advanced: [{ torch: false }] }); } catch {}
  }
}
