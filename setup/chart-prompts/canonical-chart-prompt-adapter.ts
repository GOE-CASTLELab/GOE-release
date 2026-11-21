import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type PromptConfig = {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user"; content: string }>;
};

function stringField(source: string, field: string): string {
  const match = source.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!match) throw new Error(`Canonical chart prompt is missing ${field}.`);
  return JSON.parse(`"${match[1]}"`);
}

function numberField(source: string, field: string): number {
  const match = source.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`));
  if (!match) throw new Error(`Canonical chart prompt is missing ${field}.`);
  return Number(match[1]);
}

function renderCanonicalPrompt(filename: string, chartData: unknown): PromptConfig {
  const promptPath = fileURLToPath(new URL(filename, import.meta.url));
  const source = readFileSync(promptPath, "utf8");
  const contentStartMarker = '"content": `';
  const contentStart = source.indexOf(contentStartMarker);
  if (contentStart < 0) throw new Error(`Canonical chart prompt is missing its content template: ${filename}`);
  const templateStart = contentStart + contentStartMarker.length;
  const templateEnd = source.indexOf("`\n      }", templateStart);
  if (templateEnd < 0) throw new Error(`Canonical chart prompt has an unterminated content template: ${filename}`);
  const template = source.slice(templateStart, templateEnd);
  const executableTemplate = template.replace(/`/g, "\\`");

  // These templates are trusted repository sources. Evaluating only their template body
  // preserves the canonical prompt text while substituting the verified chart package.
  const content = new Function("chartData", `return \`${executableTemplate}\`;`)(chartData);
  return {
    model: stringField(source, "model"),
    max_tokens: numberField(source, "max_tokens"),
    system: stringField(source, "system"),
    messages: [{ role: "user", content }],
  };
}

function geneKeySphere(value: any) {
  const [shadow = "", gift = "", siddhi = ""] = String(value?.transformation ?? "").split(/\s*→\s*/);
  return { gate: String(value?.gate ?? ""), line: String(value?.line ?? ""), shadow, gift, siddhi };
}

export function buildCanonicalGeneKeysPrompt(geneKeys: any): PromptConfig {
  const star = new Map(
    (Array.isArray(geneKeys?.harmonySequence) ? geneKeys.harmonySequence : [])
      .map((sphere: any) => [String(sphere?.title ?? "").toLowerCase(), sphere]),
  );
  return renderCanonicalPrompt("./gene-keys-chart-prompt.txt", {
    lifeWork: geneKeySphere(geneKeys?.lifesWork),
    evolution: geneKeySphere(geneKeys?.evolution),
    radiance: geneKeySphere(geneKeys?.radiance),
    purpose: geneKeySphere(geneKeys?.purpose),
    iq: geneKeySphere(geneKeys?.iq),
    eq: geneKeySphere(geneKeys?.eq),
    sq: geneKeySphere(geneKeys?.sq),
    vocation: geneKeySphere(geneKeys?.vocation),
    culture: geneKeySphere(geneKeys?.culture),
    attraction: geneKeySphere(geneKeys?.attraction),
    pearl: geneKeySphere(geneKeys?.pearl),
    creativity: geneKeySphere(star.get("creativity")),
    relating: geneKeySphere(star.get("relating")),
    stability: geneKeySphere(star.get("stability")),
  });
}

export function buildCanonicalHumanDesignPrompt(humanDesign: any): PromptConfig {
  const centerState = (key: string) => humanDesign?.centers?.[key]?.defined ? "defined" : "undefined";
  const centerEntries = Object.entries(humanDesign?.centers ?? {}) as Array<[string, any]>;
  return renderCanonicalPrompt("./human-design-chart-prompt.txt", {
    type: humanDesign?.type,
    strategy: humanDesign?.strategy,
    authority: humanDesign?.authority,
    definition: humanDesign?.definition,
    profile: humanDesign?.profile,
    incarnationCross: humanDesign?.incarnationCross,
    notSelfTheme: humanDesign?.notSelfTheme,
    signature: humanDesign?.signature,
    definedCenters: centerEntries.filter(([, value]) => value?.defined).map(([key]) => key),
    undefinedCenters: centerEntries.filter(([, value]) => !value?.defined).map(([key]) => key),
    definedChannels: humanDesign?.channels ?? [],
    definedGates: humanDesign?.definedGates ?? [],
    centers: {
      head: centerState("head"), ajna: centerState("ajna"), throat: centerState("throat"),
      g_center: centerState("g"), heart: centerState("heart"), spleen: centerState("spleen"),
      sacral: centerState("sacral"), solar_plexus: centerState("solarPlexus"), root: centerState("root"),
    },
  });
}

const canonicalGeneKeysOutputSchema = z.object({
  genius_sequence: z.object({ life_work: z.string(), evolution: z.string(), radiance: z.string(), purpose: z.string() }),
  love_sequence: z.object({ iq: z.string(), eq: z.string(), sq: z.string() }),
  prosperity_sequence: z.object({ vocation: z.string(), culture: z.string(), attraction: z.string(), pearl: z.string() }),
  star_pearl: z.object({ creativity: z.string(), relating: z.string(), stability: z.string() }),
});

const canonicalHumanDesignOutputSchema = z.object({
  core_foundation: z.object({ type_strategy: z.string(), authority: z.string(), profile: z.string(), definition: z.string() }),
  energy_centers: z.object({
    head: z.string(), ajna: z.string(), throat: z.string(), g_center: z.string(), heart: z.string(),
    spleen: z.string(), sacral: z.string(), solar_plexus: z.string(), root: z.string(),
  }),
  additional_insights: z.object({ incarnation_cross: z.string(), not_self_theme: z.string(), signature: z.string() }),
});

export function flattenCanonicalGeneKeysOutput(input: unknown) {
  const parsed = canonicalGeneKeysOutputSchema.parse(input);
  return {
    lifesWork: parsed.genius_sequence.life_work, evolution: parsed.genius_sequence.evolution,
    radiance: parsed.genius_sequence.radiance, purpose: parsed.genius_sequence.purpose,
    attraction: parsed.prosperity_sequence.attraction, iq: parsed.love_sequence.iq,
    eq: parsed.love_sequence.eq, sq: parsed.love_sequence.sq,
    vocation: parsed.prosperity_sequence.vocation, culture: parsed.prosperity_sequence.culture,
    pearl: parsed.prosperity_sequence.pearl, creativity: parsed.star_pearl.creativity,
    stability: parsed.star_pearl.stability, relating: parsed.star_pearl.relating,
  };
}

export function flattenCanonicalHumanDesignOutput(input: unknown) {
  const parsed = canonicalHumanDesignOutputSchema.parse(input);
  return {
    typeStrategy: parsed.core_foundation.type_strategy, authority: parsed.core_foundation.authority,
    profile: parsed.core_foundation.profile, definition: parsed.core_foundation.definition,
    centers: {
      head: parsed.energy_centers.head, ajna: parsed.energy_centers.ajna,
      throat: parsed.energy_centers.throat, g: parsed.energy_centers.g_center,
      heart: parsed.energy_centers.heart, spleen: parsed.energy_centers.spleen,
      sacral: parsed.energy_centers.sacral, solarPlexus: parsed.energy_centers.solar_plexus,
      root: parsed.energy_centers.root,
    },
    incarnationCross: parsed.additional_insights.incarnation_cross,
    notSelfTheme: parsed.additional_insights.not_self_theme,
    signature: parsed.additional_insights.signature,
  };
}
