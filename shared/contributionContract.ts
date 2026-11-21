import crypto from "node:crypto";
import { MOVEMENT_READ_DERIVATION_VERSION, MOVEMENT_SPLIT_VERSION, RHYTHM_DERIVATION_VERSION } from "./movementSignal";

export const CONTRIBUTION_SCHEMA_VERSION = "0.3.0";
export const CONTRIBUTION_CARDS = ["cyclical", "rest_restore", "movement", "astrology_energetic", "return_pattern"] as const;
export const INTERVAL_BANDS = ["first", "same_day", "1_3_days", "4_7_days", "8_30_days", "31_plus_days"] as const;
export const GENE_KEY_ROLES = ["Life's Work", "Evolution", "Radiance", "Purpose", "Attraction", "IQ", "EQ", "SQ", "Vocation", "Culture", "Pearl"] as const;
export const KUNDALINI_MOON_CENTRES = ["Breasts", "Cheeks", "Clitoris", "Earlobes", "Eyebrows", "Hairline", "Inner Thighs", "Lips", "Nape of Neck", "Navel", "Vagina"] as const;
export const KUNDALINI_MOON_CENTRE_IDS = ["breasts", "cheeks", "clitoris", "earlobes", "eyebrows", "hairline", "inner-thighs", "lips", "nape-of-neck", "navel", "vagina"] as const;

export type ContributionCard = (typeof CONTRIBUTION_CARDS)[number];
export type IntervalBand = (typeof INTERVAL_BANDS)[number];
export type ContributionWindow = { window_sequence: number; window_length_days: number };
export type ContributionCardRecord = { card: ContributionCard; consentVersion: string; instrumentVersion: string; manifestFingerprint: string; mappingVersion: string; values: Record<string, unknown> };
export type ContributionEnvelope = { schemaVersion: typeof CONTRIBUTION_SCHEMA_VERSION; contributionId: string; sequenceIndex: number; intervalBand: IntervalBand; sentAt: string; window: ContributionWindow; cards: ContributionCardRecord[] };

type FieldKind = "string" | "boolean" | "transit_array" | "sky_array" | "gene_key_array" | "record_array";
export type FieldDefinition = { id: string; definition: string; kind: FieldKind; unit: string | null; allowedValues: readonly (string | number | boolean)[] | null; questionVersion: string; derivationVersion: string };
export type InstrumentManifest = { card: ContributionCard; instrumentVersion: string; mappingVersion: string; fields: readonly FieldDefinition[] };
const field = (id: string, definition: string, kind: FieldKind, options: Partial<Omit<FieldDefinition, "id" | "definition" | "kind">> = {}): FieldDefinition => ({ id, definition, kind, unit: options.unit ?? null, allowedValues: options.allowedValues ?? null, questionVersion: options.questionVersion ?? "direct-observation.v1", derivationVersion: options.derivationVersion ?? "direct.v1" });

