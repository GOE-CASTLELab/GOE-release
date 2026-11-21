import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const patterns = [
  "client/**/*.{js,jsx,ts,tsx,css,html}",
  "server/**/*.ts",
  "shared/**/*.ts",
  "scripts/**/*.{js,mjs,ts}",
  "setup/**/*.{js,mjs,ts}",
  "docs/**/*.md",
  "*.{js,ts,json,md}",
];

const result = spawnSync(
  process.execPath,
  ["node_modules/prettier/bin/prettier.cjs", "--list-different", ...patterns],
  { encoding: "utf8" },
);

if (result.status !== 0 && result.status !== 1) {
  process.stderr.write(
    result.stderr || "Prettier could not inspect the source tree.\n",
  );
  process.exit(result.status ?? 1);
}

const files = result.stdout.trim().split("\n").filter(Boolean).sort();
const fingerprint = createHash("sha256")
  .update(files.length ? `${files.join("\n")}\n` : "")
  .digest("hex");

const expected = {
  count: 165,
  fingerprint:
    "69957301cff66ef931bb468d535d0216f0d8a3f222a594c564e87ce08e911b18",
};

if (files.length !== expected.count || fingerprint !== expected.fingerprint) {
  console.error(
    `Formatting baseline changed: expected ${expected.count} files (${expected.fingerprint}), ` +
      `found ${files.length} (${fingerprint}).`,
  );
  console.error(
    "Run Prettier only on the files intentionally being changed, then update this reviewed baseline.",
  );
  process.exit(1);
}

console.log(
  `Formatting baseline unchanged: ${files.length} legacy files remain queued.`,
);
