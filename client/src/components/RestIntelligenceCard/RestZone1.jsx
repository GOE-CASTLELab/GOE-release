// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 1 — Intelligence Layer: current nervous system state + phase-aware insight
import { NERVOUS_SYSTEM, getPhaseRestGuidance } from './restCalculations';

const RestZone1 = ({ nervousSystemState, currentCycleInfo, currentMoonCenter, sleepData }) => {
  const state = nervousSystemState ? NERVOUS_SYSTEM[nervousSystemState] : null;
  const phase = currentCycleInfo?.phase;
  const guidance = getPhaseRestGuidance(phase);

  const hasData = sleepData?.energyAssessment || sleepData?.sleepProcess || sleepData?.wakingState;

  return (
    <div className="goe-glass rounded-xl p-4 mb-4">
      <div className="flex items-start gap-4">
        {/* Nervous system state symbol */}
        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border-2 ${
          state ? `${state.bg} ${state.border}` : 'bg-gray-50 border-gray-200'
        }`}>
          {state ? (
            <span className={`text-2xl font-light ${state.color}`}>{state.symbol}</span>
          ) : (
            <span className="text-2xl text-gray-300">◯</span>
          )}
        </div>

        {/* State label + guidance */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${state ? state.color : 'text-gray-400'}`}>
              {state ? state.label : 'No data yet'}
            </span>
            {state && (
              <span className="text-xs text-gray-400 font-light">— {state.description}</span>
            )}
          </div>

          <p className="text-sm text-gray-600 font-light leading-relaxed">
            {hasData ? guidance : 'Log your evening Rest or morning Rising to see your nervous system signal.'}
          </p>

          {/* Phase + moon center context */}
          {phase && (
            <div className="flex gap-3 mt-2">
              <span className="text-xs text-gray-400">
                Day {currentCycleInfo.day || '?'} · {phase}
              </span>
              {currentMoonCenter?.current && (
                <span className="text-xs text-gray-400">
                  · {currentMoonCenter.current} center
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Symbol legend */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 justify-center">
        {Object.entries(NERVOUS_SYSTEM).map(([key, ns]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`text-sm ${ns.color}`}>{ns.symbol}</span>
            <span className="text-xs text-gray-500 font-light">{ns.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RestZone1;
