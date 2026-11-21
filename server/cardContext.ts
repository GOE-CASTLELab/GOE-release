// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { resolveUserDate } from './lib/userDate';
import { getRecoveryQuality, hasRecoveryInputs } from './lib/recovery';
import { createHash } from 'node:crypto';

export type CardContextDomain = 'cycle' | 'rest' | 'movement' | 'astrology';
export type SupportedChatCard = 'menstrual' | 'rest' | 'movement' | 'cosmic' | 'general';

export interface CardContextSection {
  domain: CardContextDomain;
  label: string;
  lines: string[];
}

export interface AssembledCardContext {
  primary: CardContextDomain | 'home';
  sections: CardContextSection[];
}

export interface CardContextStorage {
  getUserProfile?(userId: string): Promise<any>;
  getCycleContext?(userId: string): Promise<any>;
  getLatestRestRisingSubmission?(userId: string): Promise<any>;
  getMovementLog?(userId: string, date: string): Promise<any>;
  getLatestMovementWorkout?(userId: string): Promise<any>;
  getBirthChart?(userId: string): Promise<any>;
  getCurrentSky?(userId: string, date?: string): Promise<any>;
  getCurrentTransits?(userId: string, date?: string): Promise<any>;
  getGeneKeys?(userId: string): Promise<any>;
  getHumanDesign?(userId: string): Promise<any>;
}

type UserDateResolver = (userId: string, storage: CardContextStorage) => Promise<string>;
type CardContextProvider = (args: {
  storage: CardContextStorage;
  userId: string;
  resolveDate: UserDateResolver;
}) => Promise<CardContextSection | null>;

const providerRegistry = new Map<CardContextDomain, CardContextProvider>();

export function registerCardContextProvider(domain: CardContextDomain, provider: CardContextProvider): void {
  providerRegistry.set(domain, provider);
}

export function listCardContextProviders(): CardContextDomain[] {
  return [...providerRegistry.keys()];
}

async function safeRead<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return (await read()) ?? null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    const clean = value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    return clean || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function compactLine(label: string, value: unknown): string | null {
  const rendered = text(value);
  return rendered ? `${label}: ${rendered}.` : null;
}

function placement(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const sign = text(value.sign);
  const house = text(value.house);
  const degree = text(value.degree);
  if (!sign) return null;
  return `${sign}${degree ? ` ${degree}` : ''}${house ? `, ${house}` : ''}`;
}

function transitName(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return text(value);
  return text(value.transit)
    || [text(value.transitingPlanet || value.planet), text(value.aspect), text(value.natalPlanet)].filter(Boolean).join(' ')
    || null;
}

registerCardContextProvider('cycle', async ({ storage, userId }) => {
  const cycle = await safeRead(() => storage.getCycleContext!(userId));
  if (!cycle || (cycle.cycleDay == null && !cycle.moonCenter)) return null;
  const lines = [
    cycle.cycleDay != null && cycle.cyclePhase ? `Day ${cycle.cycleDay} · ${cycle.cyclePhase}.` : null,
    compactLine('Kundalini moon centre', cycle.moonCenter),
    compactLine('Cycle length', cycle.cycleLength),
  ].filter(Boolean) as string[];
  return { domain: 'cycle', label: 'Cyclical', lines };
});

registerCardContextProvider('rest', async ({ storage, userId }) => {
  const rest = await safeRead(() => storage.getLatestRestRisingSubmission!(userId));
  if (!rest) return null;
  const recoveryQuality = hasRecoveryInputs(rest) ? getRecoveryQuality(rest) : null;
  const lines = [
    compactLine('Nervous system', rest.nervousSystemState),
    compactLine('Recovery', recoveryQuality),
    compactLine('Waking state', rest.wakingState),
    compactLine('Falling asleep', rest.sleepProcess),
    compactLine('Night wakings', rest.nightWakings),
    compactLine('Evening energy', rest.energyAssessment),
    rest.nightSweats == null ? null : `Night sweats: ${rest.nightSweats ? 'yes' : 'no'}.`,
    rest.alcoholConsumed == null ? null : `Alcohol: ${rest.alcoholConsumed ? 'yes' : 'no'}.`,
  ].filter(Boolean) as string[];
  return lines.length ? { domain: 'rest', label: 'Rest & Restore', lines } : null;
});

