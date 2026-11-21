// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { z } from 'zod';

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const birthChartSetupSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD').refine(isRealDate, 'birthDate is not a real date'),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'birthTime must be HH:MM or HH:MM:SS'),
  birthLocation: z.string().trim().min(1).max(200),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().trim().min(1).refine(isIanaTimezone, 'timezone must be an IANA time zone'),
  elevation: z.number().finite().optional().default(0),
}).strict();

export type BirthChartSetup = z.infer<typeof birthChartSetupSchema>;

export function normalizeBirthTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export function buildBirthChartPayload(input: BirthChartSetup) {
  return {
    chart: {
      chartData: {
        jd: 0,
        tz: input.timezone,
        lat: input.latitude,
        lng: input.longitude,
        elev: input.elevation,
        version: 1,
        coordSys: 'G',
        zodiacID: 100,
        chartDate: `${input.birthDate}T${normalizeBirthTime(input.birthTime)}`,
        chartName: 'Birth Chart',
        birthLocation: input.birthLocation,
        houseSystemID: 1,
      },
    },
    calcRequestProps: {
      needImage: 'N',
      needAspects: 'N',
    },
    params: {
      objects: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15],
    },
  };
}
