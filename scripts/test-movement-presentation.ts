import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateMovementSplit } from '../shared/movementSignal';
import { getMovementReadText, getRhythmText, MOVEMENT_INFO, READINESS_NOT_LOGGED_TEXT } from '../client/src/components/MovementIntelligenceCard/movementInsights.js';

const current = { date: '2026-10-05', rmssd: 80, hrvSource: 'manual', cyclePhase: 'follicular' };
const history = ['01', '02', '03'].map(day => ({ ...current, date: `2026-10-${day}`, rmssd: 50 }));
const context = calculateMovementSplit({ current, history, lifeStage: 'cycling', readinessScore: 8,
  rest: { alcoholConsumed: true, nightSweats: true, nightWakings: '1-2' } });
assert.equal(getRhythmText({ signalContext: context }), 'Your rhythm is recorded as green.');
assert.equal(getMovementReadText({ signalContext: context }), 'Your rest and rising, with alcohol, night sweats and 1–2 night wakings, has lowered your movement read to orange. Energy is building and your experience is easing. What movement would tend to what is growing without rushing it?');
assert.equal(getMovementReadText({ signalContext: null }), '');
assert.equal(getRhythmText({ signalContext: null }), '');
for (let score = 1; score <= 10; score++) for (const alcoholConsumed of [false, true]) for (const nightSweats of [false, true]) for (const nightWakings of ['0', '1-2', '3+'] as const) {
  const signalContext = calculateMovementSplit({ current, history, lifeStage: 'postmenopause', readinessScore: score, rest: { alcoholConsumed, nightSweats, nightWakings } });
  const text = getMovementReadText({ signalContext });
  assert.match(text, /Your experience is (motivated|rising|easing|sluggish)\./);
  assert(!text.includes('undefined'));
  assert.equal(text.includes('has lowered'), signalContext.movement.appliedDrop > 0);
  assert(!text.includes('Your readiness is logged'));
  assert(!text.includes('stays') && !text.includes('keeps your movement read'));
  assert(!text.includes('Energy is building'));
}
const missingRest = calculateMovementSplit({ current, history: [], lifeStage: 'cycling', readinessScore: 7, rest: null });
assert.equal(getRhythmText({ signalContext: missingRest }), 'Observing: your rhythm is building.');
assert.equal(getMovementReadText({ signalContext: missingRest }), 'Energy is building and your experience is rising. What movement would support what is opening? Record rest and rising for a full reading.');
const unchangedWithMarker = calculateMovementSplit({ current, history, lifeStage: 'cycling', readinessScore: 7,
  rest: { alcoholConsumed: true, nightSweats: false, nightWakings: '0' } });
assert.equal(getMovementReadText({ signalContext: unchangedWithMarker }), 'Energy is building and your experience is rising. What movement would support what is opening?');
assert(!getMovementReadText({ signalContext: unchangedWithMarker }).includes('alcohol'));
const approvedOvulation = {
  phaseForWords: 'ovulation',
  movement: { readinessWord: 'rising', movementColour: 'orange', restLogged: true, restFlags: ['alcohol'], appliedDrop: 1 },
};
assert.equal(getMovementReadText({ signalContext: approvedOvulation }), 'Your rest and rising, with alcohol, has lowered your movement read to orange. The energy body is at its peak and your experience is easing. What movement would honour this without tipping into demanding?');
assert.equal(Object.keys(MOVEMENT_INFO).length, 3);
assert(!JSON.stringify(MOVEMENT_INFO).includes('Match you'));

