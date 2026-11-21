// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

export type RestCycleBucket = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';

const RESOURCED_OPTIONS = [
  'Steady Throughout Day', 'Calm but Alert Energy',
  'Mind Blank/Peaceful', 'Gradual Settling Down',
  'Refreshed & Clear', 'Groggy but Clearing',
];

const ACTIVATED_OPTIONS = [
  'Wired but Tired', 'Sluggish Start, Better Later',
  'Racing/Rumination', 'Tossing & Turning',
  'Wired & Restless', 'Startled/Jarring Awakening',
];

export type NervousSystemState = 'resourced' | 'activated' | 'depleted';

export function classifyRestField(option?: string | null): NervousSystemState | null {
  if (!option) return null;
  if (RESOURCED_OPTIONS.includes(option)) return 'resourced';
  if (ACTIVATED_OPTIONS.includes(option)) return 'activated';
  return 'depleted';
}

// Exact shared version of the Rest card calculation: any depleted signal wins;
// otherwise a majority of activated signals wins; remaining available input is resourced.
export function classifyNervousSystemState(
  energyAssessment?: string | null,
  sleepProcess?: string | null,
  wakingState?: string | null,
): NervousSystemState | null {
  const signals = [
    classifyRestField(energyAssessment),
    classifyRestField(sleepProcess),
    classifyRestField(wakingState),
  ].filter((value): value is NervousSystemState => Boolean(value));

  if (signals.length === 0) return null;
  if (signals.includes('depleted')) return 'depleted';
  if (signals.filter(value => value === 'activated').length > signals.length / 2) return 'activated';
  return 'resourced';
}

export function restCycleBucket(phase?: string | null): RestCycleBucket | null {
  const value = String(phase || '').trim().toLowerCase();
  if (value === 'menstruation') return 'menstruation';
  if (value === 'follicular') return 'follicular';
  if (value === 'ovulatory' || value === 'ovulation') return 'ovulation';
  if (value === 'early luteal' || value === 'late luteal' || value === 'luteal') return 'luteal';
  return null;
}

export function previousDateString(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new Error(`Invalid local date: ${localDate}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function timeToHHMM(value?: string | null): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function formatLocalTime(value?: string | null): string | null {
  const normalized = timeToHHMM(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

const MERGED_FIELDS = [
  'restTime',
  'energyAssessment',
  'energyAssessmentClassification',
  'restReflection',
  'riseTime',
  'sleepProcess',
  'sleepProcessClassification',
  'wakingState',
  'wakingStateClassification',
  'dreamFragment',
  'morningReflection',
  'cyclePhase',
  'cycleDay',
  'nervousSystemState',
  'moonPhase',
  'moonCenter',
  'nightWakings',
  'nightSweats',
  'alcoholConsumed',
] as const;

function timestamp(value: any): number {
  const parsed = value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function present(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function mergeRestRisingRows<T extends Record<string, any>>(rows: T[]): T | undefined {
  if (!rows.length) return undefined;
  const sorted = [...rows].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  const merged = { ...sorted[0] } as T;

  for (const field of MERGED_FIELDS) {
    const source = sorted.find(row => present(row[field]));
    (merged as any)[field] = source ? source[field] : null;
  }

  return merged;
}
