import type { RetrogradeMovement } from "./astrologyBoundaries";

// Provider documentation: https://documenter.getpostman.com/view/1590333/2s8YzUw1vr
// Ingresses supply exactJD. Stations are bracketed from dated /chart speeds;
// they are derived to one-minute precision, not provider-supplied exact events.
export const CHIRON_MOVEMENT_VERSION = "astroapp-chiron.v1";
export const CHIRON_REQUEST_LIMIT = 80;
const DAY = 86_400_000;
const PRECISION_MS = 60_000;
const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
export type AstroAppRequest = (
  url: string,
  options: RequestInit,
) => Promise<any>;
type Position = { lng: number; speed: number };
type Sample = Position & { at: string };
type Station = { before: Sample; after: Sample; at: string };
export interface ChironMovementRecord {
  version: typeof CHIRON_MOVEMENT_VERSION;
  retrogradeStation: Station;
  directStation: Station;
  movement: RetrogradeMovement;
}

export function skyInstant(chartData: any, fallback: Date): Date {
  const jd = Number(chartData?.jd);
  if (Number.isFinite(jd) && jd > 2_000_000)
    return new Date((jd - 2440587.5) * DAY);
  const date = chartData?.chartDate;
  if (typeof date !== "string") return fallback;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(date)) return new Date(date);
  if (!chartData.tz) return fallback;
  // AstroApp commonly echoes jd:0 and a timezone-less local chartDate. Resolve
  // that wall clock in its supplied IANA zone, never in the server's zone.
  const wall = Date.parse(`${date}Z`);
  if (!Number.isFinite(wall)) throw new Error("Invalid AstroApp chart date");
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: chartData.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = wall;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(
      format
        .formatToParts(new Date(candidate))
        .map((part) => [part.type, part.value]),
    );
    const represented = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
    const adjustment = wall - represented;
    if (adjustment === 0) return new Date(candidate);
    candidate += adjustment;
  }
  throw new Error(
    "AstroApp chart wall clock could not be resolved in its timezone",
  );
}

function sign(lng: number): string {
  return SIGNS[Math.floor((((lng % 360) + 360) % 360) / 30)];
}

export function validChironMovement(
  record: ChironMovementRecord | undefined,
  at: Date,
): record is ChironMovementRecord {
  return (
    record?.version === CHIRON_MOVEMENT_VERSION &&
    record.retrogradeStation?.before?.speed >= 0 &&
    record.retrogradeStation?.after?.speed < 0 &&
    record.directStation?.before?.speed < 0 &&
    record.directStation?.after?.speed >= 0 &&
    at.getTime() >= Date.parse(record.retrogradeStation.after.at) &&
    at.getTime() < Date.parse(record.directStation.before.at)
  );
}