// Render the actual components without APIs or owner writes.
const require = createRequire(import.meta.url);
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
function component(zone: number | 'Shared', exportName = 'default') {
  const file = zone === 'Shared' ? 'MovementShared' : `MovementZone${zone}`;
  const build = buildSync({ entryPoints: [`client/src/components/MovementIntelligenceCard/${file}.jsx`],
    bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
    define: {
      'import.meta.env.VITE_DEFAULT_HRV_SOURCE': JSON.stringify('manual'),
    }, logLevel: 'silent' });
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', build.outputFiles[0].text)(require, module, module.exports);
  return module.exports[exportName];
}
function render(zone: number, props: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
    React.createElement(component(zone), props)));
}
const props = { result: { rhythmColour: 'green', movementColour: 'orange', rmssd: 80, context }, recentLogs: [] };
const ownerRhythm = render(1, props);
assert(!ownerRhythm.includes('data-rhythm-point'));
assert(ownerRhythm.includes('from-emerald-50 to-green-100'), 'Your Rhythm uses its recorded green treatment');
assert(ownerRhythm.includes('from-orange-100 to-orange-200'), 'Movement Read uses its recorded orange treatment');
const now = new Date();
const calendarProps = {
  calendarLogs: [],
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth(),
  localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  onMonthChange() {},
};
const ownerCalendar = render(3, calendarProps);
assert(!ownerCalendar.includes('data-movement-session'));
const emptyDays = Array.from({ length: now.getDate() }, (_, i) => ({
  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  hasMovementRecord: false, rmssd: null, readinessScore: null, sessions: [],
}));
assert(!render(3, { ...calendarProps, calendarLogs: emptyDays }).includes('data-movement-session'));
const ownerDots = render(3, { ...calendarProps, calendarYear: 2026, calendarMonth: 9, localDate: '2026-11-03', calendarLogs: [
  { date: '2026-10-26', movementColour: 'orange', sessions: [{ practiceName: 'Functional Exercises', practiceSignal: 'yellow' }] },
] });
assert.match(ownerDots, /bg-yellow-500/);
assert.doesNotMatch(ownerDots, /bg-amber-500/);
const populated = render(1, { ...props, recentLogs: [{ ...current, rhythmColour: 'green', movementColour: 'orange', readinessScore: 8 }] });
assert(populated.includes('data-rhythm-point'));
assert(populated.includes('Your rhythm is recorded as green.'));
assert(!populated.includes('Your movement read is coming in orange.'));
const readinessOnlyContext = calculateMovementSplit({ current: { ...current, rmssd: null }, history: [], lifeStage: 'cycling', readinessScore: 2, rest: null });
const readinessOnly = render(1, { result: { rmssd: null, rhythmColour: null, movementColour: 'red', context: readinessOnlyContext }, recentLogs: [{ ...current, rmssd: null, readinessScore: 2 }] });
assert(!readinessOnly.includes('data-rhythm-point'), 'Readiness alone must not create an HRV dot');
assert(readinessOnly.includes('No recording received'));
assert(readinessOnly.includes('Energy is building and your experience is sluggish.'));
assert.equal(readinessOnly.split('Record rest and rising for a full reading.').length - 1, 1);
const observing = render(1, { ...props, recentLogs: [{ ...current, rhythmColour: null, readinessScore: 2 }] });
assert(observing.includes('data-rhythm-point'), 'A real HRV reading creates a dot while observing');
const awaitingReadiness = render(1, { result: null, initialHrvReading: { rmssd: 72, source: 'manual' }, readinessLogged: false, recentLogs: [] });
assert.equal(awaitingReadiness.split(READINESS_NOT_LOGGED_TEXT).length - 1, 1);
const emptyCard = render(1, { result: null, initialHrvReading: null, rhythmStatus: null, recentLogs: [] });
assert(!emptyCard.includes('Observing: your rhythm is building.'), 'No HRV reading must not show Observing.');
const emptyWithStatus = render(1, { result: null, initialHrvReading: null, rhythmStatus: 'observing', recentLogs: [] });
assert(!emptyWithStatus.includes('Observing: your rhythm is building.'), 'A status without an HRV reading must not show Observing.');
for (let earlierReadings = 0; earlierReadings <= 3; earlierReadings++) {
  const split = calculateMovementSplit({ current, history: history.slice(0, earlierReadings), lifeStage: 'cycling', readinessScore: 8, rest: null });
  const card = render(1, { result: null, initialHrvReading: { rmssd: 80, source: 'manual' }, rhythmStatus: split.rhythm.status, recentLogs: [] });
  assert.equal(card.includes('Observing: your rhythm is building.'), earlierReadings < 3);
}
const observingCard = render(1, { result: null, initialHrvReading: { rmssd: 72, source: 'manual' }, rhythmStatus: 'observing', readinessLogged: false, recentLogs: [] });
assert(observingCard.includes('Observing: your rhythm is building.'));
const popup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
  React.createElement(component(3, 'DayPopup'), { dayData: {
    ...current, rhythmColour: 'green', movementColour: 'orange', signalContext: context,
    cycleDay: 9, sdnn: 65, readinessLabel: 'easing', sessions: [{ practiceName: 'Walk', durationMinutes: 30, practiceSignal: 'universal' }],
  }, onClose() {} })));
