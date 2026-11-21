import { useMoonPattern } from '@/hooks/useMoonPattern';
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { publishCycleData } from "@/lib/cycleClientState";
import { X, MessageCircle, ChevronDown, RotateCcw } from "lucide-react";
import { moonCenters } from "@/utils/cycleCalculations";
import { moonCentresEnabled } from '@/lib/moonCentres';
import { getMoonPhase, getDaysToNextPhase } from "@/lib/moonPhase";
import { useAuth } from '@/hooks/useAuth';
import { useLocalDate, mondayOfLocalWeek } from '@/hooks/useLocalDate';
import { TimePickerClock } from './RestIntelligenceCard/RestZone2';
import { classifyRestField } from './RestIntelligenceCard/restCalculations';
import { ReadinessGauge } from './MovementIntelligenceCard/MovementShared';
import { COLOUR_META, getMovementReadText, getRhythmText } from './MovementIntelligenceCard/movementInsights';
import HrvReader from './HrvReader';
import { hrvReadingFromLog } from '@/lib/hrv/sources';
import { ALL_PRACTICES, DurationStepper } from './MovementIntelligenceCard/MovementZone2';
import GOE88ChatPanel from './GOE88ChatPanel';
import GOE88ModalShell from './GOE88ModalShell';
import { calculateCycleInfo, cyclePhaseForDay, parseLocalDate } from "@shared/cycleCore";
import { formatLocalTime, timeToHHMM } from "@shared/restRisingCore";

const isChatEnabled = import.meta.env.VITE_CHAT_ENABLED === 'true';

const GOE88_DISABLED_COPY = [
  'GOE88 Chat is one conversation that moves across your GOE cards, carrying the context of your body, patterns and life. It combines what your data shows over time with what you bring into the conversation now.',
  'Your intelligence leads; the technology exists to support you in living more creatively.',
];

const localDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const displayDate = (dateString) => new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const latestSubmission = (submissions, predicate) => [...(Array.isArray(submissions) ? submissions : [])]
  .filter(predicate)
  .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0] || null;

// Older Rest card submissions were sent with `type`, which the insert schema
// strips. Use the recorded fields as a compatibility fallback so those entries
// still appear in the home popup.
const isRisingSubmission = (submission) => Boolean(submission && (
  submission.submissionType === 'rise' ||
  submission.riseTime != null ||
  submission.sleepProcess != null ||
  submission.wakingState != null ||
  submission.nightWakings != null ||
  submission.nightSweats != null
));

const isRestSubmission = (submission) => Boolean(submission && (
  submission.submissionType === 'rest' ||
  submission.restTime != null ||
  submission.energyAssessment != null ||
  submission.alcoholConsumed != null
));

