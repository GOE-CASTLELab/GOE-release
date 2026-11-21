import { z } from "zod";
import { insertGeneKeysSchema, insertHumanDesignSchema } from "./schema";

const chartPackageSchema = z.object({
  version: z.literal(1),
  geneKeys: z.record(z.string(), z.unknown()).optional(),
  humanDesign: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => value.geneKeys || value.humanDesign, {
  message: "The chart package must contain geneKeys, humanDesign, or both.",
});

export function parseStaticChartPackage(input: unknown, userId: string) {
  if (!userId.trim()) throw new Error("A user ID is required for chart import.");
  const chartPackage = chartPackageSchema.parse(input);
  return {
    version: chartPackage.version,
    geneKeys: chartPackage.geneKeys
      ? insertGeneKeysSchema.parse({ ...chartPackage.geneKeys, userId })
      : undefined,
    humanDesign: chartPackage.humanDesign
      ? insertHumanDesignSchema.parse({ ...chartPackage.humanDesign, userId })
      : undefined,
  };
}

export function chartImportSummary(parsed: ReturnType<typeof parseStaticChartPackage>) {
  return {
    version: parsed.version,
    geneKeys: Boolean(parsed.geneKeys),
    humanDesign: Boolean(parsed.humanDesign),
  };
}
