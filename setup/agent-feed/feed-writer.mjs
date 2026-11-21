#!/usr/bin/env node
// feed-writer.mjs — writes current GOE card data into the marked blocks in USER.md.
// Single-owner, localhost, no auth. Missing data is stated plainly, never invented.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  calculateMoonCenter,
  cyclePhaseForDay,
  parseLocalDate,
} from '../../shared/cycleCore.ts';
import {
  classifyNervousSystemState,
  mergeRestRisingRows,
  previousDateString,
} from '../../shared/restRisingCore.ts';
import {
  movementReadiness,
} from '../../shared/movementSignal.ts';
import { getRecoveryQuality, hasRecoveryInputs } from '../../server/lib/recovery.ts';
import { moonCentresEnabled } from '../../server/moonCentres.ts';
import {
  AGENT_CONTEXT_SCHEMA_VERSION,
  assertAgentContextSnapshot,
  contextCard,
  getContextCard,
} from './agent-context-snapshot.ts';

const GOE_BASE = process.env.GOE_BASE_URL || 'http://localhost:5000';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_MD_PATH = process.env.USER_MD_PATH || path.resolve(__dirname, '../../../USER.md');

export const START_MARKER = '<!-- LIVE-FEED:START -->';
export const END_MARKER = '<!-- LIVE-FEED:END -->';
export const ASTRO_START_MARKER = '<!-- STATIC-ASTROLOGY:START -->';
export const ASTRO_END_MARKER = '<!-- STATIC-ASTROLOGY:END -->';

function dayNumber(date, startDate) {
  const startUTC = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((dateUTC - startUTC) / 86400000) + 1;
}

