// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Rest & Restore Intelligence Card — modular rebuild (Task #11 / #26)
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useRestData } from '@/hooks/useRestData';
import { useCycleData } from '@/hooks/useCycleData';
import { calculateCycleInfo, calculateRestSpanMinutes } from '@/utils/cycleCalculations';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { classifyNervousSystemState } from './restCalculations';
import { getDaysToNextPhase, getMoonPhase } from '@/lib/moonPhase';
import { useAuth } from '@/hooks/useAuth';
import RestHeader from './RestHeader';
import RestZone2 from './RestZone2';

// ─── Icon components (Circle=green, Diamond=yellow, Star=red) ─────────────────

const RegulatedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="regulatedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#16A34A" />
        <stop offset="50%" stopColor="#22C55E" />
        <stop offset="100%" stopColor="#4ADE80" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="35" fill="url(#regulatedGradient)" />
  </svg>
);

const ActivatedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="activatedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CA8A04" />
        <stop offset="50%" stopColor="#EAB308" />
        <stop offset="100%" stopColor="#FDE047" />
      </linearGradient>
    </defs>
    <polygon points="50,15 85,50 50,85 15,50" fill="url(#activatedGradient)" />
  </svg>
);

const DepletedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="depletedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="50%" stopColor="#F87171" />
        <stop offset="100%" stopColor="#FCA5A5" />
      </linearGradient>
    </defs>
    <path d="M50 10 L55 40 L85 35 L60 50 L85 65 L55 60 L50 90 L45 60 L15 65 L40 50 L15 35 L45 40 Z" fill="url(#depletedGradient)" />
  </svg>
);

const getPatternIcon = (pattern) => {
  if (pattern === 'resourced') return <RegulatedIcon />;
  if (pattern === 'activated') return <ActivatedIcon />;
  if (pattern === 'depleted') return <DepletedIcon />;
  return null;
};

// ─── Main component ───────────────────────────────────────────────────────────

