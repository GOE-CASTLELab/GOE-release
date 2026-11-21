// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 2 — Practice Layer: CYCLES (context) + REST (evening) + RISING (morning) tabs + Chat
import React, { useState, useEffect, useRef } from 'react';
import { Info, Plus, Minus } from 'lucide-react';
import GOE88ChatButton from '@/components/GOE88ChatButton';

// ─── Shared UI helpers ───────────────────────────────────────────────────────

export const TimePickerClock = ({ value, onChange, className = '', compact = false }) => {
  const [hours, minutes] = (value || '22:00').split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  const adjust = (type, dir) => {
    let h = hours, m = minutes;
    if (type === 'hour') h = dir === 'up' ? (hours + 1) % 24 : hours === 0 ? 23 : hours - 1;
    else m = dir === 'up' ? (minutes + 15) % 60 : minutes === 0 ? 45 : minutes - 15;
    onChange(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  return (
    <div
      className={`${compact ? '' : 'bg-white border-gray-200'} rounded-xl ${compact ? 'px-2 py-1.5' : 'p-3'} border shadow-sm${className ? ` ${className}` : ''}`}
      style={compact ? {
        background: 'rgba(255,255,255,0.65)',
        borderColor: 'rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } : undefined}
    >
      <div className="flex items-center justify-center space-x-1">
        {[['hour', displayHour], ['minute', minutes.toString().padStart(2, '0')]].map(([type, val], i) => (
          <React.Fragment key={type}>
            {i > 0 && <div className="text-xl font-normal text-foreground mx-0.5">:</div>}
            <div className="flex flex-col items-center gap-0.5">
              <button type="button" onClick={() => adjust(type, 'up')} className={`btn-icon ${compact ? 'w-7 h-5' : 'w-11 h-11 md:w-8 md:h-6'}`}><Plus size={compact ? 12 : 16} /></button>
              <div className={`${compact ? 'text-base w-8 py-0.5' : 'text-xl w-11 md:w-12 py-1'} font-normal text-foreground text-center`}>{val}</div>
              <button type="button" onClick={() => adjust(type, 'down')} className={`btn-icon ${compact ? 'w-7 h-5' : 'w-11 h-11 md:w-8 md:h-6'}`}><Minus size={compact ? 12 : 16} /></button>
            </div>
          </React.Fragment>
        ))}
        <div className={`${compact ? 'text-xs' : 'text-base'} text-gray-700 ml-1`}>{period}</div>
      </div>
    </div>
  );
};

export const CustomDropdown = ({ value, onChange, options, placeholder, field, updateSleepData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 bg-white border border-gray-200 rounded-xl text-left tracking-wide transition-all hover:border-gray-300 focus:outline-none shadow-sm">
        <span className={value ? 'text-gray-700' : 'text-gray-400'}>{value || placeholder}</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {options.map((opt, i) => (
            <button key={i} onClick={() => { if (updateSleepData) updateSleepData({ [field]: opt }); onChange(opt); setIsOpen(false); }}
              className={`w-full px-4 py-3 text-left tracking-wide hover:bg-gray-50 transition-colors ${value === opt ? 'bg-gray-50 text-gray-700' : 'text-gray-700'}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sliding YES/NO toggle ────────────────────────────────────────────────────

const SlideToggle = ({ value, onChange, label }) => {
  const isYes = value === true;
  return (
    <div className={`flex items-center ${label ? 'justify-between' : 'justify-end'}`}>
      {label && <span className="text-sm text-gray-700 tracking-wide">{label}</span>}
      <button
        onClick={() => onChange(isYes ? false : true)}
        className={`relative inline-flex h-8 w-20 flex-shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none ${isYes ? 'bg-indigo-500 border-indigo-500' : 'bg-gray-200 border-gray-200'}`}
      >
        <span className={`absolute text-xs font-bold tracking-wide transition-opacity duration-150 ${isYes ? 'left-2.5 text-white opacity-100' : 'opacity-0'}`}>YES</span>
        <span className={`absolute text-xs font-bold tracking-wide transition-opacity duration-150 ${!isYes ? 'right-2 text-gray-500 opacity-100' : 'opacity-0'}`}>NO</span>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isYes ? 'translate-x-12' : 'translate-x-1'}`} />
      </button>
    </div>
  );
};

// ─── Tab: Cycles ──────────────────────────────────────────────────────────────

const LIFE_STAGE_OPTIONS = [
  { value: 'cycling',       label: 'Cycling',        desc: 'Regular menstrual cycle' },
  { value: 'perimenopause', label: 'Perimenopausal',  desc: 'Hormonal transition phase' },
  { value: 'postmenopause', label: 'Menopausal',      desc: 'Post-menopause' },
];

const LifeStagePicker = ({ lifeStage, updateLifeStage }) => {
  const [open, setOpen] = useState(false);
  const current = LIFE_STAGE_OPTIONS.find(o => o.value === lifeStage);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-full text-center">
        <div className="flex items-center justify-center space-x-2 mb-1">
          <p className="text-sm text-gray-700">Life Stage</p>
        </div>
        <p className="text-base font-medium text-gray-700">{current?.label || '— Set —'}</p>
        <p className="text-sm text-gray-700">{current?.desc || 'Tap to choose'}</p>
      </button>
      {open && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {LIFE_STAGE_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={() => { updateLifeStage(opt.value); setOpen(false); }}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${lifeStage === opt.value ? 'bg-indigo-50' : ''}`}>
              <p className={`text-sm font-medium ${lifeStage === opt.value ? 'text-indigo-700' : 'text-gray-700'}`}>{opt.label}</p>
              <p className="text-xs text-gray-700">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CyclesTab = ({ currentCycleInfo, currentMoonCenter, cycleData, cycleProgress,
  sleepData, getMoonPhase, getDaysToNextPhase, moonTimezone, getPatternIcon,
  setShowPhaseModal, setShowSymbolModal, lifeStage, updateLifeStage }) => {

  const today = new Date();
  const moonPhase = getMoonPhase(today);
  const nextMoonPhase = getDaysToNextPhase(today, moonTimezone);

  const phaseData = {
    "Menstruation": { avgRest: sleepData?.menstruationAvgRest, energyLevel: sleepData?.menstruationEnergyLevel, dailyPattern: sleepData?.menstruationDailyPattern, restPattern: sleepData?.menstruationRestPattern, risingPattern: sleepData?.menstruationRisingPattern, color: "from-red-100 to-pink-100", borderColor: "border-red-300" },
    "Follicular":   { avgRest: sleepData?.follicularAvgRest, energyLevel: sleepData?.follicularEnergyLevel, dailyPattern: sleepData?.follicularDailyPattern, restPattern: sleepData?.follicularRestPattern, risingPattern: sleepData?.follicularRisingPattern, color: "from-pink-100 to-rose-100", borderColor: "border-pink-300" },
    "Ovulatory":    { avgRest: sleepData?.ovulationAvgRest, energyLevel: sleepData?.ovulationEnergyLevel, dailyPattern: sleepData?.ovulationDailyPattern, restPattern: sleepData?.ovulationRestPattern, risingPattern: sleepData?.ovulationRisingPattern, color: "from-rose-100 to-rose-200", borderColor: "border-rose-300" },
    "Luteal":        { avgRest: sleepData?.lutealAvgRest, energyLevel: sleepData?.lutealEnergyLevel, dailyPattern: sleepData?.lutealDailyPattern, restPattern: sleepData?.lutealRestPattern, risingPattern: sleepData?.lutealRisingPattern, color: "from-purple-100 to-purple-200", borderColor: "border-purple-300" }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-medium text-gray-700 tracking-wide mb-2">Rest & Cycle Patterns</h4>
        <p className="text-sm text-gray-700">Ancient wisdom recognises sleep as cyclical</p>
      </div>

      {/* 4-tile context grid: Cycle Day / Moon Phase / Moon Center / Life Stage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Cycle Day', value: currentCycleInfo.day || '...', sub: currentCycleInfo.phase || '...', modal: 'cycle' },
          { label: 'Moon Phase', value: `${moonPhase.emoji} ${moonPhase.name}`, sub: nextMoonPhase, modal: 'moon' },
          { label: 'Kundalini Moon Centre', value: currentMoonCenter.current || 'Calculating...', sub: currentMoonCenter.details?.theme || 'Energetic focus', modal: 'center' },
        ].map(({ label, value, sub, modal }) => (
          <div key={label} className="goe-glass text-center p-4 rounded-xl">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <p className="text-sm text-gray-700">{label}</p>
              <button onClick={() => setShowPhaseModal(modal)} className="text-gray-400 hover:text-gray-600"><Info size={14} /></button>
            </div>
            <p className="text-base text-gray-700">{value}</p>
            <p className="text-sm text-gray-700">{sub}</p>
          </div>
        ))}
        {/* Life Stage tile */}
        <div className="goe-glass text-center p-4 rounded-xl">
          <LifeStagePicker lifeStage={lifeStage} updateLifeStage={updateLifeStage} />
        </div>
      </div>

      <div className="mb-6">
        <div className="bg-white rounded-full h-3 overflow-hidden border border-gray-200 shadow-sm">
          <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300" style={{width:`${cycleProgress || 32}%`}}/>
        </div>
        <p className="text-xs text-gray-700 text-center mt-2">Day {currentCycleInfo.day || '...'} of {cycleData.cycleLength}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(phaseData).map(([phase, data]) => (
          <div key={phase} className={`p-4 rounded-xl border-2 transition-all relative ${phase === (currentCycleInfo.phase === 'Early Luteal' || currentCycleInfo.phase === 'Late Luteal' ? 'Luteal' : currentCycleInfo.phase) ? `bg-gradient-to-br ${data.color} ${data.borderColor} ring-1 ring-gray-300 ring-opacity-30` : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-medium text-sm tracking-wide text-gray-700">{phase}</h4>
              <button onClick={() => setShowPhaseModal(phase)} className="text-gray-400 hover:text-gray-600"><Info size={14} /></button>
            </div>
            <div className="text-center py-2 mb-3">
              <div className="text-lg text-gray-700">{data.avgRest || ''}</div>
              <div className="text-xs text-gray-700">Average Rest</div>
            </div>
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Energy:{data.energyLevel ? ` ${data.energyLevel}` : ''}</span>
                <button onClick={() => setShowSymbolModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={14} /></button>
              </div>
              {[['Daily', data.dailyPattern], ['Rest', data.restPattern], ['Rising', data.risingPattern]].map(([label, pattern]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700">{label}:</span>
                  {getPatternIcon(pattern)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-xs text-gray-700 text-center bg-gray-50 rounded-lg p-3 leading-relaxed">
        Your personal patterns will appear as you log daily rest and rising data
      </div>
    </div>
  );
};

// ─── Tab: Rest (evening) ──────────────────────────────────────────────────────

const RestTab = ({ sleepData, updateSleepData, isSubmitting, isRestSubmittedToday, handleRestSubmission,
  restInput, setRestInput, restProcessing, restAnalysis, analyzeRestNeeds, rotateRestPractice,
  audioPractice,
  isPlayingAudio, audioProgress, audioDuration, handlePlayPause, handleRewind, handleFastForward,
  handleProgressChange, formatTime, setShowRestRisingModal, getRestDateLabel,
  alcoholConsumed, setAlcoholConsumed }) => {

  const ENERGY_OPTIONS = ["Steady Throughout Day", "Calm but Alert Energy", "Burn Out at 4pm", "Heavy/Dense Feeling", "Wired but Tired", "Sluggish Start, Better Later"];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center space-x-2">
          <h4 className="text-lg font-medium text-gray-700 tracking-wide">Evening Reflection</h4>
          <button onClick={() => setShowRestRisingModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={16} /></button>
        </div>
        <p className="text-sm text-gray-700">{getRestDateLabel()}</p>
      </div>

      <div className="goe-glass rounded-xl p-4 md:p-6">
        <h5 className="font-medium text-gray-700 mb-4 tracking-wide mobile-heading-scale">Rest & Reflection</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:items-stretch">
          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Time to Rest</label>
            <TimePickerClock className="flex-1 flex items-center justify-center" value={sleepData.restTime} onChange={(t) => updateSleepData({ restTime: t })} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-700 mb-3 block tracking-wide">Energy Assessment</label>
              <CustomDropdown value={sleepData.energyAssessment} onChange={() => {}} options={ENERGY_OPTIONS}
                placeholder="How was your energy today?" field="energyAssessment" updateSleepData={updateSleepData} />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-gray-700 mb-3 block tracking-wide">Alcohol Consumed Today</label>
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-end">
                <SlideToggle value={alcoholConsumed} onChange={setAlcoholConsumed} label="" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button onClick={handleRestSubmission} data-testid="button-submit-rest-data"
            disabled={isSubmitting || isRestSubmittedToday || !sleepData.energyAssessment || !sleepData.restTime}
            className="w-full bg-gradient-to-br from-indigo-400 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
            {isRestSubmittedToday ? 'Submitted' : isSubmitting ? 'Submitting...' : 'Submit Rest Data'}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <h5 className="font-medium text-gray-700 mb-3 tracking-wide">Rest & Restore Practice</h5>
        <div className="flex gap-2">
          <input type="text" placeholder="Share how you're feeling and your rest intelligence will choose tonight's practice."
            className="flex-1 p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-gray-400"
            value={restInput} onChange={(e) => setRestInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !restProcessing && restInput.trim() && analyzeRestNeeds(restInput.trim())}
            disabled={restProcessing} />
          <button onClick={() => restInput.trim() && analyzeRestNeeds(restInput.trim())}
            disabled={restProcessing || !restInput.trim()}
            className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium text-sm shadow-md disabled:opacity-50">
            {restProcessing ? <div className="flex space-x-1">{[0,0.1,0.2].map((d,i) => <div key={i} className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:`${d}s`}}/>)}</div> : 'GOE'}
          </button>
        </div>

        {restAnalysis && (
          <div className="space-y-3 mt-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
              <div><span className="font-medium text-gray-700">Practice:</span> <span className="text-gray-700">{restAnalysis.practice}</span></div>
              <div className="pt-3 border-t border-gray-100"><p className="text-sm text-gray-700 italic">"{restAnalysis.wisdom}"</p></div>
            </div>

            {audioPractice?.audioFile && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h6 className="text-sm font-medium text-gray-700">{audioPractice.practice}</h6>
                  <button onClick={rotateRestPractice} className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                  </button>
                </div>
                <div className="mb-3">
                  <div className="w-full h-2 bg-gray-200 rounded-full cursor-pointer" onClick={handleProgressChange}>
                    <div className="h-2 bg-gray-600 rounded-full transition-all" style={{width:`${audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0}%`}}/>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mt-1"><span>{formatTime(audioProgress)}</span><span>{formatTime(audioDuration)}</span></div>
                </div>
                <div className="flex items-center justify-center space-x-4">
                  <button onClick={handleRewind} className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    <span className="text-xs font-medium">15 sec</span>
                  </button>
                  <button onClick={handlePlayPause} className="w-12 h-12 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-700">
                    {isPlayingAudio ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                  </button>
                  <button onClick={handleFastForward} className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">
                    <span className="text-xs font-medium">15 sec</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!restAnalysis && (
          <div className="goe-glass rounded-xl p-4 mt-4">
            <h5 className="font-medium text-gray-700 tracking-wide mb-2">Personalized Audio Practice</h5>
            <p className="text-xs text-gray-700 leading-relaxed">Your practice will appear here after careful consideration — perfectly chosen for your current state</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Rising (morning) ───────────────────────────────────────────────────

const RisingTab = ({ sleepData, updateSleepData, isSubmitting, isRisingSubmittedToday,
  handleRisingSubmission, calculateRestDuration, setShowRestRisingModal,
  nightWakings, setNightWakings, nightSweats, setNightSweats, getPreviousDate }) => {

  const SLEEP_PROCESS_OPTIONS = ["Mind Blank/Peaceful", "Gradual Settling Down", "Instant Drop-Off", "Fragmented & Scattered", "Racing/Rumination", "Tossing & Turning"];
  const WAKING_STATE_OPTIONS  = ["Refreshed & Clear", "Groggy but Clearing", "Heavy & Dense", "Fragmented & Scattered", "Wired & Restless", "Startled/Jarring Awakening"];
  const NIGHT_WAKINGS_OPTIONS = ['0', '1–2', '3+'];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center space-x-2">
          <h4 className="text-lg font-medium text-gray-700 tracking-wide">Rising Assessment</h4>
          <button onClick={() => setShowRestRisingModal(true)} className="text-gray-400 hover:text-gray-600"><Info size={16} /></button>
        </div>
        <p className="text-sm text-gray-700">Recording last night — {getPreviousDate()}</p>
      </div>

      <div className="goe-glass rounded-xl p-4 md:p-6">
        <h5 className="font-medium text-gray-700 mb-4 tracking-wide mobile-heading-scale">Rest & Rising</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4">
          <div>
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Rise Time</label>
            <TimePickerClock value={sleepData.riseTime} onChange={(t) => updateSleepData({ riseTime: t })} />
          </div>
          <div>
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Rest Duration</label>
            <div className="goe-glass rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl text-gray-700 mb-1">{calculateRestDuration()}</div>
              <div className="text-xs text-gray-700 tracking-wide">Total Rest</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4">
          <div>
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Sleep Process</label>
            <CustomDropdown value={sleepData.sleepProcess} onChange={() => {}} options={SLEEP_PROCESS_OPTIONS}
              placeholder="How did falling asleep go?" field="sleepProcess" updateSleepData={updateSleepData} />
          </div>
          <div>
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Waking State</label>
            <CustomDropdown value={sleepData.wakingState} onChange={() => {}} options={WAKING_STATE_OPTIONS}
              placeholder="How do you feel now?" field="wakingState" updateSleepData={updateSleepData} />
          </div>
        </div>

        {/* Night Wakings + Night Sweats — matched height via items-stretch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:items-stretch">
          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Night Wakings</label>
            <CustomDropdown
              value={nightWakings}
              onChange={setNightWakings}
              options={NIGHT_WAKINGS_OPTIONS}
              placeholder="Times woken"
              field="nightWakings"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-3 block tracking-wide">Night Sweats / Hot Flashes</label>
            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-end">
              <SlideToggle value={nightSweats} onChange={setNightSweats} label="" />
            </div>
          </div>
        </div>

        <div className="mt-2">
          <button onClick={handleRisingSubmission} data-testid="button-submit-rising-data"
            disabled={isSubmitting || isRisingSubmittedToday || !sleepData.sleepProcess || !sleepData.wakingState || !sleepData.riseTime}
            className="w-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
            {isRisingSubmittedToday ? 'Submitted' : isSubmitting ? 'Submitting...' : 'Submit Rising Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RestZone2: tab switcher + chat ──────────────────────────────────────────

const RestZone2 = ({
  practiceView, setPracticeView,
  sleepData, updateSleepData,
  isSubmitting, isRestSubmittedToday, isRisingSubmittedToday,
  handleRestSubmission, handleRisingSubmission,
  restInput, setRestInput, restProcessing, restAnalysis, analyzeRestNeeds, rotateRestPractice,
  audioPractice,
  isPlayingAudio, audioProgress, audioDuration, handlePlayPause, handleRewind, handleFastForward,
  handleProgressChange, formatTime, calculateRestDuration,
  currentCycleInfo, currentMoonCenter, cycleData, cycleProgress,
  getMoonPhase, getDaysToNextPhase, moonTimezone, getPatternIcon,
  setShowRestRisingModal, setShowPhaseModal, setShowSymbolModal,
  getCurrentDate, getPreviousDate, getRestDateLabel,
  lifeStage, updateLifeStage,
  alcoholConsumed, setAlcoholConsumed,
  nightWakings, setNightWakings,
  nightSweats, setNightSweats,
}) => (
  <div className="mt-4">
    {/* Tab switcher */}
    <div className="goe-glass rounded-xl p-4 mb-4">
      <div className="text-center mb-3">
        <p className="text-sm text-gray-700">{getCurrentDate()}</p>
      </div>
      <div className="flex justify-center gap-2 md:gap-4">
        {[{ key: 'cycles', label: 'Cycles' }, { key: 'rest', label: 'Rest' }, { key: 'rising', label: 'Rising' }].map(({ key, label }) => (
          <button key={key} onClick={() => setPracticeView(key)}
            className={`px-4 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ${practiceView === key ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* Tab content */}
    <div className="goe-glass rounded-xl p-4 mb-4 flex-1">
      <div className="overflow-y-auto h-full">
        {practiceView === 'cycles' && <CyclesTab currentCycleInfo={currentCycleInfo} currentMoonCenter={currentMoonCenter}
          cycleData={cycleData} cycleProgress={cycleProgress} sleepData={sleepData}
          getMoonPhase={getMoonPhase} getDaysToNextPhase={getDaysToNextPhase} moonTimezone={moonTimezone} getPatternIcon={getPatternIcon}
          setShowPhaseModal={setShowPhaseModal} setShowSymbolModal={setShowSymbolModal}
          lifeStage={lifeStage} updateLifeStage={updateLifeStage} />}

        {practiceView === 'rest' && <RestTab sleepData={sleepData} updateSleepData={updateSleepData}
          isSubmitting={isSubmitting} isRestSubmittedToday={isRestSubmittedToday} handleRestSubmission={handleRestSubmission}
          restInput={restInput} setRestInput={setRestInput} restProcessing={restProcessing} restAnalysis={restAnalysis}
          audioPractice={audioPractice}
          analyzeRestNeeds={analyzeRestNeeds} rotateRestPractice={rotateRestPractice}
          isPlayingAudio={isPlayingAudio} audioProgress={audioProgress} audioDuration={audioDuration}
          handlePlayPause={handlePlayPause} handleRewind={handleRewind} handleFastForward={handleFastForward}
          handleProgressChange={handleProgressChange} formatTime={formatTime} setShowRestRisingModal={setShowRestRisingModal}
          getRestDateLabel={getRestDateLabel}
          alcoholConsumed={alcoholConsumed} setAlcoholConsumed={setAlcoholConsumed} />}

        {practiceView === 'rising' && <RisingTab sleepData={sleepData} updateSleepData={updateSleepData}
          isSubmitting={isSubmitting} isRisingSubmittedToday={isRisingSubmittedToday} handleRisingSubmission={handleRisingSubmission}
          calculateRestDuration={calculateRestDuration}
          setShowRestRisingModal={setShowRestRisingModal}
          nightWakings={nightWakings} setNightWakings={setNightWakings}
          nightSweats={nightSweats} setNightSweats={setNightSweats}
          getPreviousDate={getPreviousDate} />}
      </div>
    </div>

    <GOE88ChatButton gradient="from-blue-400 to-indigo-600" cardType="rest" />
  </div>
);

export default RestZone2;
