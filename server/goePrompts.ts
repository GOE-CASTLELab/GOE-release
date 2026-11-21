// GOE Prompt Generators — provider-agnostic (dispatch handled in sendClaude via LLM_PROVIDER)
// Generates prompts for Current Sky, Current Transits, and Chat interactions
import { ASTROLOGY_CHAT_PROMPT, CYCLE_CHAT_PROMPT, REST_CHAT_PROMPT, MOVEMENT_CHAT_PROMPT } from "./prompts/chatPrompts";
import { NATAL_CHART_PROMPT, PERSONAL_PLANET_INSIGHT_PROMPT, CURRENT_TRANSITS_PROMPT, DESIGN_THREAD_PROMPT, PERSONAL_WEEKLY_READ_PROMPT, REST_PRACTICE_PROMPT } from "./prompts/wiredProsePrompts";

// Single source for the default model every prompt config below requests.
// LLM_MODEL (see server/routes/shared.ts sendClaude) overrides this centrally at
// dispatch time regardless of what's written here — this constant only means the
// default is typed once, not retyped per prompt and possibly missed on a change.
export const DEFAULT_PROMPT_MODEL = 'claude-sonnet-4-6';

interface TransformedChart {
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  rising: { sign: string; degree: string };
  sun: { sign: string; degree: string; house: string };
  moon: { sign: string; degree: string; house: string };
  mercury: { sign: string; degree: string; house: string };
  venus: { sign: string; degree: string; house: string };
  mars: { sign: string; degree: string; house: string };
  jupiter: { sign: string; degree: string; house: string };
  saturn: { sign: string; degree: string; house: string };
  uranus: { sign: string; degree: string; house: string };
  neptune: { sign: string; degree: string; house: string };
  pluto: { sign: string; degree: string; house: string };
  chiron?: { sign: string; degree: string; house: string };
  northNode: { sign: string; degree: string; house: string };
  midheaven: { sign: string; degree: string };
}

interface TransformedPlanet {
  planet: string;
  sign: string;
  degree: string;
  retrograde?: boolean;
}

interface TransformedTransit {
  transit: string;
  exactDate: string;
  exactAt?: string;
  exactDates?: string[];
  aspect: string;
  transitingPlanet: string;
  natalPlanet: string;
}

// Cycle data as consumed by the chat prompt builders below. Fields are nullable —
// absence means the user hasn't set up cycle tracking, not an error.
interface CycleContextData {
  cycleDay?: number | string | null;
  cyclePhase?: string | null;
  moonCenter?: string | null;
  [key: string]: unknown;
}

// Renders the CYCLE DAY / CYCLE PHASE / MOON CENTER block. When cycle data is present,
// interpolates it directly (unchanged behavior). When absent, renders an explicit,
// honest "not set up" signal instead of the literal string "null"/"undefined" or a
// fabricated phase — the model is told to name the gap only if the user's question
// actually depends on it, otherwise answer normally (S5: never fake a phase).
const cycleContextBlock = (c: CycleContextData | null | undefined): string =>
  c && c.cyclePhase != null && c.cycleDay != null
    ? `**CYCLE DAY:** ${c.cycleDay}\n**CYCLE PHASE:** ${c.cyclePhase}\n**MOON CENTER:** ${c.moonCenter ?? '—'}`
    : c?.moonCenter ? `**MOON CENTER:** ${c.moonCenter}\n**MENSTRUAL CYCLE:** not set up.`
    : `**CYCLE DATA:** not set up yet — no cycle day/phase/moon-center available. If the user's question depends on their cycle, tell them plainly it isn't set up and point them to the setup step; otherwise answer normally.`;

