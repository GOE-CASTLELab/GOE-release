// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IntervalBand } from "@shared/contributionContract";

export type LocalContributionState = {
  contributionId: string;
  nextSequenceIndex: number;
  nextWindowSequence: number;
  lastAcceptedAt: string | null;
  lastAcceptedWindowEnd: string | null;
  acceptedSnapshotFingerprints: Partial<Record<"astrology_energetic" | "kundalini_order", string>>;
  acceptedKundaliniOrderSequence: number;
};

function statePath(env: NodeJS.ProcessEnv = process.env): string {
  return env.CONTRIBUTION_STATE_PATH || path.join(os.homedir(), ".goe", "contribution-state.json");
}

function validState(value: unknown): value is LocalContributionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return typeof state.contributionId === "string" &&
    /^[0-9a-f-]{36}$/i.test(state.contributionId) &&
    Number.isInteger(state.nextSequenceIndex) && Number(state.nextSequenceIndex) >= 0 &&
    (state.nextWindowSequence === undefined || (Number.isInteger(state.nextWindowSequence) && Number(state.nextWindowSequence) >= 0)) &&
    (state.lastAcceptedAt === null || typeof state.lastAcceptedAt === "string") &&
    (state.lastAcceptedWindowEnd === undefined || state.lastAcceptedWindowEnd === null || /^\d{4}-\d{2}-\d{2}$/.test(String(state.lastAcceptedWindowEnd))) &&
    (state.acceptedSnapshotFingerprints === undefined || (typeof state.acceptedSnapshotFingerprints === "object" && state.acceptedSnapshotFingerprints !== null && !Array.isArray(state.acceptedSnapshotFingerprints))) &&
    (state.acceptedKundaliniOrderSequence === undefined || (Number.isInteger(state.acceptedKundaliniOrderSequence) && Number(state.acceptedKundaliniOrderSequence) >= 0));
}

export function loadContributionState(env: NodeJS.ProcessEnv = process.env): LocalContributionState {
  const filename = statePath(env);
  try {
    const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
    if (!validState(parsed)) throw new Error("invalid contribution state");
    return {
      ...parsed,
      nextWindowSequence: parsed.nextWindowSequence ?? 0,
      lastAcceptedWindowEnd: parsed.lastAcceptedWindowEnd ?? null,
      acceptedSnapshotFingerprints: parsed.acceptedSnapshotFingerprints ?? {},
      acceptedKundaliniOrderSequence: parsed.acceptedKundaliniOrderSequence ?? 0,
    };
  } catch (error) {
    const missing = error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
    if (!missing) throw error;
    const initial: LocalContributionState = {
      contributionId: crypto.randomUUID(),
      nextSequenceIndex: 0,
      nextWindowSequence: 0,
      lastAcceptedAt: null,
      lastAcceptedWindowEnd: null,
      acceptedSnapshotFingerprints: {},
      acceptedKundaliniOrderSequence: 0,
    };
    saveContributionState(initial, env);
    return initial;
  }
}

export function saveContributionState(state: LocalContributionState, env: NodeJS.ProcessEnv = process.env): void {
  const filename = statePath(env);
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filename);
  fs.chmodSync(filename, 0o600);
}

export function intervalBand(previous: string | null, current: Date): IntervalBand {
  if (!previous) return "first";
  const elapsedDays = Math.max(0, (current.getTime() - new Date(previous).getTime()) / 86_400_000);
  if (elapsedDays < 1) return "same_day";
  if (elapsedDays <= 3) return "1_3_days";
  if (elapsedDays <= 7) return "4_7_days";
  if (elapsedDays <= 30) return "8_30_days";
  return "31_plus_days";
}

export function markContributionAccepted(
  state: LocalContributionState,
  acceptedAt: string,
  acceptedWindowEnd: string,
  snapshotFingerprints: LocalContributionState["acceptedSnapshotFingerprints"],
  acceptedKundaliniOrderSequence: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): LocalContributionState {
  const next = {
    ...state,
    nextSequenceIndex: state.nextSequenceIndex + 1,
    nextWindowSequence: state.nextWindowSequence + 1,
    lastAcceptedAt: acceptedAt,
    lastAcceptedWindowEnd: acceptedWindowEnd,
    acceptedSnapshotFingerprints: { ...state.acceptedSnapshotFingerprints, ...snapshotFingerprints },
    acceptedKundaliniOrderSequence: acceptedKundaliniOrderSequence ?? state.acceptedKundaliniOrderSequence,
  };
  saveContributionState(next, env);
  return next;
}