async function getJSON(pathname) {
  const res = await fetch(`${GOE_BASE}${pathname}`);
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateOffset(localDate, days) {
  const date = new Date(`${localDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function present(value) {
  return value !== null && value !== undefined && value !== '';
}

function title(value) {
  return present(value) ? `${String(value).charAt(0).toUpperCase()}${String(value).slice(1)}` : '';
}

function isoTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function newestWithField(rows, field) {
  return [...rows]
    .filter(row => present(row?.[field]))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

function rowsForSleepDate(rows, sleepDate) {
  return rows.filter(row => row.sleepDate === sleepDate);
}

function setValue(record, key, value, provenance) {
  record.values[key] = value;
  if (provenance) record.provenance[key] = provenance;
}

function setMissing(record, key, reason) {
  record.values[key] = null;
  record.missing[key] = reason;
}

export function buildAgentContextSnapshot({ now, cycleData, moonPatternData, skyData, transitsData, restRows, movementToday, movementLogs }) {
  const generatedAt = now.toISOString();
  const localDate = formatDate(now);
  const cyclical = contextCard('cyclical');
  const rest = contextCard('rest_restore');
  const movement = contextCard('movement');
  const astrology = contextCard('astrology_energetic');

  let cycleDay = null;
  let cyclePhase = null;
  if (cycleData?.cycleStartDate) {
    const startDate = parseLocalDate(cycleData.cycleStartDate);
    const cycleLength = cycleData.cycleLength || 28;
    if (startDate) {
      const rawDay = dayNumber(now, startDate);
      if (rawDay >= 1) {
        cycleDay = rawDay;
        cyclePhase = cyclePhaseForDay(rawDay, cycleLength);
      }
    }
  }
  if (cycleDay != null) {
    setValue(cyclical, 'cycle_day', cycleDay, {
      source: '/api/cycle/data', localDate, derivationVersion: 'wrapped-cycle-day.v1',
    });
    setValue(cyclical, 'cycle_phase', cyclePhase, {
      source: '/api/cycle/data', localDate, derivationVersion: 'cycleCore.current.v1',
    });
  } else {
    setMissing(cyclical, 'cycle_day', 'cycle start date unavailable');
    setMissing(cyclical, 'cycle_phase', 'cycle day unavailable');
  }

  let moonCentre = null;
  if (moonCentresEnabled() && moonPatternData?.effectiveEnabled) {
    const { current } = calculateMoonCenter(moonPatternData.asOfDate ? new Date(`${moonPatternData.asOfDate}T12:00:00`) : now, moonPatternData.pattern);
    if (current) moonCentre = current;
  }
  if (moonCentre) {
    setValue(cyclical, 'moon_centre', moonCentre, {
      source: '/api/cycle/moon-pattern', localDate: moonPatternData.asOfDate || localDate, derivationVersion: 'moon-centre.owner-pattern.v2',
    });
  } else setMissing(cyclical, 'moon_centre', moonCentresEnabled() ? 'connected Kundalini moon-centre pattern unavailable' : 'Kundalini moon centres disabled');

  const restField = (key, field) => {
    const row = newestWithField(restRows, field);
    if (!row) return setMissing(rest, key, 'not recorded');
    setValue(rest, key, row[field], {
      source: '/api/rest-rising/submissions',
      localDate: row.sleepDate,
      observedAt: isoTimestamp(row.updatedAt || row.createdAt) || undefined,
    });
    return row;
  };
  const energyRow = restField('energy_assessment', 'energyAssessment');
  const sleepRow = restField('sleep_process', 'sleepProcess');
  const wakingRow = restField('waking_state', 'wakingState');
  const nervousSystemState = classifyNervousSystemState(
    energyRow?.energyAssessment,
    sleepRow?.sleepProcess,
    wakingRow?.wakingState,
  );
  if (nervousSystemState) {
    setValue(rest, 'nervous_system_state', nervousSystemState, {
      source: 'shared/restRisingCore.ts',
      localDate: wakingRow?.sleepDate || sleepRow?.sleepDate || energyRow?.sleepDate,
      derivationVersion: 'rest-rising-state.v1',
    });
  } else setMissing(rest, 'nervous_system_state', 'no saved Rest/Rising fields to derive it from');

  const hrvReadings = [...movementLogs]
    .filter(log => present(log.rmssd))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 4)
    .map(log => ({
      date: log.date,
      rmssd: log.rmssd,
      sdnn: present(log.sdnn) ? log.sdnn : null,
      source: log.hrvSource || null,
      capturedAt: isoTimestamp(log.hrvCapturedAt || log.updatedAt || log.createdAt) || null,
    }));
  if (hrvReadings.length) {
    setValue(movement, 'hrv_readings', hrvReadings, {
      source: '/api/movement/logs',
      observedAt: hrvReadings[0].capturedAt || undefined,
      derivationVersion: 'latest-four-dated.v1',
    });
  } else setMissing(movement, 'hrv_readings', 'not recorded');

  const currentLog = movementToday && movementToday.date === localDate ? movementToday : null;
  const signalContext = currentLog?.signalContext || null;
  if (signalContext?.rhythm?.status === 'recorded') {
    setValue(movement, 'hrv_personal_baseline', {
      date: currentLog.date, ...signalContext.rhythm,
    }, { source: '/api/movement/today', localDate: currentLog.date, derivationVersion: 'phase-or-recent-rmssd.v1' });
  } else setMissing(movement, 'hrv_personal_baseline', 'not available for the current reading');

  if (currentLog?.readinessScore != null) {
    setValue(movement, 'readiness', {
      date: currentLog.date,
      label: movementReadiness(currentLog.readinessScore)?.word,
      score: currentLog.readinessScore,
    }, { source: '/api/movement/today', localDate: currentLog.date });
  } else setMissing(movement, 'readiness', 'not recorded for today');

  const recoverySleepDate = currentLog ? previousDateString(currentLog.date) : previousDateString(localDate);
  const recoveryRows = rowsForSleepDate(restRows, recoverySleepDate);
  const recovery = recoveryRows.length ? mergeRestRisingRows(recoveryRows) : null;
  const recoveryQuality = hasRecoveryInputs(recovery) ? getRecoveryQuality(recovery) : null;
  if (recoveryQuality) {
    setValue(rest, 'overnight_recovery', {
      sleepDate: recoverySleepDate,
      quality: recoveryQuality,
    }, {
      source: '/api/rest-rising/submissions',
      localDate: recoverySleepDate,
      derivationVersion: 'recorded-recovery-flags.v1',
    });
  } else setMissing(rest, 'overnight_recovery', `not recorded for sleep ${recoverySleepDate}`);

  if (signalContext?.instrumentVersion === '0.3.0') {
    setValue(movement, 'your_rhythm', { date: currentLog.date, ...signalContext.rhythm }, {
      source: '/api/movement/today', localDate: currentLog.date, derivationVersion: 'phase-or-recent-rmssd.v1',
    });
    setValue(movement, 'movement_read', { date: currentLog.date, ...signalContext.movement }, {
      source: '/api/movement/today', localDate: currentLog.date, derivationVersion: 'readiness-rest-points.v1',
    });
  } else {
    setMissing(movement, 'your_rhythm', 'not calculated for today');
    setMissing(movement, 'movement_read', 'not calculated for today');
  }

  const workout = movementToday?.latestWorkout;
  if (workout?.practiceName && workout?.durationMinutes) {
    setValue(movement, 'movement_recorded', {
      date: workout.date,
      practiceName: workout.practiceName,
      durationMinutes: workout.durationMinutes,
    }, {
      source: '/api/movement/today',
      localDate: workout.date,
      observedAt: isoTimestamp(workout.updatedAt || workout.createdAt) || undefined,
    });
  } else setMissing(movement, 'movement_recorded', 'not recorded');

  const sky = Array.isArray(skyData?.currentSky) ? skyData.currentSky : [];
  if (sky.length) setValue(astrology, 'current_sky', sky, { source: '/api/current-sky', localDate });
  else setMissing(astrology, 'current_sky', 'not available');

  const transits = Array.isArray(transitsData?.currentTransits) ? transitsData.currentTransits : [];
  if (transits.length) setValue(astrology, 'transits_active', transits, { source: '/api/current-transits', localDate });
  else setMissing(astrology, 'transits_active', 'none returned');
  setMissing(astrology, 'gk_position', 'not derived — no agreed current-position method');
  setMissing(astrology, 'hd_polarity', 'not derived — no agreed current-polarity method');

  const snapshot = {
    schemaVersion: AGENT_CONTEXT_SCHEMA_VERSION,
    generatedAt,
    localDate,
    cards: [cyclical, rest, movement, astrology],
  };
  assertAgentContextSnapshot(snapshot);
  return snapshot;
}

function fieldValue(card, key) {
  return card.values[key];
}

function fieldReason(card, key) {
  return card.missing[key] || 'not available';
}

function formatDatedRestField(card, key) {
  const value = fieldValue(card, key);
  if (!present(value)) return fieldReason(card, key);
  const provenance = card.provenance[key] || {};
  return `${provenance.localDate || 'date unavailable'} | ${value}${provenance.observedAt ? ` | saved ${provenance.observedAt}` : ''}`;
}

function formatCurrentSky(currentSky) {
  if (!Array.isArray(currentSky) || currentSky.length === 0) return 'not available';
  return currentSky.map(p => `${p.planet} ${p.sign} ${p.degree}${p.retrograde ? ' R' : ''}`).join('; ');
}

function formatTransitsActive(currentTransits) {
  if (!Array.isArray(currentTransits) || currentTransits.length === 0) return 'none returned';
  return currentTransits
    .map(t => `${t.transit} (${t.aspect}, exact ${t.exactDate}, window ${t.windowStart}–${t.windowEnd})`)
    .join('; ');
}

function formatHrvReading(log) {
  const values = [`RMSSD ${log.rmssd} ms`];
  if (present(log.sdnn)) values.push(`SDNN ${log.sdnn} ms`);
  values.push(`source ${log.source || 'not recorded'}`);
  if (log.capturedAt) values.push(`captured ${log.capturedAt}`);
  return `${log.date} | ${values.join(' | ')}`;
}

export function formatFeedBlock(snapshot) {
  assertAgentContextSnapshot(snapshot);
  const cyclical = getContextCard(snapshot, 'cyclical');
  const rest = getContextCard(snapshot, 'rest_restore');
  const movement = getContextCard(snapshot, 'movement');
  const astrology = getContextCard(snapshot, 'astrology_energetic');
  const hrvReadings = fieldValue(movement, 'hrv_readings');
  const baseline = fieldValue(movement, 'hrv_personal_baseline');
  const readiness = fieldValue(movement, 'readiness');
  const recovery = fieldValue(rest, 'overnight_recovery');
  const rhythm = fieldValue(movement, 'your_rhythm');
  const movementRead = fieldValue(movement, 'movement_read');
  const recorded = fieldValue(movement, 'movement_recorded');
  const nervousSystemState = fieldValue(rest, 'nervous_system_state');

  const lines = [
    START_MARKER,
    '**Current read (rewritten by the instance after saved readings and each morning):**',
    '```',
    `Schema: ${snapshot.schemaVersion}`,
    `Updated: ${snapshot.generatedAt}`,
    `Local date: ${snapshot.localDate}`,
    '',
    'Physiological',
    `  cycle_day:              ${fieldValue(cyclical, 'cycle_day') ?? fieldReason(cyclical, 'cycle_day')}`,
    `  cycle_phase:            ${fieldValue(cyclical, 'cycle_phase') ?? fieldReason(cyclical, 'cycle_phase')}`,
    `  moon_centre:            ${fieldValue(cyclical, 'moon_centre') ?? fieldReason(cyclical, 'moon_centre')}`,
    `  energy_assessment:      ${formatDatedRestField(rest, 'energy_assessment')}`,
    `  sleep_process:          ${formatDatedRestField(rest, 'sleep_process')}`,
    `  waking_state:           ${formatDatedRestField(rest, 'waking_state')}`,
    `  nervous_system_state:   ${nervousSystemState ? `${title(nervousSystemState)} | derived from the saved Rest/Rising fields above` : fieldReason(rest, 'nervous_system_state')}`,
    '  hrv_readings:',
  ];

  if (Array.isArray(hrvReadings) && hrvReadings.length) hrvReadings.forEach(log => lines.push(`    - ${formatHrvReading(log)}`));
  else lines.push(`    - ${fieldReason(movement, 'hrv_readings')}`);

  lines.push(
    `  hrv_personal_baseline:  ${baseline ? `for ${baseline.date} | ${baseline.referenceKind} | mean ${baseline.mean} ms | SD ${baseline.sd} ms | range ${baseline.lower}–${baseline.upper} ms | ${baseline.referenceCount} prior source-matched readings` : fieldReason(movement, 'hrv_personal_baseline')}`,
    `  readiness:              ${readiness ? `${readiness.date} | ${readiness.label} | score ${readiness.score}/10` : fieldReason(movement, 'readiness')}`,
    `  overnight_recovery:     ${recovery ? `sleep ${recovery.sleepDate} | ${title(recovery.quality)} | derived from recorded wakings, night sweats and alcohol fields` : fieldReason(rest, 'overnight_recovery')}`,
    `  your_rhythm:            ${rhythm ? `${rhythm.date} | ${rhythm.rhythmColour ?? rhythm.status}` : fieldReason(movement, 'your_rhythm')}`,
    `  movement_read:          ${movementRead ? `${movementRead.date} | ${movementRead.movementColour ?? 'readiness not logged'} | Rest/Rising ${movementRead.restLogged ? `recorded, ${movementRead.restPoints} points` : 'not logged'}` : fieldReason(movement, 'movement_read')}`,
    `  movement_recorded:      ${recorded ? `${recorded.date} | ${recorded.practiceName} | ${recorded.durationMinutes} minutes${movement.provenance.movement_recorded?.observedAt ? ` | saved ${movement.provenance.movement_recorded.observedAt}` : ''}` : fieldReason(movement, 'movement_recorded')}`,
    '',
    'Energetic',
    `  current_sky:            ${formatCurrentSky(fieldValue(astrology, 'current_sky'))}`,
    `  transits_active:        ${formatTransitsActive(fieldValue(astrology, 'transits_active'))}`,
    `  gk_position:            ${fieldReason(astrology, 'gk_position')}`,
    `  hd_polarity:            ${fieldReason(astrology, 'hd_polarity')}`,
    '```',
    END_MARKER,
  );
  return lines.join('\n');
}

function placementLine(label, value) {
  if (!value?.sign || !value?.degree) return `- ${label}: not available`;
  return `- ${label}: ${value.sign} ${value.degree}${value.house ? ` — ${value.house} house` : ''}`;
}

export function formatStaticAstrologyBlock(birthChart) {
  const chart = birthChart?.birthChart || birthChart;
  if (!chart || typeof chart !== 'object') throw new Error('Birth chart API returned no structured chart.');
  const placements = [
    ['Sun', chart.sun], ['Moon', chart.moon], ['Rising', chart.rising],
    ['Mercury', chart.mercury], ['Venus', chart.venus], ['Mars', chart.mars],
    ['Jupiter', chart.jupiter], ['Saturn', chart.saturn], ['Uranus', chart.uranus],
    ['Neptune', chart.neptune], ['Pluto', chart.pluto], ['North Node', chart.northNode],
    ['South Node', chart.southNode], ['Chiron', chart.chiron], ['Midheaven', chart.midheaven],
  ];
  return [
    ASTRO_START_MARKER,
    '### Astrology',
    `Source: stored AstroApp API chart for ${chart.birthDate || 'birth date not returned'}, ${chart.birthTime || 'birth time not returned'}, ${chart.birthLocation || 'birth location not returned'}. House system: Placidus (instance API configuration houseSystemID: 1).`,
    ...placements.map(([label, value]) => placementLine(label, value)),
    ASTRO_END_MARKER,
  ].join('\n');
}

export function replaceMarkedBlock(fileContents, startMarker, endMarker, newBlock) {
  const startIdx = fileContents.indexOf(startMarker);
  const endIdx = fileContents.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Markers not found or out of order: "${startMarker}" / "${endMarker}".`);
  }
  const before = fileContents.slice(0, startIdx);
  const after = fileContents.slice(endIdx + endMarker.length);
  return `${before}${newBlock}${after}`;
}

function atomicWrite(filePath, contents) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tempPath, contents, 'utf8');
  renameSync(tempPath, filePath);
}

async function fetchFeedInputs(now) {
  const localDate = formatDate(now);
  const startDate = dateOffset(localDate, -5);
  const [cycleData, moonPatternData, skyData, transitsData, restRows, movementToday, movementLogs] = await Promise.all([
    getJSON('/api/cycle/data'),
    getJSON('/api/cycle/moon-pattern'),
    getJSON('/api/current-sky'),
    getJSON('/api/current-transits'),
    getJSON(`/api/rest-rising/submissions?startDate=${startDate}&endDate=${localDate}`),
    getJSON('/api/movement/today'),
    getJSON('/api/movement/logs?days=14'),
  ]);
  return { now, cycleData, moonPatternData, skyData, transitsData, restRows, movementToday, movementLogs };
}

export async function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const syncStatic = argv.includes('--sync-static');
  const snapshotJson = argv.includes('--snapshot-json');
  const now = new Date();
  const snapshot = buildAgentContextSnapshot(await fetchFeedInputs(now));
  if (snapshotJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  const feedBlock = formatFeedBlock(snapshot);
  let staticBlock = '';
  if (syncStatic) staticBlock = formatStaticAstrologyBlock(await getJSON('/api/birth-chart'));

  if (dryRun) {
    if (staticBlock) process.stdout.write(`${staticBlock}\n\n`);
    process.stdout.write(`${feedBlock}\n`);
    return;
  }

  const original = readFileSync(USER_MD_PATH, 'utf8');
  let updated = replaceMarkedBlock(original, START_MARKER, END_MARKER, feedBlock);
  if (staticBlock) {
    updated = replaceMarkedBlock(updated, ASTRO_START_MARKER, ASTRO_END_MARKER, staticBlock);
  }
  atomicWrite(USER_MD_PATH, updated);
  process.stdout.write(`${feedBlock}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error('feed-writer failed:', err.message);
    process.exit(1);
  });
}
