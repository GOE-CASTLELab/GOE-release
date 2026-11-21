// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useCycleData } from '@/hooks/useCycleData';
import { calculateCycleInfo, calculateMoonCenter, parseLocalDate, cyclePhaseForDay, wrappedCycleDay, isFertileDay } from '@/utils/cycleCalculations';
import { moonCentresEnabled } from '@/lib/moonCentres';
import CyclicalHeader from './CyclicalHeader';
import CyclicalZone1 from './CyclicalZone1';
import GOE88ChatButton from '@/components/GOE88ChatButton';

const SIGNAL_PILL = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-700',
  red:    'bg-rose-100 text-rose-800',
};
const SIGNAL_LABEL = {
  green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red',
};

const CyclicalIntelligenceCard = () => {
  const { cycleData, moonPattern, recordCycleAction, extendCycle } = useCycleData();

  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState(new Date().getFullYear());
  const [showCoreModulesModal, setShowCoreModulesModal] = useState(false);
  const [showCycleInfoModal, setShowCycleInfoModal] = useState(false);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [selectedDaySnapshot, setSelectedDayInfo] = useState(null);
  const selectedDayInfo = selectedDaySnapshot ? { ...selectedDaySnapshot,
    moonCenter: calculateMoonCenter(selectedDaySnapshot.date, moonPattern) } : null;
  const [calendarPickerMode, setCalendarPickerMode] = useState(null);
  const [selectedPickerDate, setSelectedPickerDate] = useState(null);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [showConfirmation, setShowConfirmation] = useState(false);


  const { data: movementCalendar } = useQuery({
    queryKey: ['/api/movement/calendar', currentCalendarYear, currentCalendarMonth + 1],
    queryFn: () =>
      fetch(`/api/movement/calendar?year=${currentCalendarYear}&month=${currentCalendarMonth + 1}`, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    staleTime: Infinity,
  });

  const movementLogMap = useMemo(() => {
    const map = {};
    (Array.isArray(movementCalendar) ? movementCalendar : []).forEach(log => { if (log.date) map[log.date] = log; });
    return map;
  }, [movementCalendar]);

  const periodStarted = (date) => {
    recordCycleAction('period_started', date);
    closeCalendarPicker();
  };

  const periodEnded = (date) => {
    recordCycleAction('period_ended', date);
    closeCalendarPicker();
  };

  const openCalendarPicker = (mode) => {
    setCalendarPickerMode(mode);
    setSelectedPickerDate(null);
    setShowConfirmation(false);
    setPickerMonth(new Date().getMonth());
    setPickerYear(new Date().getFullYear());
  };

  const closeCalendarPicker = () => {
    setCalendarPickerMode(null);
    setSelectedPickerDate(null);
    setShowConfirmation(false);
  };

  const handlePickerDateSelect = (date) => {
    setSelectedPickerDate(date);
    setShowConfirmation(true);
  };

  const confirmDateSelection = () => {
    if (!selectedPickerDate) return;
    const year = selectedPickerDate.getFullYear();
    const month = String(selectedPickerDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedPickerDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    if (calendarPickerMode === 'start') periodStarted(dateStr);
    else if (calendarPickerMode === 'end') periodEnded(dateStr);
  };

  const generatePickerCalendarDays = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < startingDayOfWeek; i++) days.push({ date: null, day: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(pickerYear, pickerMonth, day);
      days.push({
        date: currentDate,
        day,
        isToday: currentDate.toDateString() === today.toDateString(),
        isFuture: currentDate > today,
        isSelected: selectedPickerDate && currentDate.toDateString() === selectedPickerDate.toDateString()
      });
    }
    return days;
  };


  const findCycleStartForDate = (date) => {
    if (!cycleData.periodData || !Array.isArray(cycleData.periodData) || cycleData.periodData.length === 0) {
      const start = cycleData.cycleStartDate ? parseLocalDate(cycleData.cycleStartDate) : null;
      return { cycleStart: start, hasNextPeriod: false };
    }
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const sortedStarts = cycleData.periodData
      .filter(p => p.startDate)
      .map(p => parseLocalDate(p.startDate))
      .sort((a, b) => a - b);
    for (let i = sortedStarts.length - 1; i >= 0; i--) {
      const cycleStart = sortedStarts[i];
      if (checkDate >= cycleStart) {
        return { cycleStart, hasNextPeriod: i < sortedStarts.length - 1 };
      }
    }
    return { cycleStart: null, hasNextPeriod: false };
  };

  const isHistoricalPeriodDay = (date) => {
    if (!cycleData.periodData || !Array.isArray(cycleData.periodData)) return false;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    for (const period of cycleData.periodData) {
      if (!period.startDate) continue;
      const periodStart = parseLocalDate(period.startDate);
      const periodEnd = period.endDate
        ? parseLocalDate(period.endDate)
        : new Date(periodStart.getTime() + (4 * 24 * 60 * 60 * 1000));
      periodEnd.setHours(23, 59, 59, 999);
      if (checkDate >= periodStart && checkDate <= periodEnd) return true;
    }
    return false;
  };

  const generateCalendarDays = (monthOffset = new Date().getMonth(), yearOffset = new Date().getFullYear()) => {
    const targetDate = new Date(yearOffset, monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    const today = new Date();
    const effectiveCycleLength = cycleData.cycleLength || 28;

    for (let i = 0; i < startingDayOfWeek; i++) days.push({ date: null, day: null });

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const { cycleStart, hasNextPeriod } = findCycleStartForDate(currentDate);
      let cycleInfo = calculateCycleInfo(currentDate, cycleStart, effectiveCycleLength);

      if (!hasNextPeriod && cycleInfo.day !== null && cycleInfo.day > effectiveCycleLength) {
        // Wrap past-cycle days and re-read phase from the single owner
        // (@shared/cycleCore, re-exported via @/utils/cycleCalculations).
        const wrappedDay = wrappedCycleDay(cycleInfo.day, effectiveCycleLength);
        const phase = cyclePhaseForDay(wrappedDay, effectiveCycleLength);
        cycleInfo = { day: wrappedDay, phase, isFertile: isFertileDay(wrappedDay, effectiveCycleLength) };
      }

      const moonCenter = calculateMoonCenter(currentDate, moonPattern);
      const isHistoricalPeriod = isHistoricalPeriodDay(currentDate);

      days.push({
        date: currentDate,
        day,
        cycleInfo,
        moonCenter,
        isToday: currentDate.toDateString() === today.toDateString(),
        isHistoricalPeriod
      });
    }

    return { days, monthName: targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  };

  const getPhaseGuidance = (phase) => {
    switch (phase) {
      case "Menstruation":
        return {
          guidance: "Deep rest and release. Honor your body's cleansing work.",
          support: "Warmth, gentle movement, iron-rich foods, warm baths, journaling"
        };
      case "Follicular":
        return {
          guidance: "Fresh energy building. Time for new projects and creative beginnings.",
          support: "Light exercise, planning new goals, fresh foods, vitamin D, morning sunlight"
        };
      case "Ovulatory":
        return {
          guidance: "Peak vitality and social energy. Your natural magnetism is highest.",
          support: "Social activities, important conversations, high-intensity workouts, presentation of ideas"
        };
      case "Early Luteal":
        return {
          guidance: "Energy turning inward. Consolidate and complete what you began.",
          support: "Steady routines, finishing projects, magnesium, protein, boundary setting"
        };
      case "Late Luteal":
        return {
          guidance: "Inner wisdom emerging. Process and integrate. Trust what arises.",
          support: "Reflection, deep rest, magnesium, calming activities, releasing what's done"
        };
      default:
        return {
          guidance: "Listen to your body's natural rhythms.",
          support: "Mindful awareness, gentle self-care"
        };
    }
  };

  const handleDayClick = (dayInfo) => {
    if (dayInfo.date && dayInfo.cycleInfo.day) {
      setSelectedDayInfo(dayInfo);
      setShowDayDetailModal(true);
    }
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case "Menstruation": return "bg-gradient-to-br from-rose-50 to-pink-100 border-red-800 border-opacity-30 text-red-900";
      case "Follicular": return "bg-gradient-to-br from-green-50 to-emerald-100 border-green-700 border-opacity-30 text-green-900";
      case "Ovulatory": return "bg-gradient-to-br from-amber-50 to-orange-100 border-amber-600 border-opacity-30 text-amber-900";
      case "Early Luteal": return "bg-gradient-to-br from-purple-50 to-violet-100 border-purple-800 border-opacity-30 text-purple-900";
      case "Late Luteal": return "bg-gradient-to-br from-purple-50 to-violet-100 border-purple-800 border-opacity-30 text-purple-900";
      default: return "bg-white border-gray-200 text-gray-600";
    }
  };

  const { days, monthName } = generateCalendarDays(currentCalendarMonth, currentCalendarYear);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl isolate">
      <div className="w-full h-full flex flex-col gap-4">

        {/* Calendar Picker Modal */}
        {calendarPickerMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeCalendarPicker}>
            <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={closeCalendarPicker} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {calendarPickerMode === 'start' ? 'Period Started' : 'Period Ended'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {calendarPickerMode === 'start' ? 'Select the date your period started' : 'Select the date your period ended'}
              </p>
              {showConfirmation && selectedPickerDate ? (
                <div className="text-center">
                  <p className="text-lg mb-4">
                    {calendarPickerMode === 'start' ? 'Start period on' : 'End period on'}{' '}
                    <span className="font-semibold">
                      {selectedPickerDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>?
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setShowConfirmation(false)} className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Back</button>
                    <button onClick={confirmDateSelection} className={`px-6 py-2 rounded-lg text-white ${calendarPickerMode === 'start' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-green-500 hover:bg-green-600'}`}>Confirm</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(pickerYear - 1); } else setPickerMonth(pickerMonth - 1); }} className="p-2 hover:bg-gray-100 rounded-full">
                      ‹
                    </button>
                    <span className="font-medium">
                      {new Date(pickerYear, pickerMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(pickerYear + 1); } else setPickerMonth(pickerMonth + 1); }} className="p-2 hover:bg-gray-100 rounded-full">
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {generatePickerCalendarDays().map((dayInfo, i) => (
                      <button
                        key={i}
                        disabled={!dayInfo.date || dayInfo.isFuture}
                        onClick={() => dayInfo.date && !dayInfo.isFuture && handlePickerDateSelect(dayInfo.date)}
                        className={`aspect-square rounded-lg text-sm font-medium transition-colors ${!dayInfo.date ? 'invisible' : ''} ${dayInfo.isFuture ? 'text-gray-300 cursor-not-allowed' : calendarPickerMode === 'start' ? 'hover:bg-rose-100 cursor-pointer' : 'hover:bg-green-100 cursor-pointer'} ${dayInfo.isToday ? 'ring-2 ring-gray-400' : ''} ${dayInfo.isSelected ? calendarPickerMode === 'start' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-green-500 text-white hover:bg-green-600' : ''}`}
                      >
                        {dayInfo.day}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Core Modules Info Modal */}
        {showCoreModulesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowCoreModulesModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCoreModulesModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h3 className="text-lg font-medium text-gray-700 mb-4 text-left">Custom Intelligence Training</h3>
              <p className="text-sm text-gray-700 leading-relaxed text-left">
                We train custom EP, MM, and GAIA models specifically on your content library, teaching methodology, and communication style. Hume captures your emotional approach while LLM fine-tuning ensures responses match your expertise and voice, not generic AI.
              </p>
            </div>
          </div>
        )}

        {/* Day Detail Modal */}
        {showDayDetailModal && selectedDayInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowDayDetailModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-lg w-full mx-4 relative max-h-[85vh] overflow-y-auto">
              <button onClick={() => setShowDayDetailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"><X size={20} /></button>
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {selectedDayInfo.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
                  <span>Cycle Day {selectedDayInfo.cycleInfo.day}</span>
                  <span>•</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getPhaseColor(selectedDayInfo.cycleInfo.phase).replace('bg-opacity-20', 'bg-opacity-40')}`}>
                    {selectedDayInfo.cycleInfo.phase}
                  </span>
                  {selectedDayInfo.cycleInfo.isFertile && (
                    <><span>•</span><span className="text-amber-600 text-xs">Fertile Window</span></>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold text-foreground mb-3 text-center">Cycle Phase Support</h4>
                <div className="goe-glass-inner rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {getPhaseGuidance(selectedDayInfo.cycleInfo.phase).guidance}
                  </p>
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground/80 mb-2">What's Supportive:</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getPhaseGuidance(selectedDayInfo.cycleInfo.phase).support}
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                const d = selectedDayInfo.date;
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const selectedMovement = movementLogMap[dateStr];
                return (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-800 mb-3 text-center">Movement Signal</h4>
                    <div className="goe-glass-inner rounded-lg p-4 text-center">
                      {selectedMovement?.movementColour ? (
                        <>
                          <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium mb-2 ${SIGNAL_PILL[selectedMovement.movementColour]}`}>
                            {SIGNAL_LABEL[selectedMovement.movementColour]} signal
                          </span>
                        </>
                      ) : (
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('goe-navigate-card', { detail: { index: 2 } }))}
                          className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)' }}
                        >
                          Ground down — log today's read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {selectedDayInfo.moonCenter.details && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3 text-center">Kundalini Moon Centre: {selectedDayInfo.moonCenter.details.name}</h4>
                  <div className="bg-purple-50 rounded-lg p-4 space-y-3 text-center">
                    <div>
                      <h5 className="text-xs font-medium text-purple-800 mb-1">Location & Theme</h5>
                      <p className="text-sm text-purple-700">{selectedDayInfo.moonCenter.details.location} · {selectedDayInfo.moonCenter.details.theme}</p>
                    </div>
                    <div>
                      <h5 className="text-xs font-medium text-purple-800 mb-1">Neuro-Emotional Parallel</h5>
                      <p className="text-xs text-purple-700 leading-relaxed">
                        <strong>{selectedDayInfo.moonCenter.details.neuroEmotional}:</strong> {selectedDayInfo.moonCenter.details.insight}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-xs font-medium text-purple-800 mb-1">Focus</h5>
                      <p className="text-sm text-purple-700 font-medium">{selectedDayInfo.moonCenter.details.focus}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedDayInfo.moonCenter.details && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3 text-center">Practice for Today</h4>
                  <div className="goe-glass-inner rounded-lg p-4 text-center">
                    <span className="text-sm text-gray-700">{selectedDayInfo.moonCenter.details.kriya}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button onClick={() => setShowDayDetailModal(false)} className="btn-standard">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Cycle Info Modal */}
        {showCycleInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowCycleInfoModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-lg w-full mx-4 relative max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCycleInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h3 className="text-lg font-medium text-gray-700 tracking-wide mb-4">Cyclical Calendar</h3>
              <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Cycle Phases</h4>
                  <div className="space-y-3">
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1">Menstruation</h5>
                      <p>Deep rest and release. Your body is doing major cleansing work. Ancient traditions honored this as a time when intuition is strongest and the inner voice clearest. Ayurveda: Vata rises, requiring warmth and grounding.</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1">Follicular</h5>
                      <p>Fresh energy building. Your body is regenerating and growing new tissue. This is naturally a time for new projects and creative beginnings. Ayurveda: Kapha builds, supporting regeneration.</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1">Ovulation</h5>
                      <p>Peak vitality and social energy. Your body's fire energy is highest. You're naturally more magnetic and outward-focused during this time. Ayurveda: Pitta peaks, bringing fire and clarity.</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1">Luteal</h5>
                      <p>Inner wisdom emerging. Your body is processing and integrating. Sensitivity increases as you prepare for the next cycle. Trust what arises. Ayurveda: Vata begins to rise, bringing sensitivity and deeper perception.</p>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-2">Fertility Window</h4>
                  <p className="mb-2">Approximately 5–6 days around ovulation, based on the period start and usual cycle length you entered. Marked with a gold corner tab.</p>
                  <div className="space-y-1">
                    <p><span className="font-medium">High fertility:</span> 4 days before ovulation — optimal timing for conception</p>
                    <p><span className="font-medium">Peak fertility:</span> Ovulation day — highest chance of conception</p>
                    <p><span className="font-medium">Low fertility:</span> 1 day after ovulation — egg may still be viable</p>
                  </div>
                </div>
                {moonCentresEnabled && <div className="pt-2 border-t border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-2">Kundalini Moon Centres</h4>
                  <p>Energetic points that shift every 2.5 days, mirroring the Moon's path through the zodiac. Each center influences focus and energy — from communication and sexuality to intuition. Part of ancient traditions that map women's unique rhythms to lunar cycles, recognizing the Moon as women's most embodied clock.</p>
                </div>}
              </div>
            </div>
          </div>
        )}

        <CyclicalHeader onCoreModulesInfo={() => setShowCoreModulesModal(true)} />

        <CyclicalZone1
          currentCalendarMonth={currentCalendarMonth}
          setCurrentCalendarMonth={setCurrentCalendarMonth}
          currentCalendarYear={currentCalendarYear}
          setCurrentCalendarYear={setCurrentCalendarYear}
          monthName={monthName}
          days={days}
          openCalendarPicker={openCalendarPicker}
          extendCycle={extendCycle}
          setShowCycleInfoModal={setShowCycleInfoModal}
          handleDayClick={handleDayClick}
          getPhaseColor={getPhaseColor}
        />

        <GOE88ChatButton gradient="from-pink-400 to-rose-600" cardType="menstrual" />

      </div>
    </div>
  );
};

export default CyclicalIntelligenceCard;
