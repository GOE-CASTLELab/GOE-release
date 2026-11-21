import { moonPatternRevisionKey } from '@shared/moonPattern';
import { moonCentresEnabled } from '../moonCentres';
// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { insertSleepDataSchema, insertRestRisingSubmissionSchema } from "@shared/schema";
import { getStorage, sendClaude, llmApiKey } from "./shared";
import { resolveUserDate, userDateFromTz } from "../lib/userDate";
import { refreshTodayMovementSignal } from "./movement";
import { calculateCycleInfo, parseLocalDate } from "@shared/cycleCore";
import { classifyNervousSystemState } from "@shared/restRisingCore";
import { refreshAgentFeedWithoutBreakingSave } from "../lib/agentFeedRefresh";

export function registerRestRoutes(app: Express) {
  app.get('/api/sleep/phase-averages', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const [cycle, nights] = await Promise.all([
        storageInstance.getCycleData(userId),
        storageInstance.getSleepData(userId),
      ]);
      const periods = Array.isArray(cycle?.periodData) ? cycle.periodData : [];
      const normalizedNights = nights.flatMap((night: any) => {
        const total = Number(night.sleepMetrics?.totalSleepMinutes);
        if (!night.sleepDate || !Number.isFinite(total) || total <= 0) return [];
        return [{
          sleepDate: night.sleepDate,
          bedtime: night.bedtime || "",
          wakeTime: night.wakeTime || "",
          totalSleepMinutes: total,
          awakeMinutes: Number(night.sleepMetrics?.awakeMinutes) || 0,
          stageMinutes: night.sleepMetrics?.stageMinutes || {},
        }];
      });
      const { calculateMeasuredSleepPhaseAverages } = await import('../health/appleHealth');
      res.json(calculateMeasuredSleepPhaseAverages(periods, normalizedNights, cycle?.cycleLength || 28));
    } catch (error) {
      console.error("Error calculating measured sleep phase averages:", error);
      res.status(500).json({ message: "Failed to calculate measured sleep phase averages" });
    }
  });

  // Sleep data routes
  app.get('/api/sleep/data', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const date = req.query.date as string;

      const data = await storageInstance.getSleepData(userId, date);
      res.json(data);
    } catch (error) {
      console.error("Error fetching sleep data:", error);
      res.status(500).json({ message: "Failed to fetch sleep data" });
    }
  });

  app.post('/api/sleep/data', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const sleepInfo = insertSleepDataSchema.parse({ ...req.body, userId });

      const data = await storageInstance.createSleepData(sleepInfo);
      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));
      res.json(data);
    } catch (error) {
      console.error("Error creating sleep data:", error);
      res.status(500).json({ message: "Failed to create sleep data" });
    }
  });

  // Rest & Rising submission routes
  app.get('/api/rest-rising/submissions', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cyclePhase, startDate, endDate } = req.query;
      const storageInstance = getStorage(req);

      let submissions;
      if (startDate && endDate) {
        submissions = await storageInstance.getRestRisingSubmissionsByDateRange(userId, startDate, endDate);
      } else {
        submissions = await storageInstance.getRestRisingSubmissions(userId, cyclePhase);
      }

      const cycle = await storageInstance.getCycleData(userId).catch(() => null);
      const enriched = submissions.map((submission: any) => {
        if ((submission.cycleDay != null && submission.cyclePhase) || !cycle?.cycleStartDate) return submission;
        const date = parseLocalDate(submission.sleepDate);
        if (!date) return submission;
        const context = calculateCycleInfo(date, cycle.cycleStartDate, cycle.cycleLength || 28);
        return {
          ...submission,
          cycleDay: submission.cycleDay ?? context.day,
          cyclePhase: submission.cyclePhase || context.phase,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching rest-rising submissions:", error);
      res.status(500).json({ message: "Failed to fetch rest-rising submissions" });
    }
  });

  app.post('/api/rest-rising/submissions', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storageInstance = getStorage(req);
      const existing = req.body.sleepDate
        ? await storageInstance.getRestRisingSubmissionForSleepDate(userId, req.body.sleepDate)
        : null;
      const nervousSystemState = classifyNervousSystemState(
        req.body.energyAssessment ?? existing?.energyAssessment,
        req.body.sleepProcess ?? existing?.sleepProcess,
        req.body.wakingState ?? existing?.wakingState,
      );
      const submissionData = insertRestRisingSubmissionSchema.parse({
        ...req.body,
        userId,
        nervousSystemState,
      });
      const submission = await storageInstance.createRestRisingSubmission(submissionData);
      await refreshTodayMovementSignal(storageInstance, userId);
      const agentFeedRefreshed = await refreshAgentFeedWithoutBreakingSave();
      res.set('X-Agent-Feed-Refreshed', String(agentFeedRefreshed));
      res.json(submission);
    } catch (error) {
      console.error("Error creating rest-rising submission:", error);
      res.status(500).json({ message: "Failed to create rest-rising submission" });
    }
  });

  // GET endpoints for cached daily insights
  app.get('/api/rest-practice/today', requireOwner, async (req: any, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.removeHeader('ETag');

      const userId = (req.user as any)?.claims?.sub;
      const { tz, localDate, cyclePhase } = req.query;

      // Fallback default is the user's profile timezone, not UTC — an explicit
      // client-supplied localDate or tz still wins when present.
      const storageInstance = getStorage(req);
      const today = (localDate as string)
        || (tz ? userDateFromTz(tz as string) : await resolveUserDate(userId, storageInstance));

      const currentPattern = await storageInstance.getMoonPattern(userId);
      const revision = moonPatternRevisionKey(currentPattern, moonCentresEnabled());
      const cached = await storageInstance.getDailyInsight(userId, 'rest', today);

      if (cached && cached.aiWisdom) {
        if ((cached.input as any)?.moonPatternRevision !== revision) {
          return res.status(200).json({ success: true, fromCache: false });
        }
        const requestedPhase = (cyclePhase as string || '').toLowerCase();
        const storedPhase = (cached.cyclePhase || '').toLowerCase();
        if (requestedPhase && storedPhase && requestedPhase !== storedPhase) {
          return res.status(200).json({ success: true, fromCache: false });
        }
        return res.status(200).json({
          success: true,
          fromCache: true,
          wisdom: cached.aiWisdom,
          creativeState: cached.aiCreativeState,
          recommendations: cached.aiRecommendations,
          timestamp: cached.updatedAt
        });
      } else {
        res.status(200).json({ success: true, fromCache: false });
      }
    } catch (error) {
      console.error('Error fetching cached rest practice:', error);
      res.status(500).json({ error: 'Failed to fetch cached insight' });
    }
  });

  // Sacred Rest Practice Analysis — AI-powered wisdom generation with caching
  app.post('/api/analyze-rest-practice', requireOwner, async (req: any, res) => {
    try {
      const { eveningState, cycleData, sleepData, tz, localDate, force = false } = req.body;
      const userId = (req.user as any)?.claims?.sub;

      if (!eveningState?.trim()) {
        return res.status(400).json({ error: 'Evening state is required' });
      }

      const anthropicKey = llmApiKey();
      if (!anthropicKey) {
        return res.status(500).json({ error: 'LLM API key not configured' });
      }

      // Fallback default is the user's profile timezone, not UTC — an explicit
      // client-supplied localDate or tz still wins when present.
      const storageInstance = getStorage(req);
      const today = (localDate as string)
        || (tz ? userDateFromTz(tz as string) : await resolveUserDate(userId, storageInstance));

      const publishedCycle = await storageInstance.getCycleContext(userId);
      const revision = publishedCycle?.moonPatternRevision || moonPatternRevisionKey(null, false);
      if (!force) {
        const cached = await storageInstance.getDailyInsight(userId, 'rest', today);
        if (cached && cached.aiWisdom && (cached.input as any)?.moonPatternRevision === revision) {
          return res.json({
            success: true,
            fromCache: true,
            wisdom: cached.aiWisdom,
            creativeState: cached.aiCreativeState,
            moonPatternRevision: revision
          });
        }
      }

      // Practice/UI is a single-centre surface; chat keeps the provider blend.
      const finalCycleData = publishedCycle ? { ...publishedCycle, moonCenter: publishedCycle.moonCenterCurrent } : null;
      const finalSleepData = sleepData || (await getStorage(req).getSleepData ? await getStorage(req).getSleepData(userId) : null);

      const crypto = await import('crypto');
      const inputData = JSON.stringify({ eveningState, finalCycleData, finalSleepData });
      const inputHash = crypto.createHash('sha256').update(inputData).digest('hex');

      const { generateRestPracticePrompt } = await import('../goePrompts');
      const promptConfig = generateRestPracticePrompt(finalCycleData, eveningState);

      const fullResponse = await sendClaude(promptConfig, anthropicKey);

      // The reading prompt's rule is: mixed or unclear defaults to CL, never CE.
      // A missing or malformed tag is 'unclear', so fall back to CL — do not let an
      // absent selector silently choose the ease practice.
      const clMatch = fullResponse.match(/\[CL\]|\[CE\]/);
      let creativeState = clMatch ? clMatch[0].replace(/\[|\]/g, '').trim().toUpperCase() : 'CL';

      if (!['CL', 'CE'].includes(creativeState)) {
        console.warn(`Invalid creative state "${creativeState}" normalized to CL`);
        creativeState = 'CL';
      }

      const wisdom = fullResponse.replace(/\s*\[CL\]|\[CE\]\s*/g, '').replace(/\*\*/g, '').trim();

      try {
        await getStorage(req).upsertDailyInsight({
          userId,
          submissionType: 'rest',
          localDate: today,
          timezone: tz as string,
          input: { eveningState, cycleData: finalCycleData, sleepData: finalSleepData, moonPatternRevision: revision },
          inputHash,
          aiWisdom: wisdom,
          aiCreativeState: creativeState as 'CL' | 'CE',
          aiRecommendations: null,
          model: 'claude-3-sonnet',
          promptVersion: '1.0',
          tokens: 0,
          sleepDate: today,
          submissionDate: today,
          cyclePhase: (finalCycleData?.cyclePhase || '').toLowerCase() || null
        });
      } catch (cacheError) {
        console.warn('Failed to cache rest practice insight:', cacheError);
      }

      res.json({ success: true, wisdom, creativeState, fromCache: false, moonPatternRevision: revision });
    } catch (error) {
      console.error('Error analyzing rest practice:', error);
      res.status(500).json({ error: 'Failed to analyze rest practice' });
    }
  });

}