// Generate Natal Chart prompt for Anthropic
export const generateNatalChartPrompt = (chartData: TransformedChart) => {
  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 3000,
    "system": NATAL_CHART_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `NATAL CHART DATA:
Birth Date: ${chartData.birthDate}
Birth Time: ${chartData.birthTime}
Birth Location: ${chartData.birthLocation}
Rising: ${chartData.rising.sign} ${chartData.rising.degree}
Sun: ${chartData.sun.sign} ${chartData.sun.degree} in ${chartData.sun.house} house
Moon: ${chartData.moon.sign} ${chartData.moon.degree} in ${chartData.moon.house} house
Mercury: ${chartData.mercury.sign} ${chartData.mercury.degree} in ${chartData.mercury.house} house
Venus: ${chartData.venus.sign} ${chartData.venus.degree} in ${chartData.venus.house} house
Mars: ${chartData.mars.sign} ${chartData.mars.degree} in ${chartData.mars.house} house
Jupiter: ${chartData.jupiter.sign} ${chartData.jupiter.degree} in ${chartData.jupiter.house} house
Saturn: ${chartData.saturn.sign} ${chartData.saturn.degree} in ${chartData.saturn.house} house
Uranus: ${chartData.uranus.sign} ${chartData.uranus.degree} in ${chartData.uranus.house} house
Neptune: ${chartData.neptune.sign} ${chartData.neptune.degree} in ${chartData.neptune.house} house
Pluto: ${chartData.pluto.sign} ${chartData.pluto.degree} in ${chartData.pluto.house} house
${chartData.chiron ? `Chiron: ${chartData.chiron.sign} ${chartData.chiron.degree} in ${chartData.chiron.house} house` : ''}
North Node: ${chartData.northNode.sign} ${chartData.northNode.degree} in ${chartData.northNode.house} house
${(chartData as any).southNode ? `South Node: ${(chartData as any).southNode.sign} ${(chartData as any).southNode.degree} in ${(chartData as any).southNode.house} house` : ''}
Midheaven: ${chartData.midheaven.sign} ${chartData.midheaven.degree}

TASK: Generate comprehensive natal chart insights (2-3 sentences per placement) focused on authentic self-expression, relationship patterns, and personal growth themes. These are foundational patterns that remain consistent throughout life.

HUMAN-CENTERED FOCUS AREAS:
- How you naturally express your authentic self in different contexts
- Your approach to building and maintaining meaningful relationships
- Core emotional patterns, needs, and responses
- Communication style, mental processing, and learning approach
- Values, attractions, and what draws you to others
- How you take action, pursue goals, and handle challenges
- Growth opportunities, wisdom development, and natural gifts
- Life lessons, areas of mastery, and healing journeys

REQUIREMENTS:
- 2-3 substantive sentences per placement (400-600 characters each)
- Present-tense, experiential language describing real-life manifestations
- Focus on authentic self-expression and relationship dynamics
- Include both strengths and growth areas in empowering language
- Explain how sign + house combination shows up practically
- No timing, no predictions - these are permanent inner dynamics
- Rich, nuanced insights that serve as lasting reference points

LANGUAGE PATTERNS:
- "Your [placement] expresses through [authentic behavior]. In relationships, you [pattern]. This combination creates [growth opportunity]."
- "You naturally [behavior] when [situation]. Others experience you as [impression], while internally you [inner experience]."
- "Your emotional nature [pattern], especially when [context]. This gives you [strength] while teaching you [growth area]."

AVOID CORPORATE LANGUAGE:
❌ systematizing, optimizing, managing, strategic positioning
✅ expressing, connecting, building, creating, developing, understanding, deepening

OUTPUT STRUCTURE:
{
  "rising": "2-3 sentences about natural first impression, life approach, and how others initially experience you",
  "sun": "2-3 sentences about core identity, authentic self-expression, and central life themes",
  "moon": "2-3 sentences about emotional nature, inner world, and what nurtures you",
  "mercury": "2-3 sentences about communication style, mental processing, and learning approach",
  "venus": "2-3 sentences about relationship patterns, values, and what you attract/appreciate",
  "mars": "2-3 sentences about action style, goal pursuit, and how you handle challenges",
  "jupiter": "2-3 sentences about growth opportunities, wisdom development, and natural optimism",
  "saturn": "2-3 sentences about life lessons, areas of mastery, and long-term development",
  "uranus": "2-3 sentences about innovation style, uniqueness, and where you break conventions",
  "neptune": "2-3 sentences about spiritual/creative expression, intuition, and dissolving boundaries",
  "pluto": "2-3 sentences about transformation patterns, deep drives, and psychological insights",
  "chiron": "2-3 sentences about healing journey, wisdom through experience, and teaching others",
  "northNode": "2-3 sentences about soul growth direction, emerging life themes, and development path",
  "southNode": "2-3 sentences about natural talents, comfortable patterns, and inherited gifts",
  "midheaven": "2-3 sentences about public expression, career approach, and reputation building"
}

Generate rich, nuanced insights that honor the complexity of human nature and serve as comprehensive reference points for self-understanding and authentic living.`
      }
    ]
  };
};

