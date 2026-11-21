// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { ObjectStore } from "../storage/objectStore";
import {
  calculateMeasuredSleepPhaseAverages,
  openAppleHealthXml,
  parseAppleHealthXml,
  type ApplePeriod,
  type NormalizedAppleHealth,
  type SleepPhaseAverage,
} from "./appleHealth";

export interface AppleImportWriteResult {
  duplicate: boolean;
  cyclePeriodsWritten: number;
  sleepNightsInserted: number;
  sleepNightsUpdated: number;
}

export interface AppleHealthRepository {
  findImport(userId: string, sha256: string): Promise<boolean>;
  writeImport(input: {
    userId: string;
    sha256: string;
    fileName: string;
    objectKey: string;
    normalized: NormalizedAppleHealth;
    phaseAverages: SleepPhaseAverage[];
  }): Promise<AppleImportWriteResult>;
}

export interface AppleHealthImportResult extends AppleImportWriteResult {
  sha256: string;
  objectKey: string;
  cycleLength: number;
  phaseAverages: SleepPhaseAverage[];
  sourceCounts: NormalizedAppleHealth["sourceCounts"];
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function mergePeriods(existing: unknown, incoming: ApplePeriod[]): ApplePeriod[] {
  const byStart = new Map<string, ApplePeriod>();
  if (Array.isArray(existing)) {
    for (const value of existing) {
      if (!value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      if (typeof record.startDate !== "string") continue;
      byStart.set(record.startDate, {
        startDate: record.startDate,
        endDate: typeof record.endDate === "string" ? record.endDate : null,
      });
    }
  }
  for (const period of incoming) {
    const current = byStart.get(period.startDate);
    byStart.set(period.startDate, { ...period, endDate: period.endDate ?? current?.endDate ?? null });
  }
  return [...byStart.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export class PostgresAppleHealthRepository implements AppleHealthRepository {
  constructor(private readonly pool: Pool) {}

  async findImport(userId: string, sha256: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM file_uploads
        WHERE user_id = $1
          AND file_type = 'application/vnd.apple.health+zip'
          AND processed_data->>'sha256' = $2
        LIMIT 1`,
      [userId, sha256],
    );
    return result.rowCount === 1;
  }

  async writeImport(input: {
    userId: string;
    sha256: string;
    fileName: string;
    objectKey: string;
    normalized: NormalizedAppleHealth;
    phaseAverages: SleepPhaseAverage[];
  }): Promise<AppleImportWriteResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${input.userId}:${input.sha256}`]);
      const existingImport = await client.query(
        `SELECT 1 FROM file_uploads
          WHERE user_id = $1
            AND file_type = 'application/vnd.apple.health+zip'
            AND processed_data->>'sha256' = $2
          LIMIT 1`,
        [input.userId, input.sha256],
      );
      if (existingImport.rowCount === 1) {
        await client.query("COMMIT");
        return { duplicate: true, cyclePeriodsWritten: 0, sleepNightsInserted: 0, sleepNightsUpdated: 0 };
      }

      const cyclePeriodsWritten = await this.writeCycle(client, input.userId, input.normalized);
      let sleepNightsInserted = 0;
      let sleepNightsUpdated = 0;
      for (const night of input.normalized.sleepNights) {
        const existing = await client.query(
          `SELECT id FROM sleep_data WHERE user_id = $1 AND sleep_date = $2 ORDER BY created_at LIMIT 1`,
          [input.userId, night.sleepDate],
        );
        const metrics = {
          source: "apple_health",
          importSha256: input.sha256,
          totalSleepMinutes: night.totalSleepMinutes,
          awakeMinutes: night.awakeMinutes,
          stageMinutes: night.stageMinutes,
        };
        if (existing.rowCount) {
          await client.query(
            `UPDATE sleep_data
                SET bedtime = $1, wake_time = $2, sleep_metrics = $3
              WHERE id = $4`,
            [night.bedtime, night.wakeTime, JSON.stringify(metrics), existing.rows[0].id],
          );
          sleepNightsUpdated += 1;
        } else {
          await client.query(
            `INSERT INTO sleep_data (user_id, sleep_date, bedtime, wake_time, sleep_metrics)
             VALUES ($1, $2, $3, $4, $5)`,
            [input.userId, night.sleepDate, night.bedtime, night.wakeTime, JSON.stringify(metrics)],
          );
          sleepNightsInserted += 1;
        }
      }

      await client.query(
        `INSERT INTO file_uploads (user_id, file_name, file_type, file_path, processed_data)
         VALUES ($1, $2, 'application/vnd.apple.health+zip', $3, $4)`,
        [input.userId, input.fileName, input.objectKey, JSON.stringify({
          adapter: "apple_health_v1",
          sha256: input.sha256,
          periods: input.normalized.periods.length,
          sleepNights: input.normalized.sleepNights.length,
          phaseAverages: input.phaseAverages,
          sourceCounts: input.normalized.sourceCounts,
        })],
      );
      await client.query("COMMIT");
      return { duplicate: false, cyclePeriodsWritten, sleepNightsInserted, sleepNightsUpdated };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async writeCycle(client: PoolClient, userId: string, normalized: NormalizedAppleHealth): Promise<number> {
    if (!normalized.periods.length) return 0;
    const existing = await client.query(
      `SELECT id, period_data FROM cycle_data
        WHERE user_id = $1 ORDER BY last_updated DESC NULLS LAST LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const periods = mergePeriods(existing.rows[0]?.period_data, normalized.periods);
    const latest = periods.at(-1)!;
    if (existing.rowCount) {
      await client.query(
        `UPDATE cycle_data
            SET cycle_start_date = $1, cycle_length = $2, period_end_date = $3,
                period_data = $4, last_updated = now()
          WHERE id = $5`,
        [latest.startDate, normalized.cycleLength, latest.endDate, JSON.stringify(periods), existing.rows[0].id],
      );
    } else {
      await client.query(
        `INSERT INTO cycle_data
          (user_id, cycle_start_date, cycle_length, period_end_date, period_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, latest.startDate, normalized.cycleLength, latest.endDate, JSON.stringify(periods)],
      );
    }
    return normalized.periods.length;
  }
}

export async function importAppleHealth(input: {
  userId: string;
  sourcePath: string;
  objectStore: ObjectStore;
  repository: AppleHealthRepository;
}): Promise<AppleHealthImportResult> {
  const sha256 = await hashFile(input.sourcePath);
  const extension = path.extname(input.sourcePath).toLowerCase() === ".xml" ? ".xml" : ".zip";
  const objectKey = `.private/health-imports/${input.userId.replace(/[^a-zA-Z0-9._-]/g, "_")}/${sha256}${extension}`;
  if (await input.repository.findImport(input.userId, sha256)) {
    return {
      duplicate: true,
      cyclePeriodsWritten: 0,
      sleepNightsInserted: 0,
      sleepNightsUpdated: 0,
      sha256,
      objectKey,
      cycleLength: 0,
      phaseAverages: [],
      sourceCounts: { menstrualFlow: 0, sleepAnalysis: 0, ignored: 0 },
    };
  }

  await input.objectStore.saveStream(
    objectKey,
    fs.createReadStream(input.sourcePath),
    extension === ".zip" ? "application/zip" : "application/xml",
  );
  const normalized = await parseAppleHealthXml(await openAppleHealthXml(input.sourcePath));
  const phaseAverages = calculateMeasuredSleepPhaseAverages(
    normalized.periods,
    normalized.sleepNights,
    normalized.cycleLength,
  );
  const written = await input.repository.writeImport({
    userId: input.userId,
    sha256,
    fileName: path.basename(input.sourcePath),
    objectKey,
    normalized,
    phaseAverages,
  });
  return {
    ...written,
    sha256,
    objectKey,
    cycleLength: normalized.cycleLength,
    phaseAverages,
    sourceCounts: normalized.sourceCounts,
  };
}
