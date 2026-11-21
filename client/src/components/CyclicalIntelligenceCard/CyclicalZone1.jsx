// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 1 — Calendar: cycle phase grid, period controls, moon centres

import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

const CyclicalZone1 = ({
  currentCalendarMonth, setCurrentCalendarMonth,
  currentCalendarYear, setCurrentCalendarYear,
  monthName, days,
  openCalendarPicker, extendCycle,
  setShowCycleInfoModal,
  handleDayClick,
  getPhaseColor,
}) => (
  <div className="flex-1">
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-6 h-full">
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2">
          <h4 className="text-lg font-medium text-gray-700 tracking-wide text-center">Cyclical Calendar</h4>
          <button onClick={() => setShowCycleInfoModal(true)} className="text-gray-400 hover:text-gray-600">
            <Info size={16} />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => {
            if (currentCalendarMonth === 0) {
              setCurrentCalendarMonth(11);
              setCurrentCalendarYear(currentCalendarYear - 1);
            } else {
              setCurrentCalendarMonth(currentCalendarMonth - 1);
            }
          }}
          className="p-2 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="font-medium text-gray-800 text-base tracking-wide">{monthName}</h3>
        <button
          onClick={() => {
            if (currentCalendarMonth === 11) {
              setCurrentCalendarMonth(0);
              setCurrentCalendarYear(currentCalendarYear + 1);
            } else {
              setCurrentCalendarMonth(currentCalendarMonth + 1);
            }
          }}
          className="p-2 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex justify-center gap-2 md:gap-4 mb-2">
        <button
          onClick={() => openCalendarPicker('start')}
          className="px-4 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 bg-gradient-to-br from-rose-50 to-pink-100 border border-pink-200 text-gray-700 hover:bg-pink-100"
          data-testid="button-period-started"
        >
          Period Started
        </button>
        <button
          onClick={extendCycle}
          className="px-4 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 text-gray-700 hover:bg-violet-100"
          data-testid="button-extend-cycle"
        >
          Extend Cycle
        </button>
        <button
          onClick={() => openCalendarPicker('end')}
          className="px-4 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 bg-gradient-to-br from-green-50 to-emerald-100 border border-emerald-200 text-gray-700 hover:bg-emerald-100"
          data-testid="button-period-ended"
        >
          Period Ended
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 md:gap-3 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="text-center font-medium text-gray-600 text-xs md:text-sm">{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 md:gap-3 text-sm auto-rows-[minmax(5.5rem,_1fr)] md:auto-rows-[minmax(6.5rem,_1fr)]">
        {days.map((dayInfo, i) => (
          <div
            key={i}
            className={`rounded border relative transition-colors overflow-hidden ${
              !dayInfo.date ? 'invisible' :
              dayInfo.isToday ? 'ring-2 ring-gray-400 bg-gray-50 cursor-pointer' :
              dayInfo.isHistoricalPeriod ? 'bg-gradient-to-br from-rose-50 to-pink-100 border-red-800 border-opacity-30 text-red-900 cursor-pointer hover:opacity-80' :
              dayInfo.cycleInfo.phase ? getPhaseColor(dayInfo.cycleInfo.phase) + ' cursor-pointer hover:opacity-80' :
              'bg-white border-gray-200 hover:bg-gray-50 cursor-pointer'
            }`}
            onClick={() => handleDayClick(dayInfo)}
          >
            {/* Fertility corner tab */}
            {dayInfo.cycleInfo && dayInfo.cycleInfo.isFertile && (
              <div className="absolute top-0 right-0 w-4 h-4 z-10" aria-label="Fertility window" role="img">
                <div className="absolute top-0 right-0 w-4 h-4 bg-gradient-to-br from-amber-100 to-orange-200 border border-orange-300 rounded-bl-full"></div>
              </div>
            )}
            {dayInfo.day && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0 p-2 md:p-3">
                <div className="font-semibold text-base md:text-lg tracking-wide">{dayInfo.day}</div>
                {dayInfo.cycleInfo.day && (
                  <div className="text-xs md:text-sm font-medium opacity-75">
                    D{dayInfo.cycleInfo.day}
                  </div>
                )}
                {dayInfo.moonCenter.current && (
                  <div className="hidden md:block text-[10px] md:text-xs font-light opacity-70 leading-tight truncate px-0.5">
                    {dayInfo.moonCenter.current}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default CyclicalZone1;
