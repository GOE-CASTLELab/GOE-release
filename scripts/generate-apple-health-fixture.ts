import path from "node:path";
import { SYNTHETIC_FIXTURE_DESCRIPTION, writeSyntheticAppleHealthZip } from "./apple-health-fixture";

const outputPath = path.resolve(process.argv[2] ?? "export.zip");
const proofDate = process.argv[3] ?? "2026-10-27";
await writeSyntheticAppleHealthZip(outputPath, proofDate);

console.log(JSON.stringify({ outputPath, proofDate, description: SYNTHETIC_FIXTURE_DESCRIPTION }, null, 2));
