import { MOON_CENTRE_CATALOGUE, type MoonCentreId } from './moonCentreCatalogue';
import { moonPatternSchema, type MoonPattern, MOON_CENTRE_DURATION_DAYS } from './moonPattern';
// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE CORE — the single owner of cycle-phase, cycle-day, moon-center and
// cycle-length logic. Lives in shared/ so BOTH client and server import the SAME
// math (@shared/cycleCore). This replaces the seven hand-written copies of the
// phase formula that previously lived in the util, storage.ts, chat.ts and
// movement.ts.
//
// OWNERSHIP (Option B, the sovereign-stack contract): the CYCLE card owns this
// logic because phase is the cycle card's own truth. Other cards do NOT re-compute
// phase and do NOT import each other — server consumers read the owner-scoped
// published value through storage.getCycleContext(). Cross-card chat uses the
// provider registry in server/cardContext.ts. Cycle absent -> no value is supplied.
//
// FORK NOTE: this MATH ships in the fork (a forked cycle card can compute phase).
// The owner's real DATA (start date, length, history) is stripped separately
// (Axis 4). A fresh fork computes nothing until the user enters their own data.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CYCLE_LENGTH = 28;

// Canonical phase names, Title Case. "Ovulatory" is the PHASE (the window);
// "Ovulation" (the event) is deliberately NOT used as a phase label.
// "Menstruation" is the phase name (the bleeding phase); "Menstrual" (adjective)
// is not a phase label.
export type CyclePhase =
  | 'Menstruation'
  | 'Follicular'
  | 'Ovulatory'
  | 'Early Luteal'
  | 'Late Luteal'
  | 'Unknown';

export interface CycleInfo {
  day: number | null;
  phase: CyclePhase | null;
  isFertile: boolean;
}

export interface MoonCenterInfo {
  current: string | null;
  centreId: MoonCentreId | null;
  index: number | null;
}

export const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

