// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import { calculateCycleInfo, calculateMoonCenter, cyclePhaseForDay, isFertileDay } from "@shared/cycleCore";
import { getMoonPhase } from "@shared/moonPhase";
import { mergeRestRisingRows } from "@shared/restRisingCore";
import { moonCentresEnabled } from './moonCentres';
import {
  GENE_KEY_ROLES,
  INSTRUMENT_MANIFESTS,
  isAcceptedCardVersion,
  type ContributionCard,
  type ContributionCardRecord,
  stableFingerprint,
} from "@shared/contributionContract";
import type { ConfiguredCard } from "./contributionConfig";

export interface ContributionDataSource {
  getUserProfile(userId: string): Promise<{ timezone?: string | null } | undefined>;
  getCycleData(userId: string): Promise<any | undefined>;
  getMoonPattern(userId: string): Promise<any | undefined>;
  getMoonPatternHistory?(userId: string): Promise<Array<{ revision: number; effectiveDate: string; pattern: any }>>;
  getRestRisingSubmissionsByDateRange(userId: string, startDate: string, endDate: string): Promise<any[]>;
  getMovementCalendar(userId: string, year: number, month: number): Promise<any[]>;
  getReturnPatternSessionsByDateRange(userId: string, startDate: string, endDate: string): Promise<any[]>;
  getReturnPatternSessionBefore(userId: string, before: Date): Promise<any | undefined>;
  getCurrentSky(userId: string, date?: string): Promise<any | undefined>;
  getCurrentTransits(userId: string, date?: string): Promise<any | undefined>;
  getGeneKeys(userId: string): Promise<any | undefined>;
  getHumanDesign(userId: string): Promise<any | undefined>;
}

export type ProjectionResult = {
  cards: ContributionCardRecord[];
  skippedCards: ContributionCard[];
  snapshotFingerprints: Partial<Record<"astrology_energetic" | "kundalini_order", string>>;
  acceptedKundaliniOrderSequence?: number;
};

export type ProjectionWindow = {
  startDate: string;
  endDate: string;
  windowSequence: number;
  acceptedSnapshotFingerprints?: Partial<Record<"astrology_energetic" | "kundalini_order", string>>;
  acceptedKundaliniOrderSequence?: number;
};

