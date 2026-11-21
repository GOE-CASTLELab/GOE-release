import cron from 'node-cron';
import { OWNER_ID } from './ownerGate';
import { DatabaseStorage } from './storage';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { personalSkyInsights } from '@shared/schema';
import { fetchCurrentSky, transformCurrentSkyData, fetchCurrentTransits, transformTransitsData } from './astrologyTransformations';
import { generatePersonalPlanetInsightPrompt, generateCurrentTransitsPrompt } from './goePrompts';
import { sendClaude, llmApiKey } from './routes/shared';
import { resolveUserDate } from './lib/userDate';
import { shouldRunAutomaticAstrologyRefresh } from './lib/astrologyRefreshGate';

const storage = new DatabaseStorage();

function requireOwnerId(): string {
  if (!OWNER_ID) {
    throw new Error(
      "OWNER_ID is not set. A single-owner GOE instance requires OWNER_ID in the environment."
    );
  }
  return OWNER_ID;
}

async function runRefresh() {
  const userId = requireOwnerId();
  // DATE STAMP only — NOT the trigger timing. The cron.schedule below stays anchored
  // to UTC on purpose so DST cannot double-fire or skip the AstroApp call.
  // This is the date KEY the fetched sky data is stamped with, so it matches the
  // date the owner's card will ask for (resolveUserDate) instead of drifting a UTC day
  // off near midnight and forcing a needless re-fetch.
  const today = await resolveUserDate(userId, storage);

  const birthChart = await storage.getBirthChart(userId);

  if (!birthChart || !birthChart.transformedData) {
    console.log('[SCHEDULER] No birth chart found, skipping refresh');
    return;
  }

  const rawCurrentSky = await fetchCurrentSky(userId, today);
  const transformedCurrentSky = transformCurrentSkyData(rawCurrentSky) as any[];
  const anthropicKey = llmApiKey() || '';

  await storage.upsertCurrentSky({
    userId,
    date: today,
    rawSkyData: rawCurrentSky,
    transformedData: transformedCurrentSky,
    anthropicResponse: null
  });

  console.log('[SCHEDULER] Current Sky positional data stored');

  // Generate per-planet personal insights into personal_sky_insights table
  const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node'];
  const natal = birthChart.transformedData as any;
  const birthContext = { birthDate: natal.birthDate, birthTime: natal.birthTime, birthLocation: natal.birthLocation };
  const fieldMap: Record<string, string> = {
    'Sun': 'sun', 'Moon': 'moon', 'Mercury': 'mercury', 'Venus': 'venus',
    'Mars': 'mars', 'Jupiter': 'jupiter', 'Saturn': 'saturn', 'Uranus': 'uranus',
    'Neptune': 'neptune', 'Pluto': 'pluto', 'Chiron': 'chiron',
    'North Node': 'northNode', 'South Node': 'southNode',
  };

  for (const planetName of PLANETS) {
    try {
      const skyPlanet = transformedCurrentSky.find((p: any) => p.planet === planetName);
      if (!skyPlanet) continue;
      const field = fieldMap[planetName];
      const natalData = (field && natal[field]) ? { sign: natal[field].sign, degree: natal[field].degree, house: natal[field].house } : null;
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
      console.log(`[SCHEDULER] Generated personal sky insight for ${planetName}`);
    } catch (planetError) {
      console.error(`[SCHEDULER] Failed insight for ${planetName}:`, planetError instanceof Error ? planetError.message : planetError);
    }
  }

  console.log('[SCHEDULER] Personal sky insights generated successfully');

  const rawTransits = await fetchCurrentTransits(userId, today);
  const transformedTransits = transformTransitsData(rawTransits);
  const transitsPromptConfig = generateCurrentTransitsPrompt(birthChart.transformedData as any, transformedTransits as any[]);
  const transitsRaw = await sendClaude(transitsPromptConfig, anthropicKey);
  const transitsStart = transitsRaw.indexOf('{'); const transitsEnd = transitsRaw.lastIndexOf('}') + 1;
  const transitInterpretations = JSON.parse(transitsRaw.substring(transitsStart, transitsEnd));

  await storage.upsertCurrentTransits({
    userId,
    date: today,
    rawTransitData: rawTransits,
    transformedData: transformedTransits,
    claudeInterpretations: transitInterpretations
  });

  console.log('[SCHEDULER] Current Transits data refreshed successfully');
  console.log('[SCHEDULER] Daily refresh completed');
}

