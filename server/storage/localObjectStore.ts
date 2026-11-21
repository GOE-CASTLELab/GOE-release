// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
//
// LOCAL DISK object store. Reads/writes live under LOCAL_STORAGE_DIR.
// It is plain node:fs and runs the same way on a person's own computer or
// on their own cloud server.

import fs from "fs";
import path from "path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { Response } from "express";
import type { DownloadOptions, ObjectStore } from "./objectStore";

export class LocalObjectStore implements ObjectStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private resolvePath(key: string): string {
    // Keys are logical paths like "videos/foo.mp4" or ".private/backup_x.json".
    // Normalize and keep them contained under rootDir.
    const safeKey = key.replace(/^\/+/, "");
    const resolved = path.resolve(this.rootDir, safeKey);
    const rootResolved = path.resolve(this.rootDir);
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new Error(`Invalid object key: ${key}`);
    }
    return resolved;
  }

  async save(key: string, data: Buffer, _contentType?: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  async saveStream(key: string, data: Readable, _contentType?: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(data, fs.createWriteStream(filePath, { mode: 0o600 }));
  }

  async read(key: string): Promise<Buffer | null> {
    const filePath = this.resolvePath(key);
    try {
      return await fs.promises.readFile(filePath);
    } catch (error: any) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async download(key: string, res: Response, options?: DownloadOptions): Promise<void> {
    const filePath = this.resolvePath(key);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const contentType = guessContentType(filePath);

    try {
      if (options?.range) {
        const { start, end: rawEnd } = options.range;
        const end = rawEnd ?? stat.size - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set({
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        stream.pipe(res);
      } else {
        res.set({
          "Content-Type": contentType,
          "Content-Length": stat.size,
        });

        const stream = fs.createReadStream(filePath);
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        stream.pipe(res);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4":
      return "video/mp4";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
