// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import yauzl from "yauzl";
import { SaxesParser, type SaxesTagPlain } from "saxes";
import { cyclePhaseForDay, type CyclePhase } from "@shared/cycleCore";

const MENSTRUAL_FLOW = "HKCategoryTypeIdentifierMenstrualFlow";
const SLEEP_ANALYSIS = "HKCategoryTypeIdentifierSleepAnalysis";
const CYCLE_START_KEY = "HKMenstrualCycleStart";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export interface ApplePeriod {
  startDate: string;
  endDate: string | null;
}

export interface AppleSleepNight {
  sleepDate: string;
  bedtime: string;
  wakeTime: string;
  totalSleepMinutes: number;
  awakeMinutes: number;
  stageMinutes: Record<string, number>;
}

export interface NormalizedAppleHealth {
  periods: ApplePeriod[];
  cycleLength: number;
  sleepNights: AppleSleepNight[];
  sourceCounts: { menstrualFlow: number; sleepAnalysis: number; ignored: number };
}

export interface SleepPhaseAverage {
  phase: "Menstruation" | "Follicular" | "Ovulatory" | "Luteal";
  averageMinutes: number | null;
  nights: number;
}

interface RawRecord {
  type: string;
  attributes: Record<string, string>;
  metadata: Record<string, string>;
}

interface Interval {
  start: Date;
  end: Date;
  rawStart: string;
  rawEnd: string;
  stage: string;
}

function attributes(tag: SaxesTagPlain): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tag.attributes).map(([key, value]) => {
      const attribute: unknown = value;
      return [key, typeof attribute === "string" ? attribute : (attribute as { value: string }).value];
    }),
  );
}

