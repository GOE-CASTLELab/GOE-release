import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ACCEPTED_CARD_VERSIONS,
  CONTRIBUTION_SCHEMA_VERSION,
  validateContributionEnvelope,
  type ContributionEnvelope,
} from "../shared/contributionContract";
import { readContributionConfig } from "../server/contributionConfig";
import { buildContributionProjection } from "../server/contributionProjection";
import { loadContributionState, markContributionAccepted, saveContributionState } from "../server/contributionState";
import { sendContributionOnce } from "../server/contributionService";
import { runContributionScheduleCheck } from "../server/contributionScheduler";

process.env.MOON_CENTRES_ENABLED = "true";
const credential = `goe_${"a".repeat(43)}`;
const envNames = { cyclical: "CYCLICAL", rest_restore: "REST_RESTORE", movement: "MOVEMENT", astrology_energetic: "ASTROLOGY_ENERGETIC", return_pattern: "RETURN_PATTERN" } as const;
const env: NodeJS.ProcessEnv = {
  BROKERAGE_API_URL: "http://127.0.0.1:5100/api/contributions",
  CONTRIBUTION_CREDENTIAL: credential,
  CONTRIBUTION_CARDS: "cyclical,rest_restore,movement,astrology_energetic,return_pattern",
  CONTRIBUTION_SCHEDULE: "biweekly",
};
for (const version of ACCEPTED_CARD_VERSIONS) {
  const prefix = `CONTRIBUTION_${envNames[version.card]}`;
  env[`${prefix}_CONSENT_VERSION`] = "0.5.0";
  env[`${prefix}_INSTRUMENT_VERSION`] = version.instrumentVersion;
  env[`${prefix}_MANIFEST_FINGERPRINT`] = version.manifestFingerprint;
  env[`${prefix}_MAPPING_VERSION`] = version.mappingVersion;
}
const config = readContributionConfig(env);
if (!config.enabled) console.error(config);
assert.equal(config.enabled, true);
if (!config.enabled) throw new Error(config.reason);

