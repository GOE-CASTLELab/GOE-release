// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAstrologyData } from '@/hooks/useAstrologyData';
import AstrologyHeader from './AstrologyHeader';
import AstrologyZone1 from './AstrologyZone1';
import AstrologyZone2 from './AstrologyZone2';
import AstrologyZone3 from './AstrologyZone3';
import GOE88ChatButton from '@/components/GOE88ChatButton';
import { normalizeStaticChartResponse, STAR_PEARL_ROLES, starPearlCardId } from '@/lib/staticCharts';

const AstrologyIntelligenceCard = () => {
  const { astrologyData: rawAstrologyData, updateAstrologyData, refreshSkyData, refreshCurrentTransits } = useAstrologyData();

  const [activeTab, setActiveTab] = useState('astrology');
  const [showCustomIntelligenceModal, setShowCustomIntelligenceModal] = useState(false);
  const [showSkyForecastModal, setShowSkyForecastModal] = useState(false);
  const [showTransitsModal, setShowTransitsModal] = useState(false);
  const [showBirthChartModal, setShowBirthChartModal] = useState(false);
  const [birthChartLoading, setBirthChartLoading] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [geneKeysData, setGeneKeysData] = useState(null);
  const [humanDesignData, setHumanDesignData] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  const skyScrollRef = useRef(null);
  const transitsScrollRef = useRef(null);
  const gkGeniusScrollRef = useRef(null);
  const gkLoveScrollRef = useRef(null);
  const gkProsperityScrollRef = useRef(null);
  const gkHarmonyScrollRef = useRef(null);
  const hdCoreScrollRef = useRef(null);
  const hdInsightsScrollRef = useRef(null);

  const astrologyData = rawAstrologyData || {};

  // Star Pearl content is stored in the existing harmonySequence database column.
  // (geneKeysData.harmonySequence, a jsonb array of {gate,line,title,content,transformation}).
  // Keyed by the tile id so getGeneKeysContent() below can look it up the same way
  // the static object used to. Empty/fork users (no geneKeysData yet) get {}.
  const starPearlContent = (() => {
    const seq = geneKeysData?.harmonySequence;
    if (!Array.isArray(seq) || seq.length === 0) return {};
    const out = {};
    STAR_PEARL_ROLES.forEach((role, i) => { if (seq[i]) out[starPearlCardId(role)] = seq[i]; });
    return out;
  })();

  const getGeneKeysContent = (cardId) => {
    if (starPearlContent[cardId]) return starPearlContent[cardId];
    if (!geneKeysData) return null;
    const fieldMap = {
      'genius-lifes-work': 'lifesWork', 'prosperity-lifes-work': 'lifesWork',
      'genius-evolution': 'evolution', 'genius-radiance': 'radiance', 'genius-purpose': 'purpose',
      'love-purpose': 'purpose', 'love-attraction': 'attraction', 'love-iq': 'iq',
      'love-eq': 'eq', 'love-sq': 'sq', 'love-vocation': 'vocation',
      'prosperity-vocation': 'vocation', 'prosperity-culture': 'culture', 'prosperity-pearl': 'pearl'
    };
    const fieldName = fieldMap[cardId];
    return fieldName ? geneKeysData[fieldName] : null;
  };

  const getHumanDesignContent = (cardId) => {
    if (!humanDesignData) return null;
    const fieldMap = {
      'type-strategy': 'typeStrategyInterpretation', 'authority': 'authorityInterpretation',
      'profile': 'profileInterpretation', 'definition': 'definitionInterpretation',
      'head': 'centers.head', 'ajna': 'centers.ajna', 'throat': 'centers.throat',
      'g': 'centers.g', 'heart': 'centers.heart', 'spleen': 'centers.spleen',
      'sacral': 'centers.sacral', 'solar-plexus': 'centers.solarPlexus', 'root': 'centers.root',
      'cross': 'incarnationCrossInterpretation', 'not-self': 'notSelfThemeInterpretation',
      'signature': 'signatureInterpretation'
    };
    const fieldPath = fieldMap[cardId];
    if (!fieldPath) return null;
    if (fieldPath.includes('.')) {
      const [parent, child] = fieldPath.split('.');
      return humanDesignData[parent]?.[child];
    }
    return humanDesignData[fieldPath];
  };

  const getPlanetClaudeInsight = (planetName) => {
    if (!astrologyData.currentSkyInterpretations) return null;
    return astrologyData.currentSkyInterpretations[planetName] || null;
  };

  const getTransitClaudeInsight = (transitText) => {
    if (!astrologyData.currentTransitsInterpretations?.current_transits) return null;
    const insight = astrologyData.currentTransitsInterpretations.current_transits.find(
      transit => transit.transit?.toLowerCase() === transitText?.toLowerCase()
    );
    return insight?.insight || null;
  };

  useEffect(() => {
    const loadBirthChartData = async () => {
      setBirthChartLoading(true);
      try {
        const response = await fetch('/api/birth-chart', { method: 'GET', credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        updateAstrologyData({ birthChartData: data.birthChart, interpretations: data.interpretations, lastUpdated: new Date() });
        await refreshSkyData();
        await refreshCurrentTransits();
      } catch (error) {
        console.error('Failed to load birth chart:', error);
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          window.location.href = '/api/login';
        }
      } finally {
        setBirthChartLoading(false);
      }
    };

    const loadGeneKeysData = async () => {
      try {
        const response = await fetch('/api/gene-keys');
        if (response.ok) setGeneKeysData(normalizeStaticChartResponse(await response.json()));
      } catch (error) { console.error('Failed to load Gene Keys data:', error); }
    };

    const loadHumanDesignData = async () => {
      try {
        const response = await fetch('/api/human-design');
        if (response.ok) setHumanDesignData(normalizeStaticChartResponse(await response.json()));
      } catch (error) { console.error('Failed to load Human Design data:', error); }
    };

    loadBirthChartData();
    loadGeneKeysData();
    loadHumanDesignData();
    // This is the card's one-time mount load. The hook helpers are recreated after
    // their state updates, so depending on them would repeat the complete load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollSkyLeft = () => {
    if (skyScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      skyScrollRef.current.scrollBy({ left: isMobile ? -352 : -624, behavior: 'smooth' });
    }
  };
  const scrollSkyRight = () => {
    if (skyScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      skyScrollRef.current.scrollBy({ left: isMobile ? 352 : 624, behavior: 'smooth' });
    }
  };
  const scrollTransitsLeft = () => {
    if (transitsScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      transitsScrollRef.current.scrollBy({ left: isMobile ? -272 : -608, behavior: 'smooth' });
    }
  };
  const scrollTransitsRight = () => {
    if (transitsScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      transitsScrollRef.current.scrollBy({ left: isMobile ? 272 : 608, behavior: 'smooth' });
    }
  };
  const scrollGkGenius = (direction) => {
    if (gkGeniusScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      gkGeniusScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };
  const scrollGkLove = (direction) => {
    if (gkLoveScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      gkLoveScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };
  const scrollGkProsperity = (direction) => {
    if (gkProsperityScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      gkProsperityScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };
  const scrollGkHarmony = (direction) => {
    if (gkHarmonyScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      gkHarmonyScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };
  const scrollHdCore = (direction) => {
    if (hdCoreScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      hdCoreScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };
  const scrollHdInsights = (direction) => {
    if (hdInsightsScrollRef.current) {
      const isMobile = window.innerWidth < 768;
      hdInsightsScrollRef.current.scrollBy({ left: direction === 'left' ? (isMobile ? -400 : -648) : (isMobile ? 400 : 648), behavior: 'smooth' });
    }
  };

  const getCurrentDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Human Design tile data, derived from the fetched /api/human-design row.
  // Tile `subtitle` reads straight from the *Interpretation.subtitle jsonb fields
  // and from centers[key].subtitle — the exact same strings the hardcoded literals
  // used to carry, now sourced from the DB. Null when no HD row exists yet (fork user).
  const centerTile = (key, title) => {
    const c = humanDesignData?.centers?.[key];
    return { id: key.replace(/([A-Z])/g, '-$1').toLowerCase(), title, subtitle: c?.subtitle || null };
  };
  const humanDesignStaticData = !humanDesignData ? null : {
    coreFoundation: [
      { id: 'type-strategy', title: 'Type & Strategy', subtitle: humanDesignData.typeStrategyInterpretation?.subtitle || null },
      { id: 'authority', title: 'Authority', subtitle: humanDesignData.authorityInterpretation?.subtitle || null },
      { id: 'profile', title: 'Profile', subtitle: humanDesignData.profileInterpretation?.subtitle || null },
      { id: 'definition', title: 'Definition', subtitle: humanDesignData.definitionInterpretation?.subtitle || null }
    ],
    energyCenters: [
      centerTile('head', 'Head Center'),
      centerTile('ajna', 'Ajna Center'),
      centerTile('throat', 'Throat Center'),
      centerTile('g', 'G Center'),
      centerTile('heart', 'Heart/Ego Center'),
      centerTile('spleen', 'Spleen Center'),
      centerTile('sacral', 'Sacral Center'),
      { id: 'solar-plexus', title: 'Solar Plexus Center', subtitle: humanDesignData.centers?.solarPlexus?.subtitle || null },
      centerTile('root', 'Root Center'),
    ],
    additionalInsights: [
      { id: 'cross', title: 'Incarnation Cross', subtitle: humanDesignData.incarnationCrossInterpretation?.subtitle || null },
      { id: 'not-self', title: 'Not-Self Theme', subtitle: humanDesignData.notSelfThemeInterpretation?.subtitle || null },
      { id: 'signature', title: 'Signature', subtitle: humanDesignData.signatureInterpretation?.subtitle || null }
    ]
  };

  // Gene Keys tile data, derived from the fetched /api/gene-keys row.
  // Each jsonb sphere is {gate,line,title,content,transformation} — the tile subtitle
  // format the Zone2 renderer expects is "gate.line - shadow → gift → siddhi", built here
  // from `gate`, `line`, and `transformation` (already "shadow → gift → siddhi"). Null
  // when no gene-keys row exists yet (fork user) — Zone2 must render an empty state.
  const sphereTile = (id, title, sphere) => {
    if (!sphere) return null;
    return { id, title, subtitle: `${sphere.gate}.${sphere.line} - ${sphere.transformation}` };
  };
  const geneKeysStaticData = !geneKeysData ? null : {
    geniusSequence: [
      sphereTile('genius-lifes-work', "Life's Work", geneKeysData.lifesWork),
      sphereTile('genius-evolution', 'Evolution', geneKeysData.evolution),
      sphereTile('genius-radiance', 'Radiance', geneKeysData.radiance),
      sphereTile('genius-purpose', 'Purpose', geneKeysData.purpose),
    ].filter(Boolean),
    loveSequence: [
      sphereTile('love-purpose', 'Purpose', geneKeysData.purpose),
      sphereTile('love-attraction', 'Attraction', geneKeysData.attraction),
      sphereTile('love-iq', 'IQ', geneKeysData.iq),
      sphereTile('love-eq', 'EQ', geneKeysData.eq),
      sphereTile('love-sq', 'SQ', geneKeysData.sq),
      sphereTile('love-vocation', 'Vocation', geneKeysData.vocation),
    ].filter(Boolean),
    prosperitySequence: [
      sphereTile('prosperity-vocation', 'Vocation', geneKeysData.vocation),
      sphereTile('prosperity-culture', 'Culture', geneKeysData.culture),
      sphereTile('prosperity-lifes-work', "Life's Work", geneKeysData.lifesWork),
      sphereTile('prosperity-pearl', 'Pearl', geneKeysData.pearl),
    ].filter(Boolean),
    harmonySequence: (Array.isArray(geneKeysData.harmonySequence) ? geneKeysData.harmonySequence : [])
      .map((sphere, i) => sphereTile(starPearlCardId(STAR_PEARL_ROLES[i]), sphere?.title, sphere))
      .filter(Boolean),
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl isolate">
      <div className="w-full h-full flex flex-col gap-4">

        {/* Custom Intelligence Modal */}
        {showCustomIntelligenceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowCustomIntelligenceModal(false)}>
            <div className="goe-glass rounded-xl p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCustomIntelligenceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Custom Intelligence Training</h3>
              <p className="text-sm text-muted-foreground leading-relaxed text-left">
                We train custom EP, MM, and GAIA models specifically on your content library, teaching methodology, and communication style. Hume captures your emotional approach while LLM fine-tuning ensures responses match your expertise and voice, not generic AI.
              </p>
            </div>
          </div>
        )}

        <AstrologyHeader onCoreModulesInfo={() => setShowCustomIntelligenceModal(true)} />

        {/* Tab Navigation */}
        <div className="goe-glass rounded-xl p-4 mb-4">
          <div className="text-center mb-3">
            <p className="text-sm text-gray-600 font-light">{getCurrentDate()}</p>
          </div>
          <div className="flex gap-2 md:gap-4 justify-center">
            {[
              { key: 'astrology', label: 'Astrology' },
              { key: 'genekeys', label: 'Gene Keys' },
              { key: 'humandesign', label: 'Human Design' }
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)} data-testid={`tab-${key}`}
                className={`px-4 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ${activeTab === key ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone 1 — Astrology Tab */}
        {activeTab === 'astrology' && (
          <AstrologyZone1
            astrologyData={astrologyData}
            birthChartLoading={birthChartLoading}
            selectedPlanet={selectedPlanet}
            setSelectedPlanet={setSelectedPlanet}
            skyScrollRef={skyScrollRef}
            transitsScrollRef={transitsScrollRef}
            scrollSkyLeft={scrollSkyLeft}
            scrollSkyRight={scrollSkyRight}
            scrollTransitsLeft={scrollTransitsLeft}
            scrollTransitsRight={scrollTransitsRight}
            getPlanetClaudeInsight={getPlanetClaudeInsight}
            getTransitClaudeInsight={getTransitClaudeInsight}
            showBirthChartModal={showBirthChartModal}
            setShowBirthChartModal={setShowBirthChartModal}
            showSkyForecastModal={showSkyForecastModal}
            setShowSkyForecastModal={setShowSkyForecastModal}
            showTransitsModal={showTransitsModal}
            setShowTransitsModal={setShowTransitsModal}
          />
        )}

        {/* Zone 2 — Gene Keys Tab */}
        {activeTab === 'genekeys' && (
          geneKeysStaticData ? (
            <AstrologyZone2
              geneKeysStaticData={geneKeysStaticData}
              geneKeysData={geneKeysData}
              harmonyContent={starPearlContent}
              selectedCard={selectedCard}
              setSelectedCard={setSelectedCard}
              gkGeniusScrollRef={gkGeniusScrollRef}
              gkLoveScrollRef={gkLoveScrollRef}
              gkProsperityScrollRef={gkProsperityScrollRef}
              gkHarmonyScrollRef={gkHarmonyScrollRef}
              scrollGkGenius={scrollGkGenius}
              scrollGkLove={scrollGkLove}
              scrollGkProsperity={scrollGkProsperity}
              scrollGkHarmony={scrollGkHarmony}
              getGeneKeysContent={getGeneKeysContent}
            />
          ) : (
            <div className="goe-glass rounded-xl p-8 text-center text-sm text-muted-foreground">
              Chart not set up yet.
            </div>
          )
        )}

        {/* Zone 3 — Human Design Tab */}
        {activeTab === 'humandesign' && (
          humanDesignStaticData ? (
            <AstrologyZone3
              humanDesignStaticData={humanDesignStaticData}
              humanDesignData={humanDesignData}
              selectedCard={selectedCard}
              setSelectedCard={setSelectedCard}
              hdCoreScrollRef={hdCoreScrollRef}
              hdInsightsScrollRef={hdInsightsScrollRef}
              scrollHdCore={scrollHdCore}
              scrollHdInsights={scrollHdInsights}
              getHumanDesignContent={getHumanDesignContent}
            />
          ) : (
            <div className="goe-glass rounded-xl p-8 text-center text-sm text-muted-foreground">
              Chart not set up yet.
            </div>
          )
        )}

        <GOE88ChatButton gradient="from-purple-400 to-violet-600" cardType="cosmic" />

      </div>
    </div>
  );
};

export default AstrologyIntelligenceCard;
