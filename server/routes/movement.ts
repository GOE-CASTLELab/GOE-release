// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { getStorage as defaultGetStorage } from "./shared";
import { cyclePhaseForDay, DEFAULT_CYCLE_LENGTH } from "@shared/cycleCore";
import { resolveUserDate, userDateFromTz, OWNER_FALLBACK_TZ } from "../lib/userDate";
import { movementReadiness, type MovementSignalSnapshot } from "@shared/movementSignal";
import { refreshTodayMovementSignal } from '../lib/movementRead';
import { refreshAgentFeedWithoutBreakingSave } from "../lib/agentFeedRefresh";

export { refreshTodayMovementSignal } from '../lib/movementRead';

function validLogDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// ─── Cycle phase / day helper ──────────────────────────────────────────────────
// PER-DATE calendar helper. Unlike the TODAY path (which reads the cycle card's
// published phase via storage.getCycleContext), the movement calendar needs a
// phase for arbitrary past/future dates, for which there is no published value.
// It therefore COMPUTES per date — but using the single owner's formula
// (cyclePhaseForDay from @shared/cycleCore), NOT a private copy. Output is
// movement's lowercase contract.
function getCycleContext(cycleData: any, forDate?: string): { cycleDay: number | null; cyclePhase: string | null } {
  if (!cycleData?.cycleStartDate) return { cycleDay: null, cyclePhase: null };

  // No req/userId in scope here (pure calendar helper) — every real call site passes
  // forDate explicitly (see line ~370), so this fallback is a safety net, not the hot
  // path. Switched from hardcoded America/New_York to the owner fallback tz so it never
  // silently drifts to a different user's midnight than resolveUserDate would give.
  const targetStr = forDate ?? userDateFromTz(OWNER_FALLBACK_TZ);
  const target = new Date(targetStr + 'T00:00:00');
  const start  = new Date(cycleData.cycleStartDate + 'T00:00:00');

  const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cycleLength = cycleData.cycleLength || DEFAULT_CYCLE_LENGTH;
  const cycleDay = (daysSinceStart % cycleLength) + 1;

  // Phase from the single owner (@shared/cycleCore). Movement's contract is
  // LOWERCASE phase names, so lowercase the canonical Title-Case value at this
  // boundary (Ovulatory -> 'ovulatory', Menstruation -> 'menstruation').
  const cyclePhase = cyclePhaseForDay(cycleDay, cycleLength).toLowerCase();

  return { cycleDay, cyclePhase };
}

