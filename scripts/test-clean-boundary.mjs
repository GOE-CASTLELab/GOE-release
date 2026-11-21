import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenPaths = [
  ".agents",
  "archive",
  "attached_assets",
  "public",
  "client/public/assets/genekeys-chart.png",
  "client/public/assets/humandesign-chart.png",
  "client/public/images/Creative.webp",
  "client/public/images/Nutrition.webp",
  "client/public/images/Proxy.webp",
  "client/public/images/Signal.webp",
  "client/public/images/Wine.webp",
  "client/src/assets/vilain-bottle.jpg",
  "client/src/components/VideoSequencePlayer.jsx",
  "client/src/components/nutritionInsights.js",
  "client/src/components/proxySignalStatements.js",
  "client/src/components/wineTeaserData.js",
  "client/src/pages/landing.tsx",
  "scripts/test-demo-health.ts",
  "scripts/test-demo-moon-pattern.ts",
  "scripts/test-movement-routes.ts",
  "server/demoStorage.ts",
  "server/lib/demoAstrologyFreeze.ts",
  "shared/demoHealth.ts",
  "server/storage/cloudObjectStore.ts",
  "server/uploadVideosToStorage.ts",
];

for (const relativePath of forbiddenPaths) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), false, `Forbidden path remains: ${relativePath}`);
}

assert.equal(fs.existsSync(path.join(root, ".env")), false, "A real .env must never enter source history");

const requiredPaths = [
  "client/src/components/OrbHomeScreen.jsx",
  "client/src/components/CyclicalIntelligenceCard/CyclicalZone1.jsx",
  "client/src/components/RestIntelligenceCard/RestZone1.jsx",
  "client/src/components/MovementIntelligenceCard/MovementZone1.jsx",
  "client/src/components/AstrologyIntelligenceCard/AstrologyZone1.jsx",
  "client/src/hooks/useReturnPattern.ts",
  "server/prompts/wiredProsePrompts.ts",
  "server/routes/returnPattern.ts",
  "scripts/test-return-pattern-db.ts",
  "scripts/test-return-pattern-routes.ts",
  "setup/agent-feed/test-clean-package.mjs",
];

for (const relativePath of requiredPaths) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), true, `Required fork path missing: ${relativePath}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.license, "AGPL-3.0-only");
assert.equal(packageJson.dependencies?.["@google-cloud/storage"], undefined);
assert.equal(packageJson.dependencies?.["@neondatabase/serverless"], undefined);

const allowedUiScaffold = new Set([
  "button.tsx",
  "calendar.tsx",
  "card.tsx",
  "popover.tsx",
  "toast.tsx",
  "toaster.tsx",
  "tooltip.tsx",
]);
const shippedUiScaffold = fs.readdirSync(path.join(root, "client/src/components/ui"));
assert.deepEqual(
  shippedUiScaffold.sort(),
  [...allowedUiScaffold].sort(),
  "Only imported UI scaffold files may ship",
);

for (const removedDependency of [
  "@hookform/resolvers",
  "@radix-ui/react-accordion",
  "@radix-ui/react-dialog",
  "cmdk",
  "embla-carousel-react",
  "input-otp",
  "react-hook-form",
  "react-resizable-panels",
  "recharts",
  "vaul",
]) {
  assert.equal(packageJson.dependencies?.[removedDependency], undefined, `Unused dependency returned: ${removedDependency}`);
}

const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert.equal(packageLock.packages?.["node_modules/@google-cloud/storage"], undefined);
assert.equal(packageLock.packages?.["node_modules/@neondatabase/serverless"], undefined);

const homeSource = fs.readFileSync(path.join(root, "client/src/components/OrbHomeScreen.jsx"), "utf8");
for (const [heldCard, pattern] of [
  ["Creative", /id:\s*["']creative["']|name:\s*["']Creative["']/],
  ["Nourishment", /id:\s*["']nourishment["']|name:\s*["']Nourishment["']/],
  ["Nutrition", /id:\s*["']nutrition["']|name:\s*["']Nutrition["']/],
  ["Wine", /id:\s*["'](?:wine|sensoryWine)["']|name:\s*["']Wine["']/],
  ["Proxy", /id:\s*["']proxy["']|name:\s*["']Proxy["']/],
  ["Signal", /id:\s*["']signal["']|name:\s*["']Signal["']/],
]) {
  assert.equal(pattern.test(homeSource), false, `Held card remains on Home: ${heldCard}`);
}
for (const shippedCard of ["cyclical", "rest", "movement", "astrology"]) {
  assert.equal(homeSource.includes(`id: \"${shippedCard}\"`), true, `Shipped card missing from Home: ${shippedCard}`);
}