function parseAppleDate(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error(`Unsupported Apple Health date: ${value}`);
  const parsed = new Date(`${match[1]}T${match[2]}${match[3]}${match[4]}:${match[5]}`);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid Apple Health date: ${value}`);
  return parsed;
}

function localDate(value: string): string {
  return value.slice(0, 10);
}

function localTime(value: string): string {
  return value.slice(11, 19);
}

function dateDistanceDays(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function sleepStage(value: string): string | null {
  const prefix = "HKCategoryValueSleepAnalysis";
  if (!value.startsWith(prefix)) return null;
  const stage = value.slice(prefix.length);
  return stage || null;
}

function unionMinutes(intervals: Interval[]): number {
  const ranges = intervals
    .filter((interval) => interval.end > interval.start)
    .map((interval) => [interval.start.valueOf(), interval.end.valueOf()] as const)
    .sort((a, b) => a[0] - b[0]);
  if (ranges.length === 0) return 0;
  let total = 0;
  let [start, end] = ranges[0];
  for (const [nextStart, nextEnd] of ranges.slice(1)) {
    if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      total += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  total += end - start;
  return Math.round(total / 60_000);
}

function normalizePeriods(flowRecords: RawRecord[]): ApplePeriod[] {
  const active = flowRecords.filter((record) => !record.attributes.value.endsWith("None"));
  const starts = active
    .filter((record) => ["1", "true", "YES"].includes(record.metadata[CYCLE_START_KEY]))
    .map((record) => localDate(record.attributes.startDate))
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();

  return starts.map((startDate, index) => {
    const nextStart = starts[index + 1];
    const candidates = active.filter((record) => {
      const date = localDate(record.attributes.startDate);
      const distance = dateDistanceDays(startDate, date);
      return distance >= 0 && distance <= 10 && (!nextStart || date < nextStart);
    });
    const endDate = candidates
      .flatMap((record) => [localDate(record.attributes.startDate), localDate(record.attributes.endDate)])
      .sort()
      .at(-1) ?? null;
    return { startDate, endDate };
  });
}

function normalizeSleep(records: RawRecord[]): AppleSleepNight[] {
  const intervals: Interval[] = records.flatMap((record) => {
    const stage = sleepStage(record.attributes.value);
    if (!stage) return [];
    const start = parseAppleDate(record.attributes.startDate);
    const end = parseAppleDate(record.attributes.endDate);
    if (end <= start) return [];
    return [{ start, end, rawStart: record.attributes.startDate, rawEnd: record.attributes.endDate, stage }];
  });
  intervals.sort((a, b) => a.start.valueOf() - b.start.valueOf());

  const episodes: Interval[][] = [];
  for (const interval of intervals) {
    const episode = episodes.at(-1);
    const latestEnd = episode?.reduce((latest, item) => Math.max(latest, item.end.valueOf()), 0) ?? 0;
    if (!episode || interval.start.valueOf() > latestEnd + FOUR_HOURS_MS) episodes.push([interval]);
    else episode.push(interval);
  }

  const nights = episodes.flatMap((episode): AppleSleepNight[] => {
    const asleep = episode.filter((item) =>
      ["Asleep", "AsleepUnspecified", "AsleepCore", "AsleepDeep", "AsleepREM"].includes(item.stage),
    );
    const totalSleepMinutes = unionMinutes(asleep);
    if (totalSleepMinutes < 120) return [];
    const first = episode.reduce((earliest, item) => item.start < earliest.start ? item : earliest);
    const last = episode.reduce((latest, item) => item.end > latest.end ? item : latest);
    const stages = ["AsleepUnspecified", "AsleepCore", "AsleepDeep", "AsleepREM"];
    const stageMinutes = Object.fromEntries(
      stages.map((stage) => [stage, unionMinutes(episode.filter((item) => item.stage === stage))]),
    );
    return [{
      sleepDate: localDate(first.rawStart),
      bedtime: localTime(first.rawStart),
      wakeTime: localTime(last.rawEnd),
      totalSleepMinutes,
      awakeMinutes: unionMinutes(episode.filter((item) => item.stage === "Awake")),
      stageMinutes,
    }];
  });

  const longestByDate = new Map<string, AppleSleepNight>();
  for (const night of nights) {
    const current = longestByDate.get(night.sleepDate);
    if (!current || night.totalSleepMinutes > current.totalSleepMinutes) longestByDate.set(night.sleepDate, night);
  }
  return [...longestByDate.values()].sort((a, b) => a.sleepDate.localeCompare(b.sleepDate));
}

function averageCycleLength(periods: ApplePeriod[]): number {
  const intervals = periods.slice(1).map((period, index) => dateDistanceDays(periods[index].startDate, period.startDate));
  const valid = intervals.filter((days) => days >= 15 && days <= 90);
  if (valid.length === 0) return 28;
  return Math.round(valid.reduce((sum, days) => sum + days, 0) / valid.length);
}

export async function parseAppleHealthXml(stream: Readable): Promise<NormalizedAppleHealth> {
  const flowRecords: RawRecord[] = [];
  const sleepRecords: RawRecord[] = [];
  const sourceCounts = { menstrualFlow: 0, sleepAnalysis: 0, ignored: 0 };
  let current: RawRecord | null = null;

  const parser = new SaxesParser({ xmlns: false });
  parser.on("opentag", (tag) => {
    if (tag.name === "Record") {
      const attrs = attributes(tag);
      if (attrs.type === MENSTRUAL_FLOW || attrs.type === SLEEP_ANALYSIS) {
        current = { type: attrs.type, attributes: attrs, metadata: {} };
      } else {
        sourceCounts.ignored += 1;
      }
    } else if (tag.name === "MetadataEntry" && current) {
      const attrs = attributes(tag);
      if (attrs.key) current.metadata[attrs.key] = attrs.value ?? "";
    }
  });
  parser.on("closetag", (tag) => {
    if (tag.name !== "Record" || !current) return;
    if (current.type === MENSTRUAL_FLOW) {
      flowRecords.push(current);
      sourceCounts.menstrualFlow += 1;
    } else {
      sleepRecords.push(current);
      sourceCounts.sleepAnalysis += 1;
    }
    current = null;
  });

  for await (const chunk of stream) parser.write(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  parser.close();

  const periods = normalizePeriods(flowRecords);
  return {
    periods,
    cycleLength: averageCycleLength(periods),
    sleepNights: normalizeSleep(sleepRecords),
    sourceCounts,
  };
}

export function calculateMeasuredSleepPhaseAverages(
  periods: ApplePeriod[],
  nights: AppleSleepNight[],
  fallbackCycleLength = 28,
): SleepPhaseAverage[] {
  const buckets = new Map<SleepPhaseAverage["phase"], number[]>([
    ["Menstruation", []], ["Follicular", []], ["Ovulatory", []], ["Luteal", []],
  ]);
  for (const night of nights) {
    const startIndex = periods.findLastIndex((period) => period.startDate <= night.sleepDate);
    if (startIndex < 0) continue;
    const start = periods[startIndex].startDate;
    const next = periods[startIndex + 1]?.startDate;
    const cycleLength = next ? dateDistanceDays(start, next) : fallbackCycleLength;
    const day = dateDistanceDays(start, night.sleepDate) + 1;
    if (day < 1 || day > cycleLength) continue;
    const canonical: CyclePhase = cyclePhaseForDay(day, cycleLength);
    const phase = canonical === "Early Luteal" || canonical === "Late Luteal" ? "Luteal" : canonical;
    if (phase === "Unknown") continue;
    buckets.get(phase)?.push(night.totalSleepMinutes);
  }
  return [...buckets].map(([phase, values]) => ({
    phase,
    averageMinutes: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    nights: values.length,
  }));
}

export function openAppleHealthXml(sourcePath: string): Promise<Readable> {
  if (path.extname(sourcePath).toLowerCase() === ".xml") return Promise.resolve(fs.createReadStream(sourcePath));
  if (path.extname(sourcePath).toLowerCase() !== ".zip") {
    return Promise.reject(new Error("Apple Health import must be an export.zip or export.xml file."));
  }
  return new Promise((resolve, reject) => {
    yauzl.open(sourcePath, { lazyEntries: true, autoClose: false }, (openError, zip) => {
      if (openError || !zip) return reject(openError ?? new Error("Could not open Apple Health archive."));
      let found = false;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        const normalized = entry.fileName.replace(/^\/+/, "");
        if (normalized === "apple_health_export/export.xml" || normalized.endsWith("/apple_health_export/export.xml")) {
          found = true;
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) return reject(streamError ?? new Error("Could not read export.xml."));
            stream.once("end", () => zip.close());
            stream.once("error", () => zip.close());
            resolve(stream);
          });
        } else {
          zip.readEntry();
        }
      });
      zip.on("end", () => {
        if (!found) reject(new Error("export.zip does not contain apple_health_export/export.xml."));
      });
      zip.readEntry();
    });
  });
}
