// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 1 — Your Rhythm from HRV; Movement Read from readiness and Rest/Rising.

import { useState } from 'react';
import { RotateCcw, Loader2, Info, X } from 'lucide-react';
import { ReadinessGauge } from './MovementShared';
import {
  getRhythmText, getMovementReadText, cycleContextSentence, MOVEMENT_INFO, READINESS_NOT_LOGGED_TEXT,
} from './movementInsights';
import HrvReader from '@/components/HrvReader';
import { movementReadiness } from '@shared/movementSignal';
import { calculateCycleInfo } from '@/utils/cycleCalculations';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});


// ─── HRV Timeline (banded, scrollable) ────────────────────────────────────────

const NODE_SP  = 72;   // horizontal px per node
const CHART_H  = 248;  // total chart height, including one guide-line margin above the top band
const NODE_R   = 5;    // node radius

const TOP_MARGIN_Y = 28;
const BAND_Y = { motivated: 56, rising: 104, easing: 152, sluggish: 200, unclassified: 128 };
const SIGNAL_BAND = { green: 'motivated', yellow: 'rising', orange: 'easing', red: 'sluggish' };
const readinessBand = score => movementReadiness(score)?.word ?? '';

const SIGNAL_NODE_COLOR = {
  green:  '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red:    '#f43f5e',
};

const HRV_PHASE_SHORT = {
  menstruation:   'Menses',
  follicular:     'Follicular',
  ovulatory:      'Ovulation',
  'early luteal': 'Early Lut.',
  'late luteal':  'Late Lut.',
};

