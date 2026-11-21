// Synthetic Apple Health fixture for adapter proof. Contains no personal data.

import fs from "node:fs";
import path from "node:path";
import yazl from "yazl";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function appleDate(date: Date): string {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 19)} -0600`;
}

function stageRecord(stage: string, start: Date, minutes: number): { xml: string; end: Date } {
  const end = new Date(start.valueOf() + minutes * 60_000);
  return {
    xml: ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Synthetic Apple Watch" sourceVersion="11.0" unit="" creationDate="${appleDate(end)}" startDate="${appleDate(start)}" endDate="${appleDate(end)}" value="HKCategoryValueSleepAnalysis${stage}"/>`,
    end,
  };
}

function sleepRecords(date: string, totalMinutes: number): string[] {
  const bedtime = new Date(`${date}T22:30:00Z`);
  const inBedEnd = new Date(bedtime.valueOf() + (totalMinutes + 15) * 60_000);
  const records = [
    ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Synthetic iPhone" sourceVersion="18.0" unit="" creationDate="${appleDate(inBedEnd)}" startDate="${appleDate(bedtime)}" endDate="${appleDate(inBedEnd)}" value="HKCategoryValueSleepAnalysisInBed"/>`,
  ];
  const deep = Math.round(totalMinutes * 0.18);
  const rem = Math.round(totalMinutes * 0.22);
  const coreA = Math.round((totalMinutes - deep - rem) * 0.52);
  const coreB = totalMinutes - deep - rem - coreA;
  let cursor = bedtime;
  for (const [stage, minutes] of [
    ["AsleepCore", coreA], ["AsleepDeep", deep], ["Awake", 15],
    ["AsleepCore", coreB], ["AsleepREM", rem],
  ] as const) {
    const record = stageRecord(stage, cursor, minutes);
    records.push(record.xml);
    cursor = record.end;
  }
  return records;
}

export function buildSyntheticAppleHealthXml(proofDate = "2026-10-27"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(proofDate)) throw new Error("proofDate must be YYYY-MM-DD");
  const intervals = [28, 29, 27, 28];
  const starts = [proofDate];
  for (const interval of intervals.toReversed()) starts.unshift(addDays(starts[0], -interval));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE HealthData>',
    '<HealthData locale="en_CA">',
    ' <ExportDate value="2026-10-27 12:00:00 -0600"/>',
  ];

  starts.forEach((startDate, cycleIndex) => {
    const flowDays = cycleIndex % 2 === 0 ? 5 : 4;
    for (let day = 0; day < flowDays; day += 1) {
      const date = addDays(startDate, day);
      const value = day === 0 ? "Medium" : day < 3 ? "Light" : "Unspecified";
      if (date > proofDate) continue;
      lines.push(
        ` <Record type="HKCategoryTypeIdentifierMenstrualFlow" sourceName="Synthetic Health" sourceVersion="18.0" unit="" creationDate="${date} 09:00:00 -0600" startDate="${date} 08:00:00 -0600" endDate="${date} 08:00:00 -0600" value="HKCategoryValueMenstrualFlow${value}">`,
        `  <MetadataEntry key="HKMenstrualCycleStart" value="${day === 0 ? "1" : "0"}"/>`,
        " </Record>",
      );
    }
    const variation = [-10, 5, -5, 10, 0][cycleIndex] ?? 0;
    const phaseNights = [
      { day: 1, minutes: 500 + variation },
      { day: 7, minutes: 465 + variation },
      { day: 13, minutes: 450 + variation },
      { day: 19, minutes: 480 + variation },
      { day: 24, minutes: 495 + variation },
    ];
    for (const night of phaseNights) {
      const date = addDays(startDate, night.day);
      if (date <= proofDate) lines.push(...sleepRecords(date, night.minutes));
    }
  });

  lines.push(
    ' <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Synthetic Apple Watch" sourceVersion="11.0" unit="count/min" creationDate="2026-10-27 08:00:00 -0600" startDate="2026-10-27 08:00:00 -0600" endDate="2026-10-27 08:00:05 -0600" value="68"/>',
    "</HealthData>",
  );
  return `${lines.join("\n")}\n`;
}

export const SYNTHETIC_FIXTURE_DESCRIPTION =
  "Synthetic adult demo history: five cycle starts with 27–29 day variation and measured sleep-stage records across each phase.";

export async function writeSyntheticAppleHealthZip(outputPath: string, proofDate = "2026-10-27"): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(buildSyntheticAppleHealthXml(proofDate)), "apple_health_export/export.xml");
  zip.end();
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath, { mode: 0o600 });
    zip.outputStream.pipe(output).on("close", resolve).on("error", reject);
  });
}
