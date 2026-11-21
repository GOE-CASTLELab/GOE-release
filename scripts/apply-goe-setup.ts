// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";
import {
  CONTRIBUTION_CARDS,
  type ContributionCard,
} from "../shared/contributionContract";
import { readContributionConfig } from "../server/contributionConfig";

const require = createRequire(import.meta.url);

const CARD_ENV_NAMES: Record<ContributionCard, string> = {
  cyclical: "CYCLICAL",
  rest_restore: "REST_RESTORE",
  movement: "MOVEMENT",
  astrology_energetic: "ASTROLOGY_ENERGETIC",
  return_pattern: "RETURN_PATTERN",
};

const OWNER_KEYS = ["OWNER_ID", "OWNER_DID"] as const;
const CONTRIBUTION_BASE_KEYS = [
  "BROKERAGE_API_URL",
  "CONTRIBUTION_SCHEDULE",
  "CONTRIBUTION_CREDENTIAL",
  "CONTRIBUTION_CARDS",
] as const;

const cardKeys = (card: ContributionCard) => {
  const prefix = `CONTRIBUTION_${CARD_ENV_NAMES[card]}`;
  return [
    `${prefix}_CONSENT_VERSION`,
    `${prefix}_INSTRUMENT_VERSION`,
    `${prefix}_MANIFEST_FINGERPRINT`,
    `${prefix}_MAPPING_VERSION`,
  ];
};

const ALL_CARD_KEYS = CONTRIBUTION_CARDS.flatMap(cardKeys);
const CONTRIBUTION_KEYS = [...CONTRIBUTION_BASE_KEYS, ...ALL_CARD_KEYS];
const ALL_SETUP_KEYS = new Set<string>([...OWNER_KEYS, ...CONTRIBUTION_KEYS]);

type QueryResult = { rows: Array<Record<string, any>>; rowCount?: number | null };
type QueryClient = {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release?(): void;
};

export type OwnerSetupResult = {
  action: "created" | "already_configured" | "migrated";
  migratedRecords: number;
};

export type AppliedGoeSetup = {
  owner: OwnerSetupResult;
  contribution: "configured" | "unchanged";
  cards: ContributionCard[];
  credentialSource: "setup_file" | "existing_env" | "not_applicable";
};

function assignmentKey(line: string): string | null {
  const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
  return match?.[1] ?? null;
}

function readSetupValues(text: string): Record<string, string> {
  const seen = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const key = assignmentKey(line);
    if (!key) throw new Error(`Setup file line ${index + 1} is not a KEY=value assignment.`);
    if (seen.has(key)) throw new Error(`Setup file repeats ${key}.`);
    if (!ALL_SETUP_KEYS.has(key)) throw new Error(`Setup file contains unsupported key ${key}.`);
    seen.add(key);
  }
  return parse(text);
}

function selectedCards(values: Record<string, string>): ContributionCard[] {
  const cards = (values.CONTRIBUTION_CARDS || "")
    .split(",")
    .map((card) => card.trim())
    .filter(Boolean);
  if (
    cards.length === 0 ||
    new Set(cards).size !== cards.length ||
    cards.some((card) => !CONTRIBUTION_CARDS.includes(card as ContributionCard))
  ) {
    throw new Error("Setup file has an invalid CONTRIBUTION_CARDS list.");
  }
  return cards as ContributionCard[];
}

function validateOwnerId(ownerId: string | undefined): asserts ownerId is string {
  if (!ownerId || !/^(?:goe:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|did:dfos:[a-z0-9]{20,100})$/.test(ownerId)) {
    throw new Error("Setup file OWNER_ID is missing or invalid.");
  }
}