const HRV_PHASE_FULL = {
  menstruation:   'Menstruation',
  follicular:     'Follicular',
  ovulatory:      'Ovulation',
  'early luteal': 'Early Luteal',
  'late luteal':  'Late Luteal',
};

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toYMD(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function applyRange(readings, timeRange, customFrom, customTo) {
  const sorted = [...readings].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (timeRange === '30d') return sorted;
  if (timeRange === 'custom') {
    return sorted.filter(r =>
      (!customFrom || r.date >= customFrom) &&
      (!customTo   || r.date <= customTo)
    );
  }
  return sorted.slice(-7);
}

function HrvTimeline({ recentLogs, cycleStartDate, cycleLength }) {
  const [timeRange,   setTimeRange]   = useState('7d');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');
  const [calFromOpen, setCalFromOpen] = useState(false);
  const [calToOpen,   setCalToOpen]   = useState(false);
  const [showPhase,     setShowPhase]     = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [hoverId,       setHoverId]       = useState(null);

  const enriched = (recentLogs || []).map(l => {
    if (l.cyclePhase || !cycleStartDate) return l;
    const info = calculateCycleInfo(new Date(l.date + 'T00:00:00'), cycleStartDate, cycleLength || 28);
    return info?.phase ? { ...l, cyclePhase: info.phase.toLowerCase() } : l;
  });
  const real = enriched.filter(l => l.rmssd != null);
  const readings = applyRange(real, timeRange, customFrom, customTo);

  const nodes = readings.map((r, i) => {
    const band = SIGNAL_BAND[r.rhythmColour] ?? 'unclassified';
    return {
      r, i,
      cx:  i * NODE_SP + NODE_SP / 2,
      cy:  BAND_Y[band],
      col: SIGNAL_NODE_COLOR[r.rhythmColour] ?? '#9ca3af',
    };
  });

  const totalW = readings.length * NODE_SP + NODE_SP / 2;

  let pathD = '';
  if (nodes.length >= 2) {
    pathD = `M ${nodes[0].cx} ${nodes[0].cy}`;
    for (let i = 1; i < nodes.length; i++) {
      const mx = (nodes[i - 1].cx + nodes[i].cx) / 2;
      pathD += ` C ${mx} ${nodes[i - 1].cy}, ${mx} ${nodes[i].cy}, ${nodes[i].cx} ${nodes[i].cy}`;
    }
  }

  const hov = hoverId != null ? nodes[hoverId] : null;

  const pillCls = (active) =>
    `text-[12px] px-3 py-1 rounded-full border transition-all outline-none flex-shrink-0 ${
      active
        ? 'bg-[#f0f0f0] border-[#bbb] text-[#555]'
        : 'bg-white border-[#ddd] text-[#888] hover:bg-[#f5f5f5]'
    }`;

  return (
    <div>
      {/* Title */}
      <p className="text-[13px] text-[#1a1a1a] font-medium text-center mb-2">Your RMSSD Rhythm Over Time</p>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
        {/* 7d / 30d — hide when custom active */}
        {timeRange !== 'custom' && (
          <>
            <button onClick={() => setTimeRange('7d')}  className={pillCls(timeRange === '7d')}>7d</button>
            <button onClick={() => setTimeRange('30d')} className={pillCls(timeRange === '30d')}>30d</button>
          </>
        )}

        {/* custom pill */}
        <button
          onClick={() => setTimeRange(timeRange === 'custom' ? '7d' : 'custom')}
          className={pillCls(timeRange === 'custom')}
        >
          custom
        </button>

        {/* Inline date pickers when custom */}
        {timeRange === 'custom' && (
          <>
            <span className="text-[12px] text-[#aaa] flex-shrink-0">from</span>
            <Popover open={calFromOpen} onOpenChange={setCalFromOpen}>
              <PopoverTrigger asChild>
                <button className="text-[12px] text-[#555] hover:text-[#1a1a1a] transition-colors border-b border-[#ddd] pb-px flex-shrink-0 outline-none">
                  {customFrom ? fmtDate(customFrom) : <span className="text-[#ccc]">select</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-[#e8e6e0] rounded-2xl shadow-xl" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom ? new Date(customFrom + 'T00:00:00') : undefined}
                  onSelect={d => { if (d) setCustomFrom(toYMD(d)); setCalFromOpen(false); }}
                  initialFocus
                  classNames={{
                    day_selected: 'bg-[#f0f0f0] text-[#555] hover:bg-[#f0f0f0] focus:bg-[#f0f0f0]',
                    day_today: 'bg-[#f0efeb] text-[#1a1a1a]',
                    cell: 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                  }}
                />
              </PopoverContent>
            </Popover>
            <span className="text-[12px] text-[#aaa] flex-shrink-0">to</span>
            <Popover open={calToOpen} onOpenChange={setCalToOpen}>
              <PopoverTrigger asChild>
                <button className="text-[12px] text-[#555] hover:text-[#1a1a1a] transition-colors border-b border-[#ddd] pb-px flex-shrink-0 outline-none">
                  {customTo ? fmtDate(customTo) : <span className="text-[#ccc]">select</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border border-[#e8e6e0] rounded-2xl shadow-xl" align="start">
                <Calendar
                  mode="single"
                  selected={customTo ? new Date(customTo + 'T00:00:00') : undefined}
                  onSelect={d => { if (d) setCustomTo(toYMD(d)); setCalToOpen(false); }}
                  initialFocus
                  classNames={{
                    day_selected: 'bg-[#f0f0f0] text-[#555] hover:bg-[#f0f0f0] focus:bg-[#f0f0f0]',
                    day_today: 'bg-[#f0efeb] text-[#1a1a1a]',
                    cell: 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                  }}
                />
              </PopoverContent>
            </Popover>
            {/* custom clear */}
            <button
              onClick={() => { setCustomFrom(''); setCustomTo(''); setTimeRange('7d'); }}
              className="text-[11px] text-[#bbb] hover:text-[#888] transition-colors outline-none flex-shrink-0"
            >✕</button>
          </>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-[#e8e8e8] flex-shrink-0" />

        {/* Cycle phase toggle + clear */}
        <button onClick={() => setShowPhase(s => !s)} className={pillCls(showPhase)}>
          cycle phase
        </button>
        <button onClick={() => setShowReadiness(s => !s)} className={pillCls(showReadiness)}>
          readiness
        </button>
      </div>

      {/* Chart */}
      <div className="flex" style={{ height: CHART_H }}>

  
        {/* Scrollable timeline */}
        <div
          className="flex-1 relative overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: 'none', touchAction: 'pan-x', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <div className="relative" style={{ width: Math.max(totalW, 100), height: CHART_H }}>

            <svg width={Math.max(totalW, 100)} height={CHART_H}
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              {/* Dashed guide lines */}
              {[TOP_MARGIN_Y, BAND_Y.motivated, BAND_Y.rising, BAND_Y.easing, BAND_Y.sluggish].map((y, idx) => (
                <line key={idx} x1={0} y1={y} x2={Math.max(totalW, 100)} y2={y}
                  stroke="#f0efeb" strokeWidth={1} strokeDasharray="4 6" />
              ))}
              {/* Connector */}
              {pathD && <path d={pathD} fill="none" stroke="#d4d2cc" strokeWidth={1.5} strokeLinecap="round" />}
              {/* Nodes */}
              {nodes.map(({ i, cx, cy, col }) => (
                <circle key={i} data-rhythm-point={i} cx={cx} cy={cy}
                  r={hoverId === i ? NODE_R + 2 : NODE_R}
                  fill={col}
                  stroke={col} strokeWidth={hoverId === i ? 2.5 : 2}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={() => setHoverId(i)}
                  onMouseLeave={() => setHoverId(null)}
                />
              ))}
            </svg>

            {/* Per-node column: RMSSD above · phase below · date below phase */}
            {nodes.map(({ r, i, cx, cy }) => {
              const LW   = NODE_SP - 8;
              const left = cx - LW / 2;
              const hasPhase = showPhase && r.cyclePhase;
              return (
                <div key={`col-${i}`} style={{
                  position: 'absolute', left, top: 0,
                  width: LW, height: CHART_H,
                  pointerEvents: 'none',
                }}>
                  {/* Primary metric above */}
                  <div style={{ position: 'absolute', bottom: CHART_H - cy + NODE_R + 4, left: 0, width: LW, textAlign: 'center' }}>
                    {r.rmssd != null && (
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{r.rmssd}ms</p>
                    )}
                    {(r.rmssd == null || showReadiness) && r.readinessScore != null && (
                      <p style={{ fontSize: 10, color: '#555', margin: r.rmssd != null ? '1px 0 0' : 0 }}>
                        {readinessBand(r.readinessScore)}
                      </p>
                    )}
                  </div>
                  {/* Phase below */}
                  {hasPhase && (
                    <div style={{ position: 'absolute', top: cy + NODE_R + 5, left: 0, width: LW, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: '#555', margin: 0 }}>{HRV_PHASE_SHORT[r.cyclePhase] ?? r.cyclePhase}</p>
                    </div>
                  )}
                  {/* Date — immediately below phase (or node when phase off) */}
                  <div style={{ position: 'absolute', top: cy + NODE_R + (hasPhase ? 21 : 5), left: 0, width: LW, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{fmtDate(r.date)}</p>
                  </div>
                </div>
              );
            })}

            {/* Tooltip on hover */}
            {hov && (
              <div style={{
                position: 'absolute',
                left: Math.max(4, hov.cx - 44),
                top: hov.cy < CHART_H / 2 ? hov.cy + NODE_R + 8 : hov.cy - 82,
                zIndex: 20, pointerEvents: 'none',
              }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2"
              >
                <p className="text-[11px] text-gray-400 font-light">{fmtDate(hov.r.date)}</p>
                {hov.r.rmssd != null && <p className="text-sm text-gray-700 font-light tabular-nums">RMSSD {hov.r.rmssd} ms</p>}
                {hov.r.sdnn != null && <p className="text-[10px] text-gray-500 font-light">SDNN {hov.r.sdnn} ms</p>}
                {hov.r.readinessScore != null && <p className="text-[10px] text-gray-500 font-light">Readiness {readinessBand(hov.r.readinessScore)}</p>}
                {hov.r.cyclePhase && (
                  <p className="text-[10px] text-gray-400 font-light mt-0.5">
                    {HRV_PHASE_FULL[hov.r.cyclePhase] ?? hov.r.cyclePhase}
                    {hov.r.cycleDay ? ` · day ${hov.r.cycleDay}` : ''}
                  </p>
                )}
                {hov.r.practiceName && (
                  <p className="text-[10px] text-gray-500 font-light">{hov.r.practiceName}</p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {real.length === 0 && (
        <div className="mt-4 text-xs text-gray-500 text-center bg-gray-50 rounded-lg p-3 leading-relaxed">
          Your personal rhythm will appear as you log daily training data
        </div>
      )}
    </div>
  );
}

// Signal → gradient background for result cards (matches Zone 3 calendar cells)
const RESULT_GRADIENT = {
  green:  'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200',
  yellow: 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200',
  orange: 'bg-gradient-to-br from-orange-100 to-orange-200 border-orange-200',
  red:    'bg-gradient-to-br from-rose-50 to-red-100 border-rose-200',
};

// ─── Result view ───────────────────────────────────────────────────────────────
function ResultView({ result, onReadAgain }) {
  const { rhythmColour, movementColour, context = {}, rmssd } = result;
  const signalText = rmssd != null ? getRhythmText({ signalContext: context }) : 'No recording received';
  const cycleText = cycleContextSentence(context.cyclePhase, context.cycleDay);
  const crossRef = getMovementReadText({ signalContext: context });

  return (
    <div className="space-y-3">

      {/* Re-read icon — top right */}
      <div className="flex justify-end">
        <button
          onClick={onReadAgain}
          title="Re-read today"
          className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors rounded-full hover:bg-gray-50"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 1 — Your Rhythm */}
      <div className={`rounded-lg p-4 border ${RESULT_GRADIENT[rhythmColour] ?? 'bg-gray-50 border-gray-200'}`} data-movement-read="rhythm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">Your Rhythm</p>
        {rmssd != null && (
          <p className="text-xl font-light text-gray-700 mb-2 tracking-tight text-center">RMSSD {rmssd} ms</p>
        )}
        <p className="text-sm text-gray-700 leading-relaxed text-center">{signalText}</p>
      </div>

      {/* 2 — Cycle Context */}
      {cycleText && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Cycle Context</p>
          <p className="text-sm text-gray-700 leading-relaxed text-center">{cycleText}</p>
        </div>
      )}

      {/* 3 — Cross-reference (signal × cycle phase) */}
      {crossRef && (
        <div className={`rounded-lg p-4 border ${RESULT_GRADIENT[movementColour] ?? 'bg-gray-50 border-gray-200'}`} data-movement-read="experience">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">Movement Read</p>
          <p className="text-sm text-gray-700 leading-relaxed italic text-center">{crossRef}</p>
        </div>
      )}

    </div>
  );
}

// ─── Info modal ────────────────────────────────────────────────────────────────
function Zone1InfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="goe-glass relative rounded-2xl p-6 w-full max-w-lg z-10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-lg font-medium text-gray-700 tracking-wide mb-1">Movement Intelligence</h3>
        <p className="text-xs text-gray-400 font-light mb-4">Training HRV Read</p>
        <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
          {MOVEMENT_INFO["Training HRV Read (i)"].map((paragraph, i) => (
            <div key={i}>{paragraph.map((line, j) => <p key={j}>{line}</p>)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Zone 1 ──────────────────────────────────────────────────────────────
export default function MovementZone1({ result, isLoading, onMorningSubmit, onHrvCapture, initialHrvReading, rhythmStatus, readinessLogged, onReadAgain, submitting, recentLogs, cycleStartDate, cycleLength }) {
  const [hrvReading, setHrvReading] = useState(null);
  const [readinessScore, setReadinessScore] = useState(5);
  const [showModal, setShowModal] = useState(false);


  const handleSubmit = () => {
    onMorningSubmit(hrvReading, readinessScore);
  };

  const readyToSubmit = readinessScore >= 1 && readinessScore <= 10;
  const hasRecordedHrv = hrvReading?.rmssd != null || initialHrvReading?.rmssd != null;

  // ── Shared header ──
  const SectionHeader = () => (
    <div className="mb-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <h4 className="text-lg font-medium text-gray-700 tracking-wide">Training HRV Read</h4>
        <button onClick={() => setShowModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={16} /></button>
      </div>
      <p className="text-sm text-gray-500">{today}</p>
    </div>
  );

  // ── Submitted / result view ──
  if (result) {
    return (
      <div className="goe-glass rounded-xl p-6">
        <SectionHeader />
        <div className="goe-glass-inner rounded-xl p-4 space-y-4">
          <HrvTimeline recentLogs={recentLogs} cycleStartDate={cycleStartDate} cycleLength={cycleLength} />
          <div className="pt-3 border-t border-gray-100">
            <ResultView result={result} onReadAgain={onReadAgain} />
          </div>
        </div>
        {showModal && <Zone1InfoModal onClose={() => setShowModal(false)} />}
      </div>
    );
  }

  // ── Loading — query in flight, don't flash the submission form ──
  if (!result && isLoading) {
    return (
      <div className="goe-glass rounded-xl p-6">
        <SectionHeader />
        <div className="goe-glass-inner rounded-xl p-4 flex items-center justify-center" style={{ minHeight: 80 }}>
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  // ── Form view ──
  return (
    <div className="goe-glass rounded-xl p-6">
      <SectionHeader />

      <div className="goe-glass-inner rounded-xl p-4 space-y-5">
        {/* HRV read */}
        <div>
          <HrvReader compact initialReading={initialHrvReading} onReading={async (reading) => { await onHrvCapture(reading); setHrvReading(reading); }} />
        </div>

        {hasRecordedHrv && rhythmStatus === 'observing' && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-2">
            <span className="text-amber-500 text-sm flex-shrink-0">◎</span>
            <p className="text-xs text-amber-700 leading-snug">Observing: your rhythm is building.</p>
          </div>
        )}

        {/* Readiness gauge */}
        <div className="pt-3 border-t border-gray-100">
          {hasRecordedHrv && !readinessLogged && (
            <p className="mb-3 text-xs text-gray-500 text-center">{READINESS_NOT_LOGGED_TEXT}</p>
          )}
          <ReadinessGauge value={readinessScore} onChange={setReadinessScore} />
        </div>
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!readyToSubmit || submitting}
        className={`w-full mt-4 py-2.5 px-4 rounded-xl font-medium text-sm transition-all shadow-md ${
          readyToSubmit && !submitting
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
        }`}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />Calculating…
          </span>
        ) : 'Submit Training Data'}
      </button>

      {showModal && <Zone1InfoModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
