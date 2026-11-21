// GOE Platform — © 2022–2026 Leah M Wilson
// Per-card hook: Rest & Restore Intelligence data — self-contained
// Interface unchanged — swap internals without touching card code.

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { calculateSleepDuration } from '@/utils/cycleCalculations';
import { useDashboard } from '@/contexts/DashboardContext';
import { restCycleBucket, timeToHHMM } from '@shared/restRisingCore';
import { classifyRestField } from '@/components/RestIntelligenceCard/restCalculations';

const measuredAverageFields = (averages: any[]) => Object.fromEntries(
  averages.flatMap((entry) => {
    if (!Number.isFinite(entry?.averageMinutes)) return [];
    const key = entry.phase === 'Menstruation' ? 'menstruationAvgRest'
      : entry.phase === 'Follicular' ? 'follicularAvgRest'
      : entry.phase === 'Ovulatory' ? 'ovulationAvgRest'
      : entry.phase === 'Luteal' ? 'lutealAvgRest'
      : null;
    return key ? [[key, `${(entry.averageMinutes / 60).toFixed(1)} hours`]] : [];
  }),
);

interface SleepData {
  restTime: string;
  riseTime: string;
  energyAssessment: string;
  sleepProcess: string;
  wakingState: string;
  dreamFragment: string;
  morningReflection: string;
  menstruationAvgRest?: string | null;
  menstruationEnergyLevel?: string | null;
  menstruationDailyPattern?: 'resourced' | 'activated' | 'depleted';
  menstruationRestPattern?: 'resourced' | 'activated' | 'depleted';
  menstruationRisingPattern?: 'resourced' | 'activated' | 'depleted';
  follicularAvgRest?: string | null;
  follicularEnergyLevel?: string | null;
  follicularDailyPattern?: 'resourced' | 'activated' | 'depleted';
  follicularRestPattern?: 'resourced' | 'activated' | 'depleted';
  follicularRisingPattern?: 'resourced' | 'activated' | 'depleted';
  ovulationAvgRest?: string | null;
  ovulationEnergyLevel?: string | null;
  ovulationDailyPattern?: 'resourced' | 'activated' | 'depleted';
  ovulationRestPattern?: 'resourced' | 'activated' | 'depleted';
  ovulationRisingPattern?: 'resourced' | 'activated' | 'depleted';
  lutealAvgRest?: string | null;
  lutealEnergyLevel?: string | null;
  lutealDailyPattern?: 'resourced' | 'activated' | 'depleted';
  lutealRestPattern?: 'resourced' | 'activated' | 'depleted';
  lutealRisingPattern?: 'resourced' | 'activated' | 'depleted';
}

const DEFAULT_SLEEP: SleepData = {
  restTime: '22:30', riseTime: '07:15',
  energyAssessment: '', sleepProcess: '', wakingState: '', dreamFragment: '', morningReflection: '',
};