registerCardContextProvider('movement', async ({ storage, userId, resolveDate }) => {
  const date = await resolveDate(userId, storage);
  const [movement, latestWorkout] = await Promise.all([
    safeRead(() => storage.getMovementLog!(userId, date)),
    safeRead(() => storage.getLatestMovementWorkout!(userId)),
  ]);
  if (!movement && !latestWorkout) return null;
  const lines = [
    compactLine('Your Rhythm', movement?.rhythmColour),
    compactLine('Your Rhythm status', movement?.signalContext?.rhythm?.status),
    compactLine('Movement Read', movement?.movementColour),
    compactLine('Readiness word', movement?.signalContext?.movement?.readinessWord),
    movement?.signalContext ? `Rest/Rising recorded: ${movement.signalContext.movement.restLogged ? 'yes' : 'no'}.` : null,
    movement?.rmssd == null ? null : `HRV metric used by Movement — RMSSD: ${movement.rmssd} ms.`,
    movement?.sdnn == null ? null : `Additional HRV context — SDNN: ${movement.sdnn} ms.`,
    movement?.readinessScore == null ? null : `Readiness: ${movement.readinessScore}/10.`,
    compactLine('Latest practice', latestWorkout?.practiceName),
    latestWorkout?.durationMinutes == null ? null : `Latest duration: ${latestWorkout.durationMinutes} minutes.`,
  ].filter(Boolean) as string[];
  return lines.length ? { domain: 'movement', label: 'Movement', lines } : null;
});

registerCardContextProvider('astrology', async ({ storage, userId }) => {
  const [birthChart, currentSky, currentTransits, geneKeys, humanDesign] = await Promise.all([
    safeRead(() => storage.getBirthChart!(userId)),
    safeRead(() => storage.getCurrentSky!(userId)),
    safeRead(() => storage.getCurrentTransits!(userId)),
    safeRead(() => storage.getGeneKeys!(userId)),
    safeRead(() => storage.getHumanDesign!(userId)),
  ]);
  const chart = birthChart?.transformedData;
  const sky = Array.isArray(currentSky?.transformedData) ? currentSky.transformedData : [];
  const transits = Array.isArray(currentTransits?.transformedData) ? currentTransits.transformedData : [];
  const activeTransits = transits.map(transitName).filter(Boolean).slice(0, 3);
  const skySun = sky.find((item: any) => String(item?.planet || '').toLowerCase() === 'sun');
  const lines = [
    compactLine('Natal Sun', placement(chart?.sun)),
    compactLine('Natal Moon', placement(chart?.moon)),
    compactLine('Rising', placement(chart?.ascendant || chart?.rising)),
    compactLine('Current Sun', skySun ? placement(skySun) : null),
    activeTransits.length ? `Active transits: ${activeTransits.join('; ')}.` : null,
    compactLine('Human Design type', humanDesign?.type || humanDesign?.chartData?.type),
    compactLine('Human Design authority', humanDesign?.authority || humanDesign?.chartData?.authority),
    geneKeys ? 'Gene Keys profile: available.' : null,
  ].filter(Boolean) as string[];
  return lines.length ? { domain: 'astrology', label: 'Astrology', lines } : null;
});

const PRIMARY_DOMAIN: Record<SupportedChatCard, CardContextDomain | 'home'> = {
  menstrual: 'cycle',
  rest: 'rest',
  movement: 'movement',
  cosmic: 'astrology',
  general: 'home',
};

// These contexts are already assembled natively by the existing prompt builders.
// Excluding them here prevents duplicate data while preserving the prompts unchanged.
const NATIVE_CONTEXT: Record<SupportedChatCard, CardContextDomain[]> = {
  menstrual: ['cycle'],
  rest: ['rest', 'cycle'],
  movement: ['movement', 'rest', 'cycle'],
  cosmic: ['astrology'],
  general: [],
};

