// AstroApp Data Transformation Layer
// Converts raw AstroApp API responses into readable format for Anthropic prompts
import { makeAstroAppRequest, getAstroAppToken } from './astroAppAuth';
import { storage } from './storage';
import type { InsertBirthChart, InsertCurrentSky, InsertCurrentTransits } from '@shared/schema';
import {
  ASTROLOGY_CALCULATION_VERSION,
  CURRENT_SKY_CALCULATION_VERSION,
  calculateSkyBoundaries,
  calculateTransitInfluenceRange,
  transitCandidateHorizonDays,
  transitExactMoment,
} from './lib/astrologyBoundaries';
import { buildBirthChartPayload, normalizeBirthTime, type BirthChartSetup } from './lib/birthChartSetup';
import { ensureChironMovement, skyInstant, validChironMovement, type ChironMovementRecord } from './lib/astroAppChiron';

interface AstroAppResponse {
  chironMovement?: ChironMovementRecord;
  calcResultsAvailable: boolean;
  chartData: any;
  houseCusps: number[];
  objects: Array<{
    id: number;
    lat: number;
    lng: number;
    speed: number;
  }>;
  aspects?: Array<{
    objectId1: number;
    objectId2: number;
    angle: number;
    orb: number;
  }>;
}

interface TransitsResponse {
  results: Array<{
    objectId1: number;
    objectId2: number;
    aspectAngle: number;
    exactDate1: string;
    exactJD?: number;
    exactLng?: number;
    eventType?: number;
    [key: string]: any;
  }>;
}

interface TransformedChart {
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  [planetName: string]: any;
}

interface TransformedPlanet {
  planet: string;
  sign: string;
  degree: string;
  house?: string;
  retrograde?: boolean;
  signEntry?: string;
  signExit?: string;
  retrogradeStart?: string;
  retrogradeEnd?: string;
  signMovement?: {
    nextSign: string;
    nextSignAt: string;
    direction: 'forward' | 'backward';
    source: string;
    calculationVersion: string;
  };
  retrogradeMovement?: {
    crossesSignBoundary: boolean;
    crossingSign?: string;
    crossingAt?: string;
    directSign: string;
    directAt: string;
    nextSign: string;
    nextSignAt: string;
    source: string;
    calculationVersion: string;
  };
  rangeSource?: string;
  calculationVersion?: string;
}

interface TransformedTransit {
  transit: string;
  exactDate: string;
  windowStart: string;
  windowEnd: string;
  aspect: string;
  transitingPlanet: string;
  natalPlanet: string;
  category: string;
  categoryOrder: number;
  isFirstInCategory: boolean;
  exactAt: string;
  exactDates: string[];
  orbDegrees: number;
  rangeKind: 'influence' | 'exact-only';
  rangeSource: string;
  calculationVersion: string;
}

// Shape of a single processed transit before category grouping adds isFirstInCategory
type ProcessedTransit = Omit<TransformedTransit, 'isFirstInCategory'>;

function storedNatalChart(record: any): AstroAppResponse {
  const raw = record?.rawChartData || {};
  const chartData = raw.chartData || record?.chartData;
  const houseCusps = raw.houseCusps || record?.houseCusps;
  const objects = raw.objects || record?.objects;
  if (!chartData || !Array.isArray(houseCusps) || !Array.isArray(objects)) {
    throw new Error('Stored birth chart is incomplete; import the owner chart before refreshing astrology data');
  }
  return { ...raw, chartData, houseCusps, objects } as AstroAppResponse;
}

// Convert longitude degrees to zodiac signs
const convertLongitudeToSign = (longitude: number): string => {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", 
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  return signs[Math.floor(longitude / 30)];
};

// Format degree within sign (e.g., 6.266599 longitude = Aries 6°16')
const formatDegree = (longitude: number): string => {
  const degreeInSign = longitude % 30;
  const degrees = Math.floor(degreeInSign);
  const minutes = Math.floor((degreeInSign - degrees) * 60);
  return `${degrees}°${minutes.toString().padStart(2, '0')}'`;
};

export async function prepareCurrentSkyData(raw: AstroAppResponse, previous?: AstroAppResponse): Promise<AstroAppResponse> {
  return ensureChironMovement(raw, makeAstroAppRequest, previous?.chironMovement);
}

