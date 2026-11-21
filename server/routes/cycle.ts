import { z, ZodError } from 'zod';
import { connectMoonPatternSchema, MoonPatternConflict } from '@shared/moonPattern';
import { moonCentresEnabled } from '../moonCentres';
import { resolveUserDate } from '../lib/userDate';
import type { IStorage } from '../storage';
// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { insertCycleDataSchema } from "@shared/schema";
import { getStorage } from "./shared";
import { refreshAgentFeedWithoutBreakingSave } from "../lib/agentFeedRefresh";

export function registerCycleRoutes(app: Express, storageForRequest: (req: any) => IStorage = getStorage) {
  app.get('/api/cycle/moon-pattern', requireOwner, async (req: any, res) => {
    try {
      const storage = storageForRequest(req);
      const userId = req.user.claims.sub;
      const pattern = await storage.getMoonPattern(userId);
      res.set('Cache-Control', 'no-store');
      res.json({ pattern: pattern || null, effectiveEnabled: moonCentresEnabled() && !!pattern?.enabled,
        asOfDate: await resolveUserDate(userId, storage) });
    } catch { res.status(500).json({ message: 'Failed to fetch moon pattern' }); }
  });

  // Setup and a later optional workshop both connect through this boundary.
  // Workshop draft/observations never enter this active-pattern record.
  app.put('/api/cycle/moon-pattern', requireOwner, async (req: any, res) => {
    try {
      const input = connectMoonPatternSchema.parse(req.body);
      const storage = storageForRequest(req);
      const userId = req.user.claims.sub;
      const pattern = await storage.connectMoonPattern(userId, input);
      const refreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(refreshed));
      res.json({ pattern, effectiveEnabled: moonCentresEnabled() && pattern.enabled,
        asOfDate: await resolveUserDate(userId, storage) });
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ message: 'Invalid moon pattern', issues: error.issues });
      if (error instanceof MoonPatternConflict) return res.status(409).json({ message: error.message });
      res.status(500).json({ message: 'Failed to connect moon pattern' });
    }
  });
  // Cycle data routes
  app.get('/api/cycle/data', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = storageForRequest(req);
      const userId = req.user.claims.sub;
      const data = await storageInstance.getCycleData(userId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching cycle data:", error);
      res.status(500).json({ message: "Failed to fetch cycle data" });
    }
  });

  app.put('/api/cycle/data', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = storageForRequest(req);
      const userId = req.user.claims.sub;
      const cycleInfo = insertCycleDataSchema.parse({ ...req.body, userId });

      const data = await storageInstance.upsertCycleData(cycleInfo);
      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));
      res.json(data);
    } catch (error) {
      console.error("Error updating cycle data:", error);
      res.status(500).json({ message: "Failed to update cycle data" });
    }
  });

  const cycleActionSchema = z.object({
    action: z.enum(['period_started', 'period_ended', 'cycle_extended']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).strict();

  // All owner-entered cycle events use one write boundary so the current state
  // and the contributed event history cannot diverge.
  app.post('/api/cycle/action', requireOwner, async (req: any, res) => {
    try {
      const storage = storageForRequest(req);
      const userId = req.user.claims.sub;
      const input = cycleActionSchema.parse(req.body);
      const date = input.date || await resolveUserDate(userId, storage);
      const existing = await storage.getCycleData(userId);
      const periods = Array.isArray(existing?.periodData) ? structuredClone(existing.periodData as any[]) : [];
      if (!existing && input.action !== 'period_started') return res.status(409).json({ message: 'Record a period start first.' });

      let next: any;
      if (input.action === 'period_started') {
        periods.push({ startDate: date, endDate: null, extensions: [] });
        next = { ...(existing || {}), userId, cycleStartDate: date, cycleLength: existing?.cycleLength || 28, periodEndDate: null, periodData: periods };
      } else if (input.action === 'period_ended') {
        if (!periods.length) return res.status(409).json({ message: 'Record a period start first.' });
        periods[periods.length - 1] = { ...periods[periods.length - 1], endDate: date };
        next = { ...existing, userId, periodEndDate: date, periodData: periods };
      } else {
        if (!periods.length) return res.status(409).json({ message: 'Record a period start first.' });
        const previousCycleLength = existing!.cycleLength || 28;
        const resultingCycleLength = previousCycleLength + 1;
        const current = periods[periods.length - 1];
        periods[periods.length - 1] = { ...current, extensions: [...(Array.isArray(current.extensions) ? current.extensions : []), { date, previousCycleLength, resultingCycleLength }] };
        next = { ...existing, userId, cycleLength: resultingCycleLength, periodData: periods };
      }
      const saved = await storage.upsertCycleData(insertCycleDataSchema.parse(next));
      const refreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(refreshed));
      return res.json(saved);
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ message: 'Invalid cycle action', issues: error.issues });
      console.error('Error recording cycle action:', error);
      return res.status(500).json({ message: 'Failed to record cycle action' });
    }
  });
}
