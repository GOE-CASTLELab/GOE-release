import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(projectRoot, "package-lock.json");
const outputPath = path.join(projectRoot, "THIRD_PARTY_NOTICES.md");
const checkOnly = process.argv.includes("--check");

// These releases predate the lockfile's current `license` metadata. Their
// installed package metadata/source notices identify each as MIT.
const verifiedLicenseFallbacks = new Map([
  ["passport-local@1.0.0", "MIT"],
  ["passport-strategy@1.0.0", "MIT"],
  ["pause@0.0.1", "MIT"],
]);

const lockBytes = fs.readFileSync(lockPath);
const lock = JSON.parse(lockBytes.toString("utf8"));
assert.equal(lock.lockfileVersion, 3, "Notices generation requires package-lock v3");

const packages = new Map();
for (const [packagePath, metadata] of Object.entries(lock.packages || {})) {
  if (!packagePath.includes("node_modules/") || metadata.link) continue;
  const name = packagePath.split("node_modules/").at(-1);
  const version = metadata.version;
  assert.equal(typeof name, "string");
  assert.equal(typeof version, "string", `Missing version for ${name}`);
  const key = `${name}@${version}`;
  const license = metadata.license || verifiedLicenseFallbacks.get(key);
  assert.equal(typeof license, "string", `Missing verified licence for ${key}`);

  const existing = packages.get(key) || {
    name,
    version,
    license,
    runtime: false,
    optional: false,
    development: false,
  };
  assert.equal(existing.license, license, `Conflicting licences for ${key}`);
  if (metadata.dev) existing.development = true;
  else if (metadata.optional) existing.optional = true;
  else existing.runtime = true;
  packages.set(key, existing);
}

const rows = [...packages.values()].sort((left, right) => {
  const leftKey = `${left.name}@${left.version}`;
  const rightKey = `${right.name}@${right.version}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
});
assert(rows.length > 0, "No locked third-party packages found");

function includedFor(row) {
  const scopes = [];
  if (row.runtime) scopes.push("runtime");
  if (row.optional) scopes.push("optional");
  if (row.development) scopes.push("build/development");
  return scopes.join(", ");
}

const lockHash = crypto.createHash("sha256").update(lockBytes).digest("hex");
const lines = [
  "# Third-Party Software Notices",
  "",
  "GOE uses the third-party software packages listed below. This inventory is generated",
  "from the exact locked dependency graph in `package-lock.json`, including runtime, optional,",
  "and build/development packages because the distributed source includes the lockfile and",
  "build tooling.",
  "",
  "This file covers software dependencies only. It does not cover AstroApp or another API",
  "service, Anthropic, OpenAI or another AI provider, images or other authored content, or",
  "GOE itself. GOE's own licence is in `LICENSE`.",
  "",
  "The licence column uses the package's locked SPDX licence metadata. Exact licence and",
  "copyright texts remain in each installed package. This inventory does not replace them.",
  "",
  `Package-lock SHA-256: \`${lockHash}\``,
  "",
  `Unique package releases: **${rows.length}**`,
  "",
  "| Package | Version | Licence | Included for |",
  "|---|---:|---|---|",
  ...rows.map(
    (row) =>
      `| \`${row.name}\` | \`${row.version}\` | \`${row.license}\` | ${includedFor(row)} |`,
  ),
  "",
];
const generated = lines.join("\n");

if (checkOnly) {
  assert(fs.existsSync(outputPath), "THIRD_PARTY_NOTICES.md is missing");
  assert.equal(
    fs.readFileSync(outputPath, "utf8"),
    generated,
    "THIRD_PARTY_NOTICES.md does not match package-lock.json",
  );
  console.log(`Third-party notices match ${rows.length} locked package releases.`);
} else {
  fs.writeFileSync(outputPath, generated, "utf8");
  console.log(`Wrote THIRD_PARTY_NOTICES.md for ${rows.length} locked package releases.`);
}
