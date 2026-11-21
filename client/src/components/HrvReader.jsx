import { useEffect, useMemo, useRef, useState } from 'react';
import { Bluetooth, Camera, Info, Loader2, X } from 'lucide-react';
import {
  captureWithHrvAdapter,
  getDefaultHrvSource,
  getHrvAdapter,
  hrvAdapterAvailability,
  listHrvAdapters,
  saveDefaultHrvSource,
} from '../lib/hrv/adapterRegistry';

// Exact header gradients for the four shipped cards.
const WAVE_COLOURS = [
  '#fb7185', '#e11d48', '#2dd4bf', '#0891b2', '#fbbf24', '#f97316',
    '#818cf8', '#4f46e5', '#c084fc', '#9333ea',
];
const STATIC_BUTTON_GRADIENT = 'linear-gradient(180deg, rgba(251,113,133,.62) 0%, rgba(45,212,191,.62) 22%, rgba(251,191,36,.62) 42%, rgba(129,140,248,.62) 62%, rgba(192,132,252,.62) 80%, rgba(163,230,53,.62) 100%)';

function Waveform({ values, beat, circular = false, previewRef = null, circularSize = 220 }) {
  const points = useMemo(() => {
    if (!values?.length) return '';
    const visible = values.slice(-120);
    const max = Math.max(1, ...visible.map(value => Math.abs(value)));
    return visible.map((value, index) => {
      const x = visible.length === 1 ? 0 : (index / (visible.length - 1)) * 300;
      const y = 52 - (value / max) * 34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [values]);

  return (
    <div
      className={`relative overflow-hidden border border-white/60 bg-white/45 ${circular ? 'rounded-full' : 'rounded-2xl'}`}
      style={circular ? { width: circularSize, height: circularSize } : { height: 108 }}
    >
      {previewRef && <video ref={previewRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-20" />}
      <svg viewBox="0 0 300 104" className="w-full h-full" preserveAspectRatio="none" aria-label="Live heart rhythm">
        <defs>
          <linearGradient id="goeHrvWave" x1="0" x2="1">
            {WAVE_COLOURS.map((colour, index) => (
              <stop key={colour} offset={`${index * 20}%`} stopColor={colour} />
            ))}
          </linearGradient>
        </defs>
        <line x1="0" y1="52" x2="300" y2="52" stroke="rgba(107,114,128,.15)" strokeWidth="1" />
        {points ? (
          <polyline points={points} fill="none" stroke="url(#goeHrvWave)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <path d="M0 52 C35 52 35 52 60 52 S95 52 120 52 S155 52 180 52 S215 52 240 52 S275 52 300 52" fill="none" stroke="url(#goeHrvWave)" strokeWidth="2" opacity=".35" />
        )}
      </svg>
      <div
        className="absolute right-3 top-3 w-3 h-3 rounded-full transition-transform"
        style={{ background: WAVE_COLOURS[beat % WAVE_COLOURS.length], transform: beat % 2 ? 'scale(1.45)' : 'scale(.8)' }}
      />
    </div>
  );
}

export default function HrvReader({ onReading, initialReading = null, compact = false, label = 'Read HRV', successLabel = 'Reading saved', persistOnSelect = true }) {
  const availability = hrvAdapterAvailability();
  const initialSource = getDefaultHrvSource();
  const [source, setSource] = useState(getHrvAdapter(initialSource) ? initialSource : 'camera_ppg');
  const [state, setState] = useState(initialReading ? 'done' : 'idle');
  const [reading, setReading] = useState(initialReading);
  const [countdown, setCountdown] = useState(60);
  const [waveform, setWaveform] = useState([]);
  const [bpm, setBpm] = useState(initialReading?.bpm ?? null);
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState('');
  const [illumination, setIllumination] = useState(null);
  const [manualValue, setManualValue] = useState('');
  const [metricInfoOpen, setMetricInfoOpen] = useState(false);
  const abortRef = useRef(null);
  const savedReadingRef = useRef(initialReading);
  const previewRef = useRef(null);
  const metricInfoRef = useRef(null);
  const [previewStream, setPreviewStream] = useState(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (initialReading) {
      savedReadingRef.current = initialReading;
      if (state === 'idle') {
        setReading(initialReading);
        setBpm(initialReading.bpm ?? null);
        setState('done');
      }
    }
    // Only a new reading from the parent should restore the saved result. Depending
    // on local state would undo the owner's deliberate Read Again/source reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReading]);
  useEffect(() => {
    if (previewRef.current && previewStream) {
      previewRef.current.srcObject = previewStream;
      previewRef.current.play().catch(() => {});
    }
  }, [previewStream, state]);
  useEffect(() => {
    if (!metricInfoOpen) return;
    const closeOutside = event => {
      if (metricInfoRef.current && !metricInfoRef.current.contains(event.target)) setMetricInfoOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('touchstart', closeOutside);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('touchstart', closeOutside);
    };
  }, [metricInfoOpen]);

  const chooseSource = next => {
    if (state === 'reading' || state === 'connecting') return;
    setSource(next);
    if (persistOnSelect) saveDefaultHrvSource(next);
    setState('idle');
    setReading(null);
    savedReadingRef.current = null;
    setError('');
    setWaveform([]);
    setBpm(null);
    setManualValue('');
    setPreviewStream(null);
  };

  const handleWaveform = values => {
    setWaveform(values);
    setBeat(value => value + 1);
  };

  const finish = async result => {
    setState('saving');
    await onReading?.(result);
    savedReadingRef.current = result;
    setReading(result);
    setBpm(result.bpm ?? null);
    setState('done');
  };

  const restoreSavedReading = () => {
    const saved = savedReadingRef.current;
    setError('');
    setReading(saved || null);
    setBpm(saved?.bpm ?? null);
    setWaveform([]);
    setPreviewStream(null);
    setState(saved ? 'done' : 'idle');
  };

  const start = async () => {
    if (source === 'manual') return;
    setError('');
    setReading(null);
    setWaveform([]);
    setBpm(null);
    setCountdown(60);
    setState('connecting');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await captureWithHrvAdapter(source, {
        durationSeconds: 60,
        signal: controller.signal,
        onProgress: value => { setCountdown(value); setState('reading'); },
        onWaveform: handleWaveform,
        onBpm: setBpm,
        onMode: setIllumination,
        onStream: setPreviewStream,
      });
      await finish(result);
    } catch (captureError) {
      const message = captureError?.message || '';
      const chooserCancelled = captureError?.name === 'AbortError'
        || /cancel|chooser|requestdevice/i.test(message);
      if (chooserCancelled) {
        restoreSavedReading();
      } else {
        const errorMessage = captureError?.name === 'NotAllowedError'
          ? 'Camera access is off for this site. Allow Camera in Safari, then read again.'
          : (message || 'The reading could not be completed.');
        setError(errorMessage);
        setState('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const saveManual = async () => {
    try {
      await finish(await captureWithHrvAdapter('manual', { value: manualValue }));
    } catch (saveError) {
      setError(saveError?.message || 'The reading could not be saved.');
      setState('error');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    restoreSavedReading();
  };

  const sourceOptions = listHrvAdapters();
  const selectedAdapter = getHrvAdapter(source);
  const secureMessage = !availability[source] && source !== 'manual'
    ? selectedAdapter?.unavailableReason?.()
    : null;

  return (
    <div className={`${compact ? 'space-y-1.5' : 'space-y-3 py-1'}`}>
      <div ref={metricInfoRef} className="relative flex justify-center gap-1.5" role="group" aria-label="HRV source">
        {sourceOptions.map(option => {
          const id = option.id;
          const available = availability[id];
          const Icon = option.uiKind === 'camera' ? Camera : option.uiKind === 'bluetooth' ? Bluetooth : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => chooseSource(id)}
              className={`flex items-center gap-1 rounded-full border transition-colors ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'}`}
              style={compact
                ? {
                    background: 'rgba(255,255,255,0.65)',
                    borderColor: source === id ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.08)',
                    color: source === id ? '#111827' : available ? '#4b5563' : '#9ca3af',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }
                : source === id
                  ? { background: 'rgba(255,255,255,.8)', borderColor: '#d6d3d1', color: '#44403c' }
                  : { background: 'rgba(255,255,255,.25)', borderColor: 'rgba(255,255,255,.45)', color: available ? '#78716c' : '#a8a29e' }}
              title={!available && id !== 'manual' ? 'Available from GOE’s secure address on a compatible device' : undefined}
            >
              {Icon && <Icon size={11} />}{option.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMetricInfoOpen(open => !open)}
          aria-label="About HRV metrics"
          className={`flex items-center justify-center rounded-full border transition-colors ${compact ? 'h-[22px] w-[22px]' : 'h-[28px] w-[28px]'}`}
          style={compact
            ? {
                background: 'rgba(255,255,255,0.65)',
                borderColor: 'rgba(0,0,0,0.08)',
                color: '#4b5563',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }
            : { background: 'rgba(255,255,255,.8)', borderColor: '#d6d3d1', color: '#57534e' }}
        >
          <Info size={compact ? 12 : 14} />
        </button>
        {metricInfoOpen && (
          <div className="absolute right-0 top-full z-[70] mt-2 w-64 rounded-xl border border-white/60 bg-white/90 p-3 text-left text-xs leading-relaxed text-gray-700 shadow-lg">
            <p>Take HRV within about five minutes of waking, before getting up if possible, and before food, caffeine, or exercise. Keep the position and source consistent.</p>
            <p className="mt-2">Camera and Bluetooth record RMSSD and SDNN. Manual records RMSSD only.</p>
          </div>
        )}
      </div>

      {state === 'done' && reading ? (
        <div className="flex flex-col items-center gap-2">
          <div className={`flex ${compact ? 'h-36 w-36' : 'h-48 w-48'} items-center justify-center rounded-full p-[2px] shadow-sm`} style={{ background: STATIC_BUTTON_GRADIENT }}>
            <div
              className={`flex h-full w-full flex-col items-center justify-center rounded-full text-center text-gray-900 ${compact ? 'gap-0.5' : 'gap-1 bg-white/95'}`}
              style={compact ? {
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(0,0,0,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              } : undefined}
            >
              <p className={`${compact ? 'text-[11px]' : 'text-sm'} leading-none`}>{successLabel}</p>
              <p className={`${compact ? 'text-lg' : 'text-2xl'} font-medium leading-none`}>RMSSD {reading.rmssd} ms</p>
              {reading.sdnn != null && <p className={`${compact ? 'text-[11px]' : 'text-xs'} leading-none text-gray-700`}>SDNN {reading.sdnn} ms</p>}
              {(reading.bpm || reading.quality != null) && <p className={`${compact ? 'text-[10px]' : 'text-xs'} leading-none text-gray-700`}>{reading.bpm ? `${reading.bpm} BPM` : ''}{reading.quality != null ? `${reading.bpm ? ' · ' : ''}${reading.quality}% clear` : ''}</p>}
            </div>
          </div>
          <button type="button" onClick={() => source === 'manual' ? chooseSource('manual') : start()} className={`${compact ? 'text-[11px] text-black' : 'text-[11px] text-gray-700'} underline`}>Read again</button>
        </div>
      ) : source === 'manual' ? (
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            value={manualValue}
            onChange={event => setManualValue(event.target.value)}
            placeholder="RMSSD"
            className="w-28 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm outline-none"
          />
          <span className="text-xs text-gray-500">ms</span>
          <button type="button" onClick={saveManual} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-medium text-white">Save</button>
        </div>
      ) : state === 'reading' ? (
        <div className={illumination === 'screen' ? 'fixed inset-0 z-[100] flex items-center justify-center bg-white p-6' : ''}>
          <div className="relative flex w-full flex-col items-center space-y-3">
            <div className="relative">
              <Waveform values={waveform} beat={beat} circular previewRef={previewRef} circularSize={compact ? 144 : 220} />
              <button type="button" onClick={cancel} className={`absolute ${compact ? 'right-3 top-3' : 'right-5 top-5'} z-10 rounded-full bg-white/75 p-1 text-gray-600 shadow-sm`} aria-label="Cancel HRV reading"><X size={compact ? 12 : 15} /></button>
              <div className={`pointer-events-none absolute inset-x-0 ${compact ? 'bottom-6 text-[10px]' : 'bottom-10 text-xs'} flex justify-center gap-3 font-medium text-gray-700`}>
                <span>{bpm ? `${bpm} BPM` : 'finding your rhythm…'}</span>
                <span className="tabular-nums">{countdown}s</span>
              </div>
            </div>
            <p className="max-w-xs text-center text-[11px] leading-snug text-black">
              {illumination === 'screen'
                ? 'Cover the front camera at the top of your screen. Hold there while the colour finds your rhythm.'
                : illumination === 'torch'
                  ? 'Cover one rear lens at a time. When the circle fills with the colour of your fingertip, you have the right one. Hold there.'
                  : 'Cover the active camera shown in the circle. Hold there while the camera finds your rhythm.'}
            </p>
          </div>
        </div>
      ) : state === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-48 w-48 flex-col items-center justify-center rounded-full border border-amber-200 bg-amber-50/80 px-5 text-center shadow-sm">
            <p className="text-sm font-medium text-amber-800">No reading saved</p>
            <p className="mt-2 text-[11px] leading-snug text-amber-800/75">{error}</p>
          </div>
          <button type="button" onClick={() => source === 'manual' ? chooseSource('manual') : start()} className="text-[11px] text-amber-800 underline">Read again</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={start}
            disabled={state === 'connecting' || state === 'saving'}
            className={`flex ${compact ? 'h-36 w-36' : 'h-32 w-32'} flex-col items-center justify-center rounded-full text-white shadow-sm transition-all disabled:opacity-60`}
            style={{ background: STATIC_BUTTON_GRADIENT }}
          >
            {(state === 'connecting' || state === 'saving') ? <Loader2 size={20} className="animate-spin" /> : source === 'camera_ppg' ? <Camera size={19} /> : <Bluetooth size={19} />}
            <span className="mt-1 text-sm font-medium text-center leading-tight">{state === 'connecting' ? 'Connecting…' : state === 'saving' ? 'Saving…' : label}</span>
          </button>
          {source === 'camera_ppg' && (
            <p className="max-w-xs text-center text-[11px] leading-snug text-black">
              Your camera sees tiny colour changes in your fingertip as blood volume rises and falls with each heartbeat.
            </p>
          )}
        </div>
      )}

      {secureMessage && <p className="text-center text-[11px] leading-snug text-amber-800">{secureMessage}</p>}
      {error && state !== 'error' && <p className="text-center text-[11px] leading-snug text-amber-800">{error}</p>}
    </div>
  );
}