function compact(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function cardRecord(config: ConfiguredCard, values: Record<string, unknown>): ContributionCardRecord {
  return {
    card: config.card,
    consentVersion: config.consentVersion,
    instrumentVersion: config.instrumentVersion,
    manifestFingerprint: config.manifestFingerprint,
    mappingVersion: config.mappingVersion,
    values,
  };
}

const DAY_MS = 86_400_000;
function utcDate(value: string): Date { return new Date(`${value}T12:00:00Z`); }
function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
function dayDistance(start: string, end: string): number { return Math.round((utcDate(end).getTime() - utcDate(start).getTime()) / DAY_MS); }
function windowDay(date: string, window: ProjectionWindow): number { return dayDistance(window.startDate, date) + 1; }
function datesInWindow(window: ProjectionWindow): string[] {
  const days = dayDistance(window.startDate, window.endDate) + 1;
  return Array.from({ length: days }, (_, index) => dateKey(new Date(utcDate(window.startDate).getTime() + index * DAY_MS)));
}
function inWindow(date: unknown, window: ProjectionWindow): date is string { return typeof date === "string" && date >= window.startDate && date <= window.endDate; }
function cyclePeriods(cycle: any): Array<{ startDate: string; endDate?: string | null; extensions?: Array<{ date: string; previousCycleLength: number; resultingCycleLength: number }> }> {
  const rows = Array.isArray(cycle?.periodData) ? cycle.periodData : [];
  return rows.filter((row: any) => row && typeof row.startDate === "string").sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
}
async function movementRows(source: ContributionDataSource, userId: string, window: ProjectionWindow): Promise<any[]> {
  const months = new Set<string>();
  for (const date of datesInWindow(window)) months.add(date.slice(0, 7));
  const rows = await Promise.all([...months].map((month) => source.getMovementCalendar(userId, Number(month.slice(0, 4)), Number(month.slice(5, 7)))));
  return rows.flat().filter((row) => inWindow(row?.date, window));
}

function allowedString(card: ContributionCard, fieldId: string, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const definition = INSTRUMENT_MANIFESTS[card].fields.find((field) => field.id === fieldId);
  return definition?.allowedValues?.includes(value) ? value : undefined;
}

function normalizeNightWakings(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace("–", "-");
}

function normalizeHumanDesignType(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.trim().toLowerCase();
  const canonical = compact === "manifesting generator" ? "Manifesting Generator"
    : compact === "generator" ? "Generator"
    : compact === "projector" ? "Projector"
    : compact === "manifestor" ? "Manifestor"
    : compact === "reflector" ? "Reflector"
    : undefined;
  return allowedString("astrology_energetic", "human_design_type", canonical);
}

function normalizeHumanDesignAuthority(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.trim().toLowerCase();
  const canonical = compact.includes("emotional") || compact.includes("solar plexus") ? "Emotional"
    : compact.includes("sacral") ? "Sacral"
    : compact.includes("splenic") ? "Splenic"
    : compact.includes("self-projected") || compact.includes("self projected") ? "Self-Projected"
    : compact.includes("mental") || compact.includes("environmental") || compact.includes("no inner") ? "Mental"
    : compact.includes("lunar") ? "Lunar"
    : compact.includes("ego") || compact.includes("heart") ? "Ego"
    : undefined;
  return allowedString("astrology_energetic", "human_design_authority", canonical);
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function returnIntervalBand(previous: Date | undefined, current: Date): string {
  if (!previous) return "first_recorded";
  const hours = (current.getTime() - previous.getTime()) / 3_600_000;
  return hours < 6 ? "under_6_hours" : hours < 24 ? "6_to_24_hours" : hours < 96 ? "1_to_3_days" : hours < 192 ? "4_to_7_days" : hours < 360 ? "8_to_14_days" : "over_14_days";
}

function visibleActiveTimeBand(seconds: number): string {
  return seconds < 60 ? "under_1_minute" : seconds <= 300 ? "1_to_5_minutes" : seconds <= 900 ? "6_to_15_minutes" : seconds <= 1800 ? "16_to_30_minutes" : seconds <= 3600 ? "31_to_60_minutes" : "over_60_minutes";
}

function normalizeSky(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const body = row.planet ?? row.body;
    if (typeof body !== "string" || typeof row.sign !== "string") return [];
    return [{
      body,
      sign: row.sign,
      ...(number(row.degree) !== undefined ? { degree: number(row.degree) } : {}),
      ...(typeof row.retrograde === "boolean" ? { retrograde: row.retrograde } : {}),
    }];
  }).slice(0, 20);
}

function normalizeTransits(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const transitingBody = row.transitingPlanet ?? row.transitingBody;
    const natalBody = row.natalPlanet ?? row.natalBody;
    if (typeof transitingBody !== "string" || typeof natalBody !== "string" || typeof row.aspect !== "string") return [];
    return [{
      transitingBody,
      natalBody,
      aspect: row.aspect,
      ...(number(row.orb) !== undefined ? { orb: number(row.orb) } : {}),
    }];
  }).slice(0, 32);
}

function transformationKeywords(value: unknown): [string, string, string] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(/\s*(?:→|->)\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 ? [parts[0], parts[1], parts[2]] : null;
}