export function useRestData() {
  const { user, isAuthenticated } = useAuth();
  const { chatHistories, sendChatMessage, updateIntelligenceProfile } = useDashboard();
  const [sleepData, setSleepData] = useState<SleepData>(DEFAULT_SLEEP);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      await aggregateRestRisingData();
      try {
        const res = await fetch('/api/sleep/phase-averages', { credentials: 'include' });
        const averages = res.ok ? await res.json() : [];
        updateSleepData(measuredAverageFields(averages));
      } catch {}
    };
    void load();
  }, [isAuthenticated]);

  const updateSleepData = (newData: Partial<SleepData>) => {
    setSleepData((prev) => ({ ...prev, ...newData }));
  };

  const aggregateRestRisingData = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/rest-rising/submissions', { credentials: 'include' });
      if (!res.ok) return;
      const submissions = await res.json();
      if (!submissions.length) return;

      const nightlyData = submissions.reduce((acc: any, s: any) => {
        const date = s.sleepDate;
        if (!date) return acc;
        if (!acc[date]) acc[date] = { sleepDate: date, cyclePhase: s.cyclePhase, rest: null, rising: null };
        if (!acc[date].cyclePhase && s.cyclePhase) acc[date].cyclePhase = s.cyclePhase;
        if (s.restTime && !acc[date].rest) acc[date].rest = {
          restTime: s.restTime,
          energyAssessmentLabel: s.energyAssessment,
          energyAssessment: s.energyAssessmentClassification || classifyRestField(s.energyAssessment),
        };
        if (s.riseTime && !acc[date].rising) acc[date].rising = {
          riseTime: s.riseTime,
          sleepProcess: s.sleepProcessClassification || classifyRestField(s.sleepProcess),
          wakingState: s.wakingStateClassification || classifyRestField(s.wakingState),
        };
        return acc;
      }, {});

      const phaseAgg: any = Object.values(nightlyData).reduce((acc: any, night: any) => {
        const phase = restCycleBucket(night.cyclePhase);
        if (!phase) return acc;
        if (!acc[phase]) acc[phase] = { nightCount: 0, sleepDurations: [], energyLabels: {}, energyAssessments: { resourced: 0, activated: 0, depleted: 0 }, sleepProcesses: { resourced: 0, activated: 0, depleted: 0 }, wakingStates: { resourced: 0, activated: 0, depleted: 0 } };
        acc[phase].nightCount++;
        if (night.rest?.restTime && night.rising?.riseTime) {
          const dur = calculateSleepDuration(night.rest.restTime, night.rising.riseTime);
          if (dur > 0) acc[phase].sleepDurations.push(dur);
        }
        if (night.rest?.energyAssessmentLabel) {
          const label = night.rest.energyAssessmentLabel;
          acc[phase].energyLabels[label] = (acc[phase].energyLabels[label] || 0) + 1;
        }
        if (night.rest?.energyAssessment) acc[phase].energyAssessments[night.rest.energyAssessment]++;
        if (night.rising?.sleepProcess) acc[phase].sleepProcesses[night.rising.sleepProcess]++;
        if (night.rising?.wakingState) acc[phase].wakingStates[night.rising.wakingState]++;
        return acc;
      }, {});

      const getDominant = (counts: any) => {
        const total = Object.values(counts).reduce((s: number, c: any) => s + (c as number), 0);
        if (!total) return null;
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      };

      const patterns: any = {};
      Object.keys(phaseAgg).forEach((phase) => {
        const d = phaseAgg[phase];
        const name = phase;
        if (d.sleepDurations.length) {
          const avg = d.sleepDurations.reduce((s: number, v: number) => s + v, 0) / d.sleepDurations.length;
          patterns[`${name}AvgRest`] = `${avg.toFixed(1)} hours`;
        }
        const dom = getDominant(d.energyAssessments);
        const energyLabel = getDominant(d.energyLabels);
        const domRest = getDominant(d.sleepProcesses);
        const domRising = getDominant(d.wakingStates);
        if (dom) patterns[`${name}DailyPattern`] = dom;
        if (energyLabel) patterns[`${name}EnergyLevel`] = energyLabel;
        if (domRest) patterns[`${name}RestPattern`] = domRest;
        if (domRising) patterns[`${name}RisingPattern`] = domRising;
      });

      const newestFirst = [...submissions].sort((a: any, b: any) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      const latestRestTime = timeToHHMM(newestFirst.find((s: any) => s.restTime)?.restTime);
      const latestRiseTime = timeToHHMM(newestFirst.find((s: any) => s.riseTime)?.riseTime);
      updateSleepData({
        ...patterns,
        ...(latestRestTime ? { restTime: latestRestTime } : {}),
        ...(latestRiseTime ? { riseTime: latestRiseTime } : {}),
      });
    } catch {
      // Fail silently; unknown personal patterns remain empty.
    }
  };

  const analyzeRestPractice = async (eveningState: string, cycleData?: any, sleepDataParam?: any, force = false) => {
    const timeZone = (user as any)?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Date().toLocaleDateString('en-CA', { timeZone });
    const res = await apiRequest('POST', '/api/analyze-rest-practice', {
      eveningState, cycleData, sleepData: sleepDataParam, localDate: today,
      tz: timeZone, force,
    });
    if (!res.ok) throw new Error('Failed to analyze rest practice');
    return res.json();
  };

  return {
    sleepData,
    restChatHistory: chatHistories['rest'] || [],
    updateSleepData,
    updateIntelligenceProfile,
    analyzeRestPractice,
    sendChatMessage,
  };
}
