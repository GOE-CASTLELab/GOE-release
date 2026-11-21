// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 2 — Practice Layer: movement type, duration, notes → logged entry

import { useState, useRef, useEffect } from 'react';
import { Loader2, ChevronDown, Info, Minus, Plus, X } from 'lucide-react';
import { COLOUR_META, MOVEMENT_INFO } from './movementInsights';

export const DURATION_OPTIONS = [10, 20, 30, 45, 60, 75, 90, 105, 120];

// ─── Flat practice list with group signal ──────────────────────────────────────
// signal: null = universal practice; inherits today's Movement Read colour
export const ALL_PRACTICES = [
  { name: 'Strength Training',           group: 'green'  },
  { name: 'Pilates Full Body',           group: 'green'  },
  { name: 'Pilates Flow',                group: 'yellow' },
  { name: 'Functional Exercises',        group: 'yellow' },
  { name: 'Core and Stability',          group: 'orange' },
  { name: 'Facial Release',              group: 'orange' },
  { name: 'Yin Yoga',                    group: 'red'    },
  { name: 'Breath-led Somatic Movement', group: 'red'    },
  { name: 'Walk',                        group: null     },
  { name: 'Dance',                       group: null     },
  { name: 'Abhyanga',                    group: null     },
  { name: 'Mobility',                    group: null     },
  { name: 'Riding Ground',               group: null     },
  { name: 'In-Saddle Ride',              group: null     },
];

// Pill colours — default (always visible) and selected (highlighted)
export const PILL_DEFAULT = {
  green:  'bg-emerald-50  text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  yellow: 'bg-amber-50   text-amber-700   border-amber-200   hover:bg-amber-100',
  orange: 'bg-orange-100 text-orange-700  border-orange-300  hover:bg-orange-200',
  red:    'bg-rose-50    text-rose-700    border-rose-200    hover:bg-rose-100',
  none:   'bg-gray-50    text-gray-600    border-gray-200',
};
const PILL_SELECTED = {
  green:  'bg-emerald-100 text-emerald-800 border-emerald-400 ring-1 ring-emerald-300',
  yellow: 'bg-amber-100   text-amber-800   border-amber-400   ring-1 ring-amber-300',
  orange: 'bg-orange-100  text-orange-800  border-orange-400  ring-1 ring-orange-300',
  red:    'bg-rose-100    text-rose-800    border-rose-400    ring-1 ring-rose-300',
  none:   'bg-gray-100    text-gray-800    border-gray-400    ring-1 ring-gray-300',
};
// Hover colours revealed on gray (none) pills — each practice shows its category colour on hover
const PILL_GREY_HOVER = {
  green:     'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200',
  yellow:    'hover:bg-amber-50   hover:text-amber-700   hover:border-amber-200',
  orange:    'hover:bg-orange-100 hover:text-orange-700  hover:border-orange-300',
  red:       'hover:bg-rose-50    hover:text-rose-700    hover:border-rose-200',
};

