// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 3 — Calendar: movement log history, dot per day, tap → popup

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X, Info } from 'lucide-react';
import { COLOUR_META, MOVEMENT_INFO, getMovementReadText, getRhythmText } from './movementInsights';

// ─── Info modal ────────────────────────────────────────────────────────────────
function Zone3InfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="goe-glass relative rounded-2xl p-6 w-full max-w-lg z-10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-lg font-medium text-gray-700 tracking-wide mb-4">Movement Archive</h3>
        <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
          {MOVEMENT_INFO["Movement Archive (i)"].map((paragraph, i) => (
            <div key={i}>{paragraph.map((line, j) => <p key={j}>{line}</p>)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['S','M','T','W','T','F','S'];

function buildCalendarDays(year, month) {
  // month: 0-indexed
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function padDate(n) { return String(n).padStart(2, '0'); }

const PHASE_LABEL = {
  menstruation:   'Menstruation',
  follicular:     'Follicular',
  ovulatory:      'Ovulation',
  ovulation:     'Ovulation',
  'early luteal': 'Early Luteal',
  'late luteal':  'Late Luteal',
};

export function DayPopup({ dayData, onClose, calendarQueryKey }) {
  const queryClient = useQueryClient();
  const movementMeta = COLOUR_META[dayData.movementColour];
  const sessionNotesAggregate = (dayData.sessions || [])
    .filter(s => s.notes)
    .map(s => `${s.practiceName}: ${s.notes}`)
    .join('\n');
  const [notesDraft, setNotesDraft] = useState(dayData.notes || sessionNotesAggregate || '');
  const [saveState, setSaveState] = useState('idle');
  const morningReadBg = dayData.rhythmColour
    ? HRV_CELL_BG[dayData.rhythmColour]
    : 'goe-glass-inner border-gray-100';
  const movementReadBg = dayData.movementColour
    ? HRV_CELL_BG[dayData.movementColour]
    : 'goe-glass-inner border-gray-100';

  const formattedDate = new Date(dayData.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await fetch(`/api/movement/log/${dayData.date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      queryClient.invalidateQueries({ queryKey: calendarQueryKey });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
    }
  };

  const popup = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="goe-glass rounded-xl p-6 max-w-lg w-full mx-4 relative max-h-[85vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-foreground mb-2">{formattedDate}</h3>
          <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground">
            {dayData.cycleDay && <span>Cycle Day {dayData.cycleDay}</span>}
            {dayData.cycleDay && dayData.cyclePhase && <span>•</span>}
            {dayData.cyclePhase && (
              <span>{PHASE_LABEL[dayData.cyclePhase] ?? dayData.cyclePhase}</span>
            )}
          </div>
        </div>

        <div className={`${morningReadBg} border rounded-lg p-4 mb-4 text-center`} data-movement-read="rhythm">
          <h4 className="font-semibold text-foreground mb-2">Your Rhythm</h4>
          {(dayData.rmssd != null || dayData.sdnn != null) ? (
            <div className="flex justify-center gap-4 text-sm text-gray-700 flex-wrap">
              {dayData.rmssd != null && <span>RMSSD {dayData.rmssd} ms</span>}
              {dayData.sdnn != null && <span>SDNN {dayData.sdnn} ms</span>}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No recording received</p>
          )}
          {(dayData.rmssd != null || dayData.sdnn != null) && getRhythmText({ signalContext: dayData.signalContext }) && (
            <p className="mt-2 text-sm text-gray-700 leading-relaxed">
              {getRhythmText({ signalContext: dayData.signalContext })}
            </p>
          )}
        </div>

        <div className={`${movementReadBg} border rounded-lg p-4 mb-4 text-center`} data-movement-read="experience">
          <h4 className={`font-semibold text-foreground ${movementMeta ? 'mb-2' : ''}`}>Movement Read</h4>
          {movementMeta && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {getMovementReadText({ signalContext: dayData.signalContext })}
            </p>
          )}
          {!movementMeta && <p className="mt-2 text-sm text-gray-500 italic">No reading recorded</p>}
        </div>

        <div className="mb-4">
          <h4 className="font-semibold text-foreground mb-3 text-center">Movement Recorded</h4>
          {dayData.sessions?.length > 0 ? (
            <div className="space-y-2">
              {dayData.sessions.map((session, idx) => {
                const sigKey = !session.practiceSignal || session.practiceSignal === 'universal'
                  ? dayData.movementColour
                  : session.practiceSignal;
                const bg = sigKey ? PRACTICE_CARD_BG[sigKey] : 'bg-gray-50';
                return (
                  <div key={idx} className={`${bg} rounded-lg py-2 px-3 text-center`}>
                    <p className="text-sm font-medium text-gray-700">{session.practiceName}</p>
                    {session.durationMinutes && (
                      <p className="text-xs text-gray-500 mt-1">{session.durationMinutes} min</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="goe-glass-inner rounded-lg p-4 text-center">
              <span className="text-sm text-gray-500 italic">No movement recorded</span>
            </div>
          )}
        </div>

        <div className="mb-2">
          <h4 className="font-medium text-gray-800 mb-3 text-center">Notes</h4>
          <textarea
            className="w-full bg-gray-50 rounded-lg p-3 text-sm text-gray-700 resize-none min-h-[60px] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300 leading-relaxed"
            placeholder="Add notes for this day…"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="btn-standard text-sm"
            >
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={onClose} className="btn-standard">Close</button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? popup : createPortal(popup, document.body);
}

// practiceSignal → tint for Movement Recorded card in DayPopup
const PRACTICE_CARD_BG = {
  green:  'bg-emerald-50 border-emerald-200',
  yellow: 'bg-amber-50 border-amber-200',
  orange: 'bg-orange-50 border-orange-200',
  red:    'bg-rose-50 border-rose-200',
};

// movementColour (readiness + Rest/Rising) → soft gradient fill for calendar cells
const HRV_CELL_BG = {
  green:  'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200',
  yellow: 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200',
  orange: 'bg-gradient-to-br from-orange-100 to-orange-200 border-orange-200',
  red:    'bg-gradient-to-br from-rose-50 to-red-100 border-rose-200',
};

// practiceSignal → dot colour per session
const PRACTICE_DOT = {
  green:  'bg-emerald-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red:    'bg-rose-500',
};

export default function MovementZone3({ calendarLogs = [], calendarMonth, calendarYear, localDate, onMonthChange, calendarQueryKey }) {
  const [popup, setPopup] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const logs = Array.isArray(calendarLogs) ? calendarLogs : [];
  const today = new Date(`${localDate}T12:00:00Z`);
  const isCurrentMonthView = today.getUTCFullYear() === calendarYear && today.getUTCMonth() === calendarMonth;

  const logMap = {};
  logs.forEach((day) => { logMap[day.date] = day; });

  const days = buildCalendarDays(calendarYear, calendarMonth);
  const isCurrentMonth = isCurrentMonthView;

  const handlePrev = () => {
    if (calendarMonth === 0) onMonthChange(calendarYear - 1, 11);
    else onMonthChange(calendarYear, calendarMonth - 1);
  };

  const handleNext = () => {
    if (calendarMonth === 11) onMonthChange(calendarYear + 1, 0);
    else onMonthChange(calendarYear, calendarMonth + 1);
  };

  const handleDayClick = (dayNum) => {
    if (!dayNum) return;
    const dateStr = `${calendarYear}-${padDate(calendarMonth + 1)}-${padDate(dayNum)}`;
    const dayData = logMap[dateStr];
    if (dayData) setPopup(dayData);
  };

  return (
    <div className="goe-glass rounded-xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2">
          <h4 className="text-lg font-medium text-gray-700 tracking-wide text-center">Movement Archive</h4>
          <button onClick={() => setShowModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={16} /></button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={handlePrev} className="p-2 rounded-full hover:bg-gray-50 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h3 className="font-medium text-gray-800 text-base tracking-wide">
          {MONTH_NAMES[calendarMonth]} {calendarYear}
        </h3>
        <button onClick={handleNext} className="p-2 rounded-full hover:bg-gray-50 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 md:gap-3 mb-2">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium">{d}</div>
        ))}
      </div>

      {/* Calendar grid — matches Cyclical calendar cell height for consistency */}
      <div className="grid grid-cols-7 gap-2 md:gap-3 auto-rows-[minmax(5.5rem,_1fr)] md:auto-rows-[minmax(6.5rem,_1fr)]">
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;

          const dateStr = `${calendarYear}-${padDate(calendarMonth + 1)}-${padDate(day)}`;
          const dayData = logMap[dateStr];
          const isToday = isCurrentMonth && today.getUTCDate() === day;
          const cellBg = dayData?.movementColour ? HRV_CELL_BG[dayData.movementColour] : null;
          const hasSessions = dayData?.sessions?.length > 0;

          return (
            <div
              key={i}
              onClick={() => handleDayClick(day)}
              className={`rounded border transition-colors flex flex-col items-center justify-center gap-1 ${
                dayData ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              } ${
                isToday && !cellBg
                  ? 'ring-2 ring-gray-300 border-gray-200 bg-white'
                  : cellBg
                  ? cellBg
                  : 'bg-white border-gray-100'
              }`}
            >
              <span className={`text-sm font-medium leading-none ${
                dayData?.movementColour === 'green' ? 'text-emerald-700' :
                dayData?.movementColour === 'yellow' ? 'text-amber-700' :
                dayData?.movementColour === 'orange' ? 'text-orange-700' :
                dayData?.movementColour === 'red' ? 'text-rose-700' :
                (dayData?.movementColour || hasSessions) ? 'text-gray-500' :
                isToday ? 'text-gray-600' : 'text-gray-400'
              }`}>{day}</span>
              {hasSessions && (
                <div className="flex flex-wrap justify-center gap-0.5 max-w-[32px]">
                  {dayData.sessions.map((s, idx) => {
                    const dotSig = !s.practiceSignal || s.practiceSignal === 'universal'
                      ? dayData.movementColour
                      : s.practiceSignal;
                    return <div key={idx} data-movement-session={idx} className={`w-1.5 h-1.5 rounded-full ${PRACTICE_DOT[dotSig] ?? 'bg-gray-400'}`} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {popup && <DayPopup dayData={popup} onClose={() => setPopup(null)} calendarQueryKey={calendarQueryKey} />}
      {showModal && <Zone3InfoModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
