// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import type { ContributionCard } from '../../shared/contributionContract';

// The inward current-read projection uses the same stable card-record pattern as
// Stage 2's outward contribution projection. The values differ by design: this
// snapshot keeps exact dates and provenance for the owner's own agent.
export const AGENT_CONTEXT_SCHEMA_VERSION = '0.1.0' as const;

export type AgentContextFieldValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | Record<string, unknown>[];

export type AgentContextFieldProvenance = {
  source: string;
  localDate?: string;
  observedAt?: string;
  derivationVersion?: string;
};

export type AgentContextCardRecord = {
  card: ContributionCard;
  values: Record<string, AgentContextFieldValue>;
  provenance: Record<string, AgentContextFieldProvenance>;
  missing: Record<string, string>;
};

export type AgentContextSnapshot = {
  schemaVersion: typeof AGENT_CONTEXT_SCHEMA_VERSION;
  generatedAt: string;
  localDate: string;
  cards: AgentContextCardRecord[];
};

export function contextCard(
  card: ContributionCard,
  values: Record<string, AgentContextFieldValue> = {},
  provenance: Record<string, AgentContextFieldProvenance> = {},
  missing: Record<string, string> = {},
): AgentContextCardRecord {
  return { card, values, provenance, missing };
}

export function getContextCard(snapshot: AgentContextSnapshot, card: ContributionCard): AgentContextCardRecord {
  const record = snapshot.cards.find(entry => entry.card === card);
  if (!record) throw new Error(`Agent context snapshot is missing the ${card} card record.`);
  return record;
}

export function assertAgentContextSnapshot(value: unknown): asserts value is AgentContextSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Agent context snapshot must be an object.');
  const snapshot = value as Partial<AgentContextSnapshot>;
  if (snapshot.schemaVersion !== AGENT_CONTEXT_SCHEMA_VERSION) {
    throw new Error(`Unsupported agent context schema version: ${String(snapshot.schemaVersion)}`);
  }
  if (!snapshot.generatedAt || !snapshot.localDate || !Array.isArray(snapshot.cards)) {
    throw new Error('Agent context snapshot is missing generatedAt, localDate, or cards.');
  }
  const cards = new Set(snapshot.cards.map(record => record?.card));
  for (const required of ['cyclical', 'rest_restore', 'movement', 'astrology_energetic'] as const) {
    if (!cards.has(required)) throw new Error(`Agent context snapshot is missing ${required}.`);
  }
}
