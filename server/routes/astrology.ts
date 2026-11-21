// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { eq, and } from "drizzle-orm";
import { requireOwner } from "../ownerGate";
import {
  insertBirthChartSchema,
  insertCurrentSkySchema,
  insertCurrentTransitsSchema,
  insertGeneKeysSchema,
  insertHumanDesignSchema,
  personalSkyInsights,
  personalWeeklyReads,
  personalDesignThreads
} from "@shared/schema";
import {
  fetchBirthChart,
  prepareCurrentSkyData,
  transformCurrentSkyData,
  transformTransitsData,
  fetchCurrentSky,
  fetchCurrentTransits
} from "../astrologyTransformations";
import { ASTROLOGY_CALCULATION_VERSION, CURRENT_SKY_CALCULATION_VERSION } from "../lib/astrologyBoundaries";
import { withAstrologyDisplayDates } from "../lib/astrologyDisplayDates";
import { birthChartSetupSchema } from "../lib/birthChartSetup";
import { ZodError } from "zod";
import { generatePersonalWeeklyReadPrompt, generateDesignThreadPrompt, generatePersonalPlanetInsightPrompt, generateCurrentTransitsPrompt, generateNatalChartPrompt } from "../goePrompts";
import { getStorage, sendClaude, llmApiKey } from "./shared";
import { storage } from "../storage";
import { db } from "../db";
import { resolveUserDate, userDateFromTz, mondayOfLocalWeek, OWNER_FALLBACK_TZ } from "../lib/userDate";
import { OWNER_ID } from "../ownerGate";

// ─── GOEsky module-level caches (keyed by date, shared with scheduler) ───
export const weeklyReadCache        = new Map<string, string>();   // `userId_MondayDate` → read text
export const designThreadCache      = new Map<string, { humanDesign: string; geneKeys: string }>(); // `userId_MondayDate` → threads