// Calculate which house a planet is in based on house cusps
const calculateHouse = (planetLongitude: number, houseCusps: number[]): string => {
  // Normalize longitude to 0-360 range
  let normalizedLong = ((planetLongitude % 360) + 360) % 360;
  
  // Find which house the planet falls into
  for (let i = 1; i < houseCusps.length; i++) {
    let houseStart = houseCusps[i];
    let houseEnd = houseCusps[i + 1] || (houseCusps[1] + 360);
    
    if (houseEnd < houseStart) houseEnd += 360;
    if (normalizedLong >= houseStart && normalizedLong < houseEnd) {
      return getHouseOrdinal(i);
    }
  }
  return "1st"; // fallback
};

const getHouseOrdinal = (houseNum: number): string => {
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", 
                    "7th", "8th", "9th", "10th", "11th", "12th"];
  return ordinals[houseNum - 1] || "1st";
};

// Planet ID mapping
const planetMap: { [key: number]: string } = {
  0: 'sun', 1: 'moon', 2: 'mercury', 3: 'venus', 4: 'mars',
  5: 'jupiter', 6: 'saturn', 7: 'uranus', 8: 'neptune', 9: 'pluto',
  10: 'meanNode', 11: 'trueNode', 15: 'chiron'
};

// Transform AstroApp birth chart response to readable format (kept for backwards compatibility)
export const transformAstroAppData = (astroAppResponse: AstroAppResponse): TransformedChart => {
  const chartData = astroAppResponse.chartData || {};
  const chartDate = typeof chartData.chartDate === 'string' ? chartData.chartDate : '';
  const coordinates = Number.isFinite(chartData.lat) && Number.isFinite(chartData.lng)
    ? `${chartData.lat}, ${chartData.lng}`
    : '';

  // Transform each planet from objects array
  const transformedChart: TransformedChart = {
    birthDate: chartDate.slice(0, 10),
    birthTime: chartDate.slice(11, 19),
    birthLocation: chartData.birthLocation || chartData.location || coordinates
  };

  astroAppResponse.objects.forEach(obj => {
    const planetName = planetMap[obj.id];
    if (planetName) {
      transformedChart[planetName] = {
        sign: convertLongitudeToSign(obj.lng),
        degree: formatDegree(obj.lng),
        house: calculateHouse(obj.lng, astroAppResponse.houseCusps)
      };
    }
  });

  // Handle North Node (use True Node if available, else Mean Node)
  transformedChart.northNode = transformedChart.trueNode || transformedChart.meanNode;
  
  // Calculate South Node (opposite of North Node)
  if (transformedChart.northNode) {
    const northNodeLng = astroAppResponse.objects.find(obj => obj.id === 11 || obj.id === 10)?.lng;
    if (northNodeLng !== undefined) {
      const southNodeLng = (northNodeLng + 180) % 360;
      transformedChart.southNode = {
        sign: convertLongitudeToSign(southNodeLng),
        degree: formatDegree(southNodeLng),
        house: calculateHouse(southNodeLng, astroAppResponse.houseCusps)
      };
    }
  }
  
  // Clean up temporary node entries
  delete transformedChart.trueNode;
  delete transformedChart.meanNode;

  // Calculate Rising sign from 1st house cusp
  if (astroAppResponse.houseCusps && astroAppResponse.houseCusps[1]) {
    transformedChart.rising = {
      sign: convertLongitudeToSign(astroAppResponse.houseCusps[1]),
      degree: formatDegree(astroAppResponse.houseCusps[1])
    };
  }

  // Calculate Midheaven from 10th house cusp
  if (astroAppResponse.houseCusps && astroAppResponse.houseCusps[10]) {
    transformedChart.midheaven = {
      sign: convertLongitudeToSign(astroAppResponse.houseCusps[10]),
      degree: formatDegree(astroAppResponse.houseCusps[10])
    };
  }

  return transformedChart;
};

type BirthChartStorage = Pick<typeof storage, 'getBirthChart' | 'createBirthChart'>;

