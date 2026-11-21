import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { llmApiKey, sendClaude } from "../server/routes/shared";
import { parseStaticChartPackage } from "../shared/staticChartImport";
import {
  applyGeneKeysReadings,
  applyHumanDesignReadings,
  geneKeysReadingsSchema,
  humanDesignReadingsSchema,
  parseModelJson,
} from "../shared/staticChartReadings";
import {
  buildCanonicalGeneKeysPrompt,
  buildCanonicalHumanDesignPrompt,
  flattenCanonicalGeneKeysOutput,
  flattenCanonicalHumanDesignOutput,
} from "../setup/chart-prompts/canonical-chart-prompt-adapter";

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourcePath = path.resolve(valueAfter("--file") ?? "");
const outputPath = path.resolve(valueAfter("--output") ?? "");
const userId = valueAfter("--user-id") ?? process.env.OWNER_ID ?? process.env.OWNER_DID ?? "static-chart-generator";
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const only = valueAfter("--only") ?? "both";

if (!valueAfter("--file") || (!dryRun && !valueAfter("--output"))) {
  throw new Error("Usage: npm run generate:static-chart-readings -- --file /private/charts.json --output /private/charts-with-readings.json [--user-id <did>] [--only geneKeys|humanDesign|both] [--dry-run] [--overwrite]");
}
if (!new Set(["geneKeys", "humanDesign", "both"]).has(only)) throw new Error("--only must be geneKeys, humanDesign, or both.");

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const parsed = parseStaticChartPackage(source, userId);

if (dryRun) {
  console.log(JSON.stringify({ valid: true, geneKeys: Boolean(parsed.geneKeys), humanDesign: Boolean(parsed.humanDesign), providerCall: false }, null, 2));
  process.exit(0);
}

if (!overwrite) {
  try {
    await fs.access(outputPath);
    throw new Error(`Output already exists: ${outputPath}. Use --overwrite to replace it.`);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const key = llmApiKey();
if (!key) throw new Error("The configured LLM provider key is missing.");

const output = { ...source };
const summary: Record<string, unknown> = {};
const preserveProviderResponse = async (chart: "gene-keys" | "human-design", raw: string) => {
  const archivePath = `${outputPath}.${chart}.provider-response.txt`;
  await fs.writeFile(archivePath, raw, { mode: 0o600 });
  await fs.chmod(archivePath, 0o600);
};

if (parsed.geneKeys && only !== "humanDesign") {
  const raw = await sendClaude(buildCanonicalGeneKeysPrompt(parsed.geneKeys), key);
  await preserveProviderResponse("gene-keys", raw);
  const readings = geneKeysReadingsSchema.parse(flattenCanonicalGeneKeysOutput(parseModelJson(raw)));
  output.geneKeys = applyGeneKeysReadings(parsed.geneKeys, readings);
  const lengths = Object.values(readings).map((value) => value.length);
  summary.geneKeys = { containers: lengths.length, minCharacters: Math.min(...lengths), maxCharacters: Math.max(...lengths) };
}

if (parsed.humanDesign && only !== "geneKeys") {
  const raw = await sendClaude(buildCanonicalHumanDesignPrompt(parsed.humanDesign), key);
  await preserveProviderResponse("human-design", raw);
  const readings = humanDesignReadingsSchema.parse(flattenCanonicalHumanDesignOutput(parseModelJson(raw)));
  output.humanDesign = applyHumanDesignReadings(parsed.humanDesign, readings);
  const lengths = [
    readings.typeStrategy, readings.authority, readings.profile, readings.definition,
    ...Object.values(readings.centers), readings.incarnationCross, readings.notSelfTheme, readings.signature,
  ].map((value) => value.length);
  summary.humanDesign = { containers: lengths.length, minCharacters: Math.min(...lengths), maxCharacters: Math.max(...lengths) };
}

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
await fs.chmod(outputPath, 0o600);
console.log(JSON.stringify({ output: outputPath, ...summary }, null, 2));
