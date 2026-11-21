// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { previousDateString } from './restRisingCore';

// Split instrument. These pure functions are staged for the route cutover;
// the legacy exports below remain unchanged until their consumers migrate.
export const MOVEMENT_SPLIT_VERSION = '0.3.0';
export const RHYTHM_DERIVATION_VERSION = 'phase-or-recent-rmssd.v1';
export const MOVEMENT_READ_DERIVATION_VERSION = 'readiness-rest-points.v1';
export const RHYTHM_RECENT_READINGS = 28;
export const MOVEMENT_COLOURS = ['green', 'yellow', 'orange', 'red'] as const;
export type MovementColour = typeof MOVEMENT_COLOURS[number];
export type MovementLifeStage = 'cycling' | 'perimenopause' | 'postmenopause' | null;
export type MovementPhase = 'menstruation' | 'follicular' | 'ovulation' | 'early luteal' | 'late luteal';
export type ReadinessWord = 'motivated' | 'rising' | 'easing' | 'sluggish';

// Normalize the published phase; never derive a phase inside Movement.
export function movementPhase(phase: string | null | undefined): MovementPhase | null {
  const value = phase?.trim().toLowerCase();
  if (value === 'ovulatory' || value === 'ovulation') return 'ovulation';
  if (value === 'menstruation' || value === 'follicular' || value === 'early luteal' || value === 'late luteal') return value;
  return null;
}

export function movementReadPhase(lifeStage: MovementLifeStage, phase: string | null): MovementPhase | null {
  return lifeStage === 'postmenopause' ? null : movementPhase(phase);
}

export type RhythmReading = {
  date: string; // Profile-local YYYY-MM-DD, one daily anchor per owner.
  rmssd: number | null;
  hrvSource: string | null;
  cyclePhase: string | null;
};

export type YourRhythmCalculation = {
  rhythmColour: MovementColour | null;
  status: 'missing' | 'phase-unavailable' | 'observing' | 'recorded';
  referenceKind: 'phase' | 'recent';
  referenceCount: number; // Prior eligible readings only, excluding the current day.
  mean: number | null;
  sd: number | null;
  lower: number | null;
  upper: number | null;
  belowRange: boolean | null;
};

