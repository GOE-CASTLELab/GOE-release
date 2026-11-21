import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "dotenv";
import {
  applyGoeSetup,
  planOwnerSetup,
  type OwnerSetupResult,
} from "./apply-goe-setup";
import {
  ACCEPTED_CARD_VERSIONS,
  type ContributionCard,
} from "../shared/contributionContract";
import { readContributionConfig } from "../server/contributionConfig";

const envNames: Record<ContributionCard, string> = {
  cyclical: "CYCLICAL",
  rest_restore: "REST_RESTORE",
  movement: "MOVEMENT",
  astrology_energetic: "ASTROLOGY_ENERGETIC",
  return_pattern: "RETURN_PATTERN",
};

const ownerId = "goe:12d7fc32-e74e-4e27-b798-44c98eec44b1";
const databaseUrl = "postgresql://local/goe";

const setupText = (cards?: ContributionCard[], credential?: string) => {
  const lines = ["# Your GOE instance", `OWNER_ID=${ownerId}`];
  if (cards) {
    lines.push(
      "",
      "# Optional CASTLE Lab connection",
      "BROKERAGE_API_URL=https://mygoe.app/api/contributions",
      "CONTRIBUTION_SCHEDULE=biweekly",
    );
    if (credential) lines.push(`CONTRIBUTION_CREDENTIAL=${credential}`);
    lines.push(`CONTRIBUTION_CARDS=${cards.join(",")}`);
    for (const card of cards) {
      const version = ACCEPTED_CARD_VERSIONS.find((entry) => entry.card === card)!;
      const prefix = `CONTRIBUTION_${envNames[card]}`;
      lines.push(
        `${prefix}_CONSENT_VERSION=0.5.0`,
        `${prefix}_INSTRUMENT_VERSION=${version.instrumentVersion}`,
        `${prefix}_MANIFEST_FINGERPRINT=${version.manifestFingerprint}`,
        `${prefix}_MAPPING_VERSION=${version.mappingVersion}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
};

const calls: string[] = [];
const ownerSetup = async (url: string, did: string): Promise<OwnerSetupResult> => {
  calls.push(`${url}|${did}`);
  return { action: "created", migratedRecords: 0 };
};

assert.equal(planOwnerSetup([], ownerId), "created");
assert.equal(planOwnerSetup([ownerId], ownerId), "already_configured");
assert.equal(planOwnerSetup(["legacy-owner"], ownerId), "migrated");
assert.throws(() => planOwnerSetup(["one", "two"], ownerId), /more than one user record/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "goe-setup-"));
try {
  const envPath = path.join(root, ".env");
  const inputPath = path.join(root, "goe-setup.env");
  const credential = `goe_${"a".repeat(43)}`;
  const allCards = ACCEPTED_CARD_VERSIONS.map((entry) => entry.card);
  fs.writeFileSync(
    envPath,
    `# Existing instance\nDATABASE_URL=${databaseUrl}\nUNRELATED_VALUE=keep-me\nOWNER_ID=\nCONTRIBUTION_CREDENTIAL=\n`,
    { mode: 0o644 },
  );
  fs.writeFileSync(inputPath, setupText(allCards, credential), { mode: 0o600 });

  const first = await applyGoeSetup(
    inputPath,
    envPath,
    new Date("2026-10-13T21:30:00Z"),
    ownerSetup,
  );
  assert.deepEqual(first.cards, allCards);
  assert.equal(first.contribution, "configured");
  assert.equal(first.credentialSource, "setup_file");
  assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
  assert.equal(fs.readdirSync(root).some((name) => name.includes("pre-goe-setup")), false);
  const applied = parse(fs.readFileSync(envPath));
  assert.equal(applied.UNRELATED_VALUE, "keep-me");
  assert.equal(applied.OWNER_ID, ownerId);
  assert.equal(applied.CONTRIBUTION_CREDENTIAL, credential);
  assert.equal(readContributionConfig({ ...applied, NODE_ENV: "production" }).enabled, true);

  const updatePath = path.join(root, "goe-consent-update.env");
  fs.writeFileSync(updatePath, setupText(["cyclical", "rest_restore"]).replace(`OWNER_ID=${ownerId}\n`, ""), { mode: 0o600 });
  const update = await applyGoeSetup(
    updatePath,
    envPath,
    new Date("2026-10-13T21:31:00Z"),
    ownerSetup,
  );
  assert.equal(update.credentialSource, "existing_env");
  const updated = parse(fs.readFileSync(envPath));
  assert.equal(updated.CONTRIBUTION_CREDENTIAL, credential);
  assert.equal(updated.CONTRIBUTION_CARDS, "cyclical,rest_restore");
  assert.equal(updated.OWNER_ID, ownerId);
  assert.equal(updated.CONTRIBUTION_MOVEMENT_CONSENT_VERSION, undefined);
  assert.equal(updated.CONTRIBUTION_ASTROLOGY_ENERGETIC_CONSENT_VERSION, undefined);
  assert.equal(readContributionConfig({ ...updated, NODE_ENV: "production" }).enabled, true);
  const wrongOwnerPath = path.join(root, "wrong-owner.env");
  fs.writeFileSync(wrongOwnerPath, `OWNER_DID=did:dfos:abcdefghijklmnopqrstuvwxyz123456\n`, { mode: 0o600 });
  await assert.rejects(() => applyGoeSetup(wrongOwnerPath, envPath, new Date(), ownerSetup), /cannot replace/);
  assert.equal(parse(fs.readFileSync(envPath)).OWNER_ID, ownerId);
  const legacyEnv = path.join(root, "legacy.env");
  const legacyOwner = "did:dfos:abcdefghijklmnopqrstuvwxyz123456";
  fs.writeFileSync(legacyEnv, `DATABASE_URL=${databaseUrl}\nOWNER_DID=${legacyOwner}\nCONTRIBUTION_CREDENTIAL=${credential}\n`, { mode: 0o600 });
  await applyGoeSetup(updatePath, legacyEnv, new Date(), ownerSetup);
  assert.equal(parse(fs.readFileSync(legacyEnv)).OWNER_ID, legacyOwner);
  assert.equal(parse(fs.readFileSync(legacyEnv)).OWNER_DID, undefined);
  const freshEnv = path.join(root, "fresh.env");
  fs.writeFileSync(freshEnv, `DATABASE_URL=${databaseUrl}\n`, { mode: 0o600 });
  await assert.rejects(() => applyGoeSetup(wrongOwnerPath, freshEnv, new Date(), ownerSetup), /New GOE instances require/);

  const rotatedCredential = `goe_${"b".repeat(43)}`;
  const rotationPath = path.join(root, "goe-rotation.env");
  fs.writeFileSync(
    rotationPath,
    setupText(["cyclical", "rest_restore"], rotatedCredential),
    { mode: 0o600 },
  );
  const rotation = await applyGoeSetup(
    rotationPath,
    envPath,
    new Date("2026-10-13T21:31:30Z"),
    ownerSetup,
  );
  assert.equal(rotation.credentialSource, "setup_file");
  assert.equal(parse(fs.readFileSync(envPath)).CONTRIBUTION_CREDENTIAL, rotatedCredential);

  const ownerOnlyPath = path.join(root, "goe-owner.env");
  fs.writeFileSync(ownerOnlyPath, setupText(), { mode: 0o600 });
  const beforeOwnerOnly = parse(fs.readFileSync(envPath));
  const ownerOnly = await applyGoeSetup(
    ownerOnlyPath,
    envPath,
    new Date("2026-10-13T21:32:00Z"),
    ownerSetup,
  );
  const afterOwnerOnly = parse(fs.readFileSync(envPath));
  assert.equal(ownerOnly.contribution, "unchanged");
  assert.equal(ownerOnly.credentialSource, "not_applicable");
  assert.equal(afterOwnerOnly.CONTRIBUTION_CREDENTIAL, beforeOwnerOnly.CONTRIBUTION_CREDENTIAL);
  assert.equal(afterOwnerOnly.CONTRIBUTION_CARDS, beforeOwnerOnly.CONTRIBUTION_CARDS);

  const beforeInvalid = crypto.createHash("sha256").update(fs.readFileSync(envPath)).digest("hex");
  const invalidPath = path.join(root, "invalid.env");
  fs.writeFileSync(
    invalidPath,
    setupText(["cyclical"], credential).replace(
      /CONTRIBUTION_CYCLICAL_MANIFEST_FINGERPRINT=.*/,
      `CONTRIBUTION_CYCLICAL_MANIFEST_FINGERPRINT=${"0".repeat(64)}`,
    ),
    { mode: 0o600 },
  );
  await assert.rejects(() => applyGoeSetup(invalidPath, envPath, new Date(), ownerSetup), /does not match this GOE instance/);
  const afterInvalid = crypto.createHash("sha256").update(fs.readFileSync(envPath)).digest("hex");
  assert.equal(afterInvalid, beforeInvalid);

  const beforeFailure = fs.readFileSync(envPath);
  await assert.rejects(
    () => applyGoeSetup(
      ownerOnlyPath,
      envPath,
      new Date("2026-10-13T21:33:00Z"),
      async () => { throw new Error("database setup failed"); },
    ),
    /database setup failed/,
  );
  assert.deepEqual(fs.readFileSync(envPath), beforeFailure);
  assert.equal(fs.readdirSync(root).some((name) => name.includes("pre-goe-setup")), false);
  assert.ok(calls.length >= 3);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("GOE setup file, consent update, and owner plan: pass");