function normalizeGeneKeys(value: any): Record<string, unknown>[] {
  if (!value) return [];
  const sphereFields = [
    ["lifesWork", "Life's Work"],
    ["evolution", "Evolution"],
    ["radiance", "Radiance"],
    ["purpose", "Purpose"],
    ["attraction", "Attraction"],
    ["iq", "IQ"],
    ["eq", "EQ"],
    ["sq", "SQ"],
    ["vocation", "Vocation"],
    ["culture", "Culture"],
    ["pearl", "Pearl"],
  ] as const;
  const sources: Array<{ entry: unknown; fixedRole?: (typeof GENE_KEY_ROLES)[number] }> = sphereFields
    .map(([key, fixedRole]) => ({ entry: value[key], fixedRole }))
    .filter(({ entry }) => entry && typeof entry === "object");
  for (const sequence of [value.activationSequence, value.venusSequence, value.earthSequence, value.harmonySequence]) {
    if (Array.isArray(sequence)) sources.push(...sequence.map((entry) => ({ entry })));
  }
  const seen = new Set<string>();
  const normalized: Record<string, unknown>[] = [];
  for (const source of sources) {
    const entry = source.entry;
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const rawRole = source.fixedRole ?? row.role ?? row.title ?? row.name;
    const role = GENE_KEY_ROLES.find((candidate) => candidate.toLowerCase() === String(rawRole).trim().toLowerCase());
    let gate = row.geneKey ?? row.gate;
    let line = row.line;
    const combined = String(gate ?? "").trim().match(/^(\d{1,2})\.([1-6])$/);
    if (combined && (line === undefined || line === null || line === "")) {
      gate = combined[1];
      line = combined[2];
    }
    const direct = [row.shadow, row.gift, row.siddhi];
    const parsed = transformationKeywords(row.transformation);
    const keywords = direct.every((item) => typeof item === "string")
      ? direct as string[]
      : parsed;
    const geneKey = String(gate ?? "").trim();
    const geneLine = String(line ?? "").trim();
    if (!role || !/^\d{1,2}$/.test(geneKey) || !/^[1-6]$/.test(geneLine) || !keywords) continue;
    if (seen.has(role)) continue;
    seen.add(role);
    normalized.push({
      role,
      geneKey,
      line: geneLine,
      shadow: keywords[0],
      gift: keywords[1],
      siddhi: keywords[2],
    });
  }
  return GENE_KEY_ROLES.flatMap((role) => {
    const sphere = normalized.find((entry) => entry.role === role);
    return sphere ? [sphere] : [];
  });
}

