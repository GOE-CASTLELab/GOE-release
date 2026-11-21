import { useMoonPattern } from '@/hooks/useMoonPattern';
// GOE Platform — © 2022–2026 Leah M Wilson
// Per-card hook: Cyclical Intelligence data — self-contained
// Interface unchanged — swap internals without touching card code.

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  calculateCycleInfo,
  parseLocalDate,
  cyclePhaseForDay,
  wrappedCycleDay,
  type CycleInfo,
} from '@/utils/cycleCalculations';
import { useDashboard } from '@/contexts/DashboardContext';
import { type SharedIntelligenceProfile } from '@shared/intelligenceProfile';
import {
  CYCLE_DATA_UPDATED_EVENT,
  cycleDataFromUpdateEvent,
  publishCycleData,
  type CycleClientData,
} from '@/lib/cycleClientState';

interface CycleData {
  cycleLength: number;
  cycleStartDate: string;
  moonCenterStartDate: string;
  periodEndDate?: string;
  periodData?: Array<{ startDate: string; endDate: string | null; extensions?: Array<{ date: string; previousCycleLength: number; resultingCycleLength: number }> }>;
  asOfDate?: string;
}

const DEFAULT_CYCLE: CycleData = { cycleLength: 28, cycleStartDate: '', moonCenterStartDate: '' };
const DEFAULT_INFO: CycleInfo = { day: null, phase: null, isFertile: false };

function findMostRecentStart(cd: CycleData): string {
  if (cd.periodData?.length) {
    const sorted = cd.periodData
      .filter((p) => p.startDate)
      .map((p) => p.startDate)
      .sort((a, b) => parseLocalDate(b)!.getTime() - parseLocalDate(a)!.getTime());
    if (sorted.length) return sorted[0];
  }
  return cd.cycleStartDate;
}

function recalc(cd: CycleData) {
  const today = cd.asOfDate ? new Date(`${cd.asOfDate}T12:00:00`) : new Date();
  const len = cd.cycleLength || 28;
  let info = calculateCycleInfo(today, findMostRecentStart(cd), len);
  // If the raw day runs past one cycle length, wrap it and re-read phase from the
  // single owner (@shared/cycleCore) rather than recomputing the formula here.
  if (info.day !== null && info.day > len) {
    const w = wrappedCycleDay(info.day, len);
    info = { day: w, phase: cyclePhaseForDay(w, len), isFertile: info.isFertile };
  }
  return { currentCycleInfo: info };
}

export function useCycleData() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { updateIntelligenceProfile } = useDashboard();

  const [cycleData, setCycleData] = useState<CycleData>(DEFAULT_CYCLE);
  const [currentCycleInfo, setCurrentCycleInfo] = useState<CycleInfo>(DEFAULT_INFO);
  const { currentMoonCenter, moonPattern, moonPatternRevision } = useMoonPattern();

  useEffect(() => {
    updateIntelligenceProfile('cyclical', { moonCenter: currentMoonCenter.current });
  }, [currentMoonCenter.current]);

  const applyCycleData = (data: CycleClientData) => {
    if (!data?.cycleStartDate) return;
    const cd: CycleData = {
      cycleLength: data.cycleLength || 28,
      cycleStartDate: data.cycleStartDate,
      moonCenterStartDate: data.moonCenterStartDate || '',
      periodEndDate: data.periodEndDate || undefined,
      periodData: data.periodData || undefined,
      asOfDate: data.asOfDate,
    };
    const { currentCycleInfo: ci } = recalc(cd);
    setCycleData(cd);
    setCurrentCycleInfo(ci);
    updateIntelligenceProfile('cyclical', {
      currentDay: ci.day,
      currentPhase: ci.phase as SharedIntelligenceProfile['cyclical']['currentPhase'],
      cycleLength: cd.cycleLength,
      isFertile: ci.isFertile,
      cycleStartDate: cd.cycleStartDate,
    });
  };

  const fetchAndApply = () => {
    if (!isAuthenticated) return;
    apiRequest('GET', '/api/cycle/data').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      applyCycleData(data);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchAndApply();
  }, [isAuthenticated]);

  useEffect(() => {
    const handler = (event: Event) => {
      const data = cycleDataFromUpdateEvent(event);
      if (data) applyCycleData(data);
      else fetchAndApply();
    };
    window.addEventListener(CYCLE_DATA_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CYCLE_DATA_UPDATED_EVENT, handler);
  }, [isAuthenticated]);

  const updateCycleData = async (newData: Partial<CycleData>) => {
    if (!isAuthenticated) return;
    const previous = cycleData;
    try {
      let base = cycleData;
      try {
        const fresh = await apiRequest('GET', '/api/cycle/data');
        if (fresh.ok) {
          const fd = await fresh.json();
          if (fd?.cycleStartDate) {
            base = {
              cycleLength: fd.cycleLength || 28,
              cycleStartDate: fd.cycleStartDate,
              moonCenterStartDate: fd.moonCenterStartDate || '',
              periodEndDate: fd.periodEndDate,
              periodData: fd.periodData,
              asOfDate: fd.asOfDate,
            };
          }
        }
      } catch {}
      const updated = { ...base, ...newData };
      publishCycleData(updated);
      const res = await apiRequest('PUT', '/api/cycle/data', updated);
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      publishCycleData(saved);
      toast({ title: 'Cycle data updated', description: 'Your menstrual cycle information has been saved.' });
    } catch {
      publishCycleData(previous);
      toast({ title: 'Update failed', description: 'Failed to update cycle data. Please try again.', variant: 'destructive' });
    }
  };

  const recordCycleAction = async (action: 'period_started' | 'period_ended' | 'cycle_extended', date?: string) => {
    if (!isAuthenticated) return;
    const previous = cycleData;
    try {
      const res = await apiRequest('POST', '/api/cycle/action', { action, ...(date ? { date } : {}) });
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      publishCycleData(saved);
      toast({ title: 'Cycle data updated', description: 'Your menstrual cycle information has been saved.' });
      return saved;
    } catch {
      publishCycleData(previous);
      toast({ title: 'Update failed', description: 'Failed to update cycle data. Please try again.', variant: 'destructive' });
    }
  };

  return {
    cycleData,
    currentCycleInfo,
    currentMoonCenter,
    moonPattern,
    moonPatternRevision,
    updateCycleData,
    recordCycleAction,
    extendCycle:      () => recordCycleAction('cycle_extended'),
    resetCycleToToday: () => {
      const today = new Date().toISOString().split('T')[0];
      return recordCycleAction('period_started', today);
    },
  };
}
