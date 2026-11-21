// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import {
  CONTRIBUTION_CARDS,
  LOCAL_INSTRUMENT_MANIFESTS,
  fingerprintManifest,
  acceptedCardVersion,
  type ContributionCard,
} from "@shared/contributionContract";

export const SUPPORTED_CONSENT_VERSION = "0.5.0";
export const OFFICIAL_BROKERAGE_ENDPOINT = "https://mygoe.app/api/contributions";

export type ConfiguredCard = {
  card: ContributionCard;
  consentVersion: string;
  instrumentVersion: string;
  manifestFingerprint: string;
  mappingVersion: string;
};

export type ContributionConfig = {
  enabled: true;
  endpoint: string;
  credential: string;
  schedule: "manual" | "biweekly";
  cards: ConfiguredCard[];
};

export type ContributionConfigState =
  | { enabled: false; status: "not_configured"; reason: string }
  | { enabled: false; status: "paused"; reason: string; card?: ContributionCard }
  | ContributionConfig;

const envCardName: Record<ContributionCard, string> = {
  cyclical: "CYCLICAL",
  rest_restore: "REST_RESTORE",
  movement: "MOVEMENT",
  astrology_energetic: "ASTROLOGY_ENERGETIC",
  return_pattern: "RETURN_PATTERN",
};

function parseEndpoint(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readContributionConfig(env: NodeJS.ProcessEnv = process.env): ContributionConfigState {
  const rawCards = (env.CONTRIBUTION_CARDS || "")
    .split(",")
    .map((card) => card.trim())
    .filter(Boolean);
  if (rawCards.length === 0) {
    return { enabled: false, status: "not_configured", reason: "No card contribution grants are configured." };
  }
  const unique = new Set(rawCards);
  if (unique.size !== rawCards.length || rawCards.some((card) => !CONTRIBUTION_CARDS.includes(card as ContributionCard))) {
    return { enabled: false, status: "paused", reason: "The configured contribution card list is invalid." };
  }
  const endpoint = parseEndpoint(env.BROKERAGE_API_URL);
  if (!endpoint) {
    return { enabled: false, status: "not_configured", reason: "BROKERAGE_API_URL is missing or invalid." };
  }
  if (env.NODE_ENV === "production" && endpoint !== OFFICIAL_BROKERAGE_ENDPOINT) {
    return { enabled: false, status: "paused", reason: "Production contribution is pinned to the official mygoe.app brokerage endpoint." };
  }
  const schedule = env.CONTRIBUTION_SCHEDULE || "manual";
  if (schedule !== "manual" && schedule !== "biweekly") {
    return { enabled: false, status: "paused", reason: "The contribution schedule is invalid." };
  }
  const credential = env.CONTRIBUTION_CREDENTIAL;
  if (!credential || !/^goe_[A-Za-z0-9_-]{40,80}$/.test(credential)) {
    return { enabled: false, status: "not_configured", reason: "CONTRIBUTION_CREDENTIAL is missing or invalid." };
  }

  const cards: ConfiguredCard[] = [];
  for (const rawCard of rawCards) {
    const card = rawCard as ContributionCard;
    const prefix = `CONTRIBUTION_${envCardName[card]}`;
    const configured = {
      card,
      consentVersion: env[`${prefix}_CONSENT_VERSION`] || "",
      instrumentVersion: env[`${prefix}_INSTRUMENT_VERSION`] || "",
      manifestFingerprint: env[`${prefix}_MANIFEST_FINGERPRINT`] || "",
      mappingVersion: env[`${prefix}_MAPPING_VERSION`] || "",
    };
    const accepted = acceptedCardVersion(card);
    const local = LOCAL_INSTRUMENT_MANIFESTS[card];
    if (!accepted || local.mappingVersion === 'pending' || fingerprintManifest(local) !== accepted.manifestFingerprint) {
      return { enabled: false, status: 'paused', card,
        reason: `${card} instrument ${local.instrumentVersion} is awaiting an approved mapping. Contribution is paused; local use is unchanged.` };
    }
    if (configured.consentVersion !== SUPPORTED_CONSENT_VERSION) {
      return { enabled: false, status: "paused", card, reason: `${card} contribution-area consent version is not supported by this instance.` };
    }
    if (
      configured.instrumentVersion !== accepted.instrumentVersion ||
      configured.manifestFingerprint !== accepted.manifestFingerprint ||
      configured.mappingVersion !== accepted.mappingVersion
    ) {
      return {
        enabled: false,
        status: "paused",
        card,
        reason: `${card} instrument or mapping metadata does not match this instance. Contribution is paused; local use is unchanged.`,
      };
    }
    cards.push(configured);
  }
  return { enabled: true, endpoint, credential, schedule, cards };
}
