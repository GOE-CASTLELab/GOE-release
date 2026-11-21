import "dotenv/config";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.OWNER_ID = "goe:00000000-0000-4000-8000-000000000006";
process.env.DATABASE_URL ||= "postgresql:///postgres";

const require = createRequire(import.meta.url);
const pg = require("pg");
const sourceUrl = new URL(process.env.DATABASE_URL);
if (!["", "localhost", "127.0.0.1", "::1"].includes(sourceUrl.hostname)) {
  throw new Error("The Return Pattern route test runs only against local PostgreSQL.");
}

const databaseName = `goe_return_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
let server: import("node:http").Server | undefined;

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  process.env.DATABASE_URL = testUrl.toString();
  const { execFileSync } = await import("node:child_process");
  execFileSync("./node_modules/.bin/drizzle-kit", ["push", "--force"], { env: process.env, stdio: "pipe" });

  const [{ default: express }, { registerReturnPatternRoutes }] = await Promise.all([
    import("express"),
    import("../server/routes/returnPattern"),
  ]);
  const app = express();
  app.use(express.json());
  registerReturnPatternRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const base = `http://127.0.0.1:${address.port}`;

  const database = await import("../server/db");
  await database.pool.query("INSERT INTO users (id) VALUES ($1)", [process.env.OWNER_ID]);
  await database.pool.query("INSERT INTO user_profiles (user_id, timezone) VALUES ($1, 'America/Edmonton')", [process.env.OWNER_ID]);
  const createdResponse = await fetch(`${base}/api/return-pattern/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as { id: string; openedAt: string };
  assert.ok(created.id);
  assert.ok(created.openedAt);
  const activityResponse = await fetch(`${base}/api/return-pattern/sessions/${created.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activeSecondsDelta: 60, close: true }) });
  assert.equal(activityResponse.status, 200);
  const readResponse = await fetch(`${base}/api/return-pattern/sessions?start=0001-01-01&end=9999-12-31`);
  assert.equal(readResponse.status, 200);
  const records = await readResponse.json() as Array<{ id: string; activeSeconds: number; closedAt: string | null }>;
  assert.equal(records.length, 1);
  assert.equal(records[0].id, created.id);
  assert.equal(records[0].activeSeconds, 60);
  assert.ok(records[0].closedAt);
  const invalidResponse = await fetch(`${base}/api/return-pattern/sessions/${created.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activeSecondsDelta: 91 }) });
  assert.equal(invalidResponse.status, 400);
  const deleteResponse = await fetch(`${base}/api/return-pattern/sessions`, { method: "DELETE" });
  assert.equal(deleteResponse.status, 200);
  await database.closeDatabaseConnection();
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
}

console.log("Return Pattern owner routes: pass");
