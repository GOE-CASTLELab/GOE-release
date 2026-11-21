// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 1 — Astrology tab: Birth Chart + Current Sky + Current Transits

import { ChevronLeft, ChevronRight, RefreshCw, Info, X } from 'lucide-react';
const formatAstrologyDate = (dateStr, record) => {
  if (record?.displayDates?.[dateStr]?.short) return record.displayDates[dateStr].short;
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSkyDegree = (degree) => degree?.replace("'", '′') || '';

const CurrentSkyMovement = ({ planet }) => {
  const movement = planet.retrogradeMovement;
  const signMovement = planet.signMovement;

  if (planet.retrograde && movement) {
    return (
      <div className="flex flex-col items-center gap-0.5 md:gap-1 leading-tight">
        <div className="text-base md:text-lg font-semibold text-gray-700 tracking-wide flex items-center justify-center gap-1">
          {planet.planet}
          <span className="text-xs font-normal text-amber-600 tracking-normal">Rx</span>
        </div>
        <div className="text-xs md:text-sm text-gray-600 font-light whitespace-nowrap">
          {planet.sign} · {formatSkyDegree(planet.degree)}
        </div>
        <div className="text-xs md:text-sm text-amber-600 font-light whitespace-nowrap">
          Moves forward {formatAstrologyDate(movement.directAt, planet)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5 md:gap-1 leading-tight">
      <div className="text-base md:text-lg font-semibold text-gray-700 tracking-wide flex items-center justify-center gap-1">
        {planet.planet}
        {planet.retrograde && <span className="text-xs font-normal text-amber-600 tracking-normal">Rx</span>}
      </div>
      <div className="text-xs md:text-sm text-gray-600 font-light whitespace-nowrap">
        {planet.sign} · {formatSkyDegree(planet.degree)}
      </div>
      {signMovement && (
        <div className="text-xs md:text-sm text-gray-500 font-light whitespace-nowrap">
          {signMovement.direction === 'backward' ? '←' : '→'} {signMovement.nextSign} · {formatAstrologyDate(signMovement.nextSignAt, planet)}
        </div>
      )}
    </div>
  );
};

const CurrentSkyTimeline = ({ planet }) => {
  const movement = planet.retrogradeMovement;
  if (!planet.retrograde || !movement) return null;
  const date = (value) => planet.displayDates?.[value]?.long || new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="text-sm text-gray-800 leading-relaxed mb-3 space-y-2">
      {movement.crossesSignBoundary && movement.crossingAt && (
        <p>{date(movement.crossingAt)} — moved backward from {movement.nextSign} into {movement.crossingSign}.</p>
      )}
      <p>{date(movement.directAt)} — begins moving forward in {movement.directSign}.</p>
      <p>{date(movement.nextSignAt)} — enters {movement.nextSign}{movement.crossesSignBoundary ? ' again' : ''}.</p>
    </div>
  );
};


const AstrologyZone1 = ({
  astrologyData,
  birthChartLoading,
  selectedPlanet, setSelectedPlanet,
  skyScrollRef, transitsScrollRef,
  scrollSkyLeft, scrollSkyRight, scrollTransitsLeft, scrollTransitsRight,
  getPlanetClaudeInsight, getTransitClaudeInsight,
  showBirthChartModal, setShowBirthChartModal,
  showSkyForecastModal, setShowSkyForecastModal,
  showTransitsModal, setShowTransitsModal,
}) => (
  <div>
    {/* Current Sky Forecast Modal */}
    {showSkyForecastModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowSkyForecastModal(false)}>
        <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowSkyForecastModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Current Sky Forecast</h3>
          <p className="text-sm text-muted-foreground leading-relaxed text-left mb-3">
            Real-time astronomical data showing how current planetary positions interact with your birth chart — revealing personal, creative, and relational patterns at play right now.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed text-left mb-3">
            When a planet like Mercury, Venus, or Mars turns retrograde, it's an event: a departure from normal forward motion that shifts its energy inward. The nodes work differently. The North Node (your soul's growth direction in this lifetime) and South Node (the past you carry naturally) travel retrograde almost always — it's their baseline, not a signal that something unusual is happening.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            Pattern recognition applied to the largest system we're embedded in.
          </p>
        </div>
      </div>
    )}

    {/* Current Transits Modal */}
    {showTransitsModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowTransitsModal(false)}>
        <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowTransitsModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Current Transits</h3>
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            How current planetary movements interact with your birth sky to reveal natural timing for creative work, relationships, and growth. Rhythm recognition, not fortune telling.
          </p>
          <div className="text-sm text-muted-foreground leading-relaxed text-left mt-4 space-y-2">
            <p><strong>Conjunction (0°)</strong> - Activation. The transiting planet intensifies your natal planet's themes—amplifying what's already in you.</p>
            <p><strong>Opposition (180°)</strong> - Confrontation. External circumstances mirror and challenge your natal planet, added intensity for you to integrate polarities and find balance.</p>
            <p><strong>Square (90°)</strong> - Pressure. Dynamic tension forcing growth and action. Obstacles that encourage you to develop mastery through effort and adjustment.</p>
            <p><strong>Trine (120°)</strong> - Support. Easy flow and opportunities aligning with your natal gifts. Things come together naturally if you engage them.</p>
            <p><strong>Sextile (60°)</strong> - Opening. Supportive circumstances offering possibilities that reward your initiative and conscious participation.</p>
          </div>
        </div>
      </div>
    )}

    {/* Birth Chart Modal */}
    {showBirthChartModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowBirthChartModal(false)}>
        <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowBirthChartModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Birth Chart</h3>
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            Your personal cosmic blueprint showing planetary positions at the moment of your birth. This foundational data creates the reference point for all current sky and transit interpretations.
          </p>
        </div>
      </div>
    )}

    {/* Birth Chart Section */}
    <div className="goe-glass rounded-xl p-4 flex-1 flex flex-col mb-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-lg tracking-wide flex items-center gap-2">
            Birth Chart
            <button onClick={() => setShowBirthChartModal(true)} className="text-gray-400 hover:text-gray-600 transition-colors"><Info size={16} /></button>
          </h3>
          <p className="text-sm text-muted-foreground font-normal">Your cosmic blueprint</p>
        </div>
        {birthChartLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={16} className="animate-spin" />
            Loading birth chart...
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-h-96 overflow-y-auto">
        {astrologyData.birthChartData ? (
          ((() => {
            const planetOrder = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode', 'midheaven'];
            return planetOrder
              .filter(planetName => astrologyData.birthChartData[planetName])
              .map((planetName, idx) => {
                const planetData = astrologyData.birthChartData[planetName];
                return [planetName, planetData, idx];
              });
          })()
            .map(([planetName, planetData, idx]) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-4 text-center border border-gray-200 cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-all duration-200 transform hover:scale-105 min-h-[140px] md:min-h-[160px] flex flex-col justify-center"
                onClick={() => setSelectedPlanet(selectedPlanet === `birth-${idx}` ? null : `birth-${idx}`)}
              >
                <div className="text-2xl md:text-3xl mb-1">
                  {(() => {
                    const planetSymbols = {
                      'sun': '☉', 'moon': '☽', 'mercury': '☿', 'venus': '♀', 'mars': '♂',
                      'jupiter': '♃', 'saturn': '♄', 'uranus': '♅', 'neptune': '♆', 'pluto': '♇',
                      'chiron': '⚷', 'northNode': '☊', 'southNode': '☋', 'rising': 'AC', 'midheaven': 'MC'
                    };
                    const symbol = planetSymbols[planetName] || '⭐';
                    if (symbol === 'AC' || symbol === 'MC') {
                      return <span style={{ fontSize: '1rem', letterSpacing: '-0.1em', fontWeight: '500' }}>{symbol}</span>;
                    }
                    return symbol;
                  })()}
                </div>
                <div className="text-base md:text-lg font-semibold text-gray-700 mb-1 tracking-wide capitalize">
                  {(() => {
                    const displayNames = { 'northNode': 'North Node', 'southNode': 'South Node', 'midheaven': 'Midheaven', 'rising': 'Rising' };
                    return displayNames[planetName] || planetName.charAt(0).toUpperCase() + planetName.slice(1);
                  })()}
                </div>
                <div className="text-sm md:text-base text-gray-600 font-light">{planetData?.sign} {planetData?.degree}</div>
                {planetData?.house && <div className="text-xs md:text-sm text-gray-500 font-light mt-1">{planetData.house} house</div>}
              </div>
            )))
        ) : (
          <div className="col-span-2 md:col-span-3 text-center text-gray-500 py-8">
            <p className="text-sm">{birthChartLoading ? 'Loading your birth chart...' : 'Birth chart not available'}</p>
            <p className="text-xs mt-1">{birthChartLoading ? 'Please wait while we fetch your cosmic blueprint' : 'Unable to load birth chart data'}</p>
          </div>
        )}
      </div>

      {/* Birth Chart Planet insight popup */}
      {selectedPlanet !== null && typeof selectedPlanet === 'string' && selectedPlanet.startsWith('birth-') && astrologyData.birthChartData && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlanet(null)}>
          <div className="goe-glass rounded-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div className="text-lg font-semibold text-gray-700">
                {(() => {
                  const planetIndex = parseInt(selectedPlanet.split('-')[1]);
                  const planetOrder = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode', 'midheaven'];
                  const availablePlanets = planetOrder.filter(planetName => astrologyData.birthChartData[planetName]);
                  const planetName = availablePlanets[planetIndex] || 'Planet';
                  const displayNames = { 'northNode': 'North Node', 'southNode': 'South Node', 'midheaven': 'Midheaven', 'rising': 'Rising' };
                  return displayNames[planetName] || planetName.charAt(0).toUpperCase() + planetName.slice(1);
                })()}
              </div>
              <button onClick={() => setSelectedPlanet(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {(() => {
                const planetIndex = parseInt(selectedPlanet.split('-')[1]);
                const planetOrder = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode', 'midheaven'];
                const availablePlanets = planetOrder.filter(planetName => astrologyData.birthChartData[planetName]);
                const planetName = availablePlanets[planetIndex];
                const planetData = planetName ? astrologyData.birthChartData[planetName] : null;
                return planetData ? `${planetData.sign} ${planetData.degree}${planetData.house ? ` • ${planetData.house} house` : ''}` : 'Planet information';
              })()}
            </div>
            <div className="text-sm text-gray-800 leading-relaxed">
              {(() => {
                const planetIndex = parseInt(selectedPlanet.split('-')[1]);
                const planetOrder = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode', 'midheaven'];
                const availablePlanets = planetOrder.filter(planetName => astrologyData.birthChartData[planetName]);
                const planetName = availablePlanets[planetIndex];
                if (astrologyData.interpretations && planetName && astrologyData.interpretations[planetName]) {
                  return astrologyData.interpretations[planetName];
                }
                return "Personalized interpretation will be loaded here from GOE's GAIA.";
              })()}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Current Sky Forecast */}
    <div className="goe-glass rounded-xl p-4 flex-1 flex flex-col mb-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-lg tracking-wide flex items-center gap-2">
            Current Sky Forecast
            <button onClick={() => setShowSkyForecastModal(true)} className="text-gray-400 hover:text-gray-600 transition-colors"><Info size={16} /></button>
          </h3>
          <p className="text-sm text-muted-foreground font-normal">Today's planetary positions</p>
        </div>
      </div>

      <div className="relative flex-1 mb-4">
        <button onClick={scrollSkyLeft} className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
          <ChevronLeft size={20} />
        </button>
        <div
          ref={skyScrollRef}
          className="flex gap-4 overflow-x-auto px-8 h-full items-center min-h-[200px] scrollbar-hide"
          style={{ touchAction: 'pan-x' }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {!astrologyData.currentSkyData || astrologyData.currentSkyData.length === 0 ? (
            <div className="w-full text-center text-gray-500 py-8">
              <p className="text-sm">Loading sky data...</p>
              <p className="text-xs mt-1">Processing current planetary positions</p>
            </div>
          ) : (
            astrologyData.currentSkyData.map((planet, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-40 h-40 md:w-48 md:h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 md:p-6 text-center cursor-pointer hover:from-gray-100 hover:to-gray-200 border border-gray-200 relative flex flex-col justify-center shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={() => setSelectedPlanet(selectedPlanet === idx ? null : idx)}
              >
                <div className="text-3xl md:text-5xl mb-1 md:mb-2">{planet.symbol}</div>
                <CurrentSkyMovement planet={planet} />
              </div>
            ))
          )}
        </div>
        <button onClick={scrollSkyRight} className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Planet insight popup */}
      {selectedPlanet !== null && astrologyData.currentSkyData && selectedPlanet < astrologyData.currentSkyData.length && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlanet(null)}>
          <div className="goe-glass rounded-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div className="text-lg font-semibold text-gray-700">
                {astrologyData.currentSkyData[selectedPlanet].planet} {astrologyData.currentSkyData[selectedPlanet].symbol}
              </div>
              <button onClick={() => setSelectedPlanet(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
              <span>{astrologyData.currentSkyData[selectedPlanet].sign} {astrologyData.currentSkyData[selectedPlanet].degree}</span>
              {astrologyData.currentSkyData[selectedPlanet].retrograde && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Rx</span>
              )}
            </div>
            <CurrentSkyTimeline planet={astrologyData.currentSkyData[selectedPlanet]} />
            <div className="text-sm text-gray-800 leading-relaxed">
              {(() => {
                const planetName = astrologyData.currentSkyData[selectedPlanet].planet;
                const claudeInsight = getPlanetClaudeInsight(planetName);
                return claudeInsight || 'GOE interpretation is being generated. Please check back in a moment.';
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Current Transits */}
      <div className="border-t border-gray-100 pt-4 flex-1">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-foreground text-lg tracking-wide flex items-center gap-2">
              Current Transits
              <button onClick={() => setShowTransitsModal(true)} className="text-gray-400 hover:text-gray-600 transition-colors"><Info size={16} /></button>
            </h3>
            <p className="text-sm text-muted-foreground font-normal">Current planetary movements</p>
          </div>
        </div>

        <div className="relative h-48">
          <button onClick={scrollTransitsLeft} className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
            <ChevronLeft size={20} />
          </button>
          <div
            ref={transitsScrollRef}
            className="flex gap-4 overflow-x-auto px-8 h-full items-center scrollbar-hide"
            style={{ touchAction: 'pan-x' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {!astrologyData.currentTransits || !Array.isArray(astrologyData.currentTransits) || astrologyData.currentTransits.length === 0 ? (
              <div className="w-full text-center text-gray-500 py-8">
                <p className="text-sm">Loading transit data...</p>
                <p className="text-xs mt-1">Processing current planetary movements</p>
              </div>
            ) : (
              (() => {
                const groupedTransits = astrologyData.currentTransits.reduce((groups, transit, idx) => {
                  const category = transit.category || 'Other';
                  if (!groups[category]) groups[category] = [];
                  groups[category].push({ ...transit, originalIndex: idx });
                  return groups;
                }, {});
                return Object.entries(groupedTransits).map(([category, transits]) => (
                  <div key={category} className="flex flex-col mr-6 md:mr-8">
                    <div className="mb-2 md:mb-3">
                      <h4 className="text-xs md:text-sm font-semibold text-gray-600 uppercase tracking-wide">{category}</h4>
                    </div>
                    <div className="flex gap-4">
                      {transits.map((transit) => {
                        const windowStart = formatAstrologyDate(transit.windowStart, transit);
                        const windowEnd = formatAstrologyDate(transit.windowEnd, transit);
                        const exactDates = (transit.exactDates?.length ? transit.exactDates : [transit.exactAt || transit.exactDate])
                          .map(value => formatAstrologyDate(value, transit))
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <div
                            key={transit.originalIndex}
                            className="flex-shrink-0 w-64 h-32 md:w-72 md:h-40 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-4 border border-gray-200 cursor-pointer hover:from-gray-100 hover:to-gray-200 relative shadow-lg transition-all duration-200 transform hover:scale-105"
                            onClick={() => setSelectedPlanet(selectedPlanet === `transit-${transit.originalIndex}` ? null : `transit-${transit.originalIndex}`)}
                          >
                            <div className="flex flex-col h-full justify-center items-center text-center">
                              <div className="text-sm md:text-base text-gray-700 font-semibold leading-tight tracking-wide mb-2 md:mb-3">
                                {transit.transit || 'Transit data'}
                              </div>
                              <div className="text-xs md:text-sm text-gray-500">
                                {transit.rangeKind === 'influence' && windowStart && windowEnd && (
                                  <div className="font-medium">Influence: {windowStart} – {windowEnd}</div>
                                )}
                                {exactDates && <div>Exact: {exactDates}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
          <button onClick={scrollTransitsRight} className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Transit insight popup */}
      {selectedPlanet !== null && typeof selectedPlanet === 'string' && selectedPlanet.startsWith('transit-') && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlanet(null)}>
          <div className="goe-glass rounded-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div className="text-lg font-semibold text-gray-700">Transit Insight</div>
              <button onClick={() => setSelectedPlanet(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {(() => {
                const transitData = astrologyData.currentTransits[parseInt(selectedPlanet.split('-')[1])];
                return transitData?.transit || transitData?.aspect || 'Transit information';
              })()}
            </div>
            <div className="text-sm text-gray-800 leading-relaxed">
              {(() => {
                const transitIndex = parseInt(selectedPlanet.split('-')[1]);
                const transitData = astrologyData.currentTransits[transitIndex];
                const claudeInsight = getTransitClaudeInsight(transitData?.transit);
                return claudeInsight || 'GOE interpretation is being generated. Please check back in a moment.';
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default AstrologyZone1;
