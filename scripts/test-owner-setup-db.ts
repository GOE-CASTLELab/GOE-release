import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { parse } from "dotenv";
import { applyGoeSetup } from "./apply-goe-setup";

const require = createRequire(import.meta.url);
const pg = require("pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the isolated owner-setup database test.");
const sourceUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "::1"].includes(sourceUrl.hostname)) {
  throw new Error("The isolated owner-setup database test runs only against a local PostgreSQL server.");
}

const databaseName = `goe_setup_test_${process.pid}_${Date.now()}`;
if (!/^goe_setup_test_[0-9_]+$/.test(databaseName)) throw new Error("Unsafe test database name.");
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;

const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
const root = fs.mkdtempSync(path.join(os.tmpdir(), "goe-owner-db-test-"));
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const testDb = new pg.Pool({ connectionString: testUrl.toString(), max: 1 });
  try {
    await testDb.query(`
      CREATE TABLE users (
        id varchar PRIMARY KEY,
        email varchar UNIQUE,
        first_name varchar,
        last_name varchar,
        profile_image_url varchar,
        life_stage varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE cycle_data (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        value integer NOT NULL
      );
      CREATE TABLE movement_logs (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        value integer NOT NULL
      );
    `);

    const envPath = path.join(root, ".env");
    const setupPath = path.join(root, "goe-setup.env");
    const firstOwner = "goe:12d7fc32-e74e-4e27-b798-44c98eec44b1";
    const secondOwner = "goe:bd25842a-d7db-4381-a8bf-927e99a8a3be";
    fs.writeFileSync(envPath, `DATABASE_URL=${testUrl.toString()}\nOWNER_ID=\n`, { mode: 0o600 });
    execFileSync(path.resolve("node_modules/.bin/tsx"), ["scripts/setup-local-owner.ts", envPath]);
    const generatedOwner = parse(fs.readFileSync(envPath, "utf8")).OWNER_ID;
    assert.match(generatedOwner, /^goe:[0-9a-f-]{36}$/);
    assert.deepEqual((await testDb.query("SELECT id FROM users")).rows, [{ id: generatedOwner }]);
    fs.writeFileSync(setupPath, `# Your GOE instance\nOWNER_ID=${firstOwner}\n`, { mode: 0o600 });
    fs.writeFileSync(envPath, `DATABASE_URL=${testUrl.toString()}\nOWNER_ID=\n`, { mode: 0o600 });
    await testDb.query("DELETE FROM users WHERE id = $1", [generatedOwner]);

    const fresh = await applyGoeSetup(setupPath, envPath, new Date("2026-10-13T22:00:00Z"));
    assert.equal(fresh.owner.action, "created");
    await testDb.query(
      "UPDATE users SET email = 'owner@example.com', first_name = 'Owner' WHERE id = $1",
      [firstOwner],
    );
    await testDb.query("INSERT INTO cycle_data (user_id, value) VALUES ($1, 1), ($1, 2)", [firstOwner]);
    await testDb.query("INSERT INTO movement_logs (user_id, value) VALUES ($1, 3)", [firstOwner]);

    fs.writeFileSync(setupPath, `# Your GOE instance\nOWNER_ID=${secondOwner}\n`, { mode: 0o600 });
    await assert.rejects(() => applyGoeSetup(setupPath, envPath), /cannot replace/);
    const migrated = await applyGoeSetup(setupPath, envPath, new Date("2026-10-13T22:01:00Z"), undefined, true);
    assert.equal(migrated.owner.action, "migrated");
    assert.equal(migrated.owner.migratedRecords, 3);
    const ownerRows = await testDb.query("SELECT id, email, first_name FROM users ORDER BY id");
    assert.deepEqual(ownerRows.rows, [{ id: secondOwner, email: "owner@example.com", first_name: "Owner" }]);
    const childRows = await testDb.query(`
      SELECT user_id, count(*)::int AS count
        FROM (
          SELECT user_id FROM cycle_data
          UNION ALL
          SELECT user_id FROM movement_logs
        ) rows
       GROUP BY user_id
    `);
    assert.deepEqual(childRows.rows, [{ user_id: secondOwner, count: 3 }]);

    await testDb.query("INSERT INTO users (id) VALUES ('second-local-user')");
    const beforeRejected = fs.readFileSync(envPath);
    fs.writeFileSync(
      setupPath,
      "# Your GOE instance\nOWNER_ID=goe:a2853b19-7a13-4d1c-b21f-e56e53a55559\n",
      { mode: 0o600 },
    );
    await assert.rejects(
      () => applyGoeSetup(setupPath, envPath, new Date("2026-10-13T22:02:00Z"), undefined, true),
      /more than one user record/,
    );
    assert.deepEqual(fs.readFileSync(envPath), beforeRejected);
  } finally {
    await testDb.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("Fresh owner, existing-owner migration, and multi-owner stop: pass");