export async function calculateChironMovement(
  at: Date,
  position: Position,
  request: AstroAppRequest,
): Promise<ChironMovementRecord> {
  if (
    !Number.isFinite(at.getTime()) ||
    !Number.isFinite(position.lng) ||
    !(position.speed < 0)
  ) {
    throw new Error(
      "Chiron movement requires a dated retrograde provider position",
    );
  }
  let requests = 0;
  const samples = new Map<number, Sample>([
    [at.getTime(), { ...position, at: at.toISOString() }],
  ]);
  const chartData = (date: Date) => ({
    chartDate: date.toISOString().slice(0, 19),
    chartName: "Chiron movement",
    lat: 0,
    lng: 0,
    elev: 0,
    tz: "UTC",
    zodiacID: 100,
    houseSystemID: 1,
    coordSys: "G",
    jd: 0,
    version: 1,
  });
  async function call(endpoint: string, payload: unknown) {
    if (++requests > CHIRON_REQUEST_LIMIT)
      throw new Error("Chiron calculation request limit reached");
    return request(`https://astroapp.com/astro/apis/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  }
  async function sample(time: number): Promise<Sample> {
    // Query whole minutes: chart results have minute-level calculation precision.
    // Sub-minute input strings must not imply sub-minute station accuracy.
    time = Math.floor(time / PRECISION_MS) * PRECISION_MS;
    const cached = samples.get(time);
    if (cached) return cached;
    const raw = await call("chart", {
      chart: { chartData: chartData(new Date(time)) },
      calcRequestProps: { needImage: "N", needAspects: "N" },
      params: { objects: [15] },
    });
    const body = raw?.objects?.find((object: any) => object.id === 15);
    if (!body || !Number.isFinite(body.lng) || !Number.isFinite(body.speed)) {
      throw new Error("AstroApp returned no valid Chiron position");
    }
    const actual = skyInstant(raw.chartData, new Date(time)).getTime();
    if (Math.abs(actual - time) > 2000)
      throw new Error("AstroApp Chiron sample has an unexpected timestamp");
    const result = {
      at: new Date(time).toISOString(),
      lng: body.lng,
      speed: body.speed,
    };
    samples.set(time, result);
    return result;
  }
  async function station(direction: -1 | 1): Promise<Station> {
    let inner = { ...position, at: at.toISOString() };
    let outer: Sample | undefined;
    // Chiron's two stations are months apart; 16-day steps keep each crossing bracketed.
    for (let day = 16; day <= 256; day += 16) {
      const next = await sample(at.getTime() + direction * day * DAY);
      if (next.speed >= 0) {
        outer = next;
        break;
      }
      inner = next;
    }
    if (!outer)
      throw new Error(
        "AstroApp Chiron station was not bracketed within 256 days",
      );
    let before = direction === 1 ? inner : outer;
    let after = direction === 1 ? outer : inner;
    while (Date.parse(after.at) - Date.parse(before.at) > PRECISION_MS) {
      const mid = await sample(
        (Date.parse(before.at) + Date.parse(after.at)) / 2,
      );
      if (mid.speed < 0 === before.speed < 0) before = mid;
      else after = mid;
    }
    return {
      before,
      after,
      at: new Date(
        (Date.parse(before.at) + Date.parse(after.at)) / 2,
      ).toISOString(),
    };
  }
  const retrogradeStation = await station(-1);
  const directStation = await station(1);
  const directTime = Date.parse(directStation.at);
  const events = new Map<number, number>();
  // Ask both directions and sort actual JDs. AstroApp's isNext direction can follow
  // the body's current motion; never infer past/future from that flag alone.
  for (const isNext of [true, false]) {
    const response = await call("ingresses", {
      params: { ingressPlanetId: 15, eventTypeId: 1, isNext: String(isNext) },
      targetChart: chartData(new Date(directTime + DAY)),
    });
    if (!Array.isArray(response?.results))
      throw new Error("AstroApp returned no Chiron ingress events");
    for (const event of response.results) {
      if (
        event.objectId1 !== 15 ||
        event.eventType !== 1 ||
        !Number.isFinite(event.exactJD) ||
        !Number.isFinite(event.exactLng)
      )
        continue;
      events.set(Math.round((event.exactJD - 2440587.5) * DAY), event.exactLng);
    }
  }
  const times = [...events.keys()].sort((a, b) => a - b);
  const previous = times.filter((time) => time < directTime).at(-1);
  const next = times.find((time) => time > directTime);
  if (previous === undefined || next === undefined)
    throw new Error("AstroApp did not return both Chiron sign boundaries");
  const nextBefore = await sample(next - 3600_000);
  const nextAfter = await sample(next + 3600_000);
  const directSign = sign(directStation.after.lng);
  if (
    !(nextBefore.speed > 0 && nextAfter.speed > 0) ||
    sign(nextBefore.lng) !== directSign ||
    sign(nextAfter.lng) === directSign
  ) {
    throw new Error(
      "AstroApp Chiron forward ingress did not match its dated positions",
    );
  }
  const crossesSignBoundary = previous > Date.parse(retrogradeStation.at);
  let crossing: { crossingSign: string; crossingAt: string } | undefined;
  if (crossesSignBoundary) {
    const before = await sample(previous - 3600_000);
    const after = await sample(previous + 3600_000);
    if (
      !(before.speed < 0 && after.speed < 0) ||
      sign(after.lng) !== directSign ||
      sign(before.lng) === directSign
    ) {
      throw new Error(
        "AstroApp Chiron backward ingress did not match its dated positions",
      );
    }
    crossing = {
      crossingSign: sign(after.lng),
      crossingAt: new Date(previous).toISOString(),
    };
  }
  return {
    version: CHIRON_MOVEMENT_VERSION,
    retrogradeStation,
    directStation,
    movement: {
      crossesSignBoundary,
      ...crossing,
      directSign,
      directAt: directStation.at,
      nextSign: sign(nextAfter.lng),
      nextSignAt: new Date(next).toISOString(),
      source:
        "AstroApp ingress events; stations derived from AstroApp speed samples (one-minute brackets)",
      calculationVersion: CHIRON_MOVEMENT_VERSION,
    },
  };
}

const pending = new Map<string, Promise<ChironMovementRecord>>();
export async function ensureChironMovement<
  T extends {
    chartData: any;
    objects: Array<{ id: number; lng: number; speed: number }>;
    chironMovement?: ChironMovementRecord;
  },
>(
  raw: T,
  request: AstroAppRequest,
  previous?: ChironMovementRecord,
): Promise<T> {
  const chiron = raw.objects.find((object) => object.id === 15);
  if (!chiron || chiron.speed >= 0)
    return { ...raw, chironMovement: undefined };
  const at = skyInstant(raw.chartData, new Date(raw.chartData?.chartDate));
  for (const record of [raw.chironMovement, previous]) {
    if (validChironMovement(record, at))
      return { ...raw, chironMovement: record };
  }
  const key = `${at.toISOString()}:${chiron.lng}:${chiron.speed}`;
  let calculation = pending.get(key);
  if (!calculation) {
    calculation = calculateChironMovement(at, chiron, request);
    pending.set(key, calculation);
  }
  try {
    return { ...raw, chironMovement: await calculation };
  } finally {
    if (pending.get(key) === calculation) pending.delete(key);
  }
}