// Whole-day difference (date - start) + 1, computed in UTC to avoid DST drift.
const dayNumber = (date: Date, startDate: Date): number => {
  const startUTC = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((dateUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1;
};

// THE canonical phase boundaries (0.179 / 0.464 / 0.536 / 0.750). Single source,
// the owner's chosen 5-phase set (decided 2026-09-03). Luteal splits into Early
// and Late by day. If the owner ever changes the boundaries again, it changes
// HERE, once, and every card follows.
//   Menstruation  D1–D5   (<= length * 0.179)
//   Follicular    D6–D13  (<= length * 0.464)
//   Ovulatory     D14–D15 (<= length * 0.536)
//   Early Luteal  D16–D21 (<= length * 0.750)
//   Late Luteal   D22–end
export const cyclePhaseForDay = (cycleDay: number, cycleLength = DEFAULT_CYCLE_LENGTH): CyclePhase => {
  if (cycleDay < 1) return 'Unknown';
  if (cycleDay <= Math.round(cycleLength * 0.179)) return 'Menstruation';
  if (cycleDay <= Math.round(cycleLength * 0.464)) return 'Follicular';
  if (cycleDay <= Math.round(cycleLength * 0.536)) return 'Ovulatory';
  if (cycleDay <= Math.round(cycleLength * 0.750)) return 'Early Luteal';
  return 'Late Luteal';
};

// Full cycle-day + phase + fertility read for a date.
export const calculateCycleInfo = (
  date: Date,
  cycleStartDate: string | Date,
  cycleLength = DEFAULT_CYCLE_LENGTH,
): CycleInfo => {
  if (!cycleStartDate) return { day: null, phase: null, isFertile: false };

  const startDate = cycleStartDate instanceof Date ? cycleStartDate : parseLocalDate(cycleStartDate);
  if (!startDate) return { day: null, phase: null, isFertile: false };

  const rawDay = dayNumber(date, startDate);
  if (rawDay <= 0) return { day: null, phase: null, isFertile: false };

  const phase = cyclePhaseForDay(rawDay, cycleLength);
  const isFertile = isFertileDay(rawDay, cycleLength);

  return { day: rawDay, phase, isFertile };
};

// Fertile-window read for a given cycle day. Single source for the fertile-window
// formula — call this rather than re-deriving ovulationDay/fertileStart/fertileEnd
// inline.
export const isFertileDay = (cycleDay: number, cycleLength = DEFAULT_CYCLE_LENGTH): boolean => {
  const ovulationDay = Math.floor(cycleLength * 0.5);
  const fertileStart = Math.max(1, ovulationDay - 4);
  const fertileEnd = Math.min(cycleLength, ovulationDay + 1);
  return cycleDay >= fertileStart && cycleDay <= fertileEnd;
};

// Whole-calendar-day sampling. Only an explicit enabled owner pattern can read.
// Legacy date-only anchors intentionally produce no reading.
function moonPosition(date: Date, pattern: MoonPattern | null | undefined) {
  const parsed = moonPatternSchema.safeParse(pattern && typeof pattern === 'object' ? {
    enabled: pattern.enabled, anchorDate: pattern.anchorDate, anchorCentreId: pattern.anchorCentreId,
    anchorElapsedDays: pattern.anchorElapsedDays, order: pattern.order,
  } : pattern);
  if (!parsed.success || !parsed.data.enabled || !Number.isFinite(date.getTime())) return null;
  const p = parsed.data;
  const calendarSample = new Date(0);
  calendarSample.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  const sample = calendarSample.getTime();
  const anchor = new Date(`${p.anchorDate}T00:00:00Z`).getTime();
  const days = (sample - anchor) / 86400000;
  if (days < 0) return null;
  const elapsed = days + p.anchorElapsedDays;
  const steps = Math.floor(elapsed / MOON_CENTRE_DURATION_DAYS);
  const index = (p.order.indexOf(p.anchorCentreId) + steps) % p.order.length;
  return { p, index, within: elapsed % MOON_CENTRE_DURATION_DAYS };
}

export const calculateMoonCenter = (date: Date, pattern?: MoonPattern | null): MoonCenterInfo => {
  const position = moonPosition(date, pattern);
  if (!position) return { current: null, centreId: null, index: null };
  const centreId = position.p.order[position.index];
  return { current: MOON_CENTRE_CATALOGUE[centreId].name, centreId, index: position.index };
};

// Preserve transition surfaces: the final 30% is Current/Next; single-centre
// consumers call calculateMoonCenter instead (including contributions).
export const calculateMoonCenterBlend = (date: Date, pattern?: MoonPattern | null): string | null => {
  const position = moonPosition(date, pattern);
  if (!position) return null;
  const { p, index, within } = position;
  const current = MOON_CENTRE_CATALOGUE[p.order[index]].name;
  const next = MOON_CENTRE_CATALOGUE[p.order[(index + 1) % p.order.length]].name;
  return within / MOON_CENTRE_DURATION_DAYS >= 0.7 ? `${current}/${next}` : current;
};

// Wrapped cycle day: for reads that span multiple cycles, wraps the raw day back
// into 1..cycleLength. (Some server reads want this; the card's own read uses the
// un-wrapped day from calculateCycleInfo.)
export const wrappedCycleDay = (rawDay: number, cycleLength = DEFAULT_CYCLE_LENGTH): number =>
  ((rawDay - 1) % cycleLength) + 1;

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR LOOKBACK (Audit A, S7) — additive only. calculateCycleInfo() keeps its
// existing contract: day/phase are null for any date on or before the cycle start
// (rawDay <= 0), and every current caller of calculateCycleInfo relies on that.
// This does NOT change that behavior.
//
// Calendar-style callers (e.g. a month grid) need a cycle day + phase for dates
// BEFORE the start date too, so they can render the whole grid instead of leaving
// pre-start cells blank. calculateCycleDayForCalendar() serves exactly that case:
// it wraps the raw (possibly negative-going) day count into 1..cycleLength by
// projecting backward whole cycle lengths, so a pre-start date still resolves to
// a sensible day-in-cycle + phase. Use calculateCycleInfo() for normal forward
// reads; use this only where the caller explicitly wants pre-start lookback.
export interface CalendarCycleInfo {
  day: number;
  phase: CyclePhase;
}

export const calculateCycleDayForCalendar = (
  date: Date,
  cycleStartDate: string | Date,
  cycleLength = DEFAULT_CYCLE_LENGTH,
): CalendarCycleInfo | null => {
  const startDate = cycleStartDate instanceof Date ? cycleStartDate : parseLocalDate(cycleStartDate);
  if (!startDate) return null;

  const rawDay = dayNumber(date, startDate);
  // Wrap into 1..cycleLength regardless of sign — this is the pre-start projection:
  // a date 3 days before the start lands on the same day-in-cycle as 3 days before
  // the END of the prior cycle would, i.e. cycleLength - 2.
  const day = ((rawDay - 1) % cycleLength + cycleLength) % cycleLength + 1;
  const phase = cyclePhaseForDay(day, cycleLength);

  return { day, phase };
};
