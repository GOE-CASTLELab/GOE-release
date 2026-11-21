import { z } from "zod";

const reading = z.string().trim().min(300).max(1000);

export const geneKeysReadingsSchema = z.object({
  lifesWork: reading,
  evolution: reading,
  radiance: reading,
  purpose: reading,
  attraction: reading,
  iq: reading,
  eq: reading,
  sq: reading,
  vocation: reading,
  culture: reading,
  pearl: reading,
  creativity: reading,
  stability: reading,
  relating: reading,
}).strict();

export const humanDesignReadingsSchema = z.object({
  typeStrategy: reading,
  authority: reading,
  profile: reading,
  definition: reading,
  centers: z.object({
    head: reading,
    ajna: reading,
    throat: reading,
    g: reading,
    heart: reading,
    spleen: reading,
    sacral: reading,
    solarPlexus: reading,
    root: reading,
  }).strict(),
  incarnationCross: reading,
  notSelfTheme: reading,
  signature: reading,
}).strict();

export function parseModelJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The reading generator returned no JSON object.");
  return JSON.parse(match[0]);
}

function withContent(value: any, content: string) {
  return { ...(value ?? {}), content };
}

export function applyGeneKeysReadings(geneKeys: any, readings: z.infer<typeof geneKeysReadingsSchema>) {
  const coreKeys = [
    "lifesWork", "evolution", "radiance", "purpose", "attraction", "iq", "eq", "sq",
    "vocation", "culture", "pearl",
  ] as const;
  const updated = { ...geneKeys };
  for (const key of coreKeys) updated[key] = withContent(geneKeys[key], readings[key]);

  const starContent: Record<string, string> = {
    brand: readings.lifesWork,
    creativity: readings.creativity,
    pearl: readings.pearl,
    culture: readings.culture,
    stability: readings.stability,
    vocation: readings.vocation,
    relating: readings.relating,
  };
  updated.harmonySequence = (geneKeys.harmonySequence ?? []).map((sphere: any) => {
    const content = starContent[String(sphere?.title ?? "").toLowerCase()];
    if (!content) throw new Error(`Unknown Star Pearl role: ${sphere?.title ?? "missing"}`);
    return withContent(sphere, content);
  });
  if (updated.harmonySequence.length !== 7) throw new Error("Star Pearl must contain seven ordered roles.");
  return updated;
}

export function applyHumanDesignReadings(humanDesign: any, readings: z.infer<typeof humanDesignReadingsSchema>) {
  const centers = { ...humanDesign.centers };
  for (const [key, content] of Object.entries(readings.centers)) {
    if (!centers[key]) throw new Error(`Human Design center is missing: ${key}`);
    centers[key] = withContent(centers[key], content);
  }
  return {
    ...humanDesign,
    typeStrategyInterpretation: withContent(humanDesign.typeStrategyInterpretation, readings.typeStrategy),
    authorityInterpretation: withContent(humanDesign.authorityInterpretation, readings.authority),
    profileInterpretation: withContent(humanDesign.profileInterpretation, readings.profile),
    definitionInterpretation: withContent(humanDesign.definitionInterpretation, readings.definition),
    centers,
    incarnationCrossInterpretation: withContent(humanDesign.incarnationCrossInterpretation, readings.incarnationCross),
    notSelfThemeInterpretation: withContent(humanDesign.notSelfThemeInterpretation, readings.notSelfTheme),
    signatureInterpretation: withContent(humanDesign.signatureInterpretation, readings.signature),
  };
}