const orderA = ["eyebrows", "cheeks", "lips", "earlobes", "nape-of-neck", "breasts", "clitoris", "inner-thighs", "navel", "vagina", "hairline"];
const orderB = ["cheeks", "lips", "earlobes", "nape-of-neck", "breasts", "clitoris", "inner-thighs", "navel", "vagina", "hairline", "eyebrows"];
const geneKeys = {
  lifesWork: { gate: "21", line: "3", transformation: "Control → Authority → Valour" }, evolution: { gate: "48", line: "3", transformation: "Inadequacy → Resourcefulness → Wisdom" }, radiance: { gate: "38", line: "6", transformation: "Struggle → Perseverance → Honour" }, purpose: { gate: "39", line: "6", transformation: "Provocation → Dynamism → Liberation" }, attraction: { gate: "19", line: "1", transformation: "Co-dependence → Sensitivity → Sacrifice" }, iq: { gate: "22", line: "6", transformation: "Dishonour → Graciousness → Grace" }, eq: { gate: "14", line: "5", transformation: "Compromise → Competence → Bounteousness" }, sq: { gate: "34", line: "6", transformation: "Force → Strength → Majesty" }, vocation: { gate: "50", line: "1", transformation: "Corruption → Equilibrium → Harmony" }, culture: { gate: "11", line: "5", transformation: "Obscurity → Idealism → Light" }, pearl: { gate: "26", line: "2", transformation: "Pride → Artfulness → Invisibility" },
};
const source = {
  async getUserProfile() { return { timezone: "America/Edmonton" }; },
  async getCycleData() { return { cycleLength: 28, periodData: [
    { startDate: "2026-08-12", endDate: "2026-08-16" },
    { startDate: "2026-09-09", endDate: "2026-09-20", extensions: [
      { date: "2026-09-18", previousCycleLength: 28, resultingCycleLength: 29 },
      { date: "2026-09-19", previousCycleLength: 29, resultingCycleLength: 30 },
    ] },
    { startDate: "2026-09-21", endDate: null },
  ] }; },
  async getMoonPattern() { return { enabled: true, anchorDate: "2026-09-01", anchorCentreId: "eyebrows", anchorElapsedDays: 0.5, order: orderB, revision: 2 }; },
  async getMoonPatternHistory() { return [
    { revision: 1, effectiveDate: "2026-09-01", pattern: { enabled: true, anchorDate: "2026-09-01", anchorCentreId: "eyebrows", anchorElapsedDays: 0.5, order: orderA } },
    { revision: 2, effectiveDate: "2026-09-19", pattern: { enabled: true, anchorDate: "2026-09-19", anchorCentreId: "cheeks", anchorElapsedDays: 0.5, order: orderB } },
  ]; },
  async getRestRisingSubmissionsByDateRange() { return [
    { sleepDate: "2026-09-10", energyAssessment: "Steady Throughout Day", alcoholConsumed: false, restReflection: "private" },
    { sleepDate: "2026-09-10", sleepProcess: "Gradual Settling Down", wakingState: "Refreshed & Clear", nervousSystemState: "resourced", nightWakings: "1-2", nightSweats: false, dreamFragment: "private" },
    { sleepDate: "2026-09-20", energyAssessment: "Calm but Alert Energy", sleepProcess: "Mind Blank/Peaceful", wakingState: "Groggy but Clearing", nervousSystemState: "resourced", nightWakings: "0", nightSweats: false, alcoholConsumed: false },
  ]; },
  async getMovementCalendar(_userId: string, _year: number, month: number) { return month === 9 ? [
    { date: "2026-09-10", movementInstrumentVersion: "0.3.0", rmssd: 42, sdnn: 51, hrvSource: "camera_ppg", hrvQuality: 98, readinessScore: 7, rhythmColour: "green", movementColour: "yellow", notes: "private", signalContext: { private: true } },
    { date: "2026-09-12", practiceName: "Walk", durationMinutes: 30, notes: "private" },
    { date: "2026-09-12", practiceName: "Yin Yoga", durationMinutes: 20 },
    { date: "2026-09-20", movementInstrumentVersion: "0.3.0", rmssd: 40, hrvSource: "manual", readinessScore: 6, rhythmColour: "yellow", movementColour: "green" },
    { date: "2026-09-21", movementInstrumentVersion: "0.2.0", rmssd: 99, hrvSource: "manual" },
  ] : []; },
  async getReturnPatternSessionsByDateRange() { return [
    { openedAt: new Date("2026-09-10T15:00:00.000Z"), localDate: "2026-09-10", localTimeBand: "morning", activeSeconds: 180 },
    { openedAt: new Date("2026-09-20T03:00:00.000Z"), localDate: "2026-09-19", localTimeBand: "evening", activeSeconds: 1_200 },
  ]; },
  async getReturnPatternSessionBefore() { return { openedAt: new Date("2026-09-01T15:00:00.000Z") }; },
  async getCurrentSky() { return { transformedData: [{ planet: "Sun", sign: "Virgo", degree: 29.1, retrograde: false }] }; },
  async getCurrentTransits() { return { transformedData: [{ transitingPlanet: "Saturn", natalPlanet: "Sun", aspect: "conjunction" }] }; },
  async getGeneKeys() { return geneKeys; },
  async getHumanDesign() { return { type: "Generator", authority: "Sacral", birthDate: "private" }; },
};

const window = { startDate: "2026-09-09", endDate: "2026-09-22", windowSequence: 0 };
const projection = await buildContributionProjection(source, "did:dfos:must-not-leave", config.cards, window);
assert.deepEqual(projection.skippedCards, []);
const cyclical = projection.cards.find((card) => card.card === "cyclical")!;
const daily = cyclical.values.daily_positions as any[];
const events = cyclical.values.cycle_events as any[];
assert.equal(daily.length, 14);
assert.deepEqual(events.map((event) => event.event), ["period_started", "cycle_extended", "cycle_extended", "period_ended", "period_started"]);
assert.equal(daily.find((row) => row.window_day === 11).kundalini_order_sequence, 2);
assert.equal((cyclical.values.kundalini_order_snapshots as any[]).length, 2);
const rest = projection.cards.find((card) => card.card === "rest_restore")!.values.rest_observations as any[];
assert.deepEqual(rest.map((row) => row.window_day), [2, 12]);
const movement = projection.cards.find((card) => card.card === "movement")!.values;
assert.deepEqual((movement.movement_observations as any[]).map((row) => row.window_day), [2, 12]);
assert.equal((movement.movement_practices as any[]).length, 2);
assert.equal((movement.movement_observations as any[]).some((row) => row.rmssd === 99), false);
const returns = projection.cards.find((card) => card.card === "return_pattern")!.values.return_sessions as any[];
assert.deepEqual(returns, [
  { window_day: 2, local_time_band: "morning", interval_since_previous_return: "8_to_14_days", visible_active_time_band: "1_to_5_minutes" },
  { window_day: 11, local_time_band: "evening", interval_since_previous_return: "8_to_14_days", visible_active_time_band: "16_to_30_minutes" },
]);

