import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("pg");

const sourceUrl = new URL(process.env.DATABASE_URL || "postgresql:///postgres");
if (!["", "localhost", "127.0.0.1", "::1"].includes(sourceUrl.hostname)) throw new Error("The Return Pattern database test runs only against local PostgreSQL.");

const databaseName = `goe_return_pattern_test_${process.pid}_${Date.now()}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  process.env.DATABASE_URL = testUrl.toString();
  execFileSync("./node_modules/.bin/drizzle-kit", ["push", "--force"], { env: process.env, stdio: "pipe" });
  const [{ DatabaseStorage }, database] = await Promise.all([import("../server/storage"), import("../server/db")]);
  const storage = new DatabaseStorage();
  const ownerId = "goe:00000000-0000-4000-8000-000000000005";
  await database.pool.query("INSERT INTO users (id) VALUES ($1)", [ownerId]);
  await database.pool.query("INSERT INTO user_profiles (user_id, timezone) VALUES ($1, 'America/Edmonton')", [ownerId]);

  const first = await storage.createReturnPatternSession(ownerId, "2026-11-12", "afternoon");
  assert.equal(first.localDate, "2026-11-12");
  assert.equal(first.activeSeconds, 0);
  const updated = await storage.updateReturnPatternSession(ownerId, first.id, 60, false);
  assert.equal(updated?.activeSeconds, 60);
  const closed = await storage.updateReturnPatternSession(ownerId, first.id, 45, true);
  assert.equal(closed?.activeSeconds, 105);
  assert.ok(closed?.closedAt);

  const second = await storage.createReturnPatternSession(ownerId, "2026-11-13", "morning");
  const range = await storage.getReturnPatternSessionsByDateRange(ownerId, "2026-11-12", "2026-11-13");
  assert.deepEqual(range.map((row) => row.id), [first.id, second.id]);
  const previous = await storage.getReturnPatternSessionBefore(ownerId, second.openedAt);
  assert.equal(previous?.id, first.id);
  assert.equal(await storage.deleteReturnPatternSessions(ownerId), 2);
  assert.deepEqual(await storage.getReturnPatternSessionsByDateRange(ownerId, "2026-11-12", "2026-11-13"), []);
  await database.closeDatabaseConnection();
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
}

console.log("Return Pattern owner storage, active-time update, range read, prior-return read, and deletion: pass");
