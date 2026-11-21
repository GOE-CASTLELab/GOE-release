// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { getStorage } from "./shared";

const TIME_BANDS = ["overnight", "morning", "afternoon", "evening"] as const;

function localParts(now: Date, timezone: string): { localDate: string; localTimeBand: typeof TIME_BANDS[number] } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(read("hour"));
  const localTimeBand = hour < 6 ? "overnight" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return { localDate: `${read("year")}-${read("month")}-${read("day")}`, localTimeBand };
}

export function registerReturnPatternRoutes(app: Express): void {
  app.post("/api/return-pattern/sessions", requireOwner, async (req: any, res) => {
    const storage = getStorage(req);
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    const timezone = profile?.timezone || "UTC";
    let local;
    try {
      local = localParts(new Date(), timezone);
    } catch {
      return res.status(409).json({ error: "The owner timezone is invalid. Return Pattern recording is paused." });
    }
    const session = await storage.createReturnPatternSession(userId, local.localDate, local.localTimeBand);
    return res.status(201).json({ id: session.id, openedAt: session.openedAt });
  });

  app.post("/api/return-pattern/sessions/:id", requireOwner, async (req: any, res) => {
    const activeSecondsDelta = Number(req.body?.activeSecondsDelta);
    const close = req.body?.close === true;
    if (!Number.isInteger(activeSecondsDelta) || activeSecondsDelta < 0 || activeSecondsDelta > 90) {
      return res.status(400).json({ error: "Active-time update is invalid." });
    }
    const session = await getStorage(req).updateReturnPatternSession(req.user.claims.sub, req.params.id, activeSecondsDelta, close);
    return session ? res.json({ ok: true }) : res.status(404).json({ error: "Return Pattern session was not found." });
  });

  app.get("/api/return-pattern/sessions", requireOwner, async (req: any, res) => {
    const start = typeof req.query.start === "string" ? req.query.start : "0001-01-01";
    const end = typeof req.query.end === "string" ? req.query.end : "9999-12-31";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return res.status(400).json({ error: "Return Pattern date range is invalid." });
    }
    const sessions = await getStorage(req).getReturnPatternSessionsByDateRange(req.user.claims.sub, start, end);
    return res.json(sessions);
  });

  app.delete("/api/return-pattern/sessions", requireOwner, async (req: any, res) => {
    const removed = await getStorage(req).deleteReturnPatternSessions(req.user.claims.sub);
    return res.json({ ok: true, removed });
  });
}