const DOMAIN_TERMS: Record<CardContextDomain, RegExp> = {
  cycle: /\b(cycle|cyclical|period|menstruat\w*|bleed(?:ing)?|follicular|ovulat\w*|luteal|hormon\w*|moon cent(?:re|er)|fertil\w*)\b/i,
  rest: /\b(rest|restor\w*|sleep\w*|slept|tired\w*|fatigu\w*|recover\w*|nervous system|wak\w*|bedtime|insomnia|night waking|night sweats?)\b/i,
  movement: /\b(mov(?:e|ement|ing)|train\w*|workout|exercis\w*|practice|hrv|rmssd|readiness|ready to train|physical capacity|gym|run(?:ning)?|strength)\b/i,
  astrology: /\b(astrolog\w*|birth chart|natal|current sky|transit\w*|planet\w*|zodiac|sun sign|moon sign|rising sign|ascendant|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|gene keys?|human design)\b/i,
};

export function selectCrossCardDomains(cardType: SupportedChatCard, message: string, recentHistory = ''): CardContextDomain[] {
  if (cardType === 'general') return listCardContextProviders();
  const native = new Set(NATIVE_CONTEXT[cardType]);
  const conversation = `${message}\n${recentHistory}`;
  return listCardContextProviders().filter(domain => !native.has(domain) && DOMAIN_TERMS[domain].test(conversation));
}

export async function assembleCrossCardContext(args: {
  storage: CardContextStorage;
  userId: string;
  cardType: SupportedChatCard;
  message: string;
  recentHistory?: string;
  resolveDate?: UserDateResolver;
}): Promise<AssembledCardContext> {
  const domains = selectCrossCardDomains(args.cardType, args.message, args.recentHistory);
  const resolveDate = args.resolveDate || ((userId, storage) => resolveUserDate(userId, {
    getUserProfile: storage.getUserProfile
      ? (id: string) => storage.getUserProfile!(id)
      : async () => undefined,
  }));
  const sections = (await Promise.all(domains.map(async domain => {
    const provider = providerRegistry.get(domain);
    if (!provider) return null;
    return provider({ storage: args.storage, userId: args.userId, resolveDate });
  }))).filter(Boolean) as CardContextSection[];

  return { primary: PRIMARY_DOMAIN[args.cardType], sections };
}

export function renderCrossCardContext(context: AssembledCardContext): string | null {
  if (!context.sections.length) return null;
  return context.sections
    .map(section => `${section.label.toUpperCase()}\n${section.lines.map(line => `- ${line}`).join('\n')}`)
    .join('\n\n');
}

export function crossCardContextDataBlock(context: AssembledCardContext): string | null {
  const rendered = renderCrossCardContext(context);
  return rendered ? `AVAILABLE SIBLING CARD CONTEXT:\n${rendered}` : null;
}

export function addCrossCardContextToPrompt(promptConfig: any, context: AssembledCardContext): any {
  const dataBlock = crossCardContextDataBlock(context);
  if (!dataBlock || !Array.isArray(promptConfig?.messages)) return promptConfig;

  let inserted = false;
  const messages = promptConfig.messages.map((message: any) => {
    if (inserted || message?.role !== 'user' || typeof message.content !== 'string') return message;
    const questionMarker = "\nUSER'S QUESTION:";
    const markerIndex = message.content.indexOf(questionMarker);
    const content = markerIndex === -1
      ? `${message.content.trimEnd()}\n\n${dataBlock}\n`
      : `${message.content.slice(0, markerIndex)}\n\n${dataBlock}${message.content.slice(markerIndex)}`;
    inserted = true;
    return { ...message, content };
  });

  return inserted ? { ...promptConfig, messages } : promptConfig;
}

export function cardChatSessionKey(userId: string, cardType: string, conversationId = "legacy"): string {
  const ownerScope = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  const conversationScope = createHash('sha256').update(conversationId).digest('hex').slice(0, 12);
  return `goe-chat-${ownerScope}-${cardType}-${conversationScope}`;
}
