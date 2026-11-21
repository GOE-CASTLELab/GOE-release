// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
//
// Object storage interface. The app talks to one surface and never reaches
// into the filesystem directly. The implementation stores files on the
// person's own machine or cloud server under LOCAL_STORAGE_DIR.
//
// Method set is intentionally small — it matches exactly what the current
// call sites use across server/storage.ts and server/routes/practices.ts:
//   - save     : write bytes under a key (cycle-data backup)
//   - read     : read bytes back (cycle-data backup restore)
//   - exists   : existence check before serving a practice file
//   - download : stream a stored object to an Express response, with HTTP
//                Range support

import type { Response } from "express";
import type { Readable } from "node:stream";

export interface DownloadOptions {
  /** Byte range for partial content (video seeking). Omit for a full download. */
  range?: { start: number; end?: number };
}

export interface ObjectStore {
  /** Write bytes under `key`. Overwrites if the key already exists. */
  save(key: string, data: Buffer, contentType?: string): Promise<void>;

  /** Stream bytes under `key` without loading a large import into memory. */
  saveStream(key: string, data: Readable, contentType?: string): Promise<void>;

  /** Read bytes back, or `null` if the key doesn't exist. */
  read(key: string): Promise<Buffer | null>;

  /** Whether an object exists under `key`. */
  exists(key: string): Promise<boolean>;

  /**
   * Stream the object at `key` to an Express response, setting
   * Content-Type/Content-Length/Range headers as appropriate. Writes a 404
   * JSON response if the key doesn't exist, or a 500 on stream error.
   */
  download(key: string, res: Response, options?: DownloadOptions): Promise<void>;
}