const sections = ['Your Rhythm', 'Movement Read', 'Movement Recorded', 'Notes'].map(text => popup.indexOf(`>${text}<`));
assert(sections.every((position, i) => position >= 0 && (!i || position > sections[i - 1])));
assert(popup.includes('RMSSD 80 ms') && popup.includes('SDNN 65 ms'));
assert(popup.indexOf('Your rhythm is recorded as green.') > popup.indexOf('SDNN 65 ms'));
assert(popup.includes('bg-orange-50'));
assert.equal(popup.split(getMovementReadText({ signalContext: context })).length - 1, 1);
assert(!popup.includes('Orange Movement Read'));
assert(!popup.includes('Readiness easing'));
const popupHeader = popup.slice(0, popup.indexOf('Your Rhythm'));
assert(!popupHeader.includes('Movement Read') && !popupHeader.includes('flex-wrap'));
assert(popup.includes('Cycle Day 9') && popup.includes('Follicular'));
assert(popup.indexOf('Cycle Day 9') < popup.indexOf('Follicular'));
assert(popup.indexOf('Follicular') < popup.indexOf('Your Rhythm'));
assert(popup.indexOf(getMovementReadText({ signalContext: context })) > popup.indexOf('Movement Read'));
assert(popup.includes('from-emerald-50 to-green-100'), 'Calendar Rhythm uses the daily-card treatment');
assert(popup.includes('from-orange-100 to-orange-200'), 'Calendar Movement Read uses the daily-card treatment');
assert(!popup.includes(READINESS_NOT_LOGGED_TEXT));
assert(!popup.includes('Morning HRV Reading'));
const emptyPopup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
  React.createElement(component(3, 'DayPopup'), { dayData: {
    date: '2026-10-08', cycleDay: 13, cyclePhase: 'ovulatory', rhythmColour: null,
    movementColour: null, rmssd: null, sdnn: null, readinessLabel: null, sessions: [],
  }, onClose() {} })));
const emptySections = ['Your Rhythm', 'Movement Read', 'Movement Recorded', 'Notes'].map(text => emptyPopup.indexOf(`>${text}<`));
assert(emptySections.every((position, i) => position >= 0 && (!i || position > emptySections[i - 1])));
assert(emptyPopup.includes('No recording received'));
assert(emptyPopup.includes('data-movement-read="experience"'));
assert.equal(emptyPopup.split('No reading recorded').length - 1, 1);
const Gauge = component('Shared', 'ReadinessGauge');
for (let value = 1; value <= 10; value++) {
  const gauge = renderToStaticMarkup(React.createElement(Gauge, { value, onChange() {} }));
  assert(gauge.includes('>sluggish<'));
  assert(gauge.includes('>motivated<'));
  assert(!gauge.includes('>easing<') && !gauge.includes('>rising<'));
}
const practiceLibrary = render(2, { movementColour: 'orange', todayLog: null, todaySessionCount: 1 });
assert(!practiceLibrary.includes('Match you') && practiceLibrary.includes('Orange Movement Read'));
assert(practiceLibrary.includes('Walk'));
assert(practiceLibrary.includes('20 min') && practiceLibrary.includes('Log Movement'));
assert(practiceLibrary.includes('1 session logged today') && practiceLibrary.includes('text-orange-600'));
assert(!practiceLibrary.includes('text-emerald-600'));
const DurationStepper = component(2, 'DurationStepper');
const durationStepper = renderToStaticMarkup(React.createElement(DurationStepper, { value: 20, onChange() {} }));
assert(durationStepper.includes('Increase duration') && durationStepper.includes('Decrease duration'));
assert(durationStepper.includes('rgba(255,255,255,0.65)') && durationStepper.includes('blur(12px)'));
assert(durationStepper.includes('>20<') && durationStepper.includes('>min<'));
assert(durationStepper.indexOf('Increase duration') < durationStepper.indexOf('>20<'));
assert(durationStepper.indexOf('>20<') < durationStepper.indexOf('Decrease duration'));
const homeSource = readFileSync('client/src/components/OrbHomeScreen.jsx', 'utf8');
assert(homeSource.includes('const [movementDuration, setMovementDuration] = useState(20);'));
assert(homeSource.includes('durationMinutes: movementDuration'));
assert(homeSource.includes('<DurationStepper value={movementDuration} onChange={setMovementDuration} />'));
assert(homeSource.includes('COLOUR_META[movementToday.movementColour]?.pill'));
assert(homeSource.includes('border-t border-white/40 pt-3 pb-2 space-y-3'));
for (const label of ['Your Rhythm', 'Movement Read', 'Movement for today']) {
  assert(homeSource.includes(`text-sm font-medium text-black">${label}</div>`));
  assert(!homeSource.includes(`text-xs font-medium text-black">${label}</p>`));
}
assert.equal((homeSource.match(/text-sm text-black italic leading-relaxed font-normal/g) || []).length, 2);
assert(!homeSource.includes('Last movement'));
assert(!homeSource.includes('✓ Readiness logged') && !homeSource.includes('✓ {movementPractice} logged'));
console.log('Movement presentation: approved example, 120 Rest/readiness cases, missing data, owner chart and calendar gates, and populated rendering pass.');
