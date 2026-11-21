import {
  AstroTime,
  Body,
  Ecliptic,
  GeoVector,
  type FlexibleDateTime,
} from "astronomy-engine";

export const ASTROLOGY_CALCULATION_VERSION = "astronomy-boundaries.v1";
export const CURRENT_SKY_CALCULATION_VERSION = "astrology-movement.v3";
export const ASTROLOGY_EPHEMERIS_SOURCE =
  "Astronomy Engine 2.1.19 (VSOP87/NOVAS-validated)";

const DAY_MS = 86_400_000;

const BODY_BY_ASTROAPP_ID: Partial<Record<number, Body>> = {
  0: Body.Sun,
  1: Body.Moon,
  2: Body.Mercury,
  3: Body.Venus,
  4: Body.Mars,
  5: Body.Jupiter,
  6: Body.Saturn,
  7: Body.Uranus,
  8: Body.Neptune,
  9: Body.Pluto,
};

const SEARCH_STEP_DAYS: Record<number, number> = {
  0: 1,
  1: 0.125,
  2: 0.25,
  3: 0.25,
  4: 0.5,
  5: 2,
  6: 2,
  7: 4,
  8: 4,
  9: 4,
};

const MAX_SIGN_SEARCH_DAYS: Record<number, number> = {
  0: 45,
  1: 5,
  2: 150,
  3: 300,
  4: 900,
  5: 900,
  6: 1_500,
  7: 4_000,
  8: 8_000,
  9: 15_000,
};

const MAX_INFLUENCE_SEARCH_DAYS: Record<number, number> = {
  0: 30,
  1: 4,
  2: 90,
  3: 120,
  4: 365,
  5: 1_000,
  6: 1_500,
  7: 2_500,
  8: 3_000,
  9: 3_500,
};

export interface CalculatedRange {
  start: string;
  end: string;
  source: string;
  calculationVersion: string;
}

export interface SkyBoundaries {
  signRange?: CalculatedRange;
  signMovement?: SignMovement;
  retrogradeRange?: CalculatedRange;
  retrogradeMovement?: RetrogradeMovement;
}

export interface SignMovement {
  nextSign: string;
  nextSignAt: string;
  direction: "forward" | "backward";
  source: string;
  calculationVersion: string;
}

export interface RetrogradeMovement {
  crossesSignBoundary: boolean;
  crossingSign?: string;
  crossingAt?: string;
  directSign: string;
  directAt: string;
  nextSign: string;
  nextSignAt: string;
  source: string;
  calculationVersion: string;
}