function validateContributionSource(
  source: Record<string, string>,
  combined: Record<string, string>,
  cards: ContributionCard[],
): void {
  for (const key of ["BROKERAGE_API_URL", "CONTRIBUTION_SCHEDULE", "CONTRIBUTION_CARDS"]) {
    if (!source[key]) throw new Error(`Setup file is missing ${key}.`);
  }
  if (!combined.CONTRIBUTION_CREDENTIAL) {
    throw new Error("Setup file is missing CONTRIBUTION_CREDENTIAL and the instance has no existing credential.");
  }
  const expectedCardKeys = new Set(cards.flatMap(cardKeys));
  for (const key of expectedCardKeys) {
    if (!source[key]) throw new Error(`Setup file is missing ${key}.`);
  }
  for (const key of ALL_CARD_KEYS) {
    if (source[key] && !expectedCardKeys.has(key)) {
      throw new Error(`Setup file includes ${key} for a card outside CONTRIBUTION_CARDS.`);
    }
  }
  const config = readContributionConfig({ ...combined, NODE_ENV: "production" });
  if (!config.enabled) {
    throw new Error(`Setup file does not match this GOE instance: ${config.reason}`);
  }
  if (config.cards.map((card) => card.card).join(",") !== cards.join(",")) {
    throw new Error("Setup file card order does not match the validated contribution configuration.");
  }
}

function encodeValue(value: string): string {
  return /^[A-Za-z0-9_./,:@+-]+$/.test(value) ? value : JSON.stringify(value);
}

function mergeSetupValues(
  targetText: string,
  values: Record<string, string>,
  contributionIncluded: boolean,
): string {
  const remaining = new Map(Object.entries(values));
  const managedScope = new Set<string>(contributionIncluded ? [...OWNER_KEYS, ...CONTRIBUTION_KEYS] : OWNER_KEYS);
  const output: string[] = [];

  for (const line of targetText.split(/\r?\n/)) {
    const key = assignmentKey(line);
    if (!key || !managedScope.has(key)) {
      output.push(line);
      continue;
    }
    const value = remaining.get(key);
    if (value !== undefined) {
      output.push(`${key}=${encodeValue(value)}`);
      remaining.delete(key);
    }
  }

  while (output.length && output.at(-1) === "") output.pop();
  const ownerEntries = [...remaining].filter(([key]) => OWNER_KEYS.some((ownerKey) => ownerKey === key));
  const contributionEntries = [...remaining].filter(([key]) => !OWNER_KEYS.some((ownerKey) => ownerKey === key));
  if (ownerEntries.length > 0) {
    output.push("", "# Your GOE instance");
    for (const [key, value] of ownerEntries) output.push(`${key}=${encodeValue(value)}`);
  }
  if (contributionEntries.length > 0) {
    output.push("", "# Optional CASTLE Lab connection");
    for (const [key, value] of contributionEntries) output.push(`${key}=${encodeValue(value)}`);
  }
  return `${output.join("\n")}\n`;
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Database returned an unsafe identifier.");
  return `"${value}"`;
}

export function planOwnerSetup(existingUserIds: string[], ownerDid: string): OwnerSetupResult["action"] {
  if (existingUserIds.length === 0) return "created";
  if (existingUserIds.length === 1 && existingUserIds[0] === ownerDid) return "already_configured";
  if (existingUserIds.length === 1) return "migrated";
  throw new Error("Owner setup found more than one user record. Review the database before choosing which owner to migrate.");
}

