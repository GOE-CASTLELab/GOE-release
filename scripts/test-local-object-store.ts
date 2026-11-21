import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalObjectStore } from "../server/storage/localObjectStore";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "goe-storage-test-"));

try {
  const store = new LocalObjectStore(root);
  const key = "checks/read-back.txt";
  const expected = Buffer.from("GOE local storage read-back");

  await store.save(key, expected, "text/plain");
  assert.equal(await store.exists(key), true);
  assert.deepEqual(await store.read(key), expected);
  assert.equal(await store.read("checks/missing.txt"), null);
  await assert.rejects(() => store.save("../outside.txt", expected), /Invalid object key/);

  console.log("Local object storage: save, exists, read-back, missing-file, and path containment pass.");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
