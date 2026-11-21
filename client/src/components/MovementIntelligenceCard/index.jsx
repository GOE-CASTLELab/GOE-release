// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Movement Intelligence — orchestrator: fetches state, delegates to zones

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocalDate } from '@/hooks/useLocalDate';
import { useMovementContext } from '@/hooks/useMovementContext';
import MovementHeader from './MovementHeader';
import MovementZone1 from './MovementZone1';
import MovementZone2 from './MovementZone2';
import MovementZone3 from './MovementZone3';
import GOE88ChatButton from '@/components/GOE88ChatButton';
import { hrvReadingFromLog } from '@/lib/hrv/sources';

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

export default function MovementIntelligenceCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const localDate = useLocalDate(user?.profile?.timezone || 'America/Edmonton');
  const { currentCycleInfo, cycleStartDate, cycleLength } = useMovementContext();

  // Zone 1 result state — set explicitly after card submission
  const [zone1Result, setZone1Result] = useState(null);
  const [zone1Submitting, setZone1Submitting] = useState(false);
  const captureDateRef = useRef(null);
  // Tracks when the user explicitly requests to re-read (overrides cache restore)
  const [readAgainMode, setReadAgainMode] = useState(false);

  // Zone 2 state
  const [zone2Submitting, setZone2Submitting] = useState(false);

  // Calendar state
  const [calendarYear, setCalendarYear] = useState(Number(localDate.slice(0, 4)));
  const [calendarMonth, setCalendarMonth] = useState(Number(localDate.slice(5, 7)) - 1); // 0-indexed

  // ── Cached queries — no duplicate fetches on re-visit ──
  const { data: todayLog, isLoading: todayLoading } = useQuery({
    queryKey: ['/api/movement/today', localDate],
    queryFn: () => fetch('/api/movement/today', { credentials: 'include' }).then(r => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    }),
    staleTime: Infinity,
  });
  useEffect(() => {
    setZone1Result(null);
    setReadAgainMode(false);
  }, [localDate]);
  const { data: recentLogs = [] } = useQuery({ queryKey: ['/api/movement/logs?days=30'], staleTime: Infinity });
  const { data: calendarLogs } = useQuery({
    queryKey: ['/api/movement/calendar', calendarYear, calendarMonth + 1],
    queryFn: () =>
      fetch(`/api/movement/calendar?year=${calendarYear}&month=${calendarMonth + 1}`, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    staleTime: Infinity,
  });

  // ── Derive result synchronously — no useEffect timing gap ──
  // Priority: readAgainMode > explicit zone1Result > restored from todayLog cache
  const restoredResult = (!readAgainMode && todayLog?.signalContext && todayLog.readinessScore != null) ? {
    rhythmColour: todayLog.rhythmColour,
    movementColour: todayLog.movementColour,
    context: {
      cycleDay:   currentCycleInfo?.day   ?? null,
      cyclePhase: currentCycleInfo?.phase?.toLowerCase() ?? null,
      ...(todayLog.signalContext || {}),
    },
    rmssd: todayLog.rmssd ?? undefined,
    sdnn: todayLog.sdnn ?? undefined,
    hrvSource: todayLog.hrvSource ?? undefined,
    readinessScore: todayLog.readinessScore ?? undefined,
  } : null;

  const displayResult = readAgainMode ? null : (zone1Result ?? restoredResult);

  const heldMovement = zone1Result?.context?.movement
    ? JSON.stringify(zone1Result.context.movement)
    : null;
  const refreshedMovement = todayLog?.signalContext?.movement
    ? JSON.stringify(todayLog.signalContext.movement)
    : null;
  useEffect(() => {
    if (heldMovement && refreshedMovement && heldMovement !== refreshedMovement) {
      setZone1Result(null);
    }
  }, [heldMovement, refreshedMovement]);

  const handleMonthChange = (year, month) => {
    setCalendarYear(year);
    setCalendarMonth(month);
  };

  const handleHrvCapture = async (reading) => {
    const captureDate = localDate;
    captureDateRef.current = captureDate;
    const log = await postJson('/api/movement/hrv', {
      date: captureDate,
      rmssd: reading.rmssd,
      sdnn: reading.sdnn ?? undefined,
      hrvSource: reading.source,
      hrvQuality: reading.quality ?? undefined,
      hrvIntervals: reading.intervals?.length ? reading.intervals : undefined,
      hrvCapturedAt: reading.capturedAt,
    });
    // Keep the shared home-popup record intact while adding the new reading.
    // The HRV endpoint returns the daily anchor, not latestWorkout.
    queryClient.setQueryData(['/api/movement/today', localDate], prev => ({ ...(prev || {}), ...log }));
    queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
    queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
  };

  // ── Zone 1: morning submit ──
  const handleMorningSubmit = async (hrvReading, readinessScore) => {
    setZone1Submitting(true);
    try {
      const effectiveReading = hrvReading ?? hrvReadingFromLog(todayLog);
      const captureDate = captureDateRef.current ?? todayLog?.date ?? localDate;
      const data = await postJson('/api/movement/morning', {
        date: captureDate,
        rmssd: effectiveReading?.rmssd ?? undefined,
        sdnn: effectiveReading?.sdnn ?? undefined,
        hrvSource: effectiveReading?.source ?? undefined,
        hrvQuality: effectiveReading?.quality ?? undefined,
        hrvIntervals: effectiveReading?.intervals?.length ? effectiveReading.intervals : undefined,
        hrvCapturedAt: effectiveReading?.capturedAt ?? undefined,
        readinessScore,
      });
      queryClient.setQueryData(['/api/movement/today', localDate], {
        ...(data.log || {}),
        latestWorkout: data.latestWorkout ?? null,
        rhythmColour: data.rhythmColour,
        movementColour: data.movementColour,
        signalContext: data.context || null,
      });
      setReadAgainMode(false);
      captureDateRef.current = null;
      setZone1Result({
        rhythmColour: data.rhythmColour,
        movementColour: data.movementColour,
        context: {
          cycleDay:   currentCycleInfo?.day   ?? null,
          cyclePhase: currentCycleInfo?.phase?.toLowerCase() ?? null,
          ...(data.context || {}),
        },
        rmssd: data.log?.rmssd ?? undefined,
        sdnn: data.log?.sdnn ?? undefined,
        hrvSource: data.log?.hrvSource ?? undefined,
        readinessScore: data.log?.readinessScore ?? undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar', calendarYear, calendarMonth + 1] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
    } catch (e) {
      console.error('Morning submit error:', e);
    } finally {
      setZone1Submitting(false);
    }
  };

  const handleReadAgain = () => {
    setZone1Result(null);
    setReadAgainMode(true);
  };

  // ── Zone 2: workout log ──
  const handleWorkoutSubmit = async (practiceName, durationMinutes, notes, practiceSignal) => {
    setZone2Submitting(true);
    try {
      await postJson('/api/movement/workout', {
        practiceName,
        durationMinutes,
        notes,
        practiceSignal,
      });
      // The workout endpoint returns the new session row, not the daily HRV
      // anchor. Do not replace the shared today query with that partial row.
      await queryClient.invalidateQueries({ queryKey: ['/api/movement/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/calendar', calendarYear, calendarMonth + 1] });
      queryClient.invalidateQueries({ queryKey: ['/api/movement/logs?days=30'] });
    } catch (e) {
      console.error('Workout submit error:', e);
    } finally {
      setZone2Submitting(false);
    }
  };

  const movementColour = displayResult?.movementColour ?? todayLog?.movementColour ?? null;

  const todayStr = localDate;
  const todayCalendarDay = Array.isArray(calendarLogs) ? calendarLogs.find(d => d.date === todayStr) : null;
  const todaySessionCount = todayCalendarDay?.sessions?.length ?? 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl isolate">
      <div className="w-full h-full flex flex-col gap-4">

        <MovementHeader />

        {/* Zone 1 — Morning Read */}
        <MovementZone1
          result={displayResult}
          isLoading={todayLoading}
          onMorningSubmit={handleMorningSubmit}
          onHrvCapture={handleHrvCapture}
          initialHrvReading={hrvReadingFromLog(todayLog)}
          rhythmStatus={todayLog?.signalContext?.rhythm?.status ?? null}
          readinessLogged={todayLog?.readinessScore != null}
          onReadAgain={handleReadAgain}
          submitting={zone1Submitting}
          recentLogs={recentLogs}
          cycleStartDate={cycleStartDate}
          cycleLength={cycleLength}
        />

        {/* Zone 2 — Practice Log */}
        <MovementZone2
          movementColour={movementColour}
          onWorkoutSubmit={handleWorkoutSubmit}
          submitting={zone2Submitting}
          todaySessionCount={todaySessionCount}
        />

        {/* Zone 3 — Calendar */}
        <MovementZone3
          calendarLogs={calendarLogs}
          calendarMonth={calendarMonth}
          calendarYear={calendarYear}
          localDate={localDate}
          onMonthChange={handleMonthChange}
          calendarQueryKey={['/api/movement/calendar', calendarYear, calendarMonth + 1]}
        />

        <GOE88ChatButton gradient="from-amber-400 to-orange-500" cardType="movement" />
      </div>
    </div>
  );
}