async function applyOwnerInsideTransaction(client: QueryClient, ownerDid: string, allowOwnerMigration: boolean): Promise<OwnerSetupResult> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('goe-owner-setup'))");
  const users = await client.query("SELECT id FROM users ORDER BY id FOR UPDATE");
  const userIds = users.rows.map((row) => String(row.id));
  const action = planOwnerSetup(userIds, ownerDid);
  if (action === "migrated" && !allowOwnerMigration) {
    throw new Error("The database already has another owner. Owner migration requires an explicit --migrate-owner.");
  }

  if (action === "created") {
    await client.query("INSERT INTO users (id) VALUES ($1)", [ownerDid]);
    return { action, migratedRecords: 0 };
  }
  if (action === "already_configured") {
    return { action, migratedRecords: 0 };
  }

  const previousOwner = userIds[0];
  const previous = await client.query("SELECT * FROM users WHERE id = $1", [previousOwner]);
  const old = previous.rows[0];
  await client.query("INSERT INTO users (id) VALUES ($1)", [ownerDid]);

  const references = await client.query(`
    SELECT namespace.nspname AS schema_name,
           child.relname AS table_name,
           attribute.attname AS column_name
      FROM pg_constraint constraint_row
      JOIN pg_class child ON child.oid = constraint_row.conrelid
      JOIN pg_namespace namespace ON namespace.oid = child.relnamespace
      JOIN unnest(constraint_row.conkey) WITH ORDINALITY child_key(attnum, ordinality) ON true
      JOIN pg_attribute attribute
        ON attribute.attrelid = constraint_row.conrelid
       AND attribute.attnum = child_key.attnum
     WHERE constraint_row.contype = 'f'
       AND constraint_row.confrelid = 'public.users'::regclass
     ORDER BY namespace.nspname, child.relname, attribute.attname
  `);

  let migratedRecords = 0;
  for (const reference of references.rows) {
    const table = `${quoteIdentifier(String(reference.schema_name))}.${quoteIdentifier(String(reference.table_name))}`;
    const column = quoteIdentifier(String(reference.column_name));
    const updated = await client.query(
      `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
      [ownerDid, previousOwner],
    );
    migratedRecords += updated.rowCount || 0;
  }

  await client.query("DELETE FROM users WHERE id = $1", [previousOwner]);
  await client.query(
    `UPDATE users
        SET email = $2,
            first_name = $3,
            last_name = $4,
            profile_image_url = $5,
            life_stage = $6,
            created_at = $7,
            updated_at = $8
      WHERE id = $1`,
    [
      ownerDid,
      old.email ?? null,
      old.first_name ?? null,
      old.last_name ?? null,
      old.profile_image_url ?? null,
      old.life_stage ?? null,
      old.created_at ?? null,
      old.updated_at ?? null,
    ],
  );
  return { action, migratedRecords };
}

export async function setupOwnerDatabase(databaseUrl: string, ownerDid: string, allowOwnerMigration = false): Promise<OwnerSetupResult> {
  const pg = require("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client: QueryClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await applyOwnerInsideTransaction(client, ownerDid, allowOwnerMigration);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release?.();
    await pool.end();
  }
}

function restoreEnvironment(envPath: string, backupPath: string | null, existed: boolean): void {
  if (existed && backupPath) {
    fs.copyFileSync(backupPath, envPath);
    fs.chmodSync(envPath, 0o600);
  } else if (!existed) {
    fs.rmSync(envPath, { force: true });
  }
  if (backupPath) fs.rmSync(backupPath, { force: true });
}

export async function applyGoeSetup(
  inputPath: string,
  envPath = path.resolve(".env"),
  now = new Date(),
  ownerSetup: (databaseUrl: string, ownerDid: string, allowOwnerMigration?: boolean) => Promise<OwnerSetupResult> = setupOwnerDatabase,
  allowOwnerMigration = false,
): Promise<AppliedGoeSetup> {
  const sourceText = fs.readFileSync(inputPath, "utf8");
  const source = readSetupValues(sourceText);
  if (source.OWNER_ID && source.OWNER_DID) throw new Error("Setup file must contain only one owner identity.");

  const targetExists = fs.existsSync(envPath);
  const targetText = targetExists ? fs.readFileSync(envPath, "utf8") : "";
  const current = parse(targetText);
  const contributionIncluded = CONTRIBUTION_KEYS.some((key) => source[key] !== undefined);
  const currentOwner = current.OWNER_ID || current.OWNER_DID;
  const suppliedOwner = source.OWNER_ID || source.OWNER_DID;
  if (source.OWNER_DID && !currentOwner) {
    throw new Error("New GOE instances require a local OWNER_ID; DFOS identity belongs to CASTLE Lab consent.");
  }
  if (suppliedOwner && currentOwner && suppliedOwner !== currentOwner && !allowOwnerMigration) {
    throw new Error("Setup file cannot replace the existing owner identity.");
  }
  const ownerId = suppliedOwner || currentOwner;
  validateOwnerId(ownerId);
  if (current.OWNER_ID && current.OWNER_DID && current.OWNER_ID !== current.OWNER_DID) {
    throw new Error("Existing OWNER_ID and OWNER_DID do not match.");
  }
  const combined = { ...current, ...source };
  if (!combined.DATABASE_URL) {
    throw new Error("The instance .env needs DATABASE_URL before GOE owner setup can run.");
  }

  let cards: ContributionCard[] = [];
  if (contributionIncluded) {
    cards = selectedCards(source);
    validateContributionSource(source, combined, cards);
  }

  const finalValues: Record<string, string> = { OWNER_ID: ownerId };
  if (contributionIncluded) {
    for (const key of CONTRIBUTION_BASE_KEYS) {
      const value = combined[key];
      if (value) finalValues[key] = value;
    }
    for (const card of cards) {
      for (const key of cardKeys(card)) finalValues[key] = source[key];
    }
  }

  let backupPath: string | null = null;
  if (targetExists) {
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    backupPath = `${envPath}.pre-goe-setup-${stamp}`;
    fs.copyFileSync(envPath, backupPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backupPath, 0o600);
  }

  const next = mergeSetupValues(targetText, finalValues, contributionIncluded);
  const temporary = `${envPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, next, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, envPath);
    fs.chmodSync(envPath, 0o600);
    const owner = await ownerSetup(combined.DATABASE_URL, ownerId, allowOwnerMigration);
    if (backupPath) fs.rmSync(backupPath, { force: true });
    return {
      owner,
      contribution: contributionIncluded ? "configured" : "unchanged",
      cards,
      credentialSource: contributionIncluded
        ? (source.CONTRIBUTION_CREDENTIAL ? "setup_file" : "existing_env")
        : "not_applicable",
    };
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    restoreEnvironment(envPath, backupPath, targetExists);
    throw error;
  }
}

