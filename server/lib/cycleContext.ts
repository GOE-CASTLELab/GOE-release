import { calculateCycleInfo, calculateMoonCenter, calculateMoonCenterBlend, cyclePhaseForDay, wrappedCycleDay } from '@shared/cycleCore';
import { getMoonPhase } from '@shared/moonPhase';
import { moonPatternRevisionKey, type MoonPatternRecord } from '@shared/moonPattern';
import { moonCentresEnabled } from '../moonCentres';

export function buildCycleContext(raw: any, pattern: MoonPatternRecord | null | undefined, asOfDate: string, length = 28) {
  if (!raw && !pattern) return undefined;
  const date = new Date(`${asOfDate}T12:00:00`);
  const info = calculateCycleInfo(date, raw?.cycleStartDate || '', length);
  const day = info.day == null ? null : wrappedCycleDay(info.day, length);
  const active = moonCentresEnabled() ? pattern : null;
  return {
    cycleDay: day,
    cyclePhase: day == null ? null : cyclePhaseForDay(day, length),
    cycleLength: raw ? length : null,
    cycleStartDate: raw?.cycleStartDate || null,
    moonCenter: calculateMoonCenterBlend(date, active),
    moonCenterCurrent: calculateMoonCenter(date, active).current,
    moonPatternRevision: moonPatternRevisionKey(pattern, moonCentresEnabled()),
    lunarPhase: getMoonPhase(date).name,
    asOfDate,
  };
}