// Generate personal per-planet sky insight — GOE register, plain-text, natal-aware
// Replaces the JSON blob generateCurrentSkyPrompt with individual per-planet calls.
// Output: 80–90 word prose reading (S1 factual | S2 natal activation | S3 locating question).
export const generatePersonalPlanetInsightPrompt = (
  planet: string,
  currentSign: string,
  currentDegree: string,
  retrograde: boolean,
  natalData: { sign: string; degree: string; house?: string } | null,
  birthContext: { birthDate: string; birthTime: string; birthLocation: string }
) => {
  const planetContextMap: Record<string, { role: string; governs: string }> = {
    Sun:          { role: "The Sun moves through one sign per month", governs: "identity, creative direction, and where vitality concentrates" },
    Moon:         { role: "The Moon governs cyclical intelligence, felt sense, and the body's knowing", governs: "rhythm, receptivity, and where we are in the cycle of becoming" },
    Mercury:      { role: "Mercury governs communication, thinking, and creative expression", governs: "how we process, transmit, and build — the quality of mind in motion" },
    Venus:        { role: "Venus governs what we value, what draws us, and what quality we bring to what we make", governs: "creative value, collaboration, and the texture of our desire" },
    Mars:         { role: "Mars governs directed will — the body's capacity to commit force in a direction", governs: "initiation, resolve, and the point where decision becomes movement" },
    Jupiter:      { role: "Jupiter governs the expansive function — what opens when we follow the larger pattern", governs: "vision, generosity, and the kind of knowing that comes from stepping back far enough to see" },
    Saturn:       { role: "Saturn governs structure and long vision — what endures when everything else has been refined away", governs: "discipline, the architecture of practice, and what becomes possible inside a real container" },
    Uranus:       { role: "Uranus governs disruption and sudden insight", governs: "innovation, freedom, and the breaks from pattern that change everything" },
    Neptune:      { role: "Neptune governs dissolution and collective imagination", governs: "the porous edge between self and everything else, intuition, and what transcends the rational" },
    Pluto:        { role: "Pluto governs transformation at depth", governs: "what dies so something else can live — power, shadow, and irreversible change" },
    Chiron:       { role: "Chiron marks the wound that became the teaching", governs: "where the break in the pattern holds the most information" },
    'North Node': { role: "The North Node marks the direction of growth in this lifetime", governs: "where the soul is being called — not where it is comfortable, but where it is stretching" },
    'South Node': { role: "The South Node marks what the soul carries as resource and release", governs: "the past as foundation — what is already known, and what is ready to be set down" },
  };

  const ctx = planetContextMap[planet] || { role: `${planet} holds its own domain`, governs: "patterns of energy and timing" };

  const natalLine = natalData
    ? `NATAL ${planet.toUpperCase()}: ${natalData.sign} ${natalData.degree}${natalData.house ? `, ${natalData.house} house` : ''}`
    : `NATAL ${planet.toUpperCase()}: position not recorded`;

  return {
    model: DEFAULT_PROMPT_MODEL,
    max_tokens: 200,
    system: PERSONAL_PLANET_INSIGHT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write a personal sky reading for ${planet} in ${currentSign} at ${currentDegree}${retrograde ? ' — Retrograde (Rx)' : ''}, against the natal placement below.

PLANET: ${ctx.role}. It governs ${ctx.governs}.${retrograde ? `\n\nRETROGRADE: ${planet} is moving retrograde — energy turns inward, toward review and integration, not initiation. Name this.` : ''}

${natalLine}
BIRTH CONTEXT: ${birthContext.birthDate}, ${birthContext.birthTime}, ${birthContext.birthLocation}

STRUCTURE (80–90 words, prose only):
1. One factual sentence: where ${planet} is right now in the sky and what this placement does.
2. One sentence locating the sky planet against the natal placement — how this moment activates or differs from the natal signature.
3. One open locating question for this person. Not prescriptive — genuinely open, grounded in their natal ${planet}.`
      }
    ]
  };
};

// Generate Current Transits prompt for Anthropic
export const generateCurrentTransitsPrompt = (transformedNatalChart: TransformedChart, processedTransitsData: TransformedTransit[], asOfDate?: string, timeZone = 'UTC') => {
  const today = asOfDate
    ? new Date(`${asOfDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const exactDates = (transit: TransformedTransit) => {
    const moments = transit.exactDates?.length ? transit.exactDates : transit.exactAt ? [transit.exactAt] : [];
    return moments.length
      ? moments.map(value => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone })).join(' · ')
      : transit.exactDate;
  };
  
  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 1500,
    "system": CURRENT_TRANSITS_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `TODAY'S DATE: ${today}

PERSONAL NATAL CHART:
Born: ${transformedNatalChart.birthDate}, ${transformedNatalChart.birthTime}, ${transformedNatalChart.birthLocation}
Rising: ${transformedNatalChart.rising.sign} ${transformedNatalChart.rising.degree}
Sun: ${transformedNatalChart.sun.sign} ${transformedNatalChart.sun.degree} in ${transformedNatalChart.sun.house} house
Moon: ${transformedNatalChart.moon.sign} ${transformedNatalChart.moon.degree} in ${transformedNatalChart.moon.house} house
Mercury: ${transformedNatalChart.mercury.sign} ${transformedNatalChart.mercury.degree} in ${transformedNatalChart.mercury.house} house
Venus: ${transformedNatalChart.venus.sign} ${transformedNatalChart.venus.degree} in ${transformedNatalChart.venus.house} house
Mars: ${transformedNatalChart.mars.sign} ${transformedNatalChart.mars.degree} in ${transformedNatalChart.mars.house} house
Jupiter: ${transformedNatalChart.jupiter.sign} ${transformedNatalChart.jupiter.degree} in ${transformedNatalChart.jupiter.house} house
Saturn: ${transformedNatalChart.saturn.sign} ${transformedNatalChart.saturn.degree} in ${transformedNatalChart.saturn.house} house
Uranus: ${transformedNatalChart.uranus.sign} ${transformedNatalChart.uranus.degree} in ${transformedNatalChart.uranus.house} house
Neptune: ${transformedNatalChart.neptune.sign} ${transformedNatalChart.neptune.degree} in ${transformedNatalChart.neptune.house} house
Pluto: ${transformedNatalChart.pluto.sign} ${transformedNatalChart.pluto.degree} in ${transformedNatalChart.pluto.house} house
North Node: ${transformedNatalChart.northNode.sign} ${transformedNatalChart.northNode.degree} in ${transformedNatalChart.northNode.house} house
Midheaven: ${transformedNatalChart.midheaven.sign} ${transformedNatalChart.midheaven.degree}

ACTIVE TRANSITS:
${processedTransitsData.map(transit => 
  `${transit.transit} - EXACT: ${exactDates(transit)} - ASPECT: ${transit.aspect}`
).join('\n')}

TASK: Generate Human-Centered Impact Intelligence for these specific transits. Each transit is a precise timing window for growth, relationship building, or authentic expression.

TRANSIT-SPECIFIC REQUIREMENTS:
- Use EXACT DATE provided for precise timing guidance
- Interpret the specific ASPECT (conjunction, square, trine, etc.) for appropriate intensity and opportunity type
- 200-250 characters each
- Focus on what this specific transit uniquely enables in human terms

ASPECT INTERPRETATION GUIDE:
- CONJUNCTION: Fusion/new beginnings - "merges", "initiates", "births new"
- TRINE: Flow/ease - "supports", "enhances", "flows naturally"
- SQUARE: Challenge/growth - "challenges you to", "pushes growth in", "tests"
- OPPOSITION: Balance/awareness - "brings awareness to", "balances", "illuminates"
- SEXTILE: Opportunity/connection - "opens doors for", "connects", "creates opportunities"

HUMAN-CENTERED FOCUS:
- Deepening relationships and self-understanding
- Building authentic connections and communications
- Expressing creativity and personal truth
- Cultivating wisdom through life experience
- Strengthening bonds with others
- Growing through meaningful challenges

AVOID CORPORATE LANGUAGE:
❌ systematizing, optimizing, managing, strategic positioning
✅ deepening, building, expressing, cultivating, strengthening, growing

LANGUAGE PATTERNS:
- "[Transit Planet] [aspect] your [Natal Planet] on [Date] [creates specific human opportunity]"
- "This [aspect type] [enables/challenges/supports] you to [human-centered growth]"
- "Peak timing around [exact date] for [authentic human outcome]"

OUTPUT STRUCTURE:
{
  "current_transits": [
    ${processedTransitsData.map(transit => `{
      "transit": "${transit.transit}",
      "insight": "Precise timing guidance based on this specific aspect and date for human growth and authentic expression (200-250 chars)"
    }`).join(',\n    ')}
  ]
}

Generate insights that honor the unique timing and intensity of each transit for meaningful human development.`
      }
    ]
  };
};


