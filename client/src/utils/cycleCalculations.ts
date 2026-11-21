import { MOON_CENTRE_CATALOGUE } from '@shared/moonCentreCatalogue';
import type { MoonPattern } from '@shared/moonPattern';
// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

// Client-side cycle utilities.
// THE MATH (cycle day, phase, moon-centre index, cycle length) now lives in the
// single owner: @shared/cycleCore. This file is a thin CLIENT wrapper that adds
// the rich per-moon-centre detail array + sleep-duration helper the UI needs, and
// re-exports the shared math so existing client callers keep working unchanged.
// Used by: DashboardContext, MenstrualCycleCard, RestIntelligenceCard.

import { moonCentresEnabled } from '@/lib/moonCentres';
import {
  calculateCycleInfo as coreCalculateCycleInfo,
  calculateMoonCenter as coreCalculateMoonCenter,
  parseLocalDate as coreParseLocalDate,
  cyclePhaseForDay,
  wrappedCycleDay,
  isFertileDay,
  DEFAULT_CYCLE_LENGTH,
  type CycleInfo as CoreCycleInfo,
} from '@shared/cycleCore';

export { cyclePhaseForDay, wrappedCycleDay, isFertileDay, DEFAULT_CYCLE_LENGTH };
export const parseLocalDate = coreParseLocalDate;
export const calculateCycleInfo = coreCalculateCycleInfo;

export type CycleInfo = CoreCycleInfo;

export interface MoonCenterInfo {
  current: string | null;
  details: any | null;
}

// Catalogue presentation is independent of each owner's sequence.
export const moonCenters = Object.values(MOON_CENTRE_CATALOGUE);
export const calculateMoonCenter = (date: Date, pattern?: MoonPattern | null): MoonCenterInfo => {
  if (!moonCentresEnabled) return { current: null, details: null };
  const { current, centreId } = coreCalculateMoonCenter(date, pattern);
  return { current, details: centreId ? MOON_CENTRE_CATALOGUE[centreId] : null };
};

// Rest-span math (rest time → rise time, minutes) — single source. Both
// calculateSleepDuration (hours, clamped) and calculateRestDuration
// ("Xh Ym" string, unclamped) delegate here instead of duplicating the formula.
export const calculateRestSpanMinutes = (restTime: string, riseTime: string): number | null => {
  if (!restTime || !riseTime) return null;

  try {
    const [restHour, restMin] = restTime.split(':').map(Number);
    const [riseHour, riseMin] = riseTime.split(':').map(Number);

    const restMinutes = restHour * 60 + restMin;
    let riseMinutes = riseHour * 60 + riseMin;

    if (riseMinutes < restMinutes) {
      riseMinutes += 24 * 60;
    }

    return riseMinutes - restMinutes;
  } catch {
    return null;
  }
};

// Calculate sleep duration in hours from rest time to rise time
export const calculateSleepDuration = (restTime: string, riseTime: string): number => {
  const durationMinutes = calculateRestSpanMinutes(restTime, riseTime);
  if (durationMinutes === null) return 0;

  try {
    const durationHours = durationMinutes / 60;

    return durationHours >= 1 && durationHours <= 16 ? durationHours : 0;
  } catch {
    return 0;
  }
};
