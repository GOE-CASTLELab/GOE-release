// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { readContributionConfig } from "../contributionConfig";
import { loadContributionState } from "../contributionState";
import { sendContributionOnce } from "../contributionService";
import { getStorage } from "./shared";

export function nextContributionAt(lastAcceptedAt: string | null): string | null {
  if (!lastAcceptedAt) return null;
  return new Date(new Date(lastAcceptedAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

export function registerContributionRoutes(app: Express): void {
  app.get("/api/contribution/status", requireOwner, (_req: any, res) => {
    const config = readContributionConfig();
    if (!config.enabled) return res.json(config);
    try {
      const state = loadContributionState();
      return res.json({
        enabled: true,
        status: state.lastAcceptedAt ? "ready" : "awaiting_first_send",
        schedule: config.schedule,
        cards: config.cards.map((card) => card.card),
        nextSequenceIndex: state.nextSequenceIndex,
        lastAcceptedAt: state.lastAcceptedAt,
        nextContributionAt: config.schedule === "biweekly" ? nextContributionAt(state.lastAcceptedAt) : null,
      });
    } catch {
      return res.status(500).json({ enabled: false, status: "paused", reason: "The local contribution state cannot be read. Contribution is paused; local use is unchanged." });
    }
  });

  app.post("/api/contribution/send", requireOwner, async (req: any, res) => {
    const result = await sendContributionOnce(getStorage(req), req.user.claims.sub);
    return res.status(result.status).json(result.body);
  });
}