// ─── Recovery quality from Rest submission ─────────────────────────────────────
// ─── Routes ────────────────────────────────────────────────────────────────────
export function registerMovementRoutes(app: Express, getStorage = defaultGetStorage) {

  // GET /api/movement/today — restore Zone 1 state on page load
  // Refreshes today's split snapshot using the merged prior sleep period.
  app.get('/api/movement/today', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const log = await refreshTodayMovementSignal(storageInstance, userId);
      if (!log) return res.json(null);
      const latestWorkout = await storageInstance.getLatestMovementWorkout(userId);
      res.json({ ...log, latestWorkout });
    } catch (error) {
      console.error("Error fetching today's movement log:", error);
      res.status(500).json({ message: "Failed to fetch today's log" });
    }
  });

  // POST /api/movement/hrv — persist the sensor reading immediately.
  // Readiness remains a separate input and attaches to this same daily anchor row.
  app.post('/api/movement/hrv', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { rmssd, sdnn, hrvSource, hrvQuality, hrvIntervals, hrvCapturedAt, date } = req.body;
      if (typeof rmssd !== 'number' || !Number.isFinite(rmssd) || rmssd <= 0) {
        return res.status(400).json({ message: 'A valid RMSSD reading is required' });
      }
      if (typeof hrvSource !== 'string' || !hrvSource) {
        return res.status(400).json({ message: 'An HRV source is required' });
      }
      if (date == null) return res.status(400).json({ message: 'date is required for an HRV reading' });
      const logDate = date;
      if (!validLogDate(logDate)) return res.status(400).json({ message: 'date must be a valid YYYY-MM-DD' });
      let log = await storageInstance.upsertMovementHrv({
        userId,
        date: logDate,
        rmssd,
        sdnn: typeof sdnn === 'number' ? sdnn : undefined,
        hrvSource,
        hrvQuality: typeof hrvQuality === 'number' ? hrvQuality : undefined,
        hrvIntervals: Array.isArray(hrvIntervals) ? hrvIntervals : undefined,
        hrvCapturedAt: hrvCapturedAt ? new Date(hrvCapturedAt) : undefined,
      });

      // HRV-only records receive Your Rhythm before readiness is logged.
      log = (await refreshTodayMovementSignal(storageInstance, userId, logDate))!;
      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));
      res.json(log);
    } catch (error) {
      console.error('Error saving HRV reading:', error);
      res.status(500).json({ message: 'Failed to save HRV reading' });
    }
  });

  // POST /api/movement/morning — log morning read + calculate readiness signal
  app.post('/api/movement/morning', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { rmssd, sdnn, readinessScore, date, hrvSource, hrvQuality, hrvIntervals, hrvCapturedAt } = req.body;
      if (date == null) return res.status(400).json({ message: 'date is required for a readiness reading' });
      const logDate = date;

      if (!validLogDate(logDate)) return res.status(400).json({ message: 'date must be a valid YYYY-MM-DD' });
      if (!Number.isInteger(readinessScore) || readinessScore < 1 || readinessScore > 10) {
        return res.status(400).json({ message: 'readinessScore must be 1–10' });
      }

      if (rmssd != null && (typeof rmssd !== 'number' || !Number.isFinite(rmssd) || rmssd <= 0)) {
        return res.status(400).json({ message: 'A valid RMSSD reading is required' });
      }

      // SWITCHBOARD READ (Option B): for TODAY, movement is a CONSUMER of the
      // cycle card's published phase — read it from getCycleContext (the publish
      // point) rather than recomputing. Movement's stored contract is lowercase,
      // so lowercase the canonical Title-Case published value. Absent cycle data
      // -> nulls, handled downstream.
      const today = await resolveUserDate(userId, storageInstance);
      const published = logDate === today ? await storageInstance.getCycleContext(userId) : null;
      const cycleDay = published?.cycleDay ?? null;
      const cyclePhase = published?.cyclePhase ? String(published.cyclePhase).toLowerCase() : null;

      // Persist morning log
      await storageInstance.upsertMovementMorning({
        userId,
        date: logDate,
        rmssd: rmssd ?? undefined,
        sdnn: typeof sdnn === 'number' ? sdnn : undefined,
        hrvSource: hrvSource ?? undefined,
        hrvQuality: typeof hrvQuality === 'number' ? hrvQuality : undefined,
        hrvIntervals: Array.isArray(hrvIntervals) ? hrvIntervals : undefined,
        hrvCapturedAt: hrvCapturedAt ? new Date(hrvCapturedAt) : undefined,
        readinessScore,
        cycleDay: cycleDay ?? undefined,
        cyclePhase: cyclePhase ?? undefined,
      });

      const log = (await refreshTodayMovementSignal(storageInstance, userId, logDate))!;

      const latestWorkout = await storageInstance.getLatestMovementWorkout(userId);
      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));

      res.json({
        log,
        rhythmColour: log.rhythmColour,
        movementColour: log.movementColour,
        movementInstrumentVersion: log.movementInstrumentVersion,
        signalContext: log.signalContext,
        latestWorkout,
        context: log.signalContext,
      });
    } catch (error) {
      console.error("Error logging movement morning read:", error);
      res.status(500).json({ message: "Failed to log morning read" });
    }
  });

  // POST /api/movement/workout — log a completed workout session
  app.post('/api/movement/workout', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { practiceName, durationMinutes, notes, date, practiceSignal } = req.body;
      const logDate = date || await resolveUserDate(userId, storageInstance);

      if (!practiceName) {
        return res.status(400).json({ message: 'practiceName is required' });
      }
      if (!durationMinutes || durationMinutes < 1) {
        return res.status(400).json({ message: 'durationMinutes must be > 0' });
      }

      const log = await storageInstance.upsertMovementWorkout(userId, logDate, {
        practiceName,
        durationMinutes,
        notes: notes ?? undefined,
        practiceSignal: practiceSignal ?? null,
      });

      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));
      res.json(log);
    } catch (error) {
      console.error("Error logging movement workout:", error);
      res.status(500).json({ message: "Failed to log workout" });
    }
  });

  // GET /api/movement/logs — last 14 days (for display / history)
  app.get('/api/movement/logs', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const daysBack = parseInt(req.query.days as string) || 14;
      const logs = await storageInstance.getMovementLogs(userId, daysBack);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching movement logs:", error);
      res.status(500).json({ message: "Failed to fetch movement logs" });
    }
  });

  // GET /api/movement/calendar?year=2026&month=4 — calendar month view
  app.get('/api/movement/calendar', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
      const logs = await storageInstance.getMovementCalendar(userId, year, month);

      // Group multiple rows per date into one day object
      const cycleData = await storageInstance.getCycleData(userId);
      const todayLocal = await resolveUserDate(userId, storageInstance);
      const dayMap: Record<string, {
        date: string;
        hasMovementRecord: boolean;
        rhythmColour: string | null;
        movementColour: string | null;
        movementInstrumentVersion: string | null;
        signalContext: MovementSignalSnapshot | null;
        cycleDay: number | null;
        cyclePhase: string | null;
        rmssd: number | null;
        sdnn: number | null;
        readinessScore: number | null;
        readinessLabel: string | null;
        notes: string | null;
        sessions: Array<{ id: string; practiceName: string | null; practiceSignal: string | null; durationMinutes: number | null; notes: string | null }>;
      }> = {};

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const todayMonthKey = todayLocal.slice(0, 7);
      const daysInMonth = new Date(year, month, 0).getDate();
      const lastOpenDay = monthKey < todayMonthKey
        ? daysInMonth
        : monthKey === todayMonthKey
          ? Math.min(daysInMonth, Number(todayLocal.slice(8, 10)))
          : 0;

      // Past and present calendar dates remain inspectable even when no Movement
      // record exists. Future dates stay inactive.
      for (let day = 1; day <= lastOpenDay; day++) {
        const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
        const cycleCtx = getCycleContext(cycleData, dateKey);
        dayMap[dateKey] = {
          date: dateKey,
          hasMovementRecord: false,
          rhythmColour: null, movementColour: null, movementInstrumentVersion: null, signalContext: null,
          cycleDay: cycleCtx.cycleDay ?? null,
          cyclePhase: cycleCtx.cyclePhase ?? null,
          rmssd: null,
          sdnn: null,
          readinessScore: null,
          readinessLabel: null,
          notes: null,
          sessions: [],
        };
      }

      for (const log of logs) {
        const dateKey = log.date as string;
        if (!dayMap[dateKey]) {
          const stored = log.cycleDay != null && log.cyclePhase != null;
          const cycleCtx = stored
            ? { cycleDay: log.cycleDay, cyclePhase: log.cyclePhase }
            : getCycleContext(cycleData, dateKey);
          dayMap[dateKey] = {
            date: dateKey,
            hasMovementRecord: true,
            rhythmColour: null, movementColour: null, movementInstrumentVersion: null, signalContext: null,
            cycleDay: cycleCtx.cycleDay ?? null,
            cyclePhase: cycleCtx.cyclePhase ?? null,
            rmssd: null,
            sdnn: null,
            readinessScore: null,
            readinessLabel: null,
            notes: null,
            sessions: [],
          };
        }
        dayMap[dateKey].hasMovementRecord = true;

        // Archives return the saved snapshot; current profile/Rest edits cannot repaint a past day.
        if (log.readinessScore != null || log.rmssd != null) {
          dayMap[dateKey].rhythmColour = log.rhythmColour ?? null;
          dayMap[dateKey].movementColour = log.movementColour ?? null;
          dayMap[dateKey].movementInstrumentVersion = log.movementInstrumentVersion ?? null;
          dayMap[dateKey].signalContext = log.signalContext ?? null;
          if (log.signalContext || log.cyclePhase != null) {
            dayMap[dateKey].cycleDay = log.cycleDay;
            dayMap[dateKey].cyclePhase = log.cyclePhase;
          }
          dayMap[dateKey].rmssd = log.rmssd ?? null;
          dayMap[dateKey].sdnn = log.sdnn ?? null;
          dayMap[dateKey].readinessScore = log.readinessScore ?? null;
          dayMap[dateKey].readinessLabel = log.signalContext
            ? log.signalContext.movement.readinessWord : movementReadiness(log.readinessScore)?.word ?? null;
          dayMap[dateKey].notes = log.notes ?? null;
        }
        if (log.rmssd == null && log.readinessScore == null && !log.practiceName && log.notes != null) {
          dayMap[dateKey].notes = log.notes;
        }
        // Any row with a practice name is a session
        if (log.practiceName) {
          dayMap[dateKey].sessions.push({
            id: log.id,
            practiceName: log.practiceName,
            practiceSignal: log.practiceSignal ?? null,
            durationMinutes: log.durationMinutes ?? null,
            notes: log.notes ?? null,
          });
        }
      }

      res.json(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error("Error fetching movement calendar:", error);
      res.status(500).json({ message: "Failed to fetch movement calendar" });
    }
  });

  // PATCH /api/movement/log/:date — update notes on an existing log
  app.patch('/api/movement/log/:date', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { date } = req.params;
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        return res.status(400).json({ message: "notes must be a string" });
      }
      const updated = await storageInstance.updateMovementNotes(userId, date, notes);
      if (!updated) return res.status(404).json({ message: "No log found for that date" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating movement notes:", error);
      res.status(500).json({ message: "Failed to update notes" });
    }
  });

  // PATCH /api/movement/session/:id/notes — update notes on a specific session row
  app.patch('/api/movement/session/:id/notes', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        return res.status(400).json({ message: "notes must be a string" });
      }
      const updated = await storageInstance.updateMovementSessionNotes(userId, id, notes);
      if (!updated) return res.status(404).json({ message: "Session not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating session notes:", error);
      res.status(500).json({ message: "Failed to update session notes" });
    }
  });

}