function cliArguments(argv: string[]): { inputPath: string; envPath: string; allowOwnerMigration: boolean } {
  let inputPath = "";
  let envPath = path.resolve(".env");
  let allowOwnerMigration = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input" && argv[index + 1]) inputPath = path.resolve(argv[++index]);
    else if (argv[index] === "--env" && argv[index + 1]) envPath = path.resolve(argv[++index]);
    else if (argv[index] === "--migrate-owner") allowOwnerMigration = true;
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  if (!inputPath) throw new Error("Usage: npm run setup:apply -- --input <goe-setup.env> [--env <.env>] [--migrate-owner]");
  return { inputPath, envPath, allowOwnerMigration };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    const { inputPath, envPath, allowOwnerMigration } = cliArguments(process.argv.slice(2));
    const result = await applyGoeSetup(inputPath, envPath, new Date(), setupOwnerDatabase, allowOwnerMigration);
    console.log("GOE setup applied.");
    if (result.owner.action === "migrated") {
      console.log(`Owner identity migrated with ${result.owner.migratedRecords} existing records.`);
    } else if (result.owner.action === "created") {
      console.log("Owner identity created.");
    } else {
      console.log("Owner identity already configured.");
    }
    console.log(result.contribution === "configured"
      ? `CASTLE Lab connection configured for: ${result.cards.join(", ")}.`
      : "CASTLE Lab connection unchanged.");
    console.log("Private .env mode: 0600.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "GOE setup failed.");
    process.exitCode = 1;
  }
}