const RestIntelligenceCard = () => {
  const { sleepData, updateSleepData, updateIntelligenceProfile,
          analyzeRestPractice } = useRestData();
  const { cycleData, currentCycleInfo, currentMoonCenter, moonPatternRevision } = useCycleData();
  const currentPatternRevision = useRef(moonPatternRevision);
  currentPatternRevision.current = moonPatternRevision;
  const { user } = useAuth();

  const userTimezone = user?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });

  // ── State ────────────────────────────────────────────────────────────────────
  const [isSubmitting,          setIsSubmitting]          = useState(false);
  const [isRestSubmittedToday,  setIsRestSubmittedToday]  = useState(false);
  const [isRisingSubmittedToday,setIsRisingSubmittedToday]= useState(false);
  const [practiceView,          setPracticeView]          = useState('cycles');
  const [restInput,             setRestInput]             = useState('');
  const [restProcessing,        setRestProcessing]        = useState(false);
  const [restAnalysis,          setRestAnalysis]          = useState(null);
  const [audioPractice,         setAudioPractice]         = useState(null);
  const [isPlayingAudio,        setIsPlayingAudio]        = useState(false);
  const [currentAudio,          setCurrentAudio]          = useState(null);
  const [audioProgress,         setAudioProgress]         = useState(0);
  const [audioDuration,         setAudioDuration]         = useState(0);
  // New fields
  const [lifeStage,             setLifeStage]             = useState(null);
  const [alcoholConsumed,       setAlcoholConsumed]       = useState(null);
  const [nightWakings,          setNightWakings]          = useState(null);
  const [nightSweats,           setNightSweats]           = useState(null);
  // Modals
  const [showRestRisingModal,   setShowRestRisingModal]   = useState(false);
  const [showPhaseModal,        setShowPhaseModal]        = useState(null);
  const [showSymbolModal,       setShowSymbolModal]       = useState(false);

  useEffect(() => {
    if (!restAnalysis) {
      setAudioPractice(null);
      return;
    }
    setAudioPractice({
      id: restAnalysis.practiceId ?? null,
      practice: restAnalysis.practice,
      audioFile: restAnalysis.audioFile,
    });
  }, [restAnalysis]);

  // ── Fetch user lifeStage on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/user', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.lifeStage) setLifeStage(data.lifeStage); })
      .catch(() => {});
  }, []);

  const updateLifeStage = async (stage) => {
    setLifeStage(stage);
    try {
      await fetch('/api/user/life-stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lifeStage: stage })
      });
    } catch (e) { console.error('Failed to save life stage:', e); }
  };

  // ── Derived: nervous system state ─────────────────────────────────────────────
  const nervousSystemState = classifyNervousSystemState(
    sleepData.energyAssessment,
    sleepData.sleepProcess,
    sleepData.wakingState
  );

  useEffect(() => {
    if (nervousSystemState) {
      updateIntelligenceProfile('rest', { nervousSystemState });
    }
    // The dashboard updater is recreated by its provider. The derived state is the
    // intended trigger; depending on the updater would repeat this write on renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nervousSystemState]);

  // ── Cycle helpers ────────────────────────────────────────────────────────────
  const getCycleInfoForDate = (date) =>
    calculateCycleInfo(new Date(date), cycleData.cycleStartDate, cycleData.cycleLength);

  const enhancedCycleData = {
    ...cycleData,
    cycleDay:    currentCycleInfo.day,
    cyclePhase:  currentCycleInfo.phase,
    moonCenter:  currentMoonCenter.current,
    currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
  };

  const cycleProgress = currentCycleInfo.day && cycleData.cycleLength
    ? Math.min(100, Math.max(0, (currentCycleInfo.day / cycleData.cycleLength) * 100))
    : 0;

  // ── Cached-data queries ──────────────────────────────────────────────────────
  const { data: cachedRestPractice } = useQuery({
    queryKey: ['/api/rest-practice/today', today, currentCycleInfo.phase, moonPatternRevision],
    queryFn: async () => {
      const phaseParam = currentCycleInfo.phase ? `&cyclePhase=${encodeURIComponent(currentCycleInfo.phase)}` : '';
      const r = await fetch(`/api/rest-practice/today?tz=${userTimezone}&localDate=${today}${phaseParam}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    staleTime: 1000 * 60 * 60
  });

  useEffect(() => {
    setRestAnalysis(null);
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    // A moon-pattern revision is the intended trigger. Depending on currentAudio
    // would clear a newly selected practice whenever audio starts or stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moonPatternRevision]);

  // Load cached rest practice
  useEffect(() => {
    if (!cachedRestPractice?.success || !cachedRestPractice.fromCache || !cachedRestPractice.wisdom) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/practices/${cachedRestPractice.creativeState}/meditation?cyclePhase=${currentCycleInfo.phase || 'unknown'}`,
          { credentials: 'include' }
        );
        const d = r.ok ? await r.json() : null;
        if (cancelled) return;
        setRestAnalysis(d?.success && d.practice ? {
          creativeState: cachedRestPractice.creativeState,
          practiceId:    d.practice.id,
          practice:      d.practice.name,
          wisdom:        cachedRestPractice.wisdom,
          audioFile:     d.practice.audioUrl
        } : {
          creativeState: cachedRestPractice.creativeState,
          practice:      "Guided Rest Practice",
          wisdom:        cachedRestPractice.wisdom,
          audioFile:     null
        });
      } catch {
        if (cancelled) return;
        setRestAnalysis({ creativeState: cachedRestPractice.creativeState, practice: "Guided Rest Practice", wisdom: cachedRestPractice.wisdom, audioFile: null });
      }
    };
    load();
    setIsRestSubmittedToday(true);
    return () => { cancelled = true; };
  }, [cachedRestPractice, currentCycleInfo.phase, moonPatternRevision]);

  // Daily submission state from localStorage (fallback)
  useEffect(() => {
    if (!restAnalysis) setIsRestSubmittedToday(localStorage.getItem('lastRestSubmission') === today);
    setIsRisingSubmittedToday(localStorage.getItem('lastRisingSubmission') === today);
  }, [today, restAnalysis]);

  // ── Submission handlers ──────────────────────────────────────────────────────
  const classifyEnergy = (opt) => {
    if (["Steady Throughout Day", "Calm but Alert Energy"].includes(opt)) return 'resourced';
    if (["Wired but Tired", "Sluggish Start, Better Later"].includes(opt)) return 'activated';
    return 'depleted';
  };
  const classifySleep = (opt) => {
    if (["Mind Blank/Peaceful", "Gradual Settling Down"].includes(opt)) return 'resourced';
    if (["Racing/Rumination", "Tossing & Turning"].includes(opt)) return 'activated';
    return 'depleted';
  };
  const classifyWaking = (opt) => {
    if (["Refreshed & Clear", "Groggy but Clearing"].includes(opt)) return 'resourced';
    if (["Wired & Restless", "Startled/Jarring Awakening"].includes(opt)) return 'activated';
    return 'depleted';
  };

  const handleRestSubmission = async () => {
    setIsSubmitting(true);
    try {
      const { restTime, energyAssessment } = sleepData;
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const sleepDate = (now.getHours() < 18
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        : now).toLocaleDateString('en-CA');
      const body = {
        sleepDate, submissionDate: todayStr, restTime, energyAssessment,
        energyAssessmentClassification: classifyEnergy(energyAssessment),
        cyclePhase: getCycleInfoForDate(sleepDate).phase || 'unknown',
        cycleDay:   getCycleInfoForDate(sleepDate).day   || 0,
        alcoholConsumed: alcoholConsumed === true ? true : alcoholConsumed === false ? false : null,
        submissionType: 'rest'
      };
      const r = await fetch('/api/rest-rising/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to submit rest data');
      localStorage.setItem('lastRestSubmission', todayStr);
      setIsRestSubmittedToday(true);
      queryClient.invalidateQueries({ queryKey: ['/api/rest-rising/submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
    } catch (e) { console.error('Error submitting rest data:', e); }
    finally { setIsSubmitting(false); }
  };

  const handleRisingSubmission = async () => {
    setIsSubmitting(true);
    try {
      const { riseTime, sleepProcess, wakingState } = sleepData;
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const sleepDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toLocaleDateString('en-CA');
      const body = {
        sleepDate, submissionDate: todayStr, riseTime, sleepProcess,
        sleepProcessClassification: classifySleep(sleepProcess),
        wakingState, wakingStateClassification: classifyWaking(wakingState),
        cyclePhase: getCycleInfoForDate(sleepDate).phase || 'unknown',
        cycleDay:   getCycleInfoForDate(sleepDate).day   || 0,
        nightWakings: nightWakings || null,
        nightSweats: nightSweats === true ? true : nightSweats === false ? false : null,
        submissionType: 'rise'
      };
      const r = await fetch('/api/rest-rising/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to submit rising data');
      localStorage.setItem('lastRisingSubmission', todayStr);
      setIsRisingSubmittedToday(true);
      queryClient.invalidateQueries({ queryKey: ['/api/rest-rising/submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar'] });
    } catch (e) { console.error('Error submitting rising data:', e); }
    finally { setIsSubmitting(false); }
  };

  // ── Rest practice analysis ───────────────────────────────────────────────────
  const analyzeRestNeeds = async (input) => {
    setRestProcessing(true);
    const requestedRevision = currentPatternRevision.current;
    try {
      const response = await analyzeRestPractice(input, enhancedCycleData, sleepData, true);
      if (currentPatternRevision.current !== requestedRevision) return;
      if (response.success && response.wisdom && response.creativeState) {
        try {
          const pr = await fetch(`/api/practices/${response.creativeState}/meditation?cyclePhase=${enhancedCycleData.cyclePhase || 'unknown'}`, { credentials: 'include' });
          const pd = pr.ok ? await pr.json() : null;
          if (currentPatternRevision.current !== requestedRevision) return;
          setRestAnalysis(pd?.success && pd.practice ? {
            creativeState: response.creativeState, practiceId: pd.practice.id, practice: pd.practice.name,
            wisdom: response.wisdom, audioFile: pd.practice.audioUrl
          } : { creativeState: response.creativeState, practice: "Guided Rest Practice", wisdom: response.wisdom, audioFile: null });
          queryClient.invalidateQueries({ queryKey: ['/api/rest-practice/today', today] });
        } catch {
          if (currentPatternRevision.current !== requestedRevision) return;
          setRestAnalysis({ creativeState: response.creativeState, practice: "Rest & Restore Guidance", wisdom: response.wisdom, audioFile: null });
        }
      } else {
        setRestAnalysis({ creativeState: "CE", practice: "Default Practice", wisdom: "Take a moment to breathe and centre yourself.", audioFile: null });
      }
    } catch {
      setRestAnalysis({ creativeState: "CE", practice: "Default Practice", wisdom: "Rest is always available to you. Trust your inner wisdom.", audioFile: null });
    } finally { setRestProcessing(false); setRestInput(''); }
  };

  const rotateRestPractice = async () => {
    if (!restAnalysis?.creativeState || !audioPractice) return;
    try {
      const after = audioPractice.id ? `&afterPracticeId=${encodeURIComponent(audioPractice.id)}` : '';
      const r = await fetch(`/api/practices/${restAnalysis.creativeState}/meditation?cyclePhase=${enhancedCycleData.cyclePhase || 'unknown'}${after}`, { credentials: 'include' });
      const d = r.ok ? await r.json() : null;
      if (d?.success && d.practice) {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          setCurrentAudio(null);
        }
        setIsPlayingAudio(false);
        setAudioProgress(0);
        setAudioDuration(0);
        setAudioPractice({ id: d.practice.id, practice: d.practice.name, audioFile: d.practice.audioUrl });
      }
    } catch (e) { console.error('Error rotating practice:', e); }
  };

  // ── Audio controls ────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!audioPractice?.audioFile) return;
    if (isPlayingAudio && currentAudio) { currentAudio.pause(); setIsPlayingAudio(false); return; }
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    const audio = new Audio(audioPractice.audioFile);
    audio.onloadedmetadata = () => setAudioDuration(audio.duration);
    audio.ontimeupdate     = () => setAudioProgress(audio.currentTime);
    audio.onended          = () => { setIsPlayingAudio(false); setAudioProgress(0); };
    audio.onerror          = () => setIsPlayingAudio(false);
    setCurrentAudio(audio); audio.play(); setIsPlayingAudio(true);
  };
  const handleRewind      = () => { if (currentAudio) currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 15); };
  const handleFastForward = () => { if (currentAudio) currentAudio.currentTime = Math.min(currentAudio.duration, currentAudio.currentTime + 15); };
  const handleProgressChange = (e) => {
    if (!currentAudio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    currentAudio.currentTime = ((e.clientX - rect.left) / rect.width) * currentAudio.duration;
  };
  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => () => { if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; } }, [currentAudio]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getCurrentDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const getPreviousDate = () => new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const getRestDateLabel = () => {
    const now = new Date();
    const date = now.getHours() < 18 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
    return `${now.getHours() < 18 ? 'Recording last night' : 'Recording tonight'} — ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const calculateRestDuration = () => {
    const tot = calculateRestSpanMinutes(sleepData.restTime, sleepData.riseTime);
    if (tot === null) return 'N/A';
    return `${Math.floor(tot / 60)}h ${tot % 60}m`;
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl isolate">
      <div className="w-full h-full flex flex-col">

        <RestHeader />

        <RestZone2
          practiceView={practiceView} setPracticeView={setPracticeView}
          sleepData={sleepData} updateSleepData={updateSleepData}
          isSubmitting={isSubmitting}
          isRestSubmittedToday={isRestSubmittedToday} isRisingSubmittedToday={isRisingSubmittedToday}
          handleRestSubmission={handleRestSubmission} handleRisingSubmission={handleRisingSubmission}
          restInput={restInput} setRestInput={setRestInput}
          restProcessing={restProcessing} restAnalysis={restAnalysis}
          audioPractice={audioPractice}
          analyzeRestNeeds={analyzeRestNeeds} rotateRestPractice={rotateRestPractice}
          isPlayingAudio={isPlayingAudio} audioProgress={audioProgress} audioDuration={audioDuration}
          handlePlayPause={handlePlayPause} handleRewind={handleRewind} handleFastForward={handleFastForward}
          handleProgressChange={handleProgressChange} formatTime={formatTime}
          calculateRestDuration={calculateRestDuration}
          currentCycleInfo={currentCycleInfo} currentMoonCenter={currentMoonCenter}
          cycleData={cycleData} cycleProgress={cycleProgress}
          getMoonPhase={getMoonPhase} getDaysToNextPhase={getDaysToNextPhase} moonTimezone={userTimezone}
          getPatternIcon={getPatternIcon}
          setShowRestRisingModal={setShowRestRisingModal}
          setShowPhaseModal={setShowPhaseModal}
          setShowSymbolModal={setShowSymbolModal}
          getCurrentDate={getCurrentDate} getPreviousDate={getPreviousDate} getRestDateLabel={getRestDateLabel}
          lifeStage={lifeStage} updateLifeStage={updateLifeStage}
          alcoholConsumed={alcoholConsumed} setAlcoholConsumed={setAlcoholConsumed}
          nightWakings={nightWakings} setNightWakings={setNightWakings}
          nightSweats={nightSweats} setNightSweats={setNightSweats}
        />

        {/* ── Modals ──────────────────────────────────────────────────────────── */}

        {showRestRisingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowRestRisingModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-lg w-full mx-4 relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowRestRisingModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Rest & Rising: Ancient Wisdom Meets Neural Science</h3>
              <div className="space-y-4 text-sm text-gray-700 leading-relaxed font-light">
                <p>The Default Mode Network (DMN) dismantles the 'sense of self' during deep sleep. This process releases us from our daytime identity, fixed thoughts, and emotional patterns — allowing the brain to process emotions without ego interference, integrate experiences without mental filters, all while preserving information.</p>
                <p>Traditional medicine systems developed specific practices to support this nightly transformation.</p>
                <div>
                  <p className="font-medium text-gray-700 mb-2">Ayurveda</p>
                  <p>Sleep was considered sacred time for cellular repair. Evening practices included Abhyanga (self-massage with warm oil), herbal teas with Ashwagandha, and Pranayama breathing to activate the parasympathetic nervous system.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 mb-2">Traditional Chinese Medicine</p>
                  <p>Sleep between 11pm and 3am was considered the most restorative period when Qi flows through the liver and gallbladder meridians. Evening practices included specific acupressure points and herbal formulas.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 mb-2">GOE Rest Intelligence</p>
                  <p>This card synthesises these traditions with modern nervous system science — using your daily inputs to build a picture of your unique rest and rising patterns across your cycle.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPhaseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowPhaseModal(null)}>
            <div className="goe-glass rounded-xl p-6 max-w-lg w-full relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowPhaseModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>

              {showPhaseModal === 'cycle' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-gray-700 mb-3">Cycle × Sleep</h3>
                <p>Your sleep needs don't stay static — they shift with your hormones and throughout the menstrual cycle. Hormones regulate body temperature, energy expenditure, and depth of rest — each phase carries distinct patterns:</p>
                <div><p className="font-medium">Follicular (Day 1–14)</p><p>This is your best shot at high-quality sleep. Rising estrogen supports REM, stabilizes mood, and regulates temperature. You may actually need less sleep here and still feel restored.</p></div>
                <div><p className="font-medium">Ovulation (~Day 14)</p><p>Estrogen peaks and progesterone begins. Slight temperature rise can make sleep feel shallow or delayed. This reflects heightened physiological activity — it's a sign you're at your energetic apex.</p></div>
                <div><p className="font-medium">Luteal (Day 15–28)</p><p>Your body starts demanding more: 168 extra calories a day, elevated core temperature, mental fatigue — all while delivering less sleep. Progesterone is sedating, but it fragments sleep. The deeper work is happening here. Prioritize quality rest and nourishment. Energy demands are higher.</p></div>
                <div><p className="font-medium">Menstruation (Day 1–5)</p><p>The energy drop is real. Blood loss, hormonal reset, and inflammation require more recovery — and intentional rest. It's your body reclaiming energy from within.</p></div>
              </div>)}

              {showPhaseModal === 'moon' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-gray-700 mb-3">Moon × Sleep</h3>
                <p>Lunar phases influence sleep timing, quality, and hormone regulation — consistently observed across clinical and lab environments:</p>
                <div><p className="font-medium">Full Moon</p><p>Sleep onset is slower. Total sleep duration drops by ~20 minutes. Deep sleep decreases by ~30%. Melatonin secretion is reduced. These patterns occur without moonlight, pointing to internal lunar entrainment.</p></div>
                <div><p className="font-medium">New Moon</p><p>Similar reduction in sleep duration observed. Gravitational influence — not brightness — is likely responsible. Internal lunar rhythms respond to subtle shifts in environment.</p></div>
                <div><p className="font-medium">Sex-Based Differences</p><p>Women show a greater drop in deep and REM sleep around the full moon, while men may show increases in REM. These distinctions suggest embedded biological responses that differ by sex and endocrine patterning.</p></div>
                <p>These are measurable physiological responses to environmental cycles. Tuning into them gives context, not constraints.</p>
              </div>)}

              {showPhaseModal === 'center' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-gray-700 mb-3">Kundalini Moon Centres: Women's Embodied Clock</h3>
                <p>Across traditions, the Moon has been central to understanding women's health — biologically, emotionally, spiritually, and creatively.</p>
                <p>TCM maps yin/yang, Blood, Qi, and meridian flow to the lunar cycle.</p>
                <p>Ayurveda tracks doshic shifts with moon phases and hormonal tides.</p>
                <p>Astrology assigns archetypes and planetary forces to each lunar and menstrual phase.</p>
                <p>Kundalini Yoga maps 11 Kundalini Moon Centres — energetic points in the female body that shift every 2.5 days, mirroring the Moon's path through the zodiac.</p>
                <p>Each cycle is unique, like a fingerprint. These systems weren't designed for linear productivity — they were designed to reflect nature. The Moon was, and still is, a woman's most embodied clock.</p>
              </div>)}

              {showPhaseModal === 'Menstruation' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-red-800 mb-3">Menstruation (Blood Phase)</h3>
                <div><p className="font-medium">Ayurveda</p><p>Menstruation is a monthly cleanse requiring rest and rejuvenation. Your body is doing major detox work — shedding the lining and releasing accumulated toxins. This requires deep, restorative sleep.</p></div>
                <div><p className="font-medium">TCM</p><p>The focus is on invigorating the flow of qi (life energy) and blood to ensure the lining can fully release. This Blood Phase requires abundant movement internally, which means you need more sleep to support this intensive process.</p></div>
              </div>)}

              {showPhaseModal === 'Follicular' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-pink-800 mb-3">Follicular (Yin Phase — Building Energy)</h3>
                <div><p className="font-medium">Ayurveda</p><p>Post-menstrual phase when the body rebuilds and regenerates, dominated by Kapha (the building, nourishing energy). Sleep fuels this reconstruction as your body grows new lining and develops follicles.</p></div>
                <div><p className="font-medium">TCM</p><p>Building Yin (the cool, nourishing, building energy) — growing new blood and tissue in the uterine lining. Sleep during this phase directly supports cellular growth and development.</p></div>
              </div>)}

              {showPhaseModal === 'Ovulatory' && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-rose-800 mb-3">Ovulation (Yang Phase — Active Energy)</h3>
                <div><p className="font-medium">Ayurveda</p><p>Pitta (fire energy) increases, bringing heat and fluidity. Your metabolic fire is most active. Sleep may be lighter because your body's energy is naturally more active and alert.</p></div>
                <div><p className="font-medium">TCM</p><p>Yin (building energy) peaks and transforms to Yang (active, warm energy). This energetic switch triggers ovulation. You need less sleep but higher quality rest during this high-energy phase.</p></div>
              </div>)}

              {(showPhaseModal === 'Luteal' || showPhaseModal === 'Early Luteal' || showPhaseModal === 'Late Luteal') && (<div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                <h3 className="text-base font-medium text-purple-800 mb-3">{showPhaseModal} (Processing Phase)</h3>
                <div><p className="font-medium">Ayurveda</p><p>Vata (the air element, governing movement) begins to rise, bringing potential restlessness and mental activity. Grounding sleep practices become essential to calm the nervous system.</p></div>
                <div><p className="font-medium">TCM</p><p>Yang phase when progesterone (warming hormone) dominates. Your body processes the month's experiences and prepares for the next cycle. Deep sleep is crucial for emotional and physical integration.</p></div>
              </div>)}

            </div>
          </div>
        )}

        {showSymbolModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowSymbolModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-sm w-full relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowSymbolModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h3 className="text-base font-medium text-gray-700 mb-3">Nervous System Pattern Information</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">These symbols reflect your natural rhythm across daily energy, rest, and rising patterns.</p>
              <div className="space-y-4 mb-4">
                <div className="flex items-center gap-3"><RegulatedIcon /><div><p className="text-sm font-medium text-green-700">Resourced</p><p className="text-xs text-gray-700">Integrated, present, grounded — your system is in a state of ease.</p></div></div>
                <div className="flex items-center gap-3"><ActivatedIcon /><div><p className="text-sm font-medium text-yellow-700">Activated</p><p className="text-xs text-gray-700">Mobilised, alert — your system is responsive but not overwhelmed.</p></div></div>
                <div className="flex items-center gap-3"><DepletedIcon /><div><p className="text-sm font-medium text-red-700">Depleted</p><p className="text-xs text-gray-700">Overextended, low capacity — your system needs deep restoration.</p></div></div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">Your systems naturally cycle between these states — nervous, hormonal, circadian rhythms all fluctuating together. None are permanent — they're information about what your body needs. Regulation isn't a destination you maintain, it's a cyclical flow you move through.</p>
              <p className="text-sm text-gray-700 leading-relaxed mt-2">Your systems are always working for you.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RestIntelligenceCard;