// Generate Oracle Intelligence prompt combining Astrology, Gene Keys, and Human Design
export const generateOraclePrompt = (
  transformedChartData: TransformedChart, 
  currentSkyTransformed: TransformedPlanet[], 
  currentTransitsData: TransformedTransit[],
  geneKeysData: any,
  humanDesignData: any,
  message: string,
  conversationHistory?: string
) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 300,
    "temperature": 0.2,
    "system": ASTROLOGY_CHAT_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `TODAY'S DATE: ${today}

ASTROLOGICAL FOUNDATION:
Born: ${transformedChartData.birthDate}, ${transformedChartData.birthTime}, ${transformedChartData.birthLocation}
Rising: ${transformedChartData.rising.sign} ${transformedChartData.rising.degree}
Sun: ${transformedChartData.sun.sign} ${transformedChartData.sun.degree} in ${transformedChartData.sun.house} house
Moon: ${transformedChartData.moon.sign} ${transformedChartData.moon.degree} in ${transformedChartData.moon.house} house
Mercury: ${transformedChartData.mercury.sign} ${transformedChartData.mercury.degree} in ${transformedChartData.mercury.house} house
Venus: ${transformedChartData.venus.sign} ${transformedChartData.venus.degree} in ${transformedChartData.venus.house} house
Mars: ${transformedChartData.mars.sign} ${transformedChartData.mars.degree} in ${transformedChartData.mars.house} house
Jupiter: ${transformedChartData.jupiter.sign} ${transformedChartData.jupiter.degree} in ${transformedChartData.jupiter.house} house
Saturn: ${transformedChartData.saturn.sign} ${transformedChartData.saturn.degree} in ${transformedChartData.saturn.house} house
Uranus: ${transformedChartData.uranus.sign} ${transformedChartData.uranus.degree} in ${transformedChartData.uranus.house} house
Neptune: ${transformedChartData.neptune.sign} ${transformedChartData.neptune.degree} in ${transformedChartData.neptune.house} house
Pluto: ${transformedChartData.pluto.sign} ${transformedChartData.pluto.degree} in ${transformedChartData.pluto.house} house${transformedChartData.chiron ? `\nChiron: ${transformedChartData.chiron.sign} ${transformedChartData.chiron.degree} in ${transformedChartData.chiron.house} house` : ''}
North Node: ${transformedChartData.northNode.sign} ${transformedChartData.northNode.degree} in ${transformedChartData.northNode.house} house
Midheaven: ${transformedChartData.midheaven.sign} ${transformedChartData.midheaven.degree}

CURRENT COSMIC WEATHER:
${currentSkyTransformed.map(planet => 
  `${planet.planet}: ${planet.sign} ${planet.degree}`
).join('\n')}

ACTIVE TRANSITS:
${currentTransitsData.slice(0, 3).map(transit => 
  `${transit.transit} - EXACT: ${transit.exactDate}`
).join('\n')}

GENE KEYS (full design — read whichever sphere is relevant to the question, do not default to Life's Work):
${geneKeysData ? [
  ['lifesWork',"Life's Work"],['evolution','Evolution'],['radiance','Radiance'],['purpose','Purpose'],
  ['vocation','Vocation'],['culture','Culture'],['pearl','Pearl'],
  ['iq','IQ'],['eq','EQ'],['sq','SQ'],['attraction','Attraction'],
].map(([k,label]) => { const s = geneKeysData[k]; return s && s.gate ? `${label}: Gate ${s.gate}${s.line ? '.'+s.line : ''}${s.transformation ? ' — '+s.transformation : (s.title ? ' — '+s.title : '')}` : null; }).filter(Boolean).join('\n') : 'Gene Keys data loading...'}

HUMAN DESIGN (full design — read whichever feature is relevant, do not default to Strategy/Authority):
${humanDesignData ? [
  `Type: ${humanDesignData.type || '—'}`,
  `Strategy: ${humanDesignData.strategy || '—'}`,
  `Authority: ${humanDesignData.authority || '—'}`,
  `Profile: ${humanDesignData.profile || '—'}`,
  humanDesignData.definition ? `Definition: ${humanDesignData.definition}` : null,
  humanDesignData.incarnationCross ? `Incarnation Cross: ${humanDesignData.incarnationCross}` : null,
  Array.isArray(humanDesignData.channels) && humanDesignData.channels.length ? `Channels: ${humanDesignData.channels.map((c: any) => typeof c === 'string' ? c : [c.name, c.channel].filter(Boolean).join(' ')).filter(Boolean).join(', ')}` : null,
  Array.isArray(humanDesignData.definedGates) && humanDesignData.definedGates.length ? `Defined Gates: ${humanDesignData.definedGates.map((g: any) => typeof g === 'object' && g ? (g.line != null ? `${g.gate}.${g.line}` : `${g.gate}`) : g).filter((v: any) => v != null && v !== 'undefined').join(', ')}` : null,
].filter(Boolean).join('\n') : 'Human Design data loading...'}

USER'S QUESTION: "${message}"

CONVERSATION HISTORY:
${conversationHistory || 'No prior mentions.'}
`
      }
    ]
  };
};