async function projectCard(
  source: ContributionDataSource,
  userId: string,
  config: ConfiguredCard,
  activeCards: ReadonlySet<ContributionCard>,
  window: ProjectionWindow,
  snapshotFingerprints: ProjectionResult["snapshotFingerprints"],
): Promise<ContributionCardRecord | null> {
  if (config.card === "return_pattern") {
    const sessions = await source.getReturnPatternSessionsByDateRange(userId, window.startDate, window.endDate);
    if (!sessions.length) return null;
    const previousBeforeWindow = await source.getReturnPatternSessionBefore(userId, new Date(sessions[0].openedAt));
    let previousOpenedAt = previousBeforeWindow?.openedAt ? new Date(previousBeforeWindow.openedAt) : undefined;
    const return_sessions = sessions.map((session) => {
      const openedAt = new Date(session.openedAt);
      const entry = {
        window_day: windowDay(session.localDate, window),
        local_time_band: session.localTimeBand,
        interval_since_previous_return: returnIntervalBand(previousOpenedAt, openedAt),
        visible_active_time_band: visibleActiveTimeBand(Number(session.activeSeconds) || 0),
      };
      previousOpenedAt = openedAt;
      return entry;
    });
    return cardRecord(config, { return_sessions });
  }
  if (config.card === "cyclical") {
    const cycle = await source.getCycleData(userId);
    if (!cycle) return null;
    const periods = cyclePeriods(cycle);
    const moonHistory = source.getMoonPatternHistory ? await source.getMoonPatternHistory(userId) : [];
    const currentPattern = await source.getMoonPattern(userId);
    const revisions = !moonCentresEnabled() ? [] : moonHistory.length ? moonHistory : currentPattern ? [{ revision: currentPattern.revision, effectiveDate: window.startDate, pattern: currentPattern }] : [];
    const daily_positions = datesInWindow(window).flatMap((date) => {
      const periodIndex = periods.findLastIndex((period) => period.startDate <= date);
      if (periodIndex < 0) return [];
      const period = periods[periodIndex];
      const nextStart = periods[periodIndex + 1]?.startDate;
      const measuredLength = nextStart ? dayDistance(period.startDate, nextStart) : undefined;
      const activeExtensions = (period.extensions || []).filter((extension) => extension.date <= date);
      const cycleLength = measuredLength || activeExtensions.at(-1)?.resultingCycleLength || number(cycle.cycleLength) || 28;
      const info = calculateCycleInfo(utcDate(date), period.startDate, cycleLength);
      if (!info.day || !info.phase || info.phase === "Unknown") return [];
      const revision = revisions.filter((item) => item.effectiveDate <= date).sort((a, b) => a.revision - b.revision).at(-1);
      const centre = revision && moonCentresEnabled() ? calculateMoonCenter(utcDate(date), revision.pattern).current : null;
      return [{
        window_day: windowDay(date, window),
        relative_cycle_day: info.day,
        cycle_phase: info.phase,
        cycle_length: cycleLength,
        calendar_fertility_window: isFertileDay(info.day, cycleLength),
        ...(centre ? { kundalini_moon_centre: centre, kundalini_order_sequence: revision!.revision } : {}),
        lunar_phase: getMoonPhase(utcDate(date)).name,
      }];
    });
    const cycle_events = periods.flatMap((period) => [
      ...(inWindow(period.startDate, window) ? [{ event: "period_started", window_day: windowDay(period.startDate, window) }] : []),
      ...(inWindow(period.endDate, window) ? [{ event: "period_ended", window_day: windowDay(period.endDate, window) }] : []),
      ...(period.extensions || []).filter((entry) => inWindow(entry.date, window)).map((entry) => ({ event: "cycle_extended", window_day: windowDay(entry.date, window), previous_cycle_length: entry.previousCycleLength, resulting_cycle_length: entry.resultingCycleLength })),
    ]).sort((a, b) => a.window_day - b.window_day);
    const unsentRevisions = revisions.filter((revision) => revision.revision > (window.acceptedKundaliniOrderSequence || 0) && revision.effectiveDate <= window.endDate);
    const orderFingerprint = unsentRevisions.length ? stableFingerprint(unsentRevisions.at(-1)!.pattern.order) : undefined;
    const kundalini_order_snapshots = unsentRevisions.length
      ? unsentRevisions.map((revision) => ({
        kundalini_order_sequence: revision.revision,
        order: revision.pattern.order,
        ...(revision.effectiveDate < window.startDate || (!moonHistory.length && revision.effectiveDate === window.startDate) ? { effective_before_window: true } : { effective_window_day: windowDay(revision.effectiveDate, window) }),
      }))
      : [];
    if (orderFingerprint && kundalini_order_snapshots.length) {
      snapshotFingerprints.kundalini_order = orderFingerprint;
    }
    const values = compact({ daily_positions, cycle_events, kundalini_order_snapshots });
    return Object.keys(values).length ? cardRecord(config, values) : null;
  }

  if (config.card === "rest_restore") {
    const rows = await source.getRestRisingSubmissionsByDateRange(userId, window.startDate, window.endDate);
    const byDate = new Map<string, any[]>();
    for (const row of rows.filter((candidate) => inWindow(candidate?.sleepDate, window))) {
      const sameDate = byDate.get(row.sleepDate) || [];
      sameDate.push(row);
      byDate.set(row.sleepDate, sameDate);
    }
    const rest_observations = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, sameDate]) => {
      const rest = mergeRestRisingRows(sameDate);
      if (!rest) return [];
      const observation = compact({ window_day: windowDay(date, window), energy_signal: rest.energyAssessment, sleep_journey: rest.sleepProcess, waking_quality: rest.wakingState, nervous_system_state: rest.nervousSystemState, night_wakings: normalizeNightWakings(rest.nightWakings), night_sweats: rest.nightSweats, alcohol_consumed: rest.alcoholConsumed });
      return Object.keys(observation).length > 1 ? [observation] : [];
    });
    return rest_observations.length ? cardRecord(config, { rest_observations }) : null;
  }

  if (config.card === "movement") {
    if (!isAcceptedCardVersion(config)) return null;
    const logs = await movementRows(source, userId, window);
    const movement_observations = logs.filter((row) => (row.readinessScore != null || row.rmssd != null) && row.movementInstrumentVersion === config.instrumentVersion).sort((a, b) => a.date.localeCompare(b.date)).flatMap((row) => {
      const observation = compact({ window_day: windowDay(row.date, window), rmssd: number(row.rmssd), sdnn: row.hrvSource === "manual" ? undefined : number(row.sdnn), hrv_source: typeof row.hrvSource === "string" && ["camera_ppg", "bluetooth_rr", "manual"].includes(row.hrvSource) ? row.hrvSource : undefined, hrv_quality: number(row.hrvQuality), readiness_score: number(row.readinessScore), rhythm_colour: ["green", "yellow", "orange", "red"].includes(row.rhythmColour) ? row.rhythmColour : undefined, movement_colour: activeCards.has("rest_restore") && ["green", "yellow", "orange", "red"].includes(row.movementColour) ? row.movementColour : undefined });
      return Object.keys(observation).length > 1 ? [observation] : [];
    });
    const movement_practices = logs.filter((row) => row.practiceName != null).sort((a, b) => a.date.localeCompare(b.date)).flatMap((row) => {
      const category = typeof row.practiceName === "string" ? row.practiceName : undefined;
      return category && number(row.durationMinutes) !== undefined ? [{ window_day: windowDay(row.date, window), practice_category: category, practice_duration: number(row.durationMinutes) }] : [];
    });
    return movement_observations.length || movement_practices.length ? cardRecord(config, { movement_observations, movement_practices }) : null;
  }

  const [sky, transits, geneKeys, humanDesign] = await Promise.all([
    source.getCurrentSky(userId),
    source.getCurrentTransits(userId),
    source.getGeneKeys(userId),
    source.getHumanDesign(userId),
  ]);
  const normalizedSky = normalizeSky(sky?.transformedData);
  const normalizedTransits = normalizeTransits(transits?.transformedData);
  const normalizedGeneKeys = normalizeGeneKeys(geneKeys);
  const values = compact({
    normalized_transits: normalizedTransits.length ? normalizedTransits : undefined,
    normalized_current_sky: normalizedSky.length ? normalizedSky : undefined,
    human_design_type: normalizeHumanDesignType(humanDesign?.type),
    human_design_authority: normalizeHumanDesignAuthority(humanDesign?.authority),
    gene_keys_structure: normalizedGeneKeys.length === GENE_KEY_ROLES.length ? normalizedGeneKeys : undefined,
  });
  if (!Object.keys(values).length) return null;
  const fingerprint = stableFingerprint(values);
  if (fingerprint === window.acceptedSnapshotFingerprints?.astrology_energetic) return null;
  snapshotFingerprints.astrology_energetic = fingerprint;
  return cardRecord(config, values);
}

export async function buildContributionProjection(
  source: ContributionDataSource,
  userId: string,
  configuredCards: ConfiguredCard[],
  window: ProjectionWindow,
): Promise<ProjectionResult> {
  const cards: ContributionCardRecord[] = [];
  const skippedCards: ContributionCard[] = [];
  const snapshotFingerprints: ProjectionResult["snapshotFingerprints"] = {};
  const activeCards = new Set(configuredCards.map((card) => card.card));
  for (const config of configuredCards) {
    const projected = await projectCard(source, userId, config, activeCards, window, snapshotFingerprints);
    if (projected) cards.push(projected);
    else skippedCards.push(config.card);
  }
  const acceptedKundaliniOrderSequence = cards.find((card) => card.card === "cyclical")?.values.kundalini_order_snapshots;
  const orderSequence = Array.isArray(acceptedKundaliniOrderSequence) && acceptedKundaliniOrderSequence.length
    ? Number((acceptedKundaliniOrderSequence.at(-1) as Record<string, unknown>).kundalini_order_sequence)
    : undefined;
  return { cards, skippedCards, snapshotFingerprints, acceptedKundaliniOrderSequence: orderSequence };
}
