import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { generateDesignThreadPrompt } from "../server/goePrompts";
import { llmApiKey, sendClaude } from "../server/routes/shared";
import { currentTransits, geneKeys, humanDesign, personalDesignThreads } from "../shared/schema";
import { z } from "zod";

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const date = valueAfter("--date") ?? "";
const userId = valueAfter("--user-id") ?? process.env.OWNER_ID ?? process.env.OWNER_DID ?? "";
const dryRun = args.includes("--dry-run");

if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !userId) {
  throw new Error("Usage: npm run generate:design-thread -- --date YYYY-MM-DD [--user-id <did>] [--dry-run]");
}

const mondayOfWeek = (dateValue: string) => {
  const day = new Date(`${dateValue}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
};

try {
  const [[gk], [hd], [transitRecord]] = await Promise.all([
    db.select().from(geneKeys).where(eq(geneKeys.userId, userId)).limit(1),
    db.select().from(humanDesign).where(eq(humanDesign.userId, userId)).limit(1),
    db.select().from(currentTransits).where(and(eq(currentTransits.userId, userId), eq(currentTransits.date, date))).limit(1),
  ]);
  if (!gk || !hd) throw new Error("Both Gene Keys and Human Design must be stored before generating the design thread.");
  if (!transitRecord || !Array.isArray(transitRecord.transformedData)) {
    throw new Error(`No stored transit record found for ${date}; no provider fallback was attempted.`);
  }

  const transits: any[] = transitRecord.transformedData;
  const supportive = transits.filter((t) => /trine|sextile/i.test(String(t.aspect))).slice(0, 4).map((t) => ({ description: t.transit }));
  const growth = transits.filter((t) => /square|opposition/i.test(String(t.aspect))).slice(0, 3).map((t) => ({ description: t.transit }));
  const outer = new Set(["Uranus", "Neptune", "Pluto", "Saturn", "Jupiter"]);
  const personal = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Ascendant", "Midheaven"]);
  const leverage = transits.filter((t) => outer.has(t.transitingPlanet) && personal.has(t.natalPlanet)).slice(0, 3).map((t) => ({ description: t.transit }));
  const weekKey = mondayOfWeek(date);

  if (dryRun) {
    console.log(JSON.stringify({ valid: true, date, weekKey, supportive: supportive.length, growth: growth.length, leverage: leverage.length, providerCall: false }, null, 2));
    process.exit(0);
  }

  const key = llmApiKey();
  if (!key) throw new Error("The configured LLM provider key is missing.");
  const prompt = generateDesignThreadPrompt(`week of ${weekKey}`, gk, hd, supportive, growth, leverage);
  const raw = await sendClaude(prompt, key);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("The design-thread generator returned no JSON object.");
  const threads = z.object({
    humanDesign: z.string().trim().min(250).max(1000),
    geneKeys: z.string().trim().min(250).max(1000),
  }).strict().parse(JSON.parse(jsonMatch[0]));

  await db.insert(personalDesignThreads)
    .values({ userId, weekKey, humanDesign: threads.humanDesign, geneKeys: threads.geneKeys })
    .onConflictDoUpdate({
      target: [personalDesignThreads.userId, personalDesignThreads.weekKey],
      set: { humanDesign: threads.humanDesign, geneKeys: threads.geneKeys },
    });
  console.log(JSON.stringify({ date, weekKey, humanDesignCharacters: threads.humanDesign.length, geneKeysCharacters: threads.geneKeys.length }, null, 2));
} finally {
  await pool.end();
}