const envelope: ContributionEnvelope = { schemaVersion: CONTRIBUTION_SCHEMA_VERSION, contributionId: "123e4567-e89b-42d3-a456-426614174000", sequenceIndex: 0, intervalBand: "first", sentAt: "2026-09-22T23:00:00.000Z", window: { window_sequence: 0, window_length_days: 14 }, cards: projection.cards };
assert.deepEqual(validateContributionEnvelope(envelope), { ok: true });
const text = JSON.stringify(projection.cards);
assert.doesNotMatch(text, /2026-09-(?:09|10|12|18|19|20|21|22)|did:dfos|private|restReflection|dreamFragment|notes|signalContext|fertility_state|"moon_centre":/);
assert.match(text, /calendar_fertility_window/);
assert.match(text, /kundalini_moon_centre/);

const unchanged = await buildContributionProjection(source, "owner", config.cards, { ...window, acceptedSnapshotFingerprints: projection.snapshotFingerprints, acceptedKundaliniOrderSequence: projection.acceptedKundaliniOrderSequence });
assert.equal(unchanged.cards.some((card) => card.card === "astrology_energetic"), false);
assert.equal((unchanged.cards.find((card) => card.card === "cyclical")!.values.kundalini_order_snapshots as any[]).length, 0);
const withReplacement = await buildContributionProjection({ ...source, async getMoonPatternHistory() { return [
  ...(await source.getMoonPatternHistory()),
  { revision: 3, effectiveDate: "2026-09-22", pattern: { enabled: true, anchorDate: "2026-09-22", anchorCentreId: "lips", anchorElapsedDays: 0.5, order: [...orderB.slice(1), orderB[0]] } },
]; } }, "owner", config.cards, { ...window, acceptedSnapshotFingerprints: projection.snapshotFingerprints, acceptedKundaliniOrderSequence: 2 });
const replacementSnapshots = withReplacement.cards.find((card) => card.card === "cyclical")!.values.kundalini_order_snapshots as any[];
assert.deepEqual(replacementSnapshots.map((snapshot) => snapshot.kundalini_order_sequence), [3]);
const delayedWindow = { startDate: "2026-09-09", endDate: "2026-09-29", windowSequence: 1, acceptedSnapshotFingerprints: projection.snapshotFingerprints, acceptedKundaliniOrderSequence: projection.acceptedKundaliniOrderSequence };
const delayed = await buildContributionProjection(source, "owner", config.cards, delayedWindow);
const delayedEnvelope: ContributionEnvelope = { ...envelope, sequenceIndex: 1, window: { window_sequence: 1, window_length_days: 21 }, cards: delayed.cards };
assert.deepEqual(validateContributionEnvelope(delayedEnvelope), { ok: true });
assert.equal((delayed.cards.find((card) => card.card === "cyclical")!.values.daily_positions as any[]).length, 21);
const oldField = structuredClone(envelope) as any;
oldField.cards.find((card: any) => card.card === "cyclical").values.daily_positions[0].fertility_state = true;
assert.equal(validateContributionEnvelope(oldField).ok, false);
const badWindow = structuredClone(envelope) as any;
badWindow.window.window_length_days = 13;
assert.equal(validateContributionEnvelope(badWindow).ok, false);

const stateFile = `/tmp/goe-contribution-state-${process.pid}.json`;
const stateEnv = { CONTRIBUTION_STATE_PATH: stateFile };
const migrationFile = `/tmp/goe-contribution-state-migration-${process.pid}.json`;
fs.writeFileSync(migrationFile, JSON.stringify({ contributionId: "123e4567-e89b-42d3-a456-426614174000", nextSequenceIndex: 7, lastAcceptedAt: "2026-09-01T00:00:00.000Z" }));
const migratedState = loadContributionState({ CONTRIBUTION_STATE_PATH: migrationFile });
assert.equal(migratedState.nextSequenceIndex, 7);
assert.equal(migratedState.nextWindowSequence, 0);
fs.rmSync(migrationFile, { force: true });
const state = loadContributionState(stateEnv);
const next = markContributionAccepted(state, envelope.sentAt, "2026-09-22", projection.snapshotFingerprints, projection.acceptedKundaliniOrderSequence, stateEnv);
assert.equal(next.nextSequenceIndex, 1);
assert.equal(next.nextWindowSequence, 1);
assert.equal(next.lastAcceptedWindowEnd, "2026-09-22");
assert.deepEqual(next.acceptedSnapshotFingerprints, projection.snapshotFingerprints);
assert.equal(next.acceptedKundaliniOrderSequence, 2);
fs.rmSync(stateFile, { force: true });

