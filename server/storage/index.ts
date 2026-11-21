// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
//
// Single local-disk object store. On both a person's own computer and their
// own cloud server, files stay beside the instance under the path they set in
// LOCAL_STORAGE_DIR. Call sites only talk to the ObjectStore interface.

import type { ObjectStore } from "./objectStore";
import { LocalObjectStore } from "./localObjectStore";

async function createObjectStore(): Promise<ObjectStore> {
  const rootDir = process.env.LOCAL_STORAGE_DIR || "../goe-data/files";
  console.log(`📦 Object storage: LOCAL DISK (${rootDir})`);
  return new LocalObjectStore(rootDir);
}

// Resolved once at startup (module load), cached as a promise so every
// caller awaits the same singleton instance.
let objectStorePromise: Promise<ObjectStore> | null = null;

export function getObjectStore(): Promise<ObjectStore> {
  if (!objectStorePromise) {
    objectStorePromise = createObjectStore();
  }
  return objectStorePromise;
}

// Kick off startup selection immediately so the mode/backend is picked at
// process start rather than on first request.
void getObjectStore();