async function refreshCurrentSkyAndTransits() {
  console.log('[SCHEDULER] Starting daily Current Sky/Transits refresh...');

  try {
    await runRefresh();
  } catch (firstError) {
    console.log('[SCHEDULER] First attempt failed, retrying in 2 seconds...', firstError instanceof Error ? firstError.message : firstError);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await runRefresh();
      console.log('[SCHEDULER] Retry succeeded');
    } catch (retryError) {
      console.error('[SCHEDULER] Retry also failed:', retryError);
    }
  }
}

async function checkAndRunRefreshIfNeeded() {
  const today  = new Date().toISOString().split('T')[0];
  try {
    const userId = requireOwnerId();
    // Check personal_sky_insights: if all 13 planets exist for today, data is fresh
    const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node'];
    const existingInsights = await db.select().from(personalSkyInsights).where(
      and(eq(personalSkyInsights.userId, userId), eq(personalSkyInsights.date, today))
    );
    const allPlanetsPresent = PLANETS.every((p: string) => existingInsights.some((r: typeof personalSkyInsights.$inferSelect) => r.planet === p));
    if (allPlanetsPresent) {
      console.log('[SCHEDULER] Today\'s sky data already in DB — skipping full refresh');

      return;
    }
    // Fallback: accept most recent personal sky insights if any exist and are < 24 hours old
    // Covers the UTC overnight window (midnight UTC to midnight EST)
    if (existingInsights.length > 0) {
      const mostRecent = existingInsights.reduce((a: typeof personalSkyInsights.$inferSelect, b: typeof personalSkyInsights.$inferSelect) =>
        (a.createdAt && b.createdAt && a.createdAt > b.createdAt) ? a : b
      );
      if (mostRecent.createdAt) {
        const ageMs = Date.now() - new Date(mostRecent.createdAt).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (ageMs < twentyFourHours) {
          console.log('[SCHEDULER] Recent sky insights found (< 24h old) — skipping startup refresh');
          return;
        }
      }
    }
    console.log('[SCHEDULER] No recent sky data in DB — running startup refresh now');
    await refreshCurrentSkyAndTransits();
  } catch (err) {
    console.error('[SCHEDULER] Startup refresh check failed:', err instanceof Error ? err.message : err);
  }
}

export function initScheduler() {
  if (process.env.ASTROAPP_REFRESH_ENABLED === 'false') {
    console.log('[SCHEDULER] Automatic AstroApp refresh explicitly disabled');
    return;
  }

  // AstroApp is a metered/billable API. Only the production deployment runs the
  // automatic refresh, so the development workspace never duplicates the daily
  // calls. Dev restarts frequently (every code edit, plus wake-from-sleep) and
  // each boot would otherwise re-fetch when its own DB is missing today's data.
  if (!shouldRunAutomaticAstrologyRefresh({
    NODE_ENV: process.env.NODE_ENV,
    ASTROAPP_REFRESH_ENABLED: process.env.ASTROAPP_REFRESH_ENABLED,
  })) {
    console.log('[SCHEDULER] Development environment — automatic AstroApp refresh disabled (production only)');
    return;
  }

  // S17: the TRIGGER runs on UTC on purpose. UTC has no DST, so this fires exactly
  // once every day and never double-fires/skips on the fall-back changeover — that
  // DST drift is what was breaking the AstroApp call. Do NOT set a local timezone here.
  // (What date the fetched data gets STAMPED with is the owner's local day — handled
  // separately in runRefresh via resolveUserDate, so the card still rolls at local midnight.)
  cron.schedule('0 0 * * *', refreshCurrentSkyAndTransits, {
    timezone: 'UTC'
  });

  console.log('[SCHEDULER] Daily Current Sky/Transits refresh scheduled for 00:00 UTC (DST-safe trigger)');

  // Run immediately on startup if today's data is missing — catches server restarts
  // Use a short delay so the rest of the server finishes initialising first
  setTimeout(checkAndRunRefreshIfNeeded, 5000);
}