// The real send path uses the same projection and advances only after receiver acceptance.
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
const sendSource = { ...source,
  async getCycleData() { return undefined; }, async getMoonPattern() { return undefined; }, async getMoonPatternHistory() { return []; },
  async getRestRisingSubmissionsByDateRange(_userId: string, startDate: string) { return [{ sleepDate: startDate, energyAssessment: "Steady Throughout Day" }]; },
};
const restEnv = { ...env, ...stateEnv, CONTRIBUTION_CARDS: "rest_restore" };
let submitted: any;
const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).endsWith("/authorization")) return new Response(JSON.stringify({ ok: true, grants: config.cards.filter((card) => card.card === "rest_restore") }), { status: 200, headers: { "content-type": "application/json" } });
  submitted = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 201, headers: { "content-type": "application/json" } });
}) as typeof fetch;
const sent = await sendContributionOnce(sendSource, "owner", restEnv, fetcher);
assert.equal(sent.status, 201);
assert.equal(submitted.window.window_length_days, 14);
assert.equal(loadContributionState(stateEnv).lastAcceptedWindowEnd, today);
fs.rmSync(stateFile, { force: true });

const scheduledState = loadContributionState(stateEnv);
const fifteenDaysAgo = new Date(Date.now() - 15 * 86_400_000).toISOString();
const fifteenDaysAgoLocal = new Date(new Date(`${today}T12:00:00Z`).getTime() - 15 * 86_400_000).toISOString().slice(0, 10);
saveContributionState({ ...scheduledState, lastAcceptedAt: fifteenDaysAgo, lastAcceptedWindowEnd: fifteenDaysAgoLocal }, stateEnv);
const scheduledStateMode = fs.statSync(stateFile).mode & 0o777;
assert.equal(scheduledStateMode, 0o600);
const staleReturnEnv = { ...env, ...stateEnv, CONTRIBUTION_CARDS: "rest_restore,return_pattern" };
let returnPatternReads = 0;
const scheduledSource = {
  ...sendSource,
  async getReturnPatternSessionsByDateRange() { returnPatternReads += 1; return source.getReturnPatternSessionsByDateRange(); },
};
submitted = null;
assert.equal(await runContributionScheduleCheck(scheduledSource, "owner", staleReturnEnv, new Date(), fetcher), "sent");
assert.equal(submitted.window.window_length_days, 15);
assert.deepEqual(submitted.cards.map((card: any) => card.card), ["rest_restore"]);
assert.equal(returnPatternReads, 0);
const acceptedScheduledState = loadContributionState(stateEnv);
assert.equal(acceptedScheduledState.nextSequenceIndex, 1);
assert.equal(fs.statSync(stateFile).mode & 0o777, scheduledStateMode);
assert.equal(new Date(acceptedScheduledState.lastAcceptedAt!).getTime() + 14 * 86_400_000 > Date.now(), true);
fs.rmSync(stateFile, { force: true });

const astrologyEnv = { ...env, ...stateEnv, CONTRIBUTION_CARDS: "astrology_energetic" };
let rejectIntake = true;
const retryFetcher = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).endsWith("/authorization")) return new Response(JSON.stringify({ ok: true, grants: config.cards.filter((card) => card.card === "astrology_energetic") }), { status: 200, headers: { "content-type": "application/json" } });
  submitted = JSON.parse(String(init?.body));
  if (rejectIntake) return new Response(JSON.stringify({ ok: false, reason: "test rejection" }), { status: 409, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 201, headers: { "content-type": "application/json" } });
}) as typeof fetch;
assert.equal((await sendContributionOnce(source, "owner", astrologyEnv, retryFetcher)).status, 502);
assert.equal(loadContributionState(stateEnv).nextSequenceIndex, 0);
assert.deepEqual(loadContributionState(stateEnv).acceptedSnapshotFingerprints, {});
rejectIntake = false;
assert.equal((await sendContributionOnce(source, "owner", astrologyEnv, retryFetcher)).status, 201);
assert.equal(submitted.cards[0].card, "astrology_energetic");
assert.equal(loadContributionState(stateEnv).nextSequenceIndex, 1);
fs.rmSync(stateFile, { force: true });
delete process.env.MOON_CENTRES_ENABLED;
console.log("Contribution window, complete records, changed snapshots, privacy, state, and send path: pass");