// Generate and store one owner's permanent natal chart from their supplied birth details.
// Existing charts are returned unchanged: replacing a natal chart is a separate, explicit
// correction rather than a setup retry.
export async function fetchBirthChart(
  userId: string,
  input: BirthChartSetup,
  chartStorage: BirthChartStorage = storage,
  request: typeof makeAstroAppRequest = makeAstroAppRequest,
): Promise<AstroAppResponse> {
  const existingChart = await chartStorage.getBirthChart(userId);
  if (existingChart) return existingChart.rawChartData as AstroAppResponse;

  const rawChartData = await request('https://astroapp.com/astro/apis/chart', {
    method: 'POST',
    body: JSON.stringify(buildBirthChartPayload(input)),
  }) as AstroAppResponse;

  if (!rawChartData?.chartData || !Array.isArray(rawChartData.houseCusps) || !Array.isArray(rawChartData.objects)) {
    throw new Error('AstroApp returned an incomplete birth chart');
  }

  const transformedData = transformAstroAppData(rawChartData);
  transformedData.birthDate = input.birthDate;
  transformedData.birthTime = normalizeBirthTime(input.birthTime);
  transformedData.birthLocation = input.birthLocation;

  const birthChartData: InsertBirthChart = {
    userId,
    rawChartData,
    transformedData,
    chartData: rawChartData.chartData,
    houseCusps: rawChartData.houseCusps,
    objects: rawChartData.objects,
  };

  await chartStorage.createBirthChart(birthChartData);
  return rawChartData;
}

// Transform AstroApp sky data for Current Sky section
export const transformCurrentSkyData = (
  astroAppResponse: AstroAppResponse,
  at = new Date(astroAppResponse.chartData?.chartDate || Date.now()),
): TransformedPlanet[] => {
  const currentSkyPlanets: TransformedPlanet[] = [];

  astroAppResponse.objects.forEach(obj => {
    const planetName = planetMap[obj.id];
    if (planetName && planetName !== 'meanNode') { // Skip mean node, use true node
      let displayName = planetName;
      
      // Convert planet names for display
      if (planetName === 'trueNode') displayName = 'North Node';
      else if (planetName === 'sun') displayName = 'Sun';
      else if (planetName === 'moon') displayName = 'Moon';
      else displayName = planetName.charAt(0).toUpperCase() + planetName.slice(1);

      const boundaries = calculateSkyBoundaries(obj.id, at);
      const chironAt = skyInstant(astroAppResponse.chartData, at);
      const retrogradeMovement = boundaries.retrogradeMovement ||
        (obj.id === 15 && validChironMovement(astroAppResponse.chironMovement, chironAt)
          ? astroAppResponse.chironMovement.movement : undefined);
      currentSkyPlanets.push({
        planet: displayName,
        sign: convertLongitudeToSign(obj.lng),
        degree: formatDegree(obj.lng),
        retrograde: obj.speed < 0,
        calculationVersion: CURRENT_SKY_CALCULATION_VERSION,
        ...(boundaries.signRange ? {
          signEntry: boundaries.signRange.start,
          signExit: boundaries.signRange.end,
          rangeSource: boundaries.signRange.source,
          calculationVersion: boundaries.signRange.calculationVersion,
        } : {}),
        ...(boundaries.signMovement ? { signMovement: boundaries.signMovement } : {}),
        ...(boundaries.retrogradeRange ? {
          retrogradeStart: boundaries.retrogradeRange.start,
          retrogradeEnd: boundaries.retrogradeRange.end,
        } : {}),
        ...(obj.speed < 0 && retrogradeMovement ? { retrogradeMovement } : {}),
      });
    }
  });

  // Add South Node (North Node + 180°) — nodes always move retrograde together
  const northNode = astroAppResponse.objects.find(obj => obj.id === 11); // True Node
  if (northNode) {
    const southNodeLng = (northNode.lng + 180) % 360;
    currentSkyPlanets.push({
      planet: 'South Node',
      sign: convertLongitudeToSign(southNodeLng),
      degree: formatDegree(southNodeLng),
      retrograde: northNode.speed < 0,
      calculationVersion: CURRENT_SKY_CALCULATION_VERSION,
    });
  }

  return currentSkyPlanets;
};