// ─── Custom dropdown ───────────────────────────────────────────────────────────
export function DurationDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="w-full p-4 bg-white border border-gray-200 rounded-xl text-left tracking-wide transition-all hover:border-gray-300 focus:outline-none shadow-sm flex items-center justify-between">
        <span className="text-sm text-gray-700">{value} min</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {DURATION_OPTIONS.map((d) => (
            <button key={d} onClick={() => { onChange(d); setOpen(false); }}
              className={`w-full px-4 py-3 text-left text-sm tracking-wide hover:bg-gray-50 transition-colors ${
                value === d ? 'bg-gray-50 text-gray-700 font-medium' : 'text-gray-700'
              }`}>
              {d} min
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compact duration stepper — Rest/Rising popup treatment ──────────────────
export function DurationStepper({ value, onChange }) {
  const currentIndex = Math.max(0, DURATION_OPTIONS.indexOf(value));
  const adjust = (direction) => {
    const nextIndex = direction === 'up'
      ? Math.min(currentIndex + 1, DURATION_OPTIONS.length - 1)
      : Math.max(currentIndex - 1, 0);
    onChange(DURATION_OPTIONS[nextIndex]);
  };

  return (
    <div
      className="rounded-xl border px-2 py-1.5 shadow-none"
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderColor: 'rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <button type="button" onClick={() => adjust('up')} className="btn-icon h-7 w-7" aria-label="Increase duration">
          <Plus size={12} />
        </button>
        <div className="flex min-w-14 items-baseline justify-center gap-1 text-foreground">
          <span className="text-base font-normal">{value}</span>
          <span className="text-xs text-gray-700">min</span>
        </div>
        <button type="button" onClick={() => adjust('down')} className="btn-icon h-7 w-7" aria-label="Decrease duration">
          <Minus size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Info modal ────────────────────────────────────────────────────────────────
function Zone2InfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="goe-glass relative rounded-2xl p-6 w-full max-w-lg z-10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-lg font-medium text-gray-700 tracking-wide mb-4">Movement Library</h3>
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          {MOVEMENT_INFO["Movement Library (i)"].map((paragraph, i) => (
            <div key={i}>{paragraph.map((line, j) => <p key={j}>{line}</p>)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Zone 2 ───────────────────────────────────────────────────────────────
export default function MovementZone2({ movementColour, onWorkoutSubmit, submitting, todaySessionCount = 0 }) {
  const [practiceName, setPracticeName] = useState('');
  const [duration, setDuration] = useState(20);
  const [notes, setNotes] = useState('');
  const [showModal, setShowModal] = useState(false);

  const handleSelect = (p) => { setPracticeName(p); };

  const handleSubmit = async () => {
    if (!practiceName || !duration) return;
    const selectedPractice = ALL_PRACTICES.find(p => p.name === practiceName);
    const practiceSignal = selectedPractice?.group ?? movementColour ?? null;
    await onWorkoutSubmit(practiceName, duration, notes, practiceSignal);
    setPracticeName('');
    setDuration(20);
    setNotes('');
  };

  // Resolve the effective display signal for a practice pill:
  // — Universal practices (group: null) follow today's Movement Read colour
  // — Signal-matching group gets its colour
  // — Everything else is gray
  const todaySignal = (movementColour) ? movementColour : null;
  const resolveSignal = (group) => {
    if (group === null) return todaySignal ?? 'none';
    if (group === todaySignal) return group;
    return 'none';
  };

  return (
    <div className="goe-glass rounded-xl p-6">

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h4 className="text-lg font-medium text-gray-700 tracking-wide text-center">Movement Library</h4>
          <button onClick={() => setShowModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={16} /></button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {movementColour && COLOUR_META[movementColour] && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${COLOUR_META[movementColour].pill}`}>
              {COLOUR_META[movementColour].label} Movement Read
            </span>
          )}
          {todaySessionCount > 0 && (
            <span className="text-xs text-orange-600">
              {todaySessionCount} {todaySessionCount === 1 ? 'session' : 'sessions'} logged today
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">

        {/* Practice selection — flat coloured pills, spread across container */}
        <div className="goe-glass-inner rounded-xl p-4">
          <div className="flex flex-wrap justify-around gap-x-3 gap-y-2">
            {ALL_PRACTICES.map(({ name, group }) => {
              const sig = resolveSignal(group);
              const isSelected = practiceName === name;
              return (
                <button key={name} onClick={() => handleSelect(name)}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                    isSelected ? PILL_SELECTED[sig] :
                    sig === 'none' ? `${PILL_DEFAULT.none} ${group ? PILL_GREY_HOVER[group] : ''}` :
                    PILL_DEFAULT[sig]
                  }`}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-sm text-gray-700 mb-3 block tracking-wide">Duration</label>
          <DurationDropdown value={duration} onChange={setDuration} />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-gray-700 mb-3 block tracking-wide">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="How the body felt — before, during, after. Anything worth noticing."
            rows={3}
            className="w-full text-sm px-4 py-3 border border-gray-200 rounded-xl resize-none placeholder:text-gray-300 text-gray-700 focus:outline-none focus:border-amber-300 font-light leading-relaxed" />
        </div>

        {/* Log */}
        <button onClick={handleSubmit} disabled={!practiceName || !duration || submitting}
          className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all shadow-md ${
            practiceName && duration && !submitting
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
          }`}>
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={13} className="animate-spin" />Saving…
            </span>
          ) : 'Log Movement'}
        </button>
      </div>

      {showModal && <Zone2InfoModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
