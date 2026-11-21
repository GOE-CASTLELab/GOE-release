import assert from "node:assert/strict";
import fs from "node:fs";
import { parseStaticChartPackage } from "../shared/staticChartImport";
import { normalizeStaticChartResponse, STAR_PEARL_ROLES, starPearlCardId } from "../client/src/lib/staticCharts.js";

const sphere = { gate: "27", line: "1", title: "Life's Work", transformation: "Selfishness → Altruism → Selflessness", content: "Source-grounded interpretation." };
const interpretation = { title: "Type & Strategy", subtitle: "Manifestor · To Inform", content: "Source-grounded interpretation." };
const centers = Object.fromEntries(["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solarPlexus", "root"].map((key) => [key, interpretation]));

const parsed = parseStaticChartPackage({
  version: 1,
  geneKeys: {
    lifesWork: sphere, evolution: sphere, radiance: sphere, purpose: sphere,
    vocation: sphere, culture: sphere, pearl: sphere, iq: sphere, eq: sphere,
    sq: sphere, attraction: sphere, profile: "1/3", activationSequence: [],
    venusSequence: [], earthSequence: [], harmonySequence: [], fullChartData: {},
  },
  humanDesign: {
    type: "Manifestor", strategy: "To Inform", authority: "Splenic", profile: "1/3",
    definition: "Single", notSelfTheme: "Anger", signature: "Peace",
    incarnationCross: "Right Angle Cross of The Unexpected (27/28 | 41/31)",
    typeStrategyInterpretation: interpretation, authorityInterpretation: interpretation,
    profileInterpretation: interpretation, definitionInterpretation: interpretation,
    incarnationCrossInterpretation: interpretation, notSelfThemeInterpretation: interpretation,
    signatureInterpretation: interpretation, centers, definedGates: [], channels: [],
    designPositions: [], personalityPositions: [], fullChartData: {},
  },
}, "did:dfos:test");

assert.equal(parsed.geneKeys?.userId, "did:dfos:test");
assert.equal(parsed.humanDesign?.userId, "did:dfos:test");
assert.equal(normalizeStaticChartResponse({ message: "No Gene Keys data found" }), null);
assert.equal(normalizeStaticChartResponse({ id: "chart" })?.id, "chart");
assert.deepEqual(STAR_PEARL_ROLES.map(starPearlCardId), [
  "star-pearl-brand", "star-pearl-creativity", "star-pearl-pearl", "star-pearl-culture",
  "star-pearl-stability", "star-pearl-vocation", "star-pearl-relating",
]);

assert.throws(() => parseStaticChartPackage({ version: 1 }, "did:dfos:test"));

const cardSource = fs.readFileSync(new URL("../client/src/components/AstrologyIntelligenceCard/index.jsx", import.meta.url), "utf8");
const zoneSource = fs.readFileSync(new URL("../client/src/components/AstrologyIntelligenceCard/AstrologyZone2.jsx", import.meta.url), "utf8");
assert.doesNotMatch(cardSource, /lifework-21|evolution-48|brand-21-harmony/);
assert.match(zoneSource, /title="Star Pearl"/);

console.log("static chart import tests passed");