function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const validRmssd = (value: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function rhythmAtDate(
  current: RhythmReading,
  history: readonly RhythmReading[],
  lifeStage: MovementLifeStage,
): YourRhythmCalculation {
  const recent = lifeStage === 'perimenopause' || lifeStage === 'postmenopause';
  const empty: YourRhythmCalculation = {
    rhythmColour: null, status: 'missing', referenceKind: recent ? 'recent' : 'phase',
    referenceCount: 0, mean: null, sd: null, lower: null, upper: null, belowRange: null,
  };
  if (!validRmssd(current.rmssd)) return empty;
  const phase = movementPhase(current.cyclePhase);
  if (!recent && phase === null) return { ...empty, status: 'phase-unavailable' };

  const eligible = history.filter(reading =>
    reading.date < current.date && reading.hrvSource === current.hrvSource && validRmssd(reading.rmssd)
    && (recent || movementPhase(reading.cyclePhase) === phase),
  );
  const reference = recent
    ? eligible.sort((a, b) => b.date.localeCompare(a.date)).slice(0, RHYTHM_RECENT_READINGS)
    : eligible;
  // First, second and third readings remain observing; the fourth has 3 priors.
  if (reference.length < 3) return { ...empty, status: 'observing', referenceCount: reference.length };
  const values = reference.map(reading => reading.rmssd as number);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  const lower = mean - sd;
  const upper = mean + sd;
  const belowRange = current.rmssd < lower;
  return {
    rhythmColour: belowRange ? 'orange' : current.rmssd > upper ? 'green' : 'yellow',
    status: 'recorded', referenceKind: empty.referenceKind, referenceCount: values.length,
    mean, sd, lower, upper, belowRange,
  };
}

export function calculateYourRhythm(
  current: RhythmReading,
  history: readonly RhythmReading[],
  lifeStage: MovementLifeStage,
): YourRhythmCalculation {
  if (!isLocalDate(current.date)) throw new Error('Your Rhythm requires a valid profile-local date.');
  const dates = new Set<string>();
  const prior = history.filter(reading => {
    if (!isLocalDate(reading.date)) throw new Error('Your Rhythm history contains an invalid date.');
    if (reading.date >= current.date || reading.hrvSource !== current.hrvSource) return false;
    if (dates.has(reading.date)) throw new Error('Your Rhythm requires one daily anchor per date and source.');
    dates.add(reading.date);
    return true;
  });
  const result = rhythmAtDate(current, prior, lifeStage);
  if (!result.belowRange) return result;
  const yesterday = prior.find(reading => reading.date === previousDateString(current.date));
  // Evaluate yesterday against its own prior reference and phase, without today's data.
  if (yesterday && rhythmAtDate(yesterday, prior, lifeStage).belowRange === true) {
    return { ...result, rhythmColour: 'red' };
  }
  return result;
}

export type MovementRestInputs = {
  alcoholConsumed?: boolean | null;
  nightSweats?: boolean | null;
  nightWakings?: '0' | '1-2' | '3+' | null;
};
export type MovementRestFlag = 'alcohol' | 'night sweats' | '1–2 night wakings' | '3+ night wakings';
export type MovementReadCalculation = {
  movementColour: MovementColour | null;
  readinessColour: MovementColour | null;
  readinessWord: ReadinessWord | null;
  restLogged: boolean;
  restFlags: MovementRestFlag[];
  restPoints: number;
  requestedDrop: 0 | 1 | 2;
  appliedDrop: number;
};

export function movementReadiness(score: number | null | undefined): {
  colour: MovementColour; word: ReadinessWord;
} | null {
  if (score == null || !Number.isInteger(score) || score < 1 || score > 10) return null;
  // Preserve the existing four-colour numeric boundaries, align words to colours.
  if (score >= 8) return { colour: 'green', word: 'motivated' };
  if (score >= 6) return { colour: 'yellow', word: 'rising' };
  if (score >= 4) return { colour: 'orange', word: 'easing' };
  return { colour: 'red', word: 'sluggish' };
}

export function calculateMovementRead(
  readinessScore: number | null | undefined,
  rest: MovementRestInputs | null | undefined,
): MovementReadCalculation {
  const readiness = movementReadiness(readinessScore);
  const restLogged = typeof rest?.alcoholConsumed === 'boolean' || typeof rest?.nightSweats === 'boolean'
    || rest?.nightWakings === '0' || rest?.nightWakings === '1-2' || rest?.nightWakings === '3+';
  const restFlags: MovementRestFlag[] = [];
  let restPoints = 0;
  if (rest?.alcoholConsumed === true) { restFlags.push('alcohol'); restPoints += 1; }
  if (rest?.nightSweats === true) { restFlags.push('night sweats'); restPoints += 2; }
  if (rest?.nightWakings === '1-2') { restFlags.push('1–2 night wakings'); restPoints += 1; }
  if (rest?.nightWakings === '3+') { restFlags.push('3+ night wakings'); restPoints += 2; }
  const requestedDrop = restPoints >= 4 ? 2 : restPoints === 3 ? 1 : 0;
  const index = readiness ? MOVEMENT_COLOURS.indexOf(readiness.colour) : null;
  const finalIndex = index === null ? null : Math.min(3, index + requestedDrop);
  return {
    movementColour: finalIndex === null ? null : MOVEMENT_COLOURS[finalIndex],
    readinessColour: readiness?.colour ?? null, readinessWord: readiness?.word ?? null,
    restLogged, restFlags, restPoints, requestedDrop,
    appliedDrop: index === null || finalIndex === null ? 0 : finalIndex - index,
  };
}

export type MovementSplitCalculation = {
  instrumentVersion: typeof MOVEMENT_SPLIT_VERSION;
  rhythm: YourRhythmCalculation;
  movement: MovementReadCalculation;
  phaseForWords: MovementPhase | null;
  readinessAgainstRhythm: 'aligns' | 'above' | 'below' | 'not-logged' | null;
};

export type MovementSignalSnapshot = MovementSplitCalculation & {
  lifeStage: MovementLifeStage;
  cycleDay: number | null;
  cyclePhase: string | null;
};

export function calculateMovementSplit(input: {
  current: RhythmReading;
  history: readonly RhythmReading[];
  lifeStage: MovementLifeStage;
  readinessScore: number | null;
  rest: MovementRestInputs | null;
}): MovementSplitCalculation {
  const rhythm = calculateYourRhythm(input.current, input.history, input.lifeStage);
  const movement = calculateMovementRead(input.readinessScore, input.rest);
  let readinessAgainstRhythm: MovementSplitCalculation['readinessAgainstRhythm'] = null;
  if (movement.readinessColour === null) readinessAgainstRhythm = 'not-logged';
  else if (rhythm.rhythmColour !== null) {
    const difference = MOVEMENT_COLOURS.indexOf(movement.readinessColour) - MOVEMENT_COLOURS.indexOf(rhythm.rhythmColour);
    readinessAgainstRhythm = difference === 0 ? 'aligns' : difference < 0 ? 'above' : 'below';
  }
  return {
    instrumentVersion: MOVEMENT_SPLIT_VERSION, rhythm, movement, readinessAgainstRhythm,
    phaseForWords: movementReadPhase(input.lifeStage, input.current.cyclePhase),
  };
}
