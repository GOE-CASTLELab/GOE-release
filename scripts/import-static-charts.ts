import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { geneKeys, humanDesign } from "../shared/schema";
import { chartImportSummary, parseStaticChartPackage } from "../shared/staticChartImport";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const userIndex = args.indexOf("--user-id");
const dryRun = args.includes("--dry-run");
const sourcePath = fileIndex >= 0 ? path.resolve(args[fileIndex + 1] ?? "") : "";
const userId = userIndex >= 0 ? args[userIndex + 1] ?? "" : process.env.OWNER_ID || process.env.OWNER_DID || "";

if (!sourcePath) {
  throw new Error("Usage: npm run import:static-charts -- --file /path/to/charts.json [--user-id <did>] [--dry-run]");
}

try {
  const parsed = parseStaticChartPackage(JSON.parse(await fs.readFile(sourcePath, "utf8")), userId);
  if (!dryRun) {
    await db.transaction(async (tx) => {
      if (parsed.geneKeys) {
        const rows = await tx.select({ id: geneKeys.id }).from(geneKeys).where(eq(geneKeys.userId, userId));
        if (rows.length > 1) throw new Error("Multiple Gene Keys rows exist for this user; import stopped.");
        if (rows[0]) await tx.update(geneKeys).set({ ...parsed.geneKeys, updatedAt: new Date() }).where(eq(geneKeys.id, rows[0].id));
        else await tx.insert(geneKeys).values(parsed.geneKeys);
      }
      if (parsed.humanDesign) {
        const rows = await tx.select({ id: humanDesign.id }).from(humanDesign).where(eq(humanDesign.userId, userId));
        if (rows.length > 1) throw new Error("Multiple Human Design rows exist for this user; import stopped.");
        if (rows[0]) await tx.update(humanDesign).set({ ...parsed.humanDesign, updatedAt: new Date() }).where(eq(humanDesign.id, rows[0].id));
        else await tx.insert(humanDesign).values(parsed.humanDesign);
      }
    });
  }
  console.log(JSON.stringify({ ...chartImportSummary(parsed), dryRun }, null, 2));
} finally {
  await pool.end();
}
