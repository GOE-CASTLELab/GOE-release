import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import { createApiRequestLogger } from "../server/apiRequestLogger";

const privateResponse = {
  profile: "PRIVATE_PROFILE_SENTINEL",
  cycle: "PRIVATE_CYCLE_SENTINEL",
  sleep: "PRIVATE_SLEEP_SENTINEL",
};
const lines: string[] = [];
let tick = 1_000;
const app = express();

app.use(createApiRequestLogger((line) => lines.push(line), () => tick++));
app.get("/api/private", (_req, res) => res.status(207).json(privateResponse));
app.get("/public", (_req, res) => res.json(privateResponse));

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

try {
  const { port } = server.address() as AddressInfo;
  const apiResponse = await fetch(`http://127.0.0.1:${port}/api/private`);
  assert.equal(apiResponse.status, 207);
  assert.deepEqual(await apiResponse.json(), privateResponse);

  const publicResponse = await fetch(`http://127.0.0.1:${port}/public`);
  assert.equal(publicResponse.status, 200);
  assert.deepEqual(await publicResponse.json(), privateResponse);

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(lines, ["GET /api/private 207 in 1ms"]);
  assert.doesNotMatch(lines.join("\n"), /PRIVATE_|profile|cycle|sleep|\{|\}/);
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log("API request logging keeps method, route, status and duration only.");

const privateLogSources = [
  "server/storage.ts",
  "server/routes/astrology.ts",
  "server/routes/practices.ts",
  "server/astroAppAuth.ts",
  "server/astrologyTransformations.ts",
].map((filename) => fs.readFileSync(filename, "utf8")).join("\n");
assert.doesNotMatch(privateLogSources, /console\.(?:log|warn|error)\([^\n]*(?:userId|data\.userId|cyclePhase|responseText|retryText)/);
assert.doesNotMatch(privateLogSources, /console\.log\([^\n]*(?:toISOString\(\)|API REQUEST to:|backup_cycle_data_)/);
console.log("Service diagnostic logs omit owner IDs, health positions, provider response bodies, request URLs, and record dates.");