// Generate Menstrual Wellness prompt with cycle intelligence
export const generateMenstrualWellnessPrompt = (
  cycleData: any,
  userMessage: string,
  conversationHistory?: string
) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 300,
    "temperature": 0.2,
    "system": CYCLE_CHAT_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `TODAY'S DATE: ${today}

CYCLE CONTEXT:
${cycleContextBlock(cycleData)}
**LIFE STAGE:** ${cycleData.lifeStage || 'Menstruating Years'}

LIFE STAGE CONTEXT:
${cycleData.lifeStage === 'Puberty' ? 'Early cycles, still stabilising — hormonal patterns forming' :
  cycleData.lifeStage === 'Perimenopause' ? 'Cycles becoming irregular — shifting hormones, changing capacity' :
  cycleData.lifeStage === 'Post-Menopause' ? 'Cycles ended — steady hormonal baseline, no monthly variation' :
  'Regular cycling — established monthly hormonal pattern'}

USER'S QUESTION: "${userMessage}"

CONVERSATION HISTORY:
${conversationHistory || 'No prior mentions.'}
`
      }
    ]
  };
};


export const generateRestChatPrompt = (
  restData: any,
  cycleData: any,
  userMessage: string,
  conversationHistory?: string
) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 300,
    "temperature": 0.2,
    "system": REST_CHAT_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `TODAY'S DATE: ${today}

REST CONTEXT:
Nervous system state: ${restData.nervousSystemState || 'Unknown'}
Recovery quality: ${restData.recoveryQuality || 'Unknown'}
Night wakings: ${restData.nightWakings ?? '\u2014'}
Night sweats logged: ${restData.nightSweats == null ? 'not logged' : (restData.nightSweats ? 'Yes' : 'No')}
Alcohol consumed: ${restData.alcoholConsumed == null ? 'not logged' : (restData.alcoholConsumed ? 'Yes' : 'No')}
Sleep: ${restData.sleepSummary || 'Not logged'}

CYCLE CONTEXT:
Cycle day: ${cycleData?.cycleDay ?? '\u2014'}
Cycle phase: ${cycleData?.cyclePhase ?? '\u2014'}
Kundalini moon centre: ${cycleData?.moonCenter ?? '\u2014'}

USER'S QUESTION: "${userMessage}"

CONVERSATION HISTORY:
${conversationHistory || 'No prior mentions.'}
`
      }
    ]
  };
};


