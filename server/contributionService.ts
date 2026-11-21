import { CONTRIBUTION_SCHEMA_VERSION, validateContributionEnvelope, type ContributionEnvelope } from "@shared/contributionContract";
import { readContributionConfig } from "./contributionConfig";
import { buildContributionProjection, type ContributionDataSource } from "./contributionProjection";
import { fetchContributionAuthorization, submitContribution } from "./contributionClient";
import { intervalBand, loadContributionState, markContributionAccepted } from "./contributionState";
import { resolveUserDate } from "./lib/userDate";

let sendInProgress = false;
export type SendResult = { status: number; body: Record<string, unknown> };
const DAY_MS = 86_400_000;
function shiftDate(value: string, days: number): string {
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
function windowLength(startDate: string, endDate: string): number {
  return Math.round((new Date(`${endDate}T12:00:00Z`).getTime() - new Date(`${startDate}T12:00:00Z`).getTime()) / DAY_MS) + 1;
}

export async function sendContributionOnce(
  source: ContributionDataSource,
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  if (sendInProgress) return { status: 409, body: { ok: false, reason: "A contribution send is already in progress." } };
  const config = readContributionConfig(env);
  if (!config.enabled) return { status: config.status === "paused" ? 409 : 503, body: { ok: false, ...config } };
  sendInProgress = true;
  try {
    const authorization = await fetchContributionAuthorization(config.endpoint, config.credential, fetcher);
    if (!authorization.ok || !Array.isArray(authorization.body.grants)) {
      return { status: 502, body: { ok: false, reason: typeof authorization.body.reason === "string" ? authorization.body.reason : "Active contribution-area consent could not be verified." } };
    }
    const grants = authorization.body.grants as Array<Record<string, unknown>>;
    const activeCards = config.cards.filter((card) => grants.some((grant) =>
      grant.card === card.card && grant.consentVersion === card.consentVersion &&
      grant.instrumentVersion === card.instrumentVersion && grant.manifestFingerprint === card.manifestFingerprint &&
      grant.mappingVersion === card.mappingVersion
    ));
    if (activeCards.length === 0) return { status: 403, body: { ok: false, reason: "No configured contribution area currently has active consent." } };
    const state = loadContributionState(env);
    const endDate = await resolveUserDate(userId, source);
    const startDate = state.lastAcceptedWindowEnd ? shiftDate(state.lastAcceptedWindowEnd, 1) : shiftDate(endDate, -13);
    const length = windowLength(startDate, endDate);
    if (length < 1) return { status: 409, body: { ok: false, reason: "There is no new contribution window to send." } };
    const projection = await buildContributionProjection(source, userId, activeCards, {
      startDate,
      endDate,
      windowSequence: state.nextWindowSequence,
      acceptedSnapshotFingerprints: state.acceptedSnapshotFingerprints,
      acceptedKundaliniOrderSequence: state.acceptedKundaliniOrderSequence,
    });
    if (projection.cards.length === 0) return { status: 422, body: { ok: false, reason: "No approved contribution area currently has a record to send.", skippedCards: projection.skippedCards } };
    const sentAt = new Date().toISOString();
    const envelope: ContributionEnvelope = {
      schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
      contributionId: state.contributionId,
      sequenceIndex: state.nextSequenceIndex,
      intervalBand: intervalBand(state.lastAcceptedAt, new Date(sentAt)),
      sentAt,
      window: { window_sequence: state.nextWindowSequence, window_length_days: length },
      cards: projection.cards,
    };
    const validation = validateContributionEnvelope(envelope);
    if (!validation.ok) return { status: 409, body: { ok: false, status: "paused", reason: validation.reason } };
    const brokerage = await submitContribution(config.endpoint, config.credential, envelope, fetcher);
    if (!brokerage.ok) return { status: 502, body: { ok: false, reason: typeof brokerage.body.reason === "string" ? brokerage.body.reason : "The brokerage service rejected the contribution.", brokerageStatus: brokerage.status } };
    markContributionAccepted(state, sentAt, endDate, projection.snapshotFingerprints, projection.acceptedKundaliniOrderSequence, env);
    return { status: 201, body: { ok: true, accepted: true, contributionId: state.contributionId, sequenceIndex: state.nextSequenceIndex, windowLengthDays: length, cards: projection.cards.map((card) => card.card), skippedCards: projection.skippedCards, duplicate: brokerage.body.duplicate === true } };
  } catch (error) {
    console.error("Contribution send failed:", error instanceof Error ? error.message : String(error));
    return { status: 500, body: { ok: false, reason: "The contribution could not be prepared. Contribution is paused; local use is unchanged." } };
  } finally {
    sendInProgress = false;
  }
}
