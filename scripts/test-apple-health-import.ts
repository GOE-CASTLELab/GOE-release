import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalObjectStore } from "../server/storage/localObjectStore";
import { openAppleHealthXml, parseAppleHealthXml } from "../server/health/appleHealth";
import {
  importAppleHealth,
  type AppleHealthRepository,
  type AppleImportWriteResult,
} from "../server/health/appleHealthImport";
import { writeSyntheticAppleHealthZip } from "./apple-health-fixture";

class MemoryRepository implements AppleHealthRepository {
  readonly hashes = new Set<string>();
  lastInput: Parameters<AppleHealthRepository["writeImport"]>[0] | null = null;

  async findImport(_userId: string, sha256: string): Promise<boolean> {
    return this.hashes.has(sha256);
  }

  async writeImport(input: Parameters<AppleHealthRepository["writeImport"]>[0]): Promise<AppleImportWriteResult> {
    if (this.hashes.has(input.sha256)) {
      return { duplicate: true, cyclePeriodsWritten: 0, sleepNightsInserted: 0, sleepNightsUpdated: 0 };
    }
    this.hashes.add(input.sha256);
    this.lastInput = input;
    return {
      duplicate: false,
      cyclePeriodsWritten: input.normalized.periods.length,
      sleepNightsInserted: input.normalized.sleepNights.length,
      sleepNightsUpdated: 0,
    };
  }
}

const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goe-apple-health-test-"));
try {
  const archivePath = path.join(root, "export.zip");
  const storagePath = path.join(root, "storage");
  await writeSyntheticAppleHealthZip(archivePath, "2026-10-27");

  const normalized = await parseAppleHealthXml(await openAppleHealthXml(archivePath));
  assert.deepEqual(normalized.periods.map((period) => period.startDate), [
    "2026-07-07", "2026-08-04", "2026-09-02", "2026-09-29", "2026-10-27",
  ]);
  assert.equal(normalized.cycleLength, 28);
  assert.equal(normalized.sleepNights.length, 20);
  assert.deepEqual(normalized.sourceCounts, { menstrualFlow: 19, sleepAnalysis: 120, ignored: 1 });

  const repository = new MemoryRepository();
  const store = new LocalObjectStore(storagePath);
  const first = await importAppleHealth({
    userId: "synthetic-adult",
    sourcePath: archivePath,
    objectStore: store,
    repository,
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.cyclePeriodsWritten, 5);
  assert.equal(first.sleepNightsInserted, 20);
  assert.deepEqual(first.phaseAverages, [
    { phase: "Menstruation", averageMinutes: 500, nights: 4 },
    { phase: "Follicular", averageMinutes: 465, nights: 4 },
    { phase: "Ovulatory", averageMinutes: 450, nights: 4 },
    { phase: "Luteal", averageMinutes: 488, nights: 8 },
  ]);
  assert.equal(await store.exists(first.objectKey), true);
  assert.deepEqual(await store.read(first.objectKey), await fs.promises.readFile(archivePath));

  const second = await importAppleHealth({
    userId: "synthetic-adult",
    sourcePath: archivePath,
    objectStore: store,
    repository,
  });
  assert.equal(second.duplicate, true);
  assert.equal(second.cyclePeriodsWritten, 0);
  assert.equal(second.sleepNightsInserted, 0);
  assert.equal(repository.hashes.size, 1);
} finally {
  await fs.promises.rm(root, { recursive: true, force: true });
}

console.log("Apple export.zip parse, normalization, raw retention, phase averages, and duplicate-safe reimport: pass");