// SLEEP REST PROMPT
export const generateRestPracticePrompt = (
  cycleData: any,
  userMessage: string
) => {
  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 400,
    "temperature": 0.2,
    "system": REST_PRACTICE_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `CURRENT STATE
${cycleContextBlock(cycleData)}

PERSON'S MESSAGE: ${userMessage}`
      }
    ]
  };
};


// ─── Astrology: Weekly Design Thread (Human Design + Gene Keys) ───────────────
// Two short threads read against this week's transits:
//   Human Design = "how to move this week" (Strategy & Authority applied to the weather)
//   Gene Keys    = "what to work with this week" (the Shadow→Gift the week presses on)
// One is action, one is contemplation — no overlap. Lane 2 (proprietary).
export const generateDesignThreadPrompt = (
  weekLabel: string,
  geneKeysData: any,
  humanDesignData: any,
  supportiveTransits: Array<{ description: string }>,
  growthTransits: Array<{ description: string }>,
  leverageTransits: Array<{ description: string }>
) => {
  const gk = geneKeysData || {};
  const hd = humanDesignData || {};

  const sphere = (s: any, label: string) =>
    s && s.gate
      ? `${label}: Gate ${s.gate}${s.line ? `.${s.line}` : ''}${s.transformation ? ` — ${s.transformation}` : ''}`
      : `${label}: not set`;

  const geneKeysSummary = [
    `Profile: ${gk.profile || '—'}`,
    sphere(gk.lifesWork, "Life's Work"),
    sphere(gk.evolution, 'Evolution'),
    sphere(gk.radiance, 'Radiance'),
    sphere(gk.purpose, 'Purpose'),
    sphere(gk.vocation, 'Vocation'),
    sphere(gk.culture, 'Culture'),
    sphere(gk.pearl, 'Pearl'),
    sphere(gk.iq, 'IQ'),
    sphere(gk.eq, 'EQ'),
    sphere(gk.sq, 'SQ'),
    sphere(gk.attraction, 'Attraction'),
  ].join('\n');

  const hdList = (arr: any, label: string) =>
    Array.isArray(arr) && arr.length ? `${label}: ${arr.join(', ')}` : `${label}: —`;

  const humanDesignSummary = [
    `Type: ${hd.type || '—'}`,
    `Strategy: ${hd.strategy || '—'}`,
    `Authority: ${hd.authority || '—'}`,
    `Profile: ${hd.profile || '—'}`,
    `Definition: ${hd.definition || '—'}`,
    `Incarnation Cross: ${hd.incarnationCross || '—'}`,
    hdList(hd.channels, 'Channels'),
    hdList(hd.definedGates, 'Defined Gates'),
  ].join('\n');

  const formatTransits = (list: Array<{ description: string }>) =>
    list.length > 0 ? list.map(t => `- ${t.description}`).join('\n') : '- None significant this week';

  return {
    model: DEFAULT_PROMPT_MODEL,
    max_tokens: 700,
    system: DESIGN_THREAD_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write the two weekly threads for ${weekLabel}.

HUMAN DESIGN:
${humanDesignSummary}

GENE KEYS:
${geneKeysSummary}

THIS WEEK — WHAT IS AVAILABLE (trines, sextiles):
${formatTransits(supportiveTransits)}

THIS WEEK — WHAT IS ASKING SOMETHING (squares, oppositions, Rx):
${formatTransits(growthTransits)}

THIS WEEK — HIGH-LEVERAGE (outer-planet transits to natal placements, conjunctions, ingresses):
${formatTransits(leverageTransits)}

Human Design thread: choose one primary placement or transit and one supporting placement only if it sharpens the read. Write 2–3 sentences, 80–110 words.
Gene Keys thread: choose one primary sphere or transit and one supporting sphere only if it sharpens the read. Write 2–3 sentences, 80–110 words.`
      }
    ]
  };
};

// ─── Creative Calendar: Personal Weekly Sky Read ──────────────────────────────
// Three-paragraph personal synthesis: supportive / growth / high-leverage window
// Lives in Lane 2 (proprietary) — never ships with the open-source card fork
export const generatePersonalWeeklyReadPrompt = (
  weekLabel: string,
  natalChart: TransformedChart,
  supportiveTransits: Array<{ description: string }>,
  growthTransits: Array<{ description: string }>,
  leverageTransits: Array<{ description: string }>
) => {
  const housedomains: Record<string, string> = {
    '1': 'identity, how you meet the world',
    '2': 'resources, what you build and what you value',
    '3': 'communication, how you think and transmit',
    '4': 'foundations, private work, what grounds you',
    '5': 'creative expression, what you make for its own sake',
    '6': 'daily practice, craft, the body\'s capacity',
    '7': 'relationship, collaboration, how you meet others',
    '8': 'depth, transformation, what is held beneath the surface',
    '9': 'vision, meaning, the larger frame',
    '10': 'public work, vocation, what you are building in the world',
    '11': 'community, collective, who you build with',
    '12': 'the unseen, what works through you rather than from you',
  };

  const natalSummary = [
    `Sun: ${natalChart.sun.sign} in ${natalChart.sun.house} house (${housedomains[natalChart.sun.house] || ''})`,
    `Moon: ${natalChart.moon.sign} in ${natalChart.moon.house} house (${housedomains[natalChart.moon.house] || ''})`,
    `Mercury: ${natalChart.mercury.sign} in ${natalChart.mercury.house} house (${housedomains[natalChart.mercury.house] || ''})`,
    `Venus: ${natalChart.venus.sign} in ${natalChart.venus.house} house (${housedomains[natalChart.venus.house] || ''})`,
    `Mars: ${natalChart.mars.sign} in ${natalChart.mars.house} house (${housedomains[natalChart.mars.house] || ''})`,
    `Jupiter: ${natalChart.jupiter.sign} in ${natalChart.jupiter.house} house (${housedomains[natalChart.jupiter.house] || ''})`,
    `Saturn: ${natalChart.saturn.sign} in ${natalChart.saturn.house} house (${housedomains[natalChart.saturn.house] || ''})`,
    `Uranus: ${natalChart.uranus.sign} in ${natalChart.uranus.house} house (${housedomains[natalChart.uranus.house] || ''})`,
    `Neptune: ${natalChart.neptune.sign} in ${natalChart.neptune.house} house (${housedomains[natalChart.neptune.house] || ''})`,
    `Pluto: ${natalChart.pluto.sign} in ${natalChart.pluto.house} house (${housedomains[natalChart.pluto.house] || ''})`,
  ].join('\n');

  const formatTransits = (list: Array<{ description: string }>) =>
    list.length > 0 ? list.map(t => `- ${t.description}`).join('\n') : '- None significant this week';

  return {
    model: DEFAULT_PROMPT_MODEL,
    max_tokens: 900,
    system: PERSONAL_WEEKLY_READ_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write the personal weekly sky read for ${weekLabel}.

NATAL CHART:
${natalSummary}

PARAGRAPH 1 — WHAT IS AVAILABLE THIS WEEK (write from these — easy transits, trines, sextiles):
${formatTransits(supportiveTransits)}

PARAGRAPH 2 — WHAT IS ASKING SOMETHING OF YOU (write from these — squares, oppositions, challenging Rx aspects):
${formatTransits(growthTransits)}

PARAGRAPH 3 — WHERE THE HIGH-LEVERAGE WINDOW IS (write from these — outer planet transits to personal natal planets, conjunctions, ingresses this week):
${formatTransits(leverageTransits)}

OUTPUT: Three short paragraphs. Two sentences per paragraph. 35–45 words per paragraph.
P1: Choose one primary supportive transit and one supporting transit only if it sharpens the primary.
P2: Choose one primary challenging transit and one supporting transit only if it sharpens the primary.
P3: Choose one primary high-leverage transit.
Use one concrete fact per sentence. End the full read with one open locating question as the final sentence. Do not add questions to P1 or P2. Do not list every supplied transit.`
      }
    ]
  };
};