const PopupDropdown = ({ value, onChange, options, placeholder, upward = false, getOptionColor, getOptionBg, showChevron = false }) => {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const ref = useRef(null);
  // On phones the pop-up panel scrolls (max-h + overflow), which clips any
  // absolutely-positioned list at the panel edge. Render the open list
  // in-flow there so the panel grows and scrolls instead of clipping.
  const inFlowList = typeof window !== 'undefined' && window.innerWidth < 768;
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
    };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="w-full px-3 py-2.5 rounded-xl text-left text-sm tracking-wide transition-all focus:outline-none flex items-center"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)', color: value ? '#111827' : '#9ca3af' }}>
        <span className="flex-1 truncate">{value || placeholder}</span>
        {showChevron && (
          <ChevronDown size={18} className={`flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#374151' }} />
        )}
      </button>
      {open && (
        <div className={`${inFlowList ? 'relative mt-1' : `absolute z-50 ${upward ? 'bottom-full mb-1' : 'mt-1'}`} w-full rounded-xl overflow-hidden overflow-y-auto shadow-lg`}
          style={{ maxHeight: 168, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px) saturate(1.8)', border: '1px solid rgba(255,255,255,0.4)' }}>
          {options.map((opt, i) => (
            <button key={i} onClick={() => { onChange(opt); setOpen(false); }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="w-full px-3 py-2.5 text-left text-sm tracking-wide transition-colors flex items-center gap-2"
              style={{
                color: '#111827',
                fontWeight: value === opt ? 600 : 400,
                // Phones: colour tint always visible (no hover on touch).
                // Desktop: colour revealed on hover only — the intended scroll-over effect.
                background: getOptionBg
                  ? (inFlowList || hoveredIdx === i ? getOptionBg(opt) : 'transparent')
                  : (hoveredIdx === i ? 'rgba(0,0,0,0.05)' : 'transparent'),
              }}>
              {getOptionColor && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getOptionColor(opt) }} />
              )}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TEASER_LIMIT = 90;

const CARDS = [
  {
    id: "cyclical", name: "Cyclical", img: "/images/Cyclical.webp",
    btnGradient: "linear-gradient(135deg, #f472b6, #f43f5e)",
    brief: [
      { label: "Day", value: "—" },
      { label: "Phase", value: "—" },
      ...(moonCentresEnabled ? [{ label: "Moon Centre", value: "—" }] : []),
    ],
    note: "Peak creative and social window.",
  },
  {
    id: "rest", name: "Rest & Restore", img: "/images/RR.webp",
    btnGradient: "linear-gradient(135deg, #818cf8, #4f46e5)",
    brief: [
      { label: "Moon Phase", value: "—" },
      { label: "Avg Sleep", value: "—" },
      { label: "NS State", value: "—" },
    ],
    note: "Nervous system stable. Trend positive.",
  },
  {
    id: "movement", name: "Movement", img: "/images/Movement.webp",
    btnGradient: "linear-gradient(135deg, #fbbf24, #f97316)",
    brief: [
      { label: "Today's Signal", value: "—" },
      { label: "HRV", value: "—" },
      { label: "Last Practice", value: "—" },
    ],
    note: "Record morning HRV for full signal.",
    hrvConnect: true,
  },
  {
    id: "astrology", name: "Astrology", img: "/images/Astrology.webp", screen: true,
    btnGradient: "linear-gradient(135deg, #a78bfa, #9333ea)",
    brief: [
      { label: "Weekly Theme", value: "—" },
      { label: "Key Date", value: "—" },
    ],
    note: "Structures you value are being refined.",
  },
];

const glassPanel = {
  background: "rgba(255,255,255,0.22)",
  backdropFilter: "blur(28px) saturate(2) brightness(1.08)",
  WebkitBackdropFilter: "blur(28px) saturate(2) brightness(1.08)",
  boxShadow: "0 8px 40px rgba(0,0,0,0.22), inset 0 1.5px 0 rgba(255,255,255,0.75)",
};
// Shared mobile panel token — both pop-up panels (card + GOE88) use the same
// more-opaque glass on phones, where the bright meadow background washes out
// the base 0.22 fill. Desktop keeps glassPanel unchanged.
const glassPanelMobile = { ...glassPanel, background: "rgba(255,255,255,0.55)" };

export default function OrbHomeScreen({ onOpenCard }) {
  const { currentMoonCenter } = useMoonPattern();
  const { user } = useAuth();
  const userTimezone = user?.profile?.timezone || 'America/Edmonton';
  const [active, setActive] = useState(null);
  const localDate = useLocalDate(userTimezone, active?.id);
  const astrologyDate = localDate;
  const astrologyWeekKey = mondayOfLocalWeek(astrologyDate);
  const [showGOE88, setShowGOE88] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Popup action state
  const [readinessScore, setReadinessScore] = useState(null);
  const [readinessSubmitting, setReadinessSubmitting] = useState(false);
  const [readinessLogged, setReadinessLogged] = useState(false);
  // Rest popup tabs (time-aware)
  const [restPopupTab, setRestPopupTab] = useState(() => {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? 'rising' : 'rest';
  });
  const [risingLog, setRisingLog] = useState({ riseTime: '07:15', sleepProcess: null, wakingState: null, nightWakings: null, nightSweats: null });
  const [risingSubmitting, setRisingSubmitting] = useState(false);
  const [risingLogged, setRisingLogged] = useState(false);
  const [restEveningLog, setRestEveningLog] = useState({ restTime: '22:30', energyAssessment: null, alcoholConsumed: false });
  const [restEveningSubmitting, setRestEveningSubmitting] = useState(false);
  const [restEveningLogged, setRestEveningLogged] = useState(false);
  const [cycleActionLoading, setCycleActionLoading] = useState(false);
  const [cycleActionDone, setCycleActionDone] = useState(null);
  const [movementPractice, setMovementPractice] = useState(null);
  const [movementDuration, setMovementDuration] = useState(20);
  const [movementLogging, setMovementLogging] = useState(false);
  const [movementLogged, setMovementLogged] = useState(null);
  const [popupHrvReading, setPopupHrvReading] = useState(null);
  const movementCaptureDateRef = useRef(null);
  // Cycle date picker
  const [pickerMode, setPickerMode] = useState(null); // null | 'started' | 'ended'
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [selectedPickerDate, setSelectedPickerDate] = useState(null);

  // Astrology popup — stacked threads (sky / human design / gene keys)
  const [astroExpanded, setAstroExpanded] = useState({ sky: false, humanDesign: false, geneKeys: false });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset popup state when card changes
  useEffect(() => {
    if (active?.id) {
      setCycleActionDone(null);
      setPickerMode(null);
      setSelectedPickerDate(null);
      setReadinessScore(null);
      setReadinessLogged(false);
      setMovementPractice(null);
      setMovementDuration(20);
      setMovementLogged(null);
      setPopupHrvReading(null);
      movementCaptureDateRef.current = null;
      const h = new Date().getHours();
      setRestPopupTab(h >= 6 && h < 18 ? 'rising' : 'rest');
      setRisingLog({ riseTime: '07:15', sleepProcess: null, wakingState: null, nightWakings: null, nightSweats: null });
      setRisingLogged(false);
      setRestEveningLog({ restTime: '22:30', energyAssessment: null, alcoholConsumed: false });
      setRestEveningLogged(false);
      setAstroExpanded({ sky: false, humanDesign: false, geneKeys: false });
    }
  }, [active?.id]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const nowForDate = new Date();
  const todayStr = localDate;
  const previousDate = new Date(`${todayStr}T12:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateStr = localDateString(previousDate);
  const restRecordDateStr = nowForDate.getHours() < 18 ? previousDateStr : todayStr;

  // --- Data queries ---
  const { data: cycleApiData } = useQuery({
    queryKey: ['/api/cycle/data'],
    queryFn: () => fetch('/api/cycle/data', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: movementToday, refetch: refetchMovement } = useQuery({
    queryKey: ['/api/movement/today', todayStr],
    queryFn: () => fetch('/api/movement/today', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayRestArr = [], refetch: refetchRest } = useQuery({
    queryKey: ['/api/rest-rising/submissions', previousDateStr, todayStr],
    queryFn: () => fetch(`/api/rest-rising/submissions?startDate=${previousDateStr}&endDate=${todayStr}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []),
    staleTime: 5 * 60 * 1000,
  });

  // Astrology popup data — weekly read (the weather) + design thread (HD + Gene Keys).
  // 404 = legitimate "no data yet" → render an empty state; other non-ok = real error.
  const { data: weeklyRead, isLoading: weeklyReadLoading, isError: weeklyReadError } = useQuery({
    queryKey: ['/api/astrology/weekly-read', astrologyWeekKey],
    queryFn: async () => {
      const r = await fetch('/api/astrology/weekly-read', { credentials: 'include' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: active?.id === 'astrology',
    retry: false,
    staleTime: Infinity,
  });

  const { data: designThread, isLoading: designThreadLoading, isError: designThreadError } = useQuery({
    queryKey: ['/api/astrology/design-thread', astrologyWeekKey],
    queryFn: async () => {
      const r = await fetch('/api/astrology/design-thread', { credentials: 'include' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: active?.id === 'astrology',
    retry: false,
    staleTime: Infinity,
  });

  // --- Derived data ---
  const todayRising = latestSubmission(todayRestArr, s => isRisingSubmission(s) && s.sleepDate === previousDateStr);
  const todayRestEvening = latestSubmission(todayRestArr, s => isRestSubmission(s) && s.sleepDate === restRecordDateStr);

  useEffect(() => {
    if (active?.id !== 'rest' || !todayRising) return;
    setRisingLog(previous => ({
      ...previous,
      riseTime: timeToHHMM(todayRising.riseTime) || previous.riseTime,
      sleepProcess: todayRising.sleepProcess ?? previous.sleepProcess,
      wakingState: todayRising.wakingState ?? previous.wakingState,
      nightWakings: todayRising.nightWakings ?? previous.nightWakings,
      nightSweats: todayRising.nightSweats ?? previous.nightSweats,
    }));
    // Refill the popup when the selected saved record changes. Local edits should
    // not be overwritten by a same-record query refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, todayRising?.id]);

  useEffect(() => {
    if (active?.id !== 'rest' || !todayRestEvening) return;
    setRestEveningLog(previous => ({
      ...previous,
      restTime: timeToHHMM(todayRestEvening.restTime) || previous.restTime,
      energyAssessment: todayRestEvening.energyAssessment ?? previous.energyAssessment,
      alcoholConsumed: todayRestEvening.alcoholConsumed ?? previous.alcoholConsumed,
    }));
    // Refill the popup when the selected saved record changes. Local edits should
    // not be overwritten by a same-record query refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, todayRestEvening?.id]);

  const cycleStartDate = cycleApiData?.cycleStartDate;
  const cycleDay = cycleStartDate
    ? Math.floor((new Date(todayStr) - new Date(cycleStartDate.split('T')[0])) / 86400000) + 1
    : null;
  const cycleLength = cycleApiData?.cycleLength || 28;
  const cyclePhase = cycleDay ? cyclePhaseForDay(cycleDay, cycleLength) : null;
  const cycleContextForDate = (dateString) => {
    const date = parseLocalDate(dateString);
    if (!date || !cycleStartDate) return { day: null, phase: null };
    return calculateCycleInfo(date, cycleStartDate, cycleLength);
  };

  const PHASE_NOTE = {
    Menstruation: 'Rest and inward presence. Your system is clearing and renewing.',
    Follicular: 'Rising energy. Good window for initiating and planning.',
    Ovulatory: 'Peak expressive and social capacity. Connect and create.',
    'Early Luteal': 'Consolidating energy. Complete and integrate what you have started.',
    'Late Luteal': 'Winding down. Release what is finished and make room for rest.',
  };

  const MOON_NOTE = {
    Eyebrows:      'Intuition is sharp. Trust what you perceive before you analyse it.',
    Cheeks:        'Radiance is your signal. Playful presence draws the right connections.',
    Lips:          'What you say carries weight. Speak slowly and speak true.',
    Earlobes:      'Discernment is active. Notice who and what genuinely feels safe.',
    'Nape of Neck':'Receptivity is open. Soften your grip and let the right things in.',
    Breasts:       'Deep care is online. Nourish yourself first, then offer to others.',
    Clitoris:      'Creative life force is high. Channel it with deliberate intention.',
    'Inner Thighs':'Embodied safety is the signal. Stay close to what grounds you.',
    Navel:         'Personal power is at centre. Act from identity, not reaction.',
    Vagina:        'Mystery is the source. Sit with what cannot yet be named.',
    Hairline:      'Perception is wide open. Let vision move beyond the obvious.',
  };

  const movementOptionsForSignal = ALL_PRACTICES.filter(practice =>
    practice.group === movementToday?.movementColour || practice.group === null
  );

  useEffect(() => {
    if (active?.id !== 'movement' || !movementToday?.movementColour || movementLogged) return;
    setMovementPractice(current => movementOptionsForSignal.some(option => option.name === current)
      ? current
      : movementOptionsForSignal[0]?.name || null);
    // The option list is derived entirely from the saved Movement colour. Depending
    // on the newly allocated array would rerun this effect on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, movementToday?.movementColour, movementLogged]);

  const rotateMovementPractice = () => {
    if (!movementOptionsForSignal.length) return;
    const currentIndex = movementOptionsForSignal.findIndex(option => option.name === movementPractice);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % movementOptionsForSignal.length;
    setMovementPractice(movementOptionsForSignal[nextIndex].name);
  };

  // --- Calendar picker helpers ---
  const generatePickerCalendarDays = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < startingDayOfWeek; i++) days.push({ date: null, day: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(pickerYear, pickerMonth, day);
      days.push({
        date: currentDate,
        day,
        isToday: currentDate.toDateString() === todayDate.toDateString(),
        isFuture: currentDate > todayDate,
        isSelected: selectedPickerDate && currentDate.toDateString() === selectedPickerDate.toDateString(),
      });
    }
    return days;
  };

  const openPicker = (mode) => {
    setPickerMode(mode);
    setSelectedPickerDate(null);
    setPickerMonth(new Date().getMonth());
    setPickerYear(new Date().getFullYear());
  };

  const closePicker = () => {
    setPickerMode(null);
    setSelectedPickerDate(null);
  };

  // --- Action handlers ---
  const handlePeriodAction = async (action, dateStr) => {
    if (cycleActionLoading) return;
    const date = dateStr || todayStr;
    setCycleActionLoading(true);
    closePicker();
    try {
      const apiAction = action === 'started' ? 'period_started' : action === 'extended' ? 'cycle_extended' : 'period_ended';
      const response = await fetch('/api/cycle/action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: apiAction, date }),
      });
      if (!response.ok) throw new Error(`Cycle save failed: ${response.status}`);
      const saved = await response.json();
      publishCycleData(saved);
      setCycleActionDone(action === 'extended' ? `extended:${saved.cycleLength}` : action);
    } catch (e) {
      if (cycleApiData?.cycleStartDate) publishCycleData(cycleApiData);
      console.error('[OrbHomeScreen] Cycle action failed:', e);
    } finally {
      setCycleActionLoading(false);
    }
  };

  const handleMovementLog = async () => {
    if (!movementPractice || movementLogging) return;
    setMovementLogging(true);
    try {
      const selectedPractice = ALL_PRACTICES.find(practice => practice.name === movementPractice);
      await fetch('/api/movement/workout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceName: movementPractice,
          durationMinutes: movementDuration,
          practiceSignal: selectedPractice?.group ?? movementToday?.movementColour ?? null,
        }),
      });
      setMovementLogged(movementPractice);
      queryClient.removeQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      refetchMovement();
    } catch (e) {
      console.error('[OrbHomeScreen] Movement log failed:', e);
    } finally {
      setMovementLogging(false);
    }
  };

  const handlePopupHrvCapture = async (reading) => {
    const captureDate = todayStr;
    movementCaptureDateRef.current = captureDate;
    const response = await fetch('/api/movement/hrv', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: captureDate,
        rmssd: reading.rmssd,
        sdnn: reading.sdnn ?? undefined,
        hrvSource: reading.source,
        hrvQuality: reading.quality ?? undefined,
        hrvIntervals: reading.intervals?.length ? reading.intervals : undefined,
        hrvCapturedAt: reading.capturedAt,
      }),
    });
    if (!response.ok) throw new Error('The reading could not be saved.');
    const log = await response.json();
    setPopupHrvReading(reading);
    // Keep the shared home-popup record intact while adding the new reading.
    queryClient.setQueryData(['/api/movement/today', todayStr], prev => ({ ...(prev || {}), ...log }));
    queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
    queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
  };

  const handleReadinessSubmit = async (score) => {
    setReadinessScore(score);
    setReadinessSubmitting(true);
    try {
      const effectiveReading = popupHrvReading ?? hrvReadingFromLog(movementToday);
      const captureDate = movementCaptureDateRef.current ?? movementToday?.date ?? todayStr;
      const res = await fetch('/api/movement/morning', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: captureDate,
          readinessScore: score,
          rmssd: effectiveReading?.rmssd ?? undefined,
          sdnn: effectiveReading?.sdnn ?? undefined,
          hrvSource: effectiveReading?.source ?? undefined,
          hrvQuality: effectiveReading?.quality ?? undefined,
          hrvIntervals: effectiveReading?.intervals?.length ? effectiveReading.intervals : undefined,
          hrvCapturedAt: effectiveReading?.capturedAt ?? undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || 'Readiness could not be saved.');
      queryClient.setQueryData(['/api/movement/today', todayStr], prev => ({
        ...(prev || {}),
        ...result.log,
        rhythmColour: result.rhythmColour,
        movementColour: result.movementColour,
        signalContext: result.signalContext ?? result.context ?? null,
        latestWorkout: result.latestWorkout ?? prev?.latestWorkout ?? null,
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
      setReadinessLogged(true);
      movementCaptureDateRef.current = null;
    } catch (e) {
      console.error('[OrbHomeScreen] Readiness submit failed:', e);
    } finally {
      setReadinessSubmitting(false);
    }
  };

  const handleRisingSubmit = async () => {
    if (risingSubmitting) return;
    setRisingSubmitting(true);
    try {
      const cycleContext = cycleContextForDate(previousDateStr);
      await fetch('/api/rest-rising/submissions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType: 'rise',
          sleepDate: previousDateStr,
          submissionDate: todayStr,
          riseTime: risingLog.riseTime,
          ...(risingLog.sleepProcess && { sleepProcess: risingLog.sleepProcess }),
          ...(risingLog.sleepProcess && { sleepProcessClassification: classifyRestField(risingLog.sleepProcess) }),
          ...(risingLog.wakingState && { wakingState: risingLog.wakingState }),
          ...(risingLog.wakingState && { wakingStateClassification: classifyRestField(risingLog.wakingState) }),
          ...(risingLog.nightWakings !== null && { nightWakings: risingLog.nightWakings }),
          ...(risingLog.nightSweats !== null && { nightSweats: risingLog.nightSweats }),
          ...(cycleContext.phase && { cyclePhase: cycleContext.phase }),
          ...(cycleContext.day != null && { cycleDay: cycleContext.day }),
        }),
      });
      await refetchRest();
      await queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
      setRisingLogged(true);
    } catch (e) {
      console.error('[OrbHomeScreen] Rising submit failed:', e);
    } finally {
      setRisingSubmitting(false);
    }
  };

  const handleRestEveningSubmit = async () => {
    if (restEveningSubmitting) return;
    setRestEveningSubmitting(true);
    try {
      const cycleContext = cycleContextForDate(restRecordDateStr);
      await fetch('/api/rest-rising/submissions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType: 'rest',
          sleepDate: restRecordDateStr,
          submissionDate: todayStr,
          restTime: restEveningLog.restTime,
          ...(restEveningLog.energyAssessment && { energyAssessment: restEveningLog.energyAssessment }),
          ...(restEveningLog.energyAssessment && { energyAssessmentClassification: classifyRestField(restEveningLog.energyAssessment) }),
          alcoholConsumed: restEveningLog.alcoholConsumed,
          ...(cycleContext.phase && { cyclePhase: cycleContext.phase }),
          ...(cycleContext.day != null && { cycleDay: cycleContext.day }),
        }),
      });
      await refetchRest();
      await queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
      setRestEveningLogged(true);
    } catch (e) {
      console.error('[OrbHomeScreen] Rest evening submit failed:', e);
    } finally {
      setRestEveningSubmitting(false);
    }
  };

  const handleOpen = (card) => {
    setActive(null);
    if (onOpenCard) onOpenCard(card.id);
  };

  const dismiss = () => {
    setActive(null);
    setShowGOE88(false);
    setCycleActionDone(null);
    setPickerMode(null);
    setSelectedPickerDate(null);
    setReadinessScore(null);
    setReadinessLogged(false);
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "100dvh", background: "#0a0a0f", fontFamily: "var(--font-sans)" }}
      onClick={dismiss}
    >
      {/* Background */}
      {isMobile ? (
        <img
          src="/images/horses_still.jpg"
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
      ) : (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          poster="/images/horses_still.jpg"
        >
          <source src="/images/horses.webm" type="video/webm" />
          <source src="/images/horses.mp4" type="video/mp4" />
        </video>
      )}

      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-20 grid grid-cols-3 items-center px-5 md:px-8"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
        onClick={e => e.stopPropagation()}
      >
        <span
          className="text-white font-light tracking-[0.25em] uppercase"
          style={{ fontSize: 12, textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}
        >
          GOE
        </span>
        <span
          className="text-white/70 font-light text-center"
          style={{ fontSize: 12, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
        >
          {isMobile
            ? new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
            : today}
        </span>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-1.5 rounded-full text-white font-light"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            onClick={e => { e.stopPropagation(); setShowGOE88(!showGOE88); }}
          >
            <MessageCircle size={12} strokeWidth={1.5} />
            GOE88
          </button>
        </div>
      </div>

      {/* Card grid */}
      {isMobile ? (
        <div className="relative z-10 h-full flex items-center justify-center" style={{ paddingTop: 80, paddingBottom: 20 }}>
          <div className="grid grid-cols-3 gap-x-6 gap-y-6 px-6">
            {CARDS.map(card => (
              <button
                key={card.id}
                className="flex flex-col items-center gap-1.5 group"
                onClick={e => { e.stopPropagation(); setActive(card); }}
              >
                <div
                  className="overflow-hidden transition-transform duration-200 group-active:scale-95"
                  style={{ width: 76, height: 76, borderRadius: 17, boxShadow: "0 4px 16px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(255,255,255,0.15)" }}
                >
                  <img
                    src={card.img}
                    alt={card.name}
                    width={76}
                    height={76}
                    decoding="async"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    style={card.screen ? { mixBlendMode: "screen" } : undefined}
                  />
                </div>
                <span className="text-white text-[12px] font-light text-center leading-tight max-w-[76px]"
                  style={{ textShadow: "0 1px 5px rgba(0,0,0,0.9)" }}>
                  {card.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-10">
            <div className="flex items-start justify-center gap-8">
              {CARDS.map(card => (
                <button
                  key={card.id}
                  className="flex flex-col items-center gap-2 group"
                  onClick={e => { e.stopPropagation(); setActive(card); }}
                >
                  <div
                    className="overflow-hidden transition-transform duration-200 group-hover:scale-105"
                    style={{
                      width: 96, height: 96, borderRadius: 20,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(255,255,255,0.15)",
                    }}
                  >
                    <img
                      src={card.img}
                      alt={card.name}
                      width={96}
                      height={96}
                      decoding="async"
                      loading="lazy"
                      className="w-full h-full object-cover"
                      style={card.screen ? { mixBlendMode: "screen" } : undefined}
                    />
                  </div>
                  <span className="text-white text-[13px] font-light text-center leading-tight max-w-[90px]"
                    style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                    {card.name}
                  </span>
                </button>
              ))}
            </div>
        </div>
      )}

      {/* Card brief popup — fixed centre */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={dismiss}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }} />
          <div className="relative rounded-2xl p-5 w-full max-w-md max-h-[88dvh] overflow-y-auto md:max-h-none md:overflow-visible z-10 goe-popup-read" style={isMobile ? glassPanelMobile : glassPanel}
            onClick={e => e.stopPropagation()}>
            <button className="absolute top-3.5 right-3.5 text-gray-400 hover:text-gray-900" onClick={dismiss}>
              <X size={16} />
            </button>

            {/* Shared header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                <img src={active.img} alt={active.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 tracking-wide">{active.name}</h3>
            </div>

            {/* ── CYCLICAL ── */}
            {active.id === 'cyclical' && (() => {
              const moonCenterName = moonCentresEnabled ? currentMoonCenter.current : null;
              const moonCenterDetails = moonCenterName
                ? moonCenters.find(c => c.name === moonCenterName)
                : null;
              return (
                <div>
                  {moonCenterName ? (
                    <div className="goe-popup-stack goe-popup-compare grid grid-cols-2 mb-4">
                      {/* Row 1 — headlines */}
                      <div className="pr-4 border-r border-white/50 pb-1.5">
                        <div className="text-2xl font-semibold text-gray-900 tracking-wide leading-none">{cycleDay ? `Day ${cycleDay}` : '—'}</div>
                      </div>
                      <div className="pl-4 pb-1.5">
                        <div className="text-2xl font-semibold text-gray-900 tracking-wide leading-none">{moonCenterName}</div>
                      </div>
                      {/* Row 2 — sub-labels */}
                      <div className="pr-4 border-r border-white/50 pb-1.5">
                        <div className="text-sm font-medium text-gray-900">{cyclePhase || ''}</div>
                      </div>
                      <div className="pl-4 pb-1.5">
                        <div className="text-sm font-medium text-gray-900 leading-snug">{moonCenterDetails?.kriya || ''}</div>
                      </div>
                      {/* Row 3 — notes */}
                      <div className="pr-4 border-r border-white/50">
                        <p className="text-sm text-gray-900 italic leading-relaxed font-normal">{cyclePhase ? PHASE_NOTE[cyclePhase] : 'No cycle start date recorded.'}</p>
                      </div>
                      <div className="pl-4">
                        <p className="text-sm text-gray-900 italic leading-relaxed font-normal">{MOON_NOTE[moonCenterName]}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      {cycleDay ? (
                        <>
                          <div className="text-2xl font-semibold text-gray-900 tracking-wide leading-none">Day {cycleDay}</div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{cyclePhase}</div>
                          {cyclePhase && <p className="text-sm text-gray-900 italic leading-relaxed mt-2 font-normal">{PHASE_NOTE[cyclePhase]}</p>}
                        </>
                      ) : (
                        <p className="text-sm text-gray-900 italic font-normal">No cycle start date recorded. Log your period to begin tracking.</p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-1.5 border-t border-white/40 pt-3 mb-4">
                    {cycleActionDone ? (
                      <p className="text-sm text-center font-medium py-2" style={{ color: '#f43f5e' }}>
                        {cycleActionDone === 'started' ? 'Period started — logged'
                          : cycleActionDone?.startsWith('extended') ? `Cycle extended to ${cycleActionDone.split(':')[1]} days — logged`
                          : 'Period ended — logged'}
                      </p>
                    ) : (
                      <>
                        {[['started','Period Started'],['ended','Period Ended']].map(([action,label]) => (
                          <button key={action} disabled={cycleActionLoading}
                            onClick={() => openPicker(action)}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-900 disabled:opacity-50 transition-opacity"
                            style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(0,0,0,0.1)' }}>
                            {label}
                          </button>
                        ))}
                        <button disabled={cycleActionLoading}
                          onClick={() => handlePeriodAction('extended')}
                          className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-900 disabled:opacity-50 transition-opacity"
                          style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(0,0,0,0.1)' }}>
                          {cycleActionLoading ? '…' : 'Extend Cycle'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── MOVEMENT ── */}
            {active.id === 'movement' && (
              <div className="mb-3 space-y-2">
                <HrvReader compact initialReading={hrvReadingFromLog(movementToday)} onReading={handlePopupHrvCapture} />

                {movementToday?.rmssd != null && (
                  <div className="border-t border-white/40 pt-2 space-y-1" data-movement-read="rhythm">
                    <div className="text-sm font-medium text-black">Your Rhythm</div>
                    <p className="text-sm text-black italic leading-relaxed font-normal">
                      {getRhythmText({ signalContext: movementToday.signalContext })}
                    </p>
                  </div>
                )}
                {movementToday?.movementColour ? (
                  <>
                    <div className="border-t border-white/40 pt-2 space-y-1" data-movement-read="experience">
                      <div className="text-sm font-medium text-black">Movement Read</div>
                      <p className="text-sm text-black italic leading-relaxed font-normal">
                        {getMovementReadText({ signalContext: movementToday.signalContext })}
                      </p>
                    </div>

                    <div className="border-t border-white/40 pt-3 pb-2 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-black">Movement for today</div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <div className="text-sm font-medium text-black">{movementPractice || '—'}</div>
                            <button
                              type="button"
                              onClick={rotateMovementPractice}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-700 shadow-sm"
                              style={{
                                background: 'rgba(255,255,255,0.65)',
                                border: '1px solid rgba(0,0,0,0.08)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                              }}
                              aria-label="Show another movement">
                              <RotateCcw size={13} />
                            </button>
                          </div>
                        </div>
                        <DurationStepper value={movementDuration} onChange={setMovementDuration} />
                      </div>

                      {movementLogged && (
                        <p className={`text-sm font-medium ${COLOUR_META[movementToday.movementColour]?.text ?? 'text-gray-600'}`}>
                          {movementLogged} logged
                        </p>
                      )}
                      {movementPractice ? (
                        <button onClick={handleMovementLog} disabled={movementLogging}
                          className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 ${COLOUR_META[movementToday.movementColour]?.pill ?? COLOUR_META.unclassified.pill}`}>
                          {movementLogging ? 'Logging…' : `Log ${movementPractice}`}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 border-t border-white/40 pt-3">
                    {readinessLogged ? (
                      <p className={`text-sm font-medium ${COLOUR_META[movementToday?.movementColour]?.text ?? 'text-gray-600'}`}>Readiness logged</p>
                    ) : (
                      <>
                        <ReadinessGauge value={readinessScore || 5} onChange={setReadinessScore} />
                        <button
                          onClick={() => handleReadinessSubmit(readinessScore || 5)}
                          disabled={readinessSubmitting}
                          className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)' }}>
                          {readinessSubmitting ? 'Logging…' : 'Log Readiness'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── REST ── */}
            {active.id === 'rest' && (() => {
              const moonPhase = getMoonPhase(new Date());

              const SLEEP_PROCESS_OPTS = ["Mind Blank/Peaceful","Gradual Settling Down","Instant Drop-Off","Fragmented & Scattered","Racing/Rumination","Tossing & Turning"];
              const WAKING_STATE_OPTS  = ["Refreshed & Clear","Groggy but Clearing","Heavy & Dense","Fragmented & Scattered","Wired & Restless","Startled/Jarring Awakening"];
              const ENERGY_OPTS        = ["Steady Throughout Day","Calm but Alert Energy","Burn Out at 4pm","Heavy/Dense Feeling","Wired but Tired","Sluggish Start, Better Later"];

              const btnBase = { background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(0,0,0,0.08)', color: '#334155' };
              const btnOn   = { background: 'linear-gradient(135deg, #818cf8, #4f46e5)', color: '#fff' };

              return (
                <div className="mb-4">
                  {/* Header — Cyclical-style 2-col */}
                  <div className="goe-popup-stack grid grid-cols-2 items-center mb-4">
                    <div className="pr-4 border-r border-white/50 flex flex-col justify-center self-stretch">
                      <div className="text-2xl font-semibold text-gray-900 tracking-wide leading-none">{moonPhase.emoji} {moonPhase.name}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{getDaysToNextPhase(new Date(), userTimezone)}</div>
                    </div>
                    <div className="pl-4 flex flex-col justify-center">
                      <div className="text-sm font-medium text-gray-900">
                        {restPopupTab === 'rising' ? 'Rise Time' : 'Time to Rest'}
                      </div>
                      {restPopupTab === 'rest' && (
                        <div className="text-xs font-normal text-gray-900 mb-1.5">
                          {nowForDate.getHours() < 18 ? 'Recording last night' : 'Record tonight'}
                        </div>
                      )}
                      {restPopupTab === 'rising' ? (
                        <TimePickerClock
                          key="rising-clock"
                          value={risingLog.riseTime}
                          onChange={value => setRisingLog(previous => ({ ...previous, riseTime: value }))}
                          compact
                          className="shadow-none"
                        />
                      ) : (
                        <TimePickerClock
                          key="rest-clock"
                          value={restEveningLog.restTime}
                          onChange={value => setRestEveningLog(previous => ({ ...previous, restTime: value }))}
                          compact
                          className="shadow-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-3 border-t border-white/40 pt-3">
                    {[['rising','Rising'],['rest','Rest']].map(([key, label]) => (
                      <button key={key} onClick={() => setRestPopupTab(key)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                        style={restPopupTab === key ? btnOn : btnBase}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Rising tab */}
                  {restPopupTab === 'rising' && (
                    todayRising ? (
                      <div className="space-y-1.5">
                        <p className="text-sm text-indigo-700 font-medium mb-1">Rising logged · {displayDate(todayRising.submissionDate || todayStr)}</p>
                        {todayRising.riseTime && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Rise Time</span><span className="font-medium text-gray-900">{formatLocalTime(todayRising.riseTime)}</span></div>}
                        {todayRising.wakingState  && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Waking</span><span className="font-medium text-gray-900">{todayRising.wakingState}</span></div>}
                        {todayRising.sleepProcess && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Sleep process</span><span className="font-medium text-gray-900">{todayRising.sleepProcess}</span></div>}
                        {todayRising.nightWakings && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Night wakings</span><span className="font-medium text-gray-900">{todayRising.nightWakings}</span></div>}
                        {todayRising.nightSweats != null && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Night sweats</span><span className="font-medium text-gray-900">{todayRising.nightSweats ? 'Yes' : 'No'}</span></div>}
                      </div>
                    ) : risingLogged ? (
                      <p className="text-sm text-indigo-700 font-medium">Rising logged</p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1.5">Sleep process</p>
                          <PopupDropdown value={risingLog.sleepProcess} onChange={v => setRisingLog(p => ({ ...p, sleepProcess: v }))} options={SLEEP_PROCESS_OPTS} placeholder="How did falling asleep go?" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1.5">Waking state</p>
                          <PopupDropdown value={risingLog.wakingState} onChange={v => setRisingLog(p => ({ ...p, wakingState: v }))} options={WAKING_STATE_OPTS} placeholder="How do you feel now?" />
                        </div>
                        <div className="flex gap-0">
                          <div className="flex-1 pr-3 border-r border-white/40">
                            <p className="text-sm font-medium text-gray-900 mb-1.5">Night wakings</p>
                            <div className="flex gap-1.5">
                              {['0','1–2','3+'].map(v => (
                                <button key={v} onClick={() => setRisingLog(p => ({ ...p, nightWakings: v }))}
                                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                                  style={risingLog.nightWakings === v ? btnOn : btnBase}>{v}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 pl-3">
                            <p className="text-sm font-medium text-gray-900 mb-1.5">Night sweats</p>
                            <div className="flex gap-1.5">
                              {[{l:'No',v:false},{l:'Yes',v:true}].map(({l,v}) => (
                                <button key={l} onClick={() => setRisingLog(p => ({ ...p, nightSweats: v }))}
                                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                                  style={risingLog.nightSweats === v ? btnOn : btnBase}>{l}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {(risingLog.sleepProcess || risingLog.wakingState || risingLog.nightWakings !== null || risingLog.nightSweats !== null) && (
                          <button onClick={handleRisingSubmit} disabled={risingSubmitting}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #818cf8, #4f46e5)' }}>
                            {risingSubmitting ? 'Saving…' : 'Save rising'}
                          </button>
                        )}
                      </div>
                    )
                  )}

                  {/* Rest tab (evening) */}
                  {restPopupTab === 'rest' && (
                    todayRestEvening ? (
                      <div className="space-y-1.5">
                        <p className="text-sm text-indigo-700 font-medium mb-1">Rest logged · {displayDate(restRecordDateStr)}</p>
                        {todayRestEvening.restTime && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Time to Rest</span><span className="font-medium text-gray-900">{formatLocalTime(todayRestEvening.restTime)}</span></div>}
                        {todayRestEvening.energyAssessment && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Energy</span><span className="font-medium text-gray-900">{todayRestEvening.energyAssessment}</span></div>}
                        {todayRestEvening.alcoholConsumed != null && <div className="flex justify-between text-sm"><span className="text-gray-900 font-normal">Alcohol</span><span className="font-medium text-gray-900">{todayRestEvening.alcoholConsumed ? 'Yes' : 'No'}</span></div>}
                      </div>
                    ) : restEveningLogged ? (
                      <p className="text-sm text-indigo-700 font-medium">Rest logged</p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1.5">Energy today</p>
                          <PopupDropdown value={restEveningLog.energyAssessment} onChange={v => setRestEveningLog(p => ({ ...p, energyAssessment: v }))} options={ENERGY_OPTS} placeholder="How was your energy today?" />
                        </div>
                        <div className="border-t border-white/40 pt-3">
                          <p className="text-sm font-medium text-gray-900 mb-1.5">Alcohol today</p>
                          <div className="flex gap-1.5">
                            {[{l:'No',v:false},{l:'Yes',v:true}].map(({l,v}) => (
                              <button key={l} onClick={() => setRestEveningLog(p => ({ ...p, alcoholConsumed: v }))}
                                className="flex-1 py-2 rounded-xl text-xs font-medium"
                                style={restEveningLog.alcoholConsumed === v ? btnOn : btnBase}>{l}</button>
                            ))}
                          </div>
                        </div>
                        {restEveningLog.energyAssessment && (
                          <button onClick={handleRestEveningSubmit} disabled={restEveningSubmitting}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #818cf8, #4f46e5)' }}>
                            {restEveningSubmitting ? 'Saving…' : 'Save rest'}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })()}

            {/* ── ASTROLOGY ── */}
            {active.id === 'astrology' && (() => {
              const sections = [
                { key: 'sky',         label: 'The Weekly Read', sub: 'The weather',                  text: weeklyRead?.text,          loading: weeklyReadLoading,  error: weeklyReadError },
                { key: 'humanDesign', label: 'Human Design',    sub: 'How to move this week',         text: designThread?.humanDesign, loading: designThreadLoading, error: designThreadError },
                { key: 'geneKeys',    label: 'Gene Keys',       sub: 'What to work with this week',   text: designThread?.geneKeys,    loading: designThreadLoading, error: designThreadError },
              ];
              const teaser = (t) => {
                const clean = (t || '').trim();
                return clean.length > TEASER_LIMIT ? clean.slice(0, TEASER_LIMIT).trimEnd() + '…' : clean;
              };
              return (
                <div className="mb-4">
                  {/* Week label */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-900 tracking-wide">This week</span>
                  </div>

                  {/* Stacked threads */}
                  <div className="space-y-2.5">
                    {sections.map(s => {
                      const expanded = astroExpanded[s.key];
                      const full = (s.text || '').trim();
                      return (
                        <div key={s.key} className="rounded-xl p-3"
                          style={{ background: 'rgba(255,255,255,0.42)', border: '1px solid rgba(255,255,255,0.4)' }}>
                          <div className="flex items-baseline justify-between mb-1.5 gap-2">
                            <span className="text-sm font-semibold text-gray-900 tracking-wide">{s.label}</span>
                            <span className="text-[11px] text-gray-600 font-normal text-right">{s.sub}</span>
                          </div>
                          {full ? (
                            <>
                              {expanded ? (
                                <div className="max-h-44 overflow-y-auto pr-1">
                                  <p className="text-sm text-gray-900 italic leading-relaxed font-normal whitespace-pre-line">{full}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-900 italic leading-relaxed font-normal">{teaser(full)}</p>
                              )}
                              {full.length > TEASER_LIMIT && (
                                <button onClick={() => setAstroExpanded(p => ({ ...p, [s.key]: !p[s.key] }))}
                                  className="mt-1.5 text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors">
                                  {expanded ? 'Show less' : 'Read full'}
                                </button>
                              )}
                            </>
                          ) : s.loading ? (
                            <p className="text-sm text-gray-500 italic font-normal">Reading this week…</p>
                          ) : s.error ? (
                            <p className="text-sm text-gray-500 italic font-normal">Couldn't load this right now. Try reopening in a moment.</p>
                          ) : (
                            <p className="text-sm text-gray-500 italic font-normal">
                              {s.key === 'sky'
                                ? 'Set up your birth chart in the Astrology card to read the weather.'
                                : 'Add your design data in the Astrology card to read this thread.'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <button
              className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:cursor-default"
              style={{ background: active.btnGradient }}
              onClick={() => handleOpen(active)}
            >
              Open {active.name}
            </button>
          </div>
        </div>
      )}

      {/* ── Cycle date picker overlay ── */}
      {pickerMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { e.stopPropagation(); closePicker(); }}>
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-900" onClick={closePicker}>
              <X size={16} />
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-0.5 tracking-wide">
              {pickerMode === 'started' ? 'Period Started' : 'Period Ended'}
            </h3>
            <p className="text-xs text-gray-500 font-normal mb-4">
              {pickerMode === 'started' ? 'Select the date your period started' : 'Select the date your period ended'}
            </p>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button className="text-gray-400 hover:text-gray-900 px-2 py-1 text-lg leading-none" onClick={() => {
                if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); }
                else setPickerMonth(m => m - 1);
              }}>‹</button>
              <span className="text-sm font-medium text-gray-900">
                {new Date(pickerYear, pickerMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </span>
              <button className="text-gray-400 hover:text-gray-900 px-2 py-1 text-lg leading-none" onClick={() => {
                if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); }
                else setPickerMonth(m => m + 1);
              }}>›</button>
            </div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {generatePickerCalendarDays().map((dayInfo, i) => (
                <button key={i}
                  disabled={!!dayInfo.isFuture || !dayInfo.date}
                  onClick={() => dayInfo.date && !dayInfo.isFuture && setSelectedPickerDate(dayInfo.date)}
                  className={[
                    'aspect-square rounded-lg text-sm font-medium transition-colors',
                    !dayInfo.date ? 'invisible' : '',
                    dayInfo.isFuture ? 'text-gray-300 cursor-not-allowed' :
                      pickerMode === 'started' ? 'hover:bg-rose-100 cursor-pointer text-gray-900' : 'hover:bg-green-100 cursor-pointer text-gray-900',
                    dayInfo.isToday ? 'ring-2 ring-gray-400' : '',
                    dayInfo.isSelected
                      ? pickerMode === 'started' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-green-500 text-white hover:bg-green-600'
                      : '',
                  ].filter(Boolean).join(' ')}>
                  {dayInfo.day}
                </button>
              ))}
            </div>
            {/* Confirm strip */}
            {selectedPickerDate && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-500 font-normal">
                  {pickerMode === 'started' ? 'Start on' : 'End on'}{' '}
                  <strong className="text-gray-900">{selectedPickerDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>
                </span>
                <button
                  onClick={() => {
                    const y = selectedPickerDate.getFullYear();
                    const m = String(selectedPickerDate.getMonth() + 1).padStart(2, '0');
                    const d = String(selectedPickerDate.getDate()).padStart(2, '0');
                    handlePeriodAction(pickerMode, `${y}-${m}-${d}`);
                  }}
                  className={`px-5 py-2 rounded-lg text-white text-sm font-medium ${pickerMode === 'started' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-green-500 hover:bg-green-600'}`}>
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GOE88 popup */}
      {showGOE88 && (
        <GOE88ModalShell
          onClose={() => setShowGOE88(false)}
          showClose={!isChatEnabled}
          panelLayoutClassName={isChatEnabled
            ? undefined
            : 'w-full max-w-sm mx-4 rounded-xl p-5'}
          panelClassName="goe-popup-read"
          panelStyle={isMobile ? glassPanelMobile : glassPanel}
          backdropStyle={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
        >
          {!isChatEnabled ? (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-3">GOE88 Chat</h3>
              <div className="space-y-3">
                {GOE88_DISABLED_COPY.map(line => (
                  <p key={line} className="text-sm text-gray-900 font-light leading-relaxed">{line}</p>
                ))}
              </div>
            </>
          ) : (
            <GOE88ChatPanel cardType="general" onClose={() => setShowGOE88(false)} />
          )}
        </GOE88ModalShell>
      )}
    </div>
  );
}
