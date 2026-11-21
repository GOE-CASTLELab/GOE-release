import "dotenv/config";
import path from "node:path";
import { pool } from "../server/db";
import { getObjectStore } from "../server/storage/index";
import { importAppleHealth, PostgresAppleHealthRepository } from "../server/health/appleHealthImport";

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const userId = process.env.OWNER_ID || process.env.OWNER_DID || "";
if (!sourcePath) throw new Error("Usage: npm run import:apple-health -- /path/to/export.zip");
if (!userId) throw new Error("OWNER_ID must be set before importing Apple Health data.");

try {
  const result = await importAppleHealth({
    userId,
    sourcePath,
    objectStore: await getObjectStore(),
    repository: new PostgresAppleHealthRepository(pool),
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