export const INSTRUMENT_MANIFESTS: Record<ContributionCard, InstrumentManifest> = {
  cyclical: { card: "cyclical", instrumentVersion: "0.3.0", mappingVersion: "0.3.0", fields: [
    field("daily_positions", "Calculated daily cycle positions sharing the contribution window's relative day.", "record_array", { derivationVersion: "cycle-window.v1" }),
    field("cycle_events", "Recorded period starts, period ends, and cycle-length extensions in the contribution window.", "record_array", { questionVersion: "cycle-events.v1" }),
    field("kundalini_order_snapshots", "The full connected Kundalini moon-centre order when first available or replaced.", "record_array", { derivationVersion: "moon-centre.owner-pattern.v2" }),
    field("calendar_fertility_window", "Whether the relative cycle day falls within the calendar fertility window calculated from the recorded cycle start and cycle length.", "boolean", { derivationVersion: "fertility-window.v1" }),
    field("kundalini_moon_centre", "The position calculated from the Kundalini moon-centre pattern you connected to GOE.", "string", { allowedValues: KUNDALINI_MOON_CENTRES, derivationVersion: "moon-centre.owner-pattern.v2" }),
  ] },
  rest_restore: { card: "rest_restore", instrumentVersion: "0.2.0", mappingVersion: "0.2.0", fields: [field("rest_observations", "Every eligible merged Rest and Rising observation in the contribution window.", "record_array", { derivationVersion: "rest-rising-window.v1" })] },
  movement: { card: "movement", instrumentVersion: "0.3.0", mappingVersion: "0.3.0", fields: [
    field("movement_observations", "Every eligible Movement read in the contribution window.", "record_array", { derivationVersion: MOVEMENT_SPLIT_VERSION }),
    field("movement_practices", "Every eligible saved Movement practice in the contribution window.", "record_array", { questionVersion: "movement-practice.v1" }),
    field("rhythm_colour", "RMSSD-only colour against personal source-specific phase or recent readings.", "string", { allowedValues: ["green", "yellow", "orange", "red"], derivationVersion: RHYTHM_DERIVATION_VERSION }),
    field("movement_colour", "Readiness colour adjusted by recorded Rest/Rising points.", "string", { allowedValues: ["green", "yellow", "orange", "red"], derivationVersion: MOVEMENT_READ_DERIVATION_VERSION }),
  ] },
  astrology_energetic: { card: "astrology_energetic", instrumentVersion: "0.2.0", mappingVersion: "0.2.0", fields: [
    field("normalized_transits", "Selected current transits represented as body, natal body, aspect, and optional orb.", "transit_array", { derivationVersion: "normalized-transits.v1" }),
    field("normalized_current_sky", "Selected current-sky positions represented as body, sign, degree, and retrograde state.", "sky_array", { derivationVersion: "normalized-current-sky.v1" }),
    field("human_design_type", "Owner-approved Human Design type.", "string", { allowedValues: ["Generator", "Manifesting Generator", "Projector", "Manifestor", "Reflector"], questionVersion: "human-design-profile.v1" }),
    field("human_design_authority", "Owner-approved Human Design authority.", "string", { allowedValues: ["Emotional", "Sacral", "Splenic", "Ego", "Self-Projected", "Mental", "Lunar"], questionVersion: "human-design-profile.v1" }),
    field("gene_keys_structure", "All 11 Gene Keys spheres with the Gene Key, line, and Shadow/Gift/Siddhi keywords for each sphere.", "gene_key_array", { derivationVersion: "gene-keys-all-spheres.v1" }),
  ] },
  return_pattern: { card: "return_pattern", instrumentVersion: "0.1.0", mappingVersion: "0.1.0", fields: [
    field("return_sessions", "Qualified returns to GOE represented by relative window position, local time-of-day band, interval since the previous return, and visible active-time band.", "record_array", { derivationVersion: "return-pattern.v1" }),
  ] },
};