export function registerAstrologyRoutes(app: Express) {
  const hasCalculationVersion = (value: unknown, version: string): boolean =>
    Array.isArray(value) && value.length > 0 &&
    value.every((entry: any) => entry?.calculationVersion === version);
  // Create the owner's permanent birth chart once from explicit setup details.
  app.post('/api/birth-chart', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;

      if (await storageInstance.getBirthChart(userId)) {
        return res.status(409).json({ error: 'Birth chart already exists' });
      }

      const input = birthChartSetupSchema.parse(req.body);
      const existingProfile = await storageInstance.getUserProfile(userId);
      const profileData = {
        userId,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthLocation: input.birthLocation,
      };

      if (existingProfile) {
        await storageInstance.updateUserProfile(userId, profileData);
      } else {
        await storageInstance.createUserProfile(profileData);
      }

      const rawChart = await fetchBirthChart(userId, input, storageInstance);
      const storedChart = await storageInstance.getBirthChart(userId);

      return res.status(201).json({
        success: true,
        hasChart: true,
        birthChart: storedChart?.transformedData,
        objectCount: rawChart.objects.length,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid birth details', issues: error.issues });
      }
      console.error('Error creating birth chart:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: 'Failed to create birth chart' });
    }
  });

  // Get Birth Chart endpoint (with Claude interpretations) — comprehensive version
  app.get('/api/birth-chart', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      console.log('Birth chart requested');

      // Check if we have birth chart data with Claude interpretations
      let existingChart = await storageInstance.getBirthChart(userId);

      if (existingChart && existingChart.anthropicResponse) {
        console.log('Birth chart with Claude interpretations found in database');
        return res.json({
          success: true,
          birthChart: existingChart.transformedData,
          interpretations: existingChart.anthropicResponse,
          fromCache: true
        });
      }

      // If we have chart data but no Claude interpretations, generate them
      if (existingChart && !existingChart.anthropicResponse) {
        console.log('Generating Claude interpretations for birth chart...');
        try {
          const anthropicKey = llmApiKey();
          if (!anthropicKey) throw new Error('LLM API key not configured');
          if (!existingChart.transformedData || typeof existingChart.transformedData !== 'object') {
            throw new Error('Invalid birth chart data structure');
          }
          const natalPromptConfig = generateNatalChartPrompt(existingChart.transformedData as any);
          const natalRaw = await sendClaude(natalPromptConfig, anthropicKey);
          const natalStart = natalRaw.indexOf('{'); const natalEnd = natalRaw.lastIndexOf('}') + 1;
          const interpretations = JSON.parse(natalRaw.substring(natalStart, natalEnd));

          await storageInstance.updateBirthChart(userId, { anthropicResponse: interpretations });

          console.log('Claude interpretations generated and stored');

          return res.json({
            success: true,
            birthChart: existingChart.transformedData,
            interpretations: interpretations,
            fromCache: false
          });
        } catch (claudeError) {
          console.error('Error generating Claude interpretations:', claudeError);
          return res.json({
            success: true,
            birthChart: existingChart.transformedData,
            interpretations: null,
            error: 'Failed to generate interpretations',
            fromCache: false
          });
        }
      }

      // Audit A (S1): no chart could be loaded or generated for this user — return an
      // explicit empty state. A new instance or an error path must see "no chart yet."
      // Shape matches what the client already treats as empty (falsy
      // birthChart -> AstrologyZone1 renders "Birth chart not available").
      console.log('No birth chart available for this user — returning empty chart state');
      res.json({
        success: true,
        birthChart: null,
        interpretations: null,
        fromCache: false,
        hasChart: false
      });
    } catch (error) {
      console.error('Error loading birth chart:', error);
      res.status(500).json({
        error: 'Failed to load birth chart',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Planets included in personal sky insights (matches GOEsky set + Chiron + Nodes)
  const PERSONAL_SKY_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node'];

  // Maps sky planet name to the corresponding natal chart field and extracts placement data
  const getNatalPlanetData = (natal: any, planetName: string): { sign: string; degree: string; house?: string } | null => {
    const fieldMap: Record<string, string> = {
      'Sun': 'sun', 'Moon': 'moon', 'Mercury': 'mercury', 'Venus': 'venus',
      'Mars': 'mars', 'Jupiter': 'jupiter', 'Saturn': 'saturn', 'Uranus': 'uranus',
      'Neptune': 'neptune', 'Pluto': 'pluto', 'Chiron': 'chiron',
      'North Node': 'northNode', 'South Node': 'southNode',
    };
    const field = fieldMap[planetName];
    if (!field || !natal[field]) return null;
    return { sign: natal[field].sign, degree: natal[field].degree, house: natal[field].house };
  };

  // Get Current Sky endpoint — positional data + per-planet personal insights from DB
  app.get('/api/current-sky', requireOwner, async (req: any, res) => {
    console.log('CURRENT SKY REQUEST STARTED');
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const today = await resolveUserDate(userId, storageInstance);
      const displayTimeZone = (await storageInstance.getUserProfile(userId))?.timezone || OWNER_FALLBACK_TZ;
      console.log('CURRENT SKY: Checking database for the owner-local date');

      // ── Step 1: Get sky positional data ──────────────────────────────────────
      let transformedCurrentSky: any[];
      const existingSky = await storageInstance.getCurrentSky(userId, today);
      if (existingSky?.transformedData && hasCalculationVersion(existingSky.transformedData, CURRENT_SKY_CALCULATION_VERSION)) {
        transformedCurrentSky = existingSky.transformedData as any[];
      } else if (existingSky?.rawSkyData) {
        console.log('CURRENT SKY: Recomputing stale boundary calculations from cached AstroApp data');
        const rawCurrentSky = await prepareCurrentSkyData(existingSky.rawSkyData as any);
        transformedCurrentSky = transformCurrentSkyData(
          rawCurrentSky,
          new Date(`${today}T12:00:00Z`),
        ) as any[];
        await storageInstance.upsertCurrentSky({
          userId,
          date: today,
          rawSkyData: rawCurrentSky,
          transformedData: transformedCurrentSky,
          anthropicResponse: existingSky.anthropicResponse,
          claudeInterpretations: existingSky.claudeInterpretations,
        });
      } else {
        // Staleness guard (2026-08-23): only TODAY's record is used; a missing today-key
        // fetches fresh from AstroApp. (Removed the "serve most-recent record" fallback
        // that returned months-old sky data whenever today's was missing.)
        console.log('CURRENT SKY: No record for today, fetching fresh sky data from API');
        const rawCurrentSky = await fetchCurrentSky(userId, today);
        transformedCurrentSky = transformCurrentSkyData(rawCurrentSky) as any[];
        await storageInstance.upsertCurrentSky({
          userId, date: today, rawSkyData: rawCurrentSky,
          transformedData: transformedCurrentSky, anthropicResponse: null
        });
      }

      transformedCurrentSky = withAstrologyDisplayDates(transformedCurrentSky, displayTimeZone);

      // ── Step 2: Check personal_sky_insights for today ────────────────────────
      const existingInsights = await db.select()
        .from(personalSkyInsights)
        .where(and(eq(personalSkyInsights.userId, userId), eq(personalSkyInsights.date, today)));

      const insightMap: Record<string, string> = Object.fromEntries(
        existingInsights.map((r: typeof personalSkyInsights.$inferSelect) => [r.planet, r.insight])
      );

      const missingPlanets = PERSONAL_SKY_PLANETS.filter(p => !insightMap[p]);

      // ── Step 3: All insights cached — return immediately ──────────────────────
      if (missingPlanets.length === 0) {
        console.log('CURRENT SKY: All planet insights cached, returning');
        return res.json({ success: true, currentSky: transformedCurrentSky, skyInsights: insightMap, date: today });
      }

      // ── Step 4: Need birth chart to generate missing insights ─────────────────
      const birthChart = await storageInstance.getBirthChart(userId);
      if (!birthChart?.transformedData) {
        console.log('CURRENT SKY: No birth chart found, returning positional data only');
        return res.json({ success: true, currentSky: transformedCurrentSky, date: today });
      }

      const anthropicKey = llmApiKey();
      if (!anthropicKey) {
        return res.json({ success: true, currentSky: transformedCurrentSky, skyInsights: insightMap, date: today });
      }

      // ── Step 5: Generate missing insights per-planet sequentially ─────────────
      console.log(`CURRENT SKY: Generating ${missingPlanets.length} missing planet insights`);
      const natal = birthChart.transformedData as any;
      const birthContext = { birthDate: natal.birthDate, birthTime: natal.birthTime, birthLocation: natal.birthLocation };

      for (const planetName of missingPlanets) {
        try {
          const skyPlanet = transformedCurrentSky.find((p: any) => p.planet === planetName);
          if (!skyPlanet) continue;
          const natalData = getNatalPlanetData(natal, planetName);
          const promptConfig = generatePersonalPlanetInsightPrompt(
            planetName, skyPlanet.sign, skyPlanet.degree, !!skyPlanet.retrograde, natalData, birthContext
          );
          const insightText = await sendClaude(promptConfig, anthropicKey);
          await db.insert(personalSkyInsights)
            .values({ userId, date: today, planet: planetName, sign: skyPlanet.sign, degree: skyPlanet.degree, retrograde: !!skyPlanet.retrograde, insight: insightText })
            .onConflictDoUpdate({
              target: [personalSkyInsights.userId, personalSkyInsights.date, personalSkyInsights.planet],
              set: { insight: insightText, sign: skyPlanet.sign, degree: skyPlanet.degree }
            });
          insightMap[planetName] = insightText;
          console.log(`CURRENT SKY: Generated insight for ${planetName}`);
        } catch (planetError) {
          console.error(`CURRENT SKY: Failed insight for ${planetName}:`, planetError instanceof Error ? planetError.message : planetError);
        }
      }

      console.log('CURRENT SKY: Sending response with sky insights');
      res.json({ success: true, currentSky: transformedCurrentSky, skyInsights: insightMap, date: today });
    } catch (error) {
      console.error("CURRENT SKY ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('AstroApp API error: 401') || errorMessage.includes('Restricted to valid users')) {
        res.status(502).json({ error: 'Upstream authentication failed after retry' });
      } else {
        res.status(500).json({ error: "Failed to load current sky data", details: errorMessage });
      }
    }
  });

  // Get current transits data
  app.get('/api/current-transits', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const today = await resolveUserDate(userId, storageInstance);
      const displayTimeZone = (await storageInstance.getUserProfile(userId))?.timezone || OWNER_FALLBACK_TZ;

      let existingTransits = await storageInstance.getCurrentTransits(userId, today);
      if (existingTransits?.rawTransitData && !hasCalculationVersion(existingTransits.transformedData, ASTROLOGY_CALCULATION_VERSION)) {
        console.log('CURRENT TRANSITS: Recomputing stale boundary calculations from cached AstroApp data');
        const recomputed = transformTransitsData(
          existingTransits.rawTransitData as any,
          new Date(`${today}T12:00:00Z`),
        );
        existingTransits = await storageInstance.upsertCurrentTransits({
          userId,
          date: today,
          rawTransitData: existingTransits.rawTransitData,
          transformedData: recomputed,
          anthropicResponse: existingTransits.anthropicResponse,
          claudeInterpretations: existingTransits.claudeInterpretations,
        });
      }
      if (existingTransits && existingTransits.transformedData && existingTransits.claudeInterpretations) {
        console.log('CURRENT TRANSITS: Found cached data with Claude interpretations, returning');
        return res.json({
          success: true,
          currentTransits: withAstrologyDisplayDates(existingTransits.transformedData as any[], displayTimeZone),
          claudeInterpretations: existingTransits.claudeInterpretations,
          date: today,
        });
      }

      // Staleness guard (2026-08-23): only TODAY's cached record is served. The old
      // "serve most-recent record" fallback would return a months-old record (e.g. May
      // in August) whenever today's was missing. Transits shift daily, so anything not
      // dated today is stale — fall through to a fresh AstroApp fetch below.

      let rawTransits;
      let transformedTransits;

      if (existingTransits && existingTransits.transformedData) {
        console.log('CURRENT TRANSITS: Using existing transit data, generating Claude interpretations');
        transformedTransits = existingTransits.transformedData;
      } else {
        console.log('CURRENT TRANSITS: No cached data, fetching fresh transit data');
        rawTransits = await fetchCurrentTransits(userId, today);
        transformedTransits = transformTransitsData(rawTransits, new Date(`${today}T12:00:00Z`));

        await storageInstance.upsertCurrentTransits({
          userId, date: today, rawTransitData: rawTransits,
          transformedData: transformedTransits, claudeInterpretations: null
        });
      }

      const birthChart = await storageInstance.getBirthChart(userId);
      if (!birthChart || !birthChart.transformedData) {
        console.log('CURRENT TRANSITS: No birth chart found, returning without Claude interpretations');
        return res.json({ success: true, currentTransits: withAstrologyDisplayDates((transformedTransits || []) as any[], displayTimeZone), date: today });
      }

      try {
        console.log('CURRENT TRANSITS: Generating Claude interpretations');
        if (!birthChart.transformedData || typeof birthChart.transformedData !== 'object') {
          throw new Error('Invalid birth chart data for transit insights');
        }
        const anthropicKey = llmApiKey();
        if (!anthropicKey) throw new Error('LLM API key not configured');
        const transitsPromptConfig = generateCurrentTransitsPrompt(birthChart.transformedData as any, (transformedTransits || []) as any[], today, displayTimeZone);
        const transitsRaw = await sendClaude(transitsPromptConfig, anthropicKey);
        const transitsStart = transitsRaw.indexOf('{'); const transitsEnd = transitsRaw.lastIndexOf('}') + 1;
        const claudeInterpretations = JSON.parse(transitsRaw.substring(transitsStart, transitsEnd));

        await storageInstance.upsertCurrentTransits({
          userId, date: today, rawTransitData: existingTransits?.rawTransitData || null,
          transformedData: transformedTransits,
          claudeInterpretations: claudeInterpretations
        });

        console.log('CURRENT TRANSITS: Sending response with Claude interpretations');
        res.json({
          success: true,
          currentTransits: withAstrologyDisplayDates((transformedTransits || []) as any[], displayTimeZone),
          claudeInterpretations: claudeInterpretations,
          date: today,
        });
      } catch (claudeError) {
        console.error('CURRENT TRANSITS: Claude generation failed:', claudeError);
        res.json({ success: true, currentTransits: withAstrologyDisplayDates((transformedTransits || []) as any[], displayTimeZone), date: today });
      }
    } catch (error) {
      console.error("Error loading current transits:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('AstroApp API error: 401') || errorMessage.includes('Restricted to valid users')) {
        res.status(502).json({ error: 'Upstream authentication failed after retry' });
      } else {
        res.status(500).json({ error: "Failed to load current transits data", details: errorMessage });
      }
    }
  });

  // Gene Keys routes
  app.get('/api/gene-keys', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const data = await storageInstance.getGeneKeys(userId);
      res.json(data || { message: "No Gene Keys data found" });
    } catch (error) {
      console.error("Error fetching Gene Keys data:", error);
      res.status(500).json({ message: "Failed to fetch Gene Keys data" });
    }
  });

  app.post('/api/gene-keys', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const geneKeysData = insertGeneKeysSchema.parse({ ...req.body, userId });

      const data = await storageInstance.createGeneKeys(geneKeysData);
      res.json(data);
    } catch (error) {
      console.error("Error creating Gene Keys data:", error);
      res.status(500).json({ message: "Failed to create Gene Keys data" });
    }
  });

  app.put('/api/gene-keys', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const geneKeysData = insertGeneKeysSchema.parse({ ...req.body, userId });

      const data = await storageInstance.updateGeneKeys(userId, geneKeysData);
      res.json(data);
    } catch (error) {
      console.error("Error updating Gene Keys data:", error);
      res.status(500).json({ message: "Failed to update Gene Keys data" });
    }
  });

  // Human Design routes
  app.get('/api/human-design', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const data = await storageInstance.getHumanDesign(userId);
      res.json(data || { message: "No Human Design data found" });
    } catch (error) {
      console.error("Error fetching Human Design data:", error);
      res.status(500).json({ message: "Failed to fetch Human Design data" });
    }
  });

  // Personal weekly read — 3-paragraph personal transit synthesis, cached per user per week
  app.get('/api/astrology/weekly-read', requireOwner, async (req: any, res) => {
    try {
      const anthropicKey = llmApiKey();
      if (!anthropicKey) {
        return res.status(500).json({ error: 'LLM API key not configured' });
      }

      const userId = req.user.claims.sub;
      const storageInstance = getStorage(req);

      // Cache key: Monday of current week per user
      const today = await resolveUserDate(userId, storageInstance);
      const weekKey = mondayOfLocalWeek(today);
      const cacheKey = `${userId}_${weekKey}`;

      const inMemory = weeklyReadCache.get(cacheKey);
      if (inMemory) {
        return res.json({ text: inMemory, weekLabel: `week of ${weekKey}` });
      }

      // Check DB — survives server restarts
      const [dbCached] = await db.select().from(personalWeeklyReads)
        .where(and(eq(personalWeeklyReads.userId, userId), eq(personalWeeklyReads.weekKey, weekKey)))
        .limit(1);
      if (dbCached) {
        weeklyReadCache.set(cacheKey, dbCached.text);
        return res.json({ text: dbCached.text, weekLabel: `week of ${weekKey}` });
      }

      const birthChart = await storageInstance.getBirthChart(userId);
      if (!birthChart || !birthChart.transformedData) {
        return res.status(404).json({ error: 'No birth chart found — add birth chart in Astrology card first' });
      }

      const transitsRecord = await storageInstance.getCurrentTransits(userId, today)
        || await storageInstance.getCurrentTransits(userId);

      if (!transitsRecord || !transitsRecord.transformedData) {
        return res.status(404).json({ error: 'No transit data found — refresh Astrology card first' });
      }

      const transits: any[] = Array.isArray(transitsRecord.transformedData)
        ? transitsRecord.transformedData : [];

      const outerPlanets = ['Uranus', 'Neptune', 'Pluto', 'Saturn', 'Jupiter'];
      const personalPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Ascendant', 'Midheaven'];

      const supportiveTransits = transits
        .filter(t => t.aspect && (t.aspect.toLowerCase().includes('trine') || t.aspect.toLowerCase().includes('sextile')))
        .slice(0, 4)
        .map(t => ({ description: t.transit }));

      const growthTransits = transits
        .filter(t => t.aspect && (t.aspect.toLowerCase().includes('square') || t.aspect.toLowerCase().includes('opposition')))
        .slice(0, 3)
        .map(t => ({ description: t.transit }));

      const leverageTransits = transits
        .filter(t => outerPlanets.includes(t.transitingPlanet) && personalPlanets.includes(t.natalPlanet))
        .slice(0, 3)
        .map(t => ({ description: t.transit }));

      const weekLabel = `week of ${weekKey}`;
      const prompt = generatePersonalWeeklyReadPrompt(
        weekLabel,
        birthChart.transformedData as any,
        supportiveTransits,
        growthTransits,
        leverageTransits
      );

      const readText = await sendClaude(prompt, anthropicKey);
      weeklyReadCache.set(cacheKey, readText);

      // Persist to DB so reads survive server restarts
      try {
        await db.insert(personalWeeklyReads)
          .values({ userId, weekKey, text: readText })
          .onConflictDoUpdate({
            target: [personalWeeklyReads.userId, personalWeeklyReads.weekKey],
            set: { text: readText },
          });
      } catch (dbErr) {
        console.warn('[weekly-read] DB persist failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr);
      }

      res.json({ text: readText, weekLabel });
    } catch (error) {
      console.error('Weekly read error:', error);
      res.status(500).json({ error: 'Failed to generate weekly read' });
    }
  });

  // Design thread — weekly Human Design + Gene Keys threads read against this week's sky,
  // cached per user per week (same Monday weekKey pattern as weekly-read)
  app.get('/api/astrology/design-thread', requireOwner, async (req: any, res) => {
    try {
      const anthropicKey = llmApiKey();
      if (!anthropicKey) {
        return res.status(500).json({ error: 'LLM API key not configured' });
      }

      const userId = req.user.claims.sub;
      const storageInstance = getStorage(req);

      // Cache key: Monday of current week per user
      const today = await resolveUserDate(userId, storageInstance);
      const weekKey = mondayOfLocalWeek(today);
      const cacheKey = `${userId}_${weekKey}`;
      const weekLabel = `week of ${weekKey}`;

      const inMemory = designThreadCache.get(cacheKey);
      if (inMemory) {
        return res.json({ ...inMemory, weekLabel });
      }

      // Check DB — survives server restarts
      const [dbCached] = await db.select().from(personalDesignThreads)
        .where(and(eq(personalDesignThreads.userId, userId), eq(personalDesignThreads.weekKey, weekKey)))
        .limit(1);
      if (dbCached) {
        const threads = { humanDesign: dbCached.humanDesign, geneKeys: dbCached.geneKeys };
        designThreadCache.set(cacheKey, threads);
        return res.json({ ...threads, weekLabel });
      }

      const geneKeysData = await storageInstance.getGeneKeys(userId);
      const humanDesignData = await storageInstance.getHumanDesign(userId);
      if (!geneKeysData && !humanDesignData) {
        return res.status(404).json({ error: 'No Human Design or Gene Keys data found — add your design data in the Astrology card first' });
      }

      const transitsRecord = await storageInstance.getCurrentTransits(userId, today)
        || await storageInstance.getCurrentTransits(userId);

      const transits: any[] = (transitsRecord && Array.isArray(transitsRecord.transformedData))
        ? transitsRecord.transformedData : [];

      const outerPlanets = ['Uranus', 'Neptune', 'Pluto', 'Saturn', 'Jupiter'];
      const personalPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Ascendant', 'Midheaven'];

      const supportiveTransits = transits
        .filter(t => t.aspect && (t.aspect.toLowerCase().includes('trine') || t.aspect.toLowerCase().includes('sextile')))
        .slice(0, 4)
        .map(t => ({ description: t.transit }));

      const growthTransits = transits
        .filter(t => t.aspect && (t.aspect.toLowerCase().includes('square') || t.aspect.toLowerCase().includes('opposition')))
        .slice(0, 3)
        .map(t => ({ description: t.transit }));

      const leverageTransits = transits
        .filter(t => outerPlanets.includes(t.transitingPlanet) && personalPlanets.includes(t.natalPlanet))
        .slice(0, 3)
        .map(t => ({ description: t.transit }));

      const prompt = generateDesignThreadPrompt(
        weekLabel,
        geneKeysData,
        humanDesignData,
        supportiveTransits,
        growthTransits,
        leverageTransits
      );

      const raw = await sendClaude(prompt as any, anthropicKey);

      // Parse JSON — tolerate stray markdown fences or surrounding prose
      let threads: { humanDesign: string; geneKeys: string };
      try {
        const jsonStr = (raw.match(/\{[\s\S]*\}/) || [raw])[0];
        const parsed = JSON.parse(jsonStr);
        threads = {
          humanDesign: typeof parsed.humanDesign === 'string' ? parsed.humanDesign.trim() : '',
          geneKeys: typeof parsed.geneKeys === 'string' ? parsed.geneKeys.trim() : '',
        };
      } catch (parseErr) {
        console.error('[design-thread] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
        return res.status(502).json({ error: 'Design thread generation returned an unexpected format' });
      }

      if (!threads.humanDesign && !threads.geneKeys) {
        return res.status(502).json({ error: 'Design thread generation returned empty content' });
      }

      designThreadCache.set(cacheKey, threads);

      // Persist to DB so threads survive server restarts
      try {
        await db.insert(personalDesignThreads)
          .values({ userId, weekKey, humanDesign: threads.humanDesign, geneKeys: threads.geneKeys })
          .onConflictDoUpdate({
            target: [personalDesignThreads.userId, personalDesignThreads.weekKey],
            set: { humanDesign: threads.humanDesign, geneKeys: threads.geneKeys },
          });
      } catch (dbErr) {
        console.warn('[design-thread] DB persist failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr);
      }

      res.json({ ...threads, weekLabel });
    } catch (error) {
      console.error('Design thread error:', error);
      res.status(500).json({ error: 'Failed to generate design thread' });
    }
  });

  app.post('/api/human-design', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const humanDesignData = insertHumanDesignSchema.parse({ ...req.body, userId });

      const data = await storageInstance.createHumanDesign(humanDesignData);
      res.json(data);
    } catch (error) {
      console.error("Error creating Human Design data:", error);
      res.status(500).json({ message: "Failed to create Human Design data" });
    }
  });

  app.put('/api/human-design', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const humanDesignData = insertHumanDesignSchema.parse({ ...req.body, userId });

      const data = await storageInstance.updateHumanDesign(userId, humanDesignData);
      res.json(data);
    } catch (error) {
      console.error("Error updating Human Design data:", error);
      res.status(500).json({ message: "Failed to update Human Design data" });
    }
  });
}