export interface TransitBoundaryInput {
  objectId2: number;
  exactDate1: string;
  exactJD?: number;
  exactLng?: number;
  aspectAngle: number;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function signedAngularDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

function angularDistance(a: number, b: number): number {
  return Math.abs(signedAngularDelta(a, b));
}

export function geocentricEclipticLongitude(astroAppObjectId: number, date: FlexibleDateTime): number {
  const body = BODY_BY_ASTROAPP_ID[astroAppObjectId];
  if (!body) throw new Error(`No local ephemeris body for AstroApp object ${astroAppObjectId}`);
  return normalizeLongitude(Ecliptic(GeoVector(body, date, true)).elon);
}

function signIndex(astroAppObjectId: number, date: Date): number {
  return Math.floor(geocentricEclipticLongitude(astroAppObjectId, date) / 30);
}

const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function signName(astroAppObjectId: number, date: Date): string {
  return SIGN_NAMES[signIndex(astroAppObjectId, date)];
}

function longitudeVelocity(astroAppObjectId: number, date: Date): number {
  const halfSpan = astroAppObjectId === 1 ? 0.02 : 0.125;
  const before = geocentricEclipticLongitude(astroAppObjectId, addDays(date, -halfSpan));
  const after = geocentricEclipticLongitude(astroAppObjectId, addDays(date, halfSpan));
  return signedAngularDelta(after, before) / (halfSpan * 2);
}

function refineBoundary(
  inside: Date,
  outside: Date,
  isInside: (date: Date) => boolean,
): Date {
  let insideTime = inside.getTime();
  let outsideTime = outside.getTime();
  for (let i = 0; i < 50 && Math.abs(outsideTime - insideTime) > 1_000; i += 1) {
    const midpoint = (insideTime + outsideTime) / 2;
    if (isInside(new Date(midpoint))) insideTime = midpoint;
    else outsideTime = midpoint;
  }
  return new Date((insideTime + outsideTime) / 2);
}

function findRange(
  anchor: Date,
  isInside: (date: Date) => boolean,
  stepDays: number,
  maxDays: number,
): { start: Date; end: Date } | null {
  if (!isInside(anchor)) return null;

  const findEdge = (direction: -1 | 1): Date | null => {
    let inside = anchor;
    for (let elapsed = stepDays; elapsed <= maxDays; elapsed += stepDays) {
      const candidate = addDays(anchor, direction * elapsed);
      if (!isInside(candidate)) return refineBoundary(inside, candidate, isInside);
      inside = candidate;
    }
    return null;
  };

  const start = findEdge(-1);
  const end = findEdge(1);
  return start && end ? { start, end } : null;
}

function calculatedRange(
  range: { start: Date; end: Date },
  calculationVersion = ASTROLOGY_CALCULATION_VERSION,
): CalculatedRange {
  return {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    source: ASTROLOGY_EPHEMERIS_SOURCE,
    calculationVersion,
  };
}

export function calculateSkyBoundaries(astroAppObjectId: number, at: Date): SkyBoundaries {
  if (!BODY_BY_ASTROAPP_ID[astroAppObjectId]) return {};

  const currentSign = signIndex(astroAppObjectId, at);
  const sign = findRange(
    at,
    (date) => signIndex(astroAppObjectId, date) === currentSign,
    SEARCH_STEP_DAYS[astroAppObjectId],
    MAX_SIGN_SEARCH_DAYS[astroAppObjectId],
  );

  const retrograde = longitudeVelocity(astroAppObjectId, at) < 0
    ? findRange(
        at,
        (date) => longitudeVelocity(astroAppObjectId, date) < 0,
        SEARCH_STEP_DAYS[astroAppObjectId],
        MAX_INFLUENCE_SEARCH_DAYS[astroAppObjectId],
      )
    : null;

  let signMovement: SignMovement | undefined;
  if (sign) {
    const nextSignIndex = signIndex(astroAppObjectId, addDays(sign.end, 0.01));
    signMovement = {
      nextSign: SIGN_NAMES[nextSignIndex],
      nextSignAt: sign.end.toISOString(),
      direction: (nextSignIndex - currentSign + 12) % 12 === 1 ? "forward" : "backward",
      source: ASTROLOGY_EPHEMERIS_SOURCE,
      calculationVersion: CURRENT_SKY_CALCULATION_VERSION,
    };
  }

  let retrogradeMovement: RetrogradeMovement | undefined;
  if (retrograde) {
    const directProbe = addDays(retrograde.end, 0.01);
    const directSignIndex = signIndex(astroAppObjectId, directProbe);
    const directSignRange = findRange(
      directProbe,
      (date) => signIndex(astroAppObjectId, date) === directSignIndex,
      SEARCH_STEP_DAYS[astroAppObjectId],
      MAX_SIGN_SEARCH_DAYS[astroAppObjectId],
    );

    if (directSignRange) {
      const crossingDuringRetrograde =
        directSignRange.start.getTime() > retrograde.start.getTime() + 60 * 60 * 1_000;
      retrogradeMovement = {
        crossesSignBoundary: crossingDuringRetrograde,
        ...(crossingDuringRetrograde ? {
          crossingSign: signName(astroAppObjectId, directProbe),
          crossingAt: directSignRange.start.toISOString(),
        } : {}),
        directSign: signName(astroAppObjectId, directProbe),
        directAt: retrograde.end.toISOString(),
        nextSign: signName(astroAppObjectId, addDays(directSignRange.end, 0.01)),
        nextSignAt: directSignRange.end.toISOString(),
        source: ASTROLOGY_EPHEMERIS_SOURCE,
        calculationVersion: CURRENT_SKY_CALCULATION_VERSION,
      };
    }
  }

  return {
    ...(sign ? { signRange: calculatedRange(sign, CURRENT_SKY_CALCULATION_VERSION) } : {}),
    ...(signMovement ? { signMovement } : {}),
    ...(retrograde ? { retrogradeRange: calculatedRange(retrograde, CURRENT_SKY_CALCULATION_VERSION) } : {}),
    ...(retrogradeMovement ? { retrogradeMovement } : {}),
  };
}

function exactMoment(event: TransitBoundaryInput): Date {
  if (Number.isFinite(event.exactJD)) {
    return new AstroTime((event.exactJD as number) - 2_451_545).date;
  }
  const parts = event.exactDate1.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (parts) {
    return new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12));
  }
  const parsed = new Date(event.exactDate1);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid transit exact date: ${event.exactDate1}`);
  return parsed;
}

export function calculateTransitInfluenceRange(
  event: TransitBoundaryInput,
  orbDegrees: number,
): CalculatedRange | null {
  if (!BODY_BY_ASTROAPP_ID[event.objectId2] || !Number.isFinite(event.exactLng)) return null;

  const anchor = exactMoment(event);
  const targetLongitude = normalizeLongitude(event.exactLng as number);
  const range = findRange(
    anchor,
    (date) => angularDistance(
      geocentricEclipticLongitude(event.objectId2, date),
      targetLongitude,
    ) <= orbDegrees,
    SEARCH_STEP_DAYS[event.objectId2],
    MAX_INFLUENCE_SEARCH_DAYS[event.objectId2],
  );

  return range ? calculatedRange(range) : null;
}

export function transitExactMoment(event: TransitBoundaryInput): string {
  return exactMoment(event).toISOString();
}

export function transitCandidateHorizonDays(astroAppObjectId: number): number {
  return MAX_INFLUENCE_SEARCH_DAYS[astroAppObjectId] ?? 2;
}
