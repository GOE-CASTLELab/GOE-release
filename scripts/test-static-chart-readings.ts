import assert from "node:assert/strict";
import {
  applyGeneKeysReadings,
  applyHumanDesignReadings,
  geneKeysReadingsSchema,
  humanDesignReadingsSchema,
} from "../shared/staticChartReadings";
import {
  buildCanonicalGeneKeysPrompt,
  buildCanonicalHumanDesignPrompt,
  flattenCanonicalGeneKeysOutput,
  flattenCanonicalHumanDesignOutput,
} from "../setup/chart-prompts/canonical-chart-prompt-adapter";

const reading = (label: string) => `${label} ${"A concrete chart reading remains attached to the supplied source value. ".repeat(6)}`;
const gkKeys = ["lifesWork", "evolution", "radiance", "purpose", "attraction", "iq", "eq", "sq", "vocation", "culture", "pearl", "creativity", "stability", "relating"];
const gkReadings = geneKeysReadingsSchema.parse(Object.fromEntries(gkKeys.map((key) => [key, reading(key)])));
const gkSource: any = {
  ...Object.fromEntries(gkKeys.slice(0, 11).map((key, index) => [key, { gate: String(index + 1), line: "1", content: "old" }])),
  harmonySequence: ["Brand", "Creativity", "Pearl", "Culture", "Stability", "Vocation", "Relating"].map((title) => ({ title, gate: "1", line: "1", content: "old" })),
};
const gk = applyGeneKeysReadings(gkSource, gkReadings);
assert.equal(gk.lifesWork.gate, "1");
assert.equal(gk.lifesWork.content, gkReadings.lifesWork);
assert.equal(gk.harmonySequence[0].content, gkReadings.lifesWork);
assert.equal(gk.harmonySequence[1].content, gkReadings.creativity);
assert.equal(gk.harmonySequence[6].content, gkReadings.relating);

const centerKeys = ["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solarPlexus", "root"];
const hdReadings = humanDesignReadingsSchema.parse({
  typeStrategy: reading("typeStrategy"), authority: reading("authority"), profile: reading("profile"), definition: reading("definition"),
  centers: Object.fromEntries(centerKeys.map((key) => [key, reading(key)])),
  incarnationCross: reading("incarnationCross"), notSelfTheme: reading("notSelfTheme"), signature: reading("signature"),
});
const hdSource: any = {
  type: "Manifestor",
  typeStrategyInterpretation: { title: "Type & Strategy", content: "old" },
  authorityInterpretation: { title: "Authority", content: "old" },
  profileInterpretation: { title: "Profile", content: "old" },
  definitionInterpretation: { title: "Definition", content: "old" },
  centers: Object.fromEntries(centerKeys.map((key) => [key, { defined: key === "root", content: "old" }])),
  incarnationCrossInterpretation: { title: "Cross", content: "old" },
  notSelfThemeInterpretation: { title: "Not-Self", content: "old" },
  signatureInterpretation: { title: "Signature", content: "old" },
};
const hd = applyHumanDesignReadings(hdSource, hdReadings);
assert.equal(hd.type, "Manifestor");
assert.equal(hd.typeStrategyInterpretation.title, "Type & Strategy");
assert.equal(hd.typeStrategyInterpretation.content, hdReadings.typeStrategy);
assert.equal(hd.centers.root.defined, true);
assert.equal(hd.centers.root.content, hdReadings.centers.root);

const canonicalGeneKeysPrompt = buildCanonicalGeneKeysPrompt({
  lifesWork: { gate: "27", line: "1", transformation: "Selfishness → Altruism → Selflessness" },
  evolution: { gate: "28", line: "1", transformation: "Purposelessness → Totality → Immortality" },
  radiance: { gate: "41", line: "3", transformation: "Fantasy → Anticipation → Emanation" },
  purpose: { gate: "31", line: "3", transformation: "Arrogance → Leadership → Humility" },
  iq: { gate: "36", line: "6", transformation: "Turbulence → Humanity → Compassion" },
  eq: { gate: "20", line: "1", transformation: "Superficiality → Self-Assurance → Presence" },
  sq: { gate: "22", line: "5", transformation: "Dishonor → Graciousness → Grace" },
  vocation: { gate: "36", line: "5", transformation: "Turbulence → Humanity → Compassion" },
  culture: { gate: "32", line: "3", transformation: "Failure → Preservation → Veneration" },
  attraction: { gate: "26", line: "3", transformation: "Pride → Artfulness → Invisibility" },
  pearl: { gate: "57", line: "2", transformation: "Unease → Intuition → Clarity" },
  harmonySequence: [
    { title: "Creativity", gate: "42", line: "1", transformation: "Expectation → Detachment → Celebration" },
    { title: "Relating", gate: "3", line: "3", transformation: "Chaos → Innovation → Innocence" },
    { title: "Stability", gate: "11", line: "2", transformation: "Obscurity → Idealism → Light" },
  ],
});
assert(canonicalGeneKeysPrompt.system.includes("Gene Keys Contemplation Oracle"));
assert(canonicalGeneKeysPrompt.messages[0].content.includes("Life's Work: 27.1 - Shadow: Selfishness, Gift: Altruism, Siddhi: Selflessness"));
assert(canonicalGeneKeysPrompt.messages[0].content.includes("Generate rich, contemplative insights"));

const canonicalHumanDesignPrompt = buildCanonicalHumanDesignPrompt({
  type: "Manifestor", strategy: "To Inform", authority: "Splenic", definition: "Single", profile: "1/3",
  incarnationCross: "Right Angle Cross of The Unexpected", notSelfTheme: "Anger", signature: "Peace",
  channels: ["20-57", "28-38", "32-54"], definedGates: ["20.1", "57.2"],
  centers: Object.fromEntries(centerKeys.map((key) => [key, { defined: ["throat", "spleen", "root"].includes(key) }])),
});
assert(canonicalHumanDesignPrompt.system.includes("Human Design Mechanics Oracle"));
assert(canonicalHumanDesignPrompt.messages[0].content.includes("DEFINED CHANNELS: 20-57, 28-38, 32-54"));
assert(canonicalHumanDesignPrompt.messages[0].content.includes("Generate rich, mechanical insights"));

const gkFlat = flattenCanonicalGeneKeysOutput({
  genius_sequence: { life_work: "lw", evolution: "ev", radiance: "ra", purpose: "pu" },
  love_sequence: { iq: "iq", eq: "eq", sq: "sq" },
  prosperity_sequence: { vocation: "vo", culture: "cu", attraction: "at", pearl: "pe" },
  star_pearl: { creativity: "cr", relating: "re", stability: "st" },
});
assert.equal(gkFlat.lifesWork, "lw");
assert.equal(gkFlat.stability, "st");

const hdFlat = flattenCanonicalHumanDesignOutput({
  core_foundation: { type_strategy: "ts", authority: "au", profile: "pr", definition: "de" },
  energy_centers: { head: "he", ajna: "aj", throat: "th", g_center: "gc", heart: "hr", spleen: "sp", sacral: "sa", solar_plexus: "so", root: "ro" },
  additional_insights: { incarnation_cross: "ic", not_self_theme: "ns", signature: "si" },
});
assert.equal(hdFlat.typeStrategy, "ts");
assert.equal(hdFlat.centers.g, "gc");

console.log("static chart reading merge: passed");