// MOVEMENT CHAT PROMPT — reads the independent Your Rhythm and Movement Read calculations.
export const generateMovementChatPrompt = (
  movementData: any,
  cycleData: any,
  userMessage: string,
  conversationHistory?: string
) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    "model": DEFAULT_PROMPT_MODEL,
    "max_tokens": 300,
    "temperature": 0.2,
    "system": MOVEMENT_CHAT_PROMPT,
    "messages": [
      {
        "role": "user",
        "content": `TODAY'S DATE: ${today}

MOVEMENT CONTEXT:
Your Rhythm colour: ${movementData.rhythmColour ?? 'Not recorded'}
Your Rhythm status: ${movementData.signalContext?.rhythm?.status ?? 'missing'}
Movement Read colour: ${movementData.movementColour ?? 'Not recorded'}
RMSSD today: ${movementData.rmssd ?? '—'}
SDNN today (recorded context): ${movementData.sdnn ?? '—'}
Your Rhythm reference: ${movementData.signalContext?.rhythm?.referenceKind ?? '—'}
Your Rhythm range (ms): ${movementData.signalContext?.rhythm?.lower ?? '—'} to ${movementData.signalContext?.rhythm?.upper ?? '—'}
Readiness word: ${movementData.signalContext?.movement?.readinessWord ?? 'Not logged'}
Rest/Rising recorded: ${movementData.signalContext?.movement?.restLogged ? 'yes' : 'no'}
Rest/Rising flags: ${movementData.signalContext?.movement?.restFlags?.join(', ') || 'None recorded'}
Rest/Rising points: ${movementData.signalContext?.movement?.restPoints ?? '—'}
Readiness score (1–10): ${movementData.readinessScore ?? '—'}
Latest workout: ${movementData.latestWorkout || 'None logged'}

CYCLE CONTEXT:
Cycle day: ${cycleData?.cycleDay ?? '—'}
Cycle phase: ${cycleData?.cyclePhase ?? '—'}

USER'S QUESTION: "${userMessage}"

CONVERSATION HISTORY:
${conversationHistory || 'No prior mentions.'}
`
      }
    ]
  };
};
