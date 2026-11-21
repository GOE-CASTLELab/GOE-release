import { z } from 'zod';
import { MOON_CENTRE_CATALOGUE, type MoonCentreId } from './moonCentreCatalogue';

export const MOON_PATTERN_DERIVATION = 'moon-centre.owner-pattern.v2';
export const MOON_CENTRE_DURATION_DAYS = 2.5;
export const realCalendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !value.startsWith('0000-') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Must be a real YYYY-MM-DD calendar date');
const centreId = z.custom<MoonCentreId>(value => typeof value === 'string'
  && Object.prototype.hasOwnProperty.call(MOON_CENTRE_CATALOGUE, value), 'Unknown moon-centre ID');

// Calendar-day samples, with an explicit elapsed position at the anchor sample.
// The canonical record stores elapsed days; entry callers may use the ordinal
// adapter below without knowing the arithmetic.
export const moonPatternSchema = z.object({
  enabled: z.boolean(),
  anchorDate: realCalendarDate,
  anchorCentreId: centreId,
  anchorElapsedDays: z.number().finite().min(0).lt(MOON_CENTRE_DURATION_DAYS),
  order: z.array(centreId).length(11).refine(ids => new Set(ids).size === 11, 'Each centre must occur exactly once'),
}).strict();
export type MoonPattern = z.infer<typeof moonPatternSchema>;
export type MoonPatternRecord = MoonPattern & { revision: number };
export type MoonPatternRevisionRecord = { revision: number; effectiveDate: string; pattern: MoonPattern };
// Day-entry samples sit halfway through the named day: day 1 = 0.5 elapsed,
// day 2 = 1.5 elapsed. With 2.5-day centres, day 2 advances tomorrow. This is a
// calendar sampling convention, not a claim of a measured transition time.
export const moonPatternDayEntrySchema = moonPatternSchema.omit({ anchorElapsedDays: true }).extend({
  dayInCentre: z.union([z.literal(1), z.literal(2)]),
}).strict();
export function moonPatternFromDay(input: z.input<typeof moonPatternDayEntrySchema>): MoonPattern {
  const { dayInCentre, ...pattern } = moonPatternDayEntrySchema.parse(input);
  return moonPatternSchema.parse({ ...pattern, anchorElapsedDays: dayInCentre - 0.5 });
}
export const connectMoonPatternSchema = z.object({
  expectedRevision: z.number().int().min(0),
  pattern: z.union([moonPatternSchema, moonPatternDayEntrySchema.transform(moonPatternFromDay)]),
}).strict();
export type ConnectMoonPattern = z.input<typeof connectMoonPatternSchema>;
export interface MoonPatternResponse {
  pattern: MoonPatternRecord | null;
  effectiveEnabled: boolean;
  asOfDate: string;
}
export class MoonPatternConflict extends Error {
  constructor() { super('Moon pattern changed; reload before connecting again'); }
}
export function moonPatternRevisionKey(pattern: MoonPatternRecord | null | undefined, enabled: boolean): string {
  return `${MOON_PATTERN_DERIVATION}:${enabled && pattern?.enabled ? pattern.revision : 'off'}`;
}