function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`; } return JSON.stringify(value); }
export function stableFingerprint(value: unknown): string { return crypto.createHash("sha256").update(stable(value)).digest("hex"); }
export function fingerprintManifest(manifest: InstrumentManifest): string { return stableFingerprint(manifest); }
export const LOCAL_INSTRUMENT_MANIFESTS = INSTRUMENT_MANIFESTS;
export const ACCEPTED_CARD_VERSIONS = CONTRIBUTION_CARDS.map((card) => { const manifest = INSTRUMENT_MANIFESTS[card]; return { card, instrumentVersion: manifest.instrumentVersion, manifestFingerprint: fingerprintManifest(manifest), mappingVersion: manifest.mappingVersion, status: "accepted" as const }; });
export function acceptedCardVersion(card: ContributionCard) { return ACCEPTED_CARD_VERSIONS.find((entry) => entry.card === card)!; }
export function isAcceptedCardVersion(record: Pick<ContributionCardRecord, "card" | "instrumentVersion" | "manifestFingerprint" | "mappingVersion">): boolean { return ACCEPTED_CARD_VERSIONS.some((entry) => entry.card === record.card && entry.instrumentVersion === record.instrumentVersion && entry.manifestFingerprint === record.manifestFingerprint && entry.mappingVersion === record.mappingVersion); }

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const shortString = (value: unknown, max = 200) => typeof value === "string" && value.length > 0 && value.length <= max;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const integer = (value: unknown) => finite(value) && Number.isInteger(value);
const windowDay = (value: unknown, length: number) => integer(value) && Number(value) >= 1 && Number(value) <= length;
const uniqueRecordNumbers = (rows: unknown[], key: string) => {
  const values = rows.flatMap((row) => object(row) && integer(row[key]) ? [Number(row[key])] : []);
  return values.length === rows.length && new Set(values).size === values.length;
};

function validGeneKeys(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== GENE_KEY_ROLES.length) return false;
  const roles = new Set<string>();
  return value.every((entry) => object(entry) && exactKeys(entry, ["role", "geneKey", "line", "shadow", "gift", "siddhi"]) && GENE_KEY_ROLES.includes(entry.role as never) && !roles.has(String(entry.role)) && (roles.add(String(entry.role)), true) && shortString(entry.geneKey, 20) && typeof entry.line === "string" && /^[1-6]$/.test(entry.line) && shortString(entry.shadow, 80) && shortString(entry.gift, 80) && shortString(entry.siddhi, 80));
}

function validAstrology(values: Record<string, unknown>): boolean {
  const allowed = ["normalized_transits", "normalized_current_sky", "human_design_type", "human_design_authority", "gene_keys_structure"];
  if (!onlyKeys(values, allowed) || Object.keys(values).length === 0) return false;
  if ("normalized_transits" in values && (!Array.isArray(values.normalized_transits) || values.normalized_transits.length > 32 || !values.normalized_transits.every((entry) => object(entry) && onlyKeys(entry, ["transitingBody", "natalBody", "aspect", "orb"]) && shortString(entry.transitingBody, 40) && shortString(entry.natalBody, 40) && shortString(entry.aspect, 30) && (entry.orb === undefined || finite(entry.orb))))) return false;
  if ("normalized_current_sky" in values && (!Array.isArray(values.normalized_current_sky) || values.normalized_current_sky.length > 20 || !values.normalized_current_sky.every((entry) => object(entry) && onlyKeys(entry, ["body", "sign", "degree", "retrograde"]) && shortString(entry.body, 40) && shortString(entry.sign, 40) && (entry.degree === undefined || finite(entry.degree)) && (entry.retrograde === undefined || typeof entry.retrograde === "boolean")))) return false;
  if ("human_design_type" in values && !["Generator", "Manifesting Generator", "Projector", "Manifestor", "Reflector"].includes(String(values.human_design_type))) return false;
  if ("human_design_authority" in values && !["Emotional", "Sacral", "Splenic", "Ego", "Self-Projected", "Mental", "Lunar"].includes(String(values.human_design_authority))) return false;
  return !("gene_keys_structure" in values) || validGeneKeys(values.gene_keys_structure);
}

function validCyclical(values: Record<string, unknown>, length: number): boolean {
  if (!onlyKeys(values, ["daily_positions", "cycle_events", "kundalini_order_snapshots"])) return false;
  const daily = values.daily_positions ?? [], events = values.cycle_events ?? [], snapshots = values.kundalini_order_snapshots ?? [];
  if (![daily, events, snapshots].some((rows) => Array.isArray(rows) && rows.length > 0)) return false;
  if (!Array.isArray(daily) || daily.length > length || !uniqueRecordNumbers(daily, "window_day") || !daily.every((entry) => {
    if (!object(entry) || !onlyKeys(entry, ["window_day", "relative_cycle_day", "cycle_phase", "cycle_length", "calendar_fertility_window", "kundalini_moon_centre", "lunar_phase", "kundalini_order_sequence"])) return false;
    return windowDay(entry.window_day, length) && integer(entry.relative_cycle_day) && Number(entry.relative_cycle_day) >= 1 && Number(entry.relative_cycle_day) <= 120 &&
      ["Menstruation", "Follicular", "Ovulatory", "Early Luteal", "Late Luteal"].includes(String(entry.cycle_phase)) && integer(entry.cycle_length) && Number(entry.cycle_length) >= 1 && Number(entry.cycle_length) <= 120 &&
      typeof entry.calendar_fertility_window === "boolean" && (entry.kundalini_moon_centre === undefined || KUNDALINI_MOON_CENTRES.includes(entry.kundalini_moon_centre as never)) &&
      (entry.lunar_phase === undefined || ["New", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full", "Waning Gibbous", "Last Quarter", "Waning Crescent"].includes(String(entry.lunar_phase))) &&
      (entry.kundalini_order_sequence === undefined || (integer(entry.kundalini_order_sequence) && Number(entry.kundalini_order_sequence) > 0));
  })) return false;
  if (!Array.isArray(events) || events.length > length * 3 || !events.every((entry) => { if (!object(entry) || !windowDay(entry.window_day, length) || !["period_started", "period_ended", "cycle_extended"].includes(String(entry.event))) return false; if (entry.event === "cycle_extended") return exactKeys(entry, ["event", "window_day", "previous_cycle_length", "resulting_cycle_length"]) && integer(entry.previous_cycle_length) && integer(entry.resulting_cycle_length) && Number(entry.resulting_cycle_length) > Number(entry.previous_cycle_length); return exactKeys(entry, ["event", "window_day"]); })) return false;
  return Array.isArray(snapshots) && snapshots.length <= length + 1 && uniqueRecordNumbers(snapshots, "kundalini_order_sequence") && snapshots.every((entry) => object(entry) && onlyKeys(entry, ["kundalini_order_sequence", "order", "effective_before_window", "effective_window_day"]) && integer(entry.kundalini_order_sequence) && Number(entry.kundalini_order_sequence) > 0 && Array.isArray(entry.order) && entry.order.length === KUNDALINI_MOON_CENTRE_IDS.length && new Set(entry.order).size === KUNDALINI_MOON_CENTRE_IDS.length && entry.order.every((centre) => KUNDALINI_MOON_CENTRE_IDS.includes(centre as never)) && ((entry.effective_before_window === true && entry.effective_window_day === undefined) || (entry.effective_before_window === undefined && windowDay(entry.effective_window_day, length))));
}

const REST_ALLOWED: Record<string, readonly unknown[]> = { energy_signal: ["Steady Throughout Day", "Calm but Alert Energy", "Burn Out at 4pm", "Heavy/Dense Feeling", "Wired but Tired", "Sluggish Start, Better Later"], sleep_journey: ["Mind Blank/Peaceful", "Gradual Settling Down", "Instant Drop-Off", "Fragmented & Scattered", "Racing/Rumination", "Tossing & Turning"], waking_quality: ["Refreshed & Clear", "Groggy but Clearing", "Heavy & Dense", "Fragmented & Scattered", "Wired & Restless", "Startled/Jarring Awakening"], nervous_system_state: ["resourced", "activated", "depleted"], night_wakings: ["0", "1-2", "3+"] };
function validRest(values: Record<string, unknown>, length: number): boolean {
  if (!exactKeys(values, ["rest_observations"]) || !Array.isArray(values.rest_observations) || values.rest_observations.length === 0 || values.rest_observations.length > length) return false;
  return uniqueRecordNumbers(values.rest_observations, "window_day") && values.rest_observations.every((entry) => { if (!object(entry) || !onlyKeys(entry, ["window_day", ...Object.keys(REST_ALLOWED), "night_sweats", "alcohol_consumed"]) || !windowDay(entry.window_day, length) || Object.keys(entry).length < 2) return false; for (const [key, allowed] of Object.entries(REST_ALLOWED)) if (key in entry && !allowed.includes(entry[key])) return false; return (entry.night_sweats === undefined || typeof entry.night_sweats === "boolean") && (entry.alcohol_consumed === undefined || typeof entry.alcohol_consumed === "boolean"); });
}

function validMovement(values: Record<string, unknown>, length: number): boolean {
  if (!onlyKeys(values, ["movement_observations", "movement_practices"])) return false;
  const observations = values.movement_observations ?? [], practices = values.movement_practices ?? [];
  if (!Array.isArray(observations) || !Array.isArray(practices) || observations.length > length || practices.length > length * 20 || observations.length + practices.length === 0) return false;
  const observationKeys = ["window_day", "rmssd", "sdnn", "hrv_source", "hrv_quality", "readiness_score", "rhythm_colour", "movement_colour"];
  if (!uniqueRecordNumbers(observations, "window_day") || !observations.every((entry) => object(entry) && onlyKeys(entry, observationKeys) && windowDay(entry.window_day, length) && Object.keys(entry).length >= 2 && (entry.rmssd === undefined || finite(entry.rmssd)) && (entry.sdnn === undefined || finite(entry.sdnn)) && (entry.hrv_source === undefined || ["camera_ppg", "bluetooth_rr", "manual"].includes(String(entry.hrv_source))) && (entry.hrv_quality === undefined || (integer(entry.hrv_quality) && Number(entry.hrv_quality) >= 0 && Number(entry.hrv_quality) <= 100)) && (entry.readiness_score === undefined || (integer(entry.readiness_score) && Number(entry.readiness_score) >= 1 && Number(entry.readiness_score) <= 10)) && (entry.rhythm_colour === undefined || ["green", "yellow", "orange", "red"].includes(String(entry.rhythm_colour))) && (entry.movement_colour === undefined || ["green", "yellow", "orange", "red"].includes(String(entry.movement_colour))))) return false;
  const categories = ["Strength Training", "Pilates Full Body", "Pilates Flow", "Functional Exercises", "Core and Stability", "Facial Release", "Yin Yoga", "Breath-led Somatic Movement", "Walk", "Dance", "Abhyanga", "Mobility", "Riding Ground", "In-Saddle Ride"];
  return practices.every((entry) => object(entry) && exactKeys(entry, ["window_day", "practice_category", "practice_duration"]) && windowDay(entry.window_day, length) && categories.includes(String(entry.practice_category)) && integer(entry.practice_duration) && Number(entry.practice_duration) >= 0 && Number(entry.practice_duration) <= 1440);
}

function validReturnPattern(values: Record<string, unknown>, length: number): boolean {
  if (!exactKeys(values, ["return_sessions"]) || !Array.isArray(values.return_sessions) || values.return_sessions.length === 0 || values.return_sessions.length > length * 100) return false;
  const timeBands = ["overnight", "morning", "afternoon", "evening"];
  const intervalBands = ["first_recorded", "under_6_hours", "6_to_24_hours", "1_to_3_days", "4_to_7_days", "8_to_14_days", "over_14_days"];
  const activeBands = ["under_1_minute", "1_to_5_minutes", "6_to_15_minutes", "16_to_30_minutes", "31_to_60_minutes", "over_60_minutes"];
  return values.return_sessions.every((entry) => object(entry) && exactKeys(entry, ["window_day", "local_time_band", "interval_since_previous_return", "visible_active_time_band"]) && windowDay(entry.window_day, length) && timeBands.includes(String(entry.local_time_band)) && intervalBands.includes(String(entry.interval_since_previous_return)) && activeBands.includes(String(entry.visible_active_time_band)));
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };
export function validateContributionEnvelope(value: unknown): ValidationResult {
  if (!object(value) || !exactKeys(value, ["schemaVersion", "contributionId", "sequenceIndex", "intervalBand", "sentAt", "window", "cards"])) return { ok: false, reason: "Contribution envelope shape is invalid." };
  if (value.schemaVersion !== CONTRIBUTION_SCHEMA_VERSION) return { ok: false, reason: "Contribution schema version is not accepted." };
  if (typeof value.contributionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.contributionId)) return { ok: false, reason: "Contribution ID is invalid." };
  if (!integer(value.sequenceIndex) || Number(value.sequenceIndex) < 0) return { ok: false, reason: "Sequence index is invalid." };
  if (!INTERVAL_BANDS.includes(value.intervalBand as IntervalBand)) return { ok: false, reason: "Interval band is invalid." };
  if (typeof value.sentAt !== "string" || !Number.isFinite(Date.parse(value.sentAt))) return { ok: false, reason: "Contribution timestamp is invalid." };
  if (!object(value.window) || !exactKeys(value.window, ["window_sequence", "window_length_days"]) || !integer(value.window.window_sequence) || Number(value.window.window_sequence) < 0 || !integer(value.window.window_length_days) || Number(value.window.window_length_days) < 1 || Number(value.window.window_length_days) > 3660) return { ok: false, reason: "Contribution window is invalid." };
  if (!Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > CONTRIBUTION_CARDS.length) return { ok: false, reason: "Contribution cards are invalid." };
  const length = Number(value.window.window_length_days), seen = new Set<string>();
  for (const candidate of value.cards) {
    if (!object(candidate) || !exactKeys(candidate, ["card", "consentVersion", "instrumentVersion", "manifestFingerprint", "mappingVersion", "values"])) return { ok: false, reason: "Card record shape is invalid." };
    const card = candidate.card as ContributionCard;
    if (!CONTRIBUTION_CARDS.includes(card) || seen.has(card)) return { ok: false, reason: "Card record is unknown or duplicated." };
    seen.add(card);
    if (!shortString(candidate.consentVersion, 32) || !shortString(candidate.instrumentVersion, 32) || !/^[a-f0-9]{64}$/.test(String(candidate.manifestFingerprint)) || !shortString(candidate.mappingVersion, 32)) return { ok: false, reason: `Version metadata is invalid for ${card}.` };
    if (!isAcceptedCardVersion(candidate as ContributionCardRecord)) return { ok: false, reason: `Instrument version is not accepted for ${card}.` };
    if (!object(candidate.values)) return { ok: false, reason: `No contributed values were supplied for ${card}.` };
    const valid = card === "cyclical" ? validCyclical(candidate.values, length) : card === "rest_restore" ? validRest(candidate.values, length) : card === "movement" ? validMovement(candidate.values, length) : card === "astrology_energetic" ? validAstrology(candidate.values) : validReturnPattern(candidate.values, length);
    if (!valid) return { ok: false, reason: `Contributed values are invalid for ${card}.` };
  }
  return { ok: true };
}