const appSource = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
assert.match(appSource, /useReturnPattern\(\)/, "Return Pattern must start from the owner app shell");
const returnRouteSource = fs.readFileSync(path.join(root, "server/routes/returnPattern.ts"), "utf8");
assert.doesNotMatch(returnRouteSource, /isDemoMode|DEMO_MODE/, "The clean owner route must not retain demo branching");
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
assert.match(envExample, /RETURN_PATTERN/, "The setup example must name the Return Pattern contribution prefix");

const staleSurfaceChecks = [
  ["client/src/components/RestIntelligenceCard/RestHeader.jsx", /Creative Intelligence/],
  ["client/src/components/HrvReader.jsx", /Creative|Nutrition/],
  ["client/src/lib/goeCardConstants.js", /creative:|nutrition:|sensoryWine:|signal:/],
  ["client/src/index.css", /goe-popup-signal/],
];
for (const [relativePath, pattern] of staleSurfaceChecks) {
  const contents = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.equal(pattern.test(contents), false, `Held-card surface remains in ${relativePath}`);
}

const forbiddenText = [
  /@google-cloud\/storage/,
  /GoogleCloudObjectStore/,
  /GOOGLE_CLOUD_BUCKET_NAME/,
  /CLOUD_BUCKET_NAME/,
  /\/Users\/nara/,
  /\bReplit\b/i,
  /1984-04-01T11:11:00/,
  /Red Deer, Canada/,
  /attached_assets/,
  /setCreativeModal|creativeModal/,
  /VITE_DEMO_MODE|DEMO_HEALTH|DEMO_ASTROLOGY|demoStorage|demoHealth|demoAstrologyFreeze/,
  /Creative\.webp|Nutrition\.webp|Wine\.webp|Proxy\.webp|Signal\.webp/,
  /nutritionInsights|proxySignalStatements|wineTeaserData|VideoSequencePlayer/,
];
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md", ".txt", ".example"]);
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
// Release source may name only published documents or the supported agent-feed target.
const allowedMarkdownReferences = new Set([
  "README.md", "COMMERCIAL.md", "THIRD_PARTY_NOTICES.md",
  "FILE_INDEX.md", "INSIDE_YOUR_GOE.md", "USER.md",
]);

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (absolutePath === fileURLToPath(import.meta.url)) continue;
    if (entry.isDirectory()) {
      visit(absolutePath);
      continue;
    }
    const extension = path.extname(entry.name);
    if (!textExtensions.has(extension) && entry.name !== ".env.example") continue;
    if (entry.name === "package-lock.json") continue;
    const contents = fs.readFileSync(absolutePath, "utf8");
    for (const [filename] of contents.matchAll(/\b[A-Z][A-Z0-9_-]*\.md\b/g)) {
      assert.ok(allowedMarkdownReferences.has(filename), `Unapproved documentation reference in ${path.relative(root, absolutePath)}`);
    }
    for (const pattern of forbiddenText) {
      assert.equal(pattern.test(contents), false, `Forbidden source text ${pattern} in ${path.relative(root, absolutePath)}`);
    }
  }
}

visit(root);
console.log("Configured source-boundary checks passed, including documentation references. Git history is not checked by this test.");
