import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";

async function main() {
  const inputPath = process.argv[2];
  const storagePath = process.env.LOCAL_STORAGE_DIR;
  if (!inputPath || !storagePath || !path.isAbsolute(storagePath)) {
    throw new Error("Use: npm run setup:check-storage -- <path-to-small-handoff-file>. Set LOCAL_STORAGE_DIR to the full path in .env first.");
  }

  const input = await fs.readFile(inputPath);
  const { getObjectStore } = await import("../server/storage/index");
  const store = await getObjectStore();
  const key = `checks/setup-${randomUUID()}`;
  const testPath = path.join(storagePath, key);

  try {
    await store.save(key, input);
    assert.equal(await store.exists(key), true);
    assert.deepEqual(await store.read(key), input);
    console.log("GOE saved and read back the handoff file unchanged.");
  } finally {
    await fs.rm(testPath, { force: true });
    await fs.rmdir(path.dirname(testPath)).catch(error => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error;
    });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