// Transform transits data from AstroApp transitstoNatal response
export const transformTransitsData = (
  transitsResponse: TransitsResponse,
  at = new Date(),
): TransformedTransit[] => {
  if (!transitsResponse.results) return [];
  
  const aspectMap: { [key: number]: string } = {
    0: 'conjunction', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opposition'
  };
  
  const transitPlanetMap: { [key: number]: string } = {
    0: 'Sun', 1: 'Moon', 2: 'Mercury', 3: 'Venus', 4: 'Mars', 
    5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune', 9: 'Pluto',
    10: 'Ascendant', 11: 'North Node', 12: 'Chiron', 13: 'South Node',
    14: 'Midheaven', 15: 'Part of Fortune'
  };

  // Classical Astrological Significance (Ptolemy/Lilly tradition)
  const aspectPriority = {
    0: 10,    // Conjunction - unity, initiation
    180: 9,   // Opposition - awareness, culmination  
    90: 8,    // Square - tension, action
    120: 7,   // Trine - harmony, flow
    60: 6     // Sextile - opportunity, cooperation
  };
  
  // Classical hierarchy: Personal > Angular > Social > Generational
  const planetWeights = {
    // Personal Planets (highest impact on daily life)
    0: 10,   // Sun - core identity, life force
    1: 10,   // Moon - emotions, instincts, daily rhythms
    2: 9,    // Mercury - communication, thinking
    3: 9,    // Venus - relationships, values, pleasure
    4: 9,    // Mars - action, desire, conflict
    
    // Angular Points (high impact on life direction)
    10: 10,  // Ascendant - personality, approach to life
    14: 9,   // Midheaven - career, reputation, calling
    
    // Social Planets (life themes and growth)
    5: 8,    // Jupiter - expansion, wisdom, opportunity
    6: 8,    // Saturn - structure, responsibility, lessons
    
    // Generational Planets (slower, collective themes)
    7: 6,    // Uranus - change, innovation, rebellion
    8: 5,    // Neptune - spirituality, illusion, compassion
    9: 5,    // Pluto - transformation, power, regeneration
    
    // Lunar Nodes & Other Points
    11: 7,   // North Node - karmic direction
    13: 6,   // South Node - karmic past
    12: 6,   // Chiron - healing, teaching through wounding
    15: 4    // Part of Fortune - material integration
  };
  
  const calculateTransitScore = (transit: TransitsResponse['results'][number]) => {
    const aspectWeight = aspectPriority[transit.aspectAngle as keyof typeof aspectPriority] || 1;
    const planetWeight = planetWeights[transit.objectId2 as keyof typeof planetWeights] || 1; // Swapped: objectId2 is transiting planet
    const targetWeight = planetWeights[transit.objectId1 as keyof typeof planetWeights] || 1;  // Swapped: objectId1 is natal planet
    
    // Time relevance - GOE's "present moment" focus
    const transitDate = new Date(transit.exactDate1);
    const today = at;
    const daysFromNow = Math.abs(transitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    
    let timeWeight;
    if (daysFromNow <= 7) timeWeight = 5;      // Next week - highest priority
    else if (daysFromNow <= 14) timeWeight = 3; // Next 2 weeks - high priority  
    else if (daysFromNow <= 30) timeWeight = 2; // Next month - medium priority
    else timeWeight = 1;                         // Future context
    
    return aspectWeight * planetWeight * targetWeight * timeWeight;
  };
  
  // Use the same aspect orbs sent to AstroApp; dates are calculated separately.
  const aspectOrbs: Record<number, number> = { 0: 10, 60: 5, 90: 8, 120: 9, 180: 10 };

  // Classical Method: Select all currently active transits, ranked by significance
  const today = at;
  console.log(`\n=== CLASSICAL ASTROLOGICAL ANALYSIS ===`);
  
  const activeTransits = transitsResponse.results
    // AstroApp event type 1 is a transit to a natal object. Event type 3 uses
    // house-cusp targets; treating those object IDs as natal planets creates
    // false labels, so they stay out of this natal-transit surface.
    .filter((transit) => transit.eventType === undefined || transit.eventType === 1)
    .filter((transit) => Number.isFinite(aspectOrbs[transit.aspectAngle]))
    .filter((transit) => {
      const exact = new Date(transitExactMoment(transit));
      const horizonMs = transitCandidateHorizonDays(transit.objectId2) * 86_400_000;
      return Math.abs(exact.getTime() - today.getTime()) <= horizonMs;
    })
    .map(transit => ({
      ...transit,
      score: calculateTransitScore(transit),
      exactAt: transitExactMoment(transit),
      orbDegrees: aspectOrbs[transit.aspectAngle],
      influenceRange: calculateTransitInfluenceRange(transit, aspectOrbs[transit.aspectAngle]),
    }))
    .filter(transit => {
      const exact = new Date(transit.exactAt);
      const isActive = transit.influenceRange
        ? today >= new Date(transit.influenceRange.start) && today <= new Date(transit.influenceRange.end)
        : Math.abs(today.getTime() - exact.getTime()) <= 12 * 60 * 60 * 1000;
      
      // Only include if we have proper planet mappings
      const transitingPlanet = transitPlanetMap[transit.objectId2];
      const natalPlanet = transitPlanetMap[transit.objectId1];
      const aspect = aspectMap[transit.aspectAngle];
      
      if (isActive && transitingPlanet && natalPlanet && aspect) {
        console.log(`✅ Active transit selected`);
        return true;
      }
      return false;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15); // Classical approach: show top 15 most significant active transits

  console.log(`\n=== SELECTED ${activeTransits.length} MOST SIGNIFICANT ACTIVE TRANSITS ===\n`);
  const significantTransits = activeTransits;
  
  // Accessible astrological categorization
  const getAstrologicalCategory = (natalPlanetId: number) => {
    // Personal Planets - immediate daily experience
    if ([0, 1, 2, 3, 4].includes(natalPlanetId)) return 'Personal Planets';
    
    // Angular Points - life direction and public persona
    if ([10, 14].includes(natalPlanetId)) return 'Life Direction';
    
    // Social Planets - growth and life lessons
    if ([5, 6].includes(natalPlanetId)) return 'Growth Themes';
    
    // Karmic Points - soul development
    if ([11, 13].includes(natalPlanetId)) return 'Soul Development';
    
    // Generational Planets - collective transformation
    if ([7, 8, 9].includes(natalPlanetId)) return 'Collective Transformation';
    
    // Other Significant Points
    return 'Ancient Wisdom';
  };

  const processedTransits = significantTransits.map((event): ProcessedTransit | null => {
    const transitingPlanet = transitPlanetMap[event.objectId2]; // Swapped: objectId2 is the transiting planet  
    const natalPlanet = transitPlanetMap[event.objectId1];     // Swapped: objectId1 is the natal planet
    const aspect = aspectMap[event.aspectAngle];
    
    // Skip if any key data is missing
    if (!transitingPlanet || !natalPlanet || !aspect) {
      return null;
    }
    
    return {
      // Chani format: "Venus trine your Sun" (transiting planet + aspect + "your" + natal planet)
      transit: `${transitingPlanet} ${aspect} your ${natalPlanet}`,
      exactDate: event.exactDate1,
      exactAt: event.exactAt,
      exactDates: [event.exactAt],
      windowStart: event.influenceRange?.start || event.exactAt,
      windowEnd: event.influenceRange?.end || event.exactAt,
      orbDegrees: event.orbDegrees,
      rangeKind: event.influenceRange ? 'influence' : 'exact-only',
      rangeSource: event.influenceRange?.source || 'AstroApp exact date',
      calculationVersion: event.influenceRange?.calculationVersion || ASTROLOGY_CALCULATION_VERSION,
      aspect,
      transitingPlanet,
      natalPlanet,
      category: getAstrologicalCategory(event.objectId1), // objectId1 is natal planet
      categoryOrder: [0, 1, 2, 3, 4].includes(event.objectId1) ? 1 : // Personal Planets first
                    [10, 14].includes(event.objectId1) ? 2 : // Angular Points second  
                    [5, 6].includes(event.objectId1) ? 3 : // Social Planets third
                    [11, 13].includes(event.objectId1) ? 4 : // Karmic Points fourth
                    [7, 8, 9].includes(event.objectId1) ? 5 : 6 // Generational last, then Other
    };
  }).filter((transit): transit is ProcessedTransit => transit !== null); // Remove any null entries

  // Multiple exact passes can belong to one uninterrupted influence range. Keep
  // every exact alignment without rendering the same continuous range twice.
  const mergedTransits = processedTransits.reduce<ProcessedTransit[]>((merged, transit) => {
    const existing = merged.find((candidate) =>
      candidate.transit === transit.transit &&
      Math.abs(new Date(candidate.windowStart).getTime() - new Date(transit.windowStart).getTime()) < 60_000 &&
      Math.abs(new Date(candidate.windowEnd).getTime() - new Date(transit.windowEnd).getTime()) < 60_000
    );
    if (existing) {
      existing.exactDates = [...existing.exactDates, ...transit.exactDates]
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      return merged;
    }
    merged.push(transit);
    return merged;
  }, []);

  // Group by category and sort
  const groupedTransits = mergedTransits.reduce<Record<string, ProcessedTransit[]>>((groups, transit) => {
    const category = transit.category;
    if (!groups[category]) groups[category] = [];
    groups[category].push(transit);
    return groups;
  }, {});

  // Sort categories by order and return flattened with category info
  return Object.entries(groupedTransits)
    .sort(([, a], [, b]) => a[0].categoryOrder - b[0].categoryOrder)
    .flatMap(([category, transits]) => 
      transits.map((transit): TransformedTransit => ({ ...transit, isFirstInCategory: transit === transits[0] }))
    );
};

// Fetch current sky data with daily caching
export async function fetchCurrentSky(userId: string, targetDate: string): Promise<AstroAppResponse> {
  try {
    const today = targetDate;
    
    // Check database for today's data first
    const existingSky = await storage.getCurrentSky(userId, today);
    
    if (existingSky?.rawSkyData) {
      return prepareCurrentSkyData(existingSky.rawSkyData as AstroAppResponse);
    }
    
    // Use birth chart data to get today's sky positions
    const birthChart = await storage.getBirthChart(userId);
    if (!birthChart) {
      throw new Error('Birth chart required for current sky calculation');
    }
    
    const natalChart = storedNatalChart(birthChart);
    const natalChartData = natalChart.chartData || {};

    // Current sky uses the stored owner's location and timezone.
    const currentSkyPayload = {
      chart: {
        chartData: {
          ...natalChartData,
          jd: 0,
          version: 1,
          coordSys: "G",
          zodiacID: 100,
          chartDate: `${today}T12:00:00`,
          chartName: "Current Sky",
          houseSystemID: 1
        }
      },
      calcRequestProps: {
        needImage: "N",
        needAspects: "N"
      },
      params: {
        objects: [0,1,2,3,4,5,6,7,8,9,10,11,15]
      }
    };
    
    console.log('CURRENT SKY: requesting AstroApp chart data');
    
    // Generate today's sky data using corrected format
    const previousSky = await storage.getCurrentSky(userId);
    const positions = await makeAstroAppRequest('https://astroapp.com/astro/apis/chart', {
      method: 'POST',
      body: JSON.stringify(currentSkyPayload)
    });
    const rawSkyData = await prepareCurrentSkyData(positions, previousSky?.rawSkyData as AstroAppResponse | undefined);

    // Transform data for storage  
    const transformedData = transformCurrentSkyData(rawSkyData);
    
    // Store in database for today
    const currentSkyData: InsertCurrentSky = {
      userId,
      date: today,
      rawSkyData,
      transformedData,
      anthropicResponse: null
    };
    
    await storage.upsertCurrentSky(currentSkyData);
    
    return rawSkyData;
  } catch (error) {
    console.error('Error fetching current sky:', error);
    throw error;
  }
}

// Follow AstroApp's exact working example - Basic Auth only, expect 302 response
export async function fetchCurrentTransits(userId: string, targetDate: string): Promise<TransitsResponse> {
  console.log('=== TRYING ASTROAPP\'S EXACT WORKING EXAMPLE ===');
  const today = targetDate;
  
  const birthChart = await storage.getBirthChart(userId);
  if (!birthChart) {
    throw new Error("Birth chart required for transit calculation");
  }
  const natalChart = storedNatalChart(birthChart);
  const natalChartData = natalChart.chartData || {};
  const payload = {
    params: {
      startDate: today,
      lat: String(natalChartData.lat),
      lng: String(natalChartData.lng),
      tz: natalChartData.tz,
      objects: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15],
      exclusions: "300",
      aspects: [
        { angle: 0, orb: 10 },
        { angle: 60, orb: 5 },
        { angle: 90, orb: 8 },
        { angle: 120, orb: 9 },
        { angle: 180, orb: 10 },
      ],
      eventTypes: [1, 3],
    },
    chart: {
      chartData: natalChartData,
      houseCusps: natalChart.houseCusps,
      objects: natalChart.objects,
    },
  };

  console.log('Using centralized AstroApp request handler...');
  
  const transitsData = await makeAstroAppRequest('https://astroapp.com/astro/apis/transits/natal', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  // AstroApp explicitly states: "successful response code for this endpoint is 302"
  // makeAstroAppRequest already handles response parsing and status validation
  console.log('✅ Transits received, count:', transitsData.results?.length || 0);
  
  // Store and return
  const transformedData = transformTransitsData(transitsData);
  const currentTransitsData: InsertCurrentTransits = {
    userId,
    date: today,
    rawTransitData: transitsData,
    transformedData,
    anthropicResponse: null
  };
  
  await storage.upsertCurrentTransits(currentTransitsData);
  return transitsData;
}
