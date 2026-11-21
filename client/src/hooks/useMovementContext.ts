// GOE Platform — © 2022–2026 Leah M Wilson
// Per-card hook: Movement Intelligence — cycle context only
// Movement card fetches its own data via useQuery. This hook provides
// the cross-card cycle context (phase, day) the Movement card needs.

import { useCycleData } from '@/hooks/useCycleData';

export function useMovementContext() {
  const { currentCycleInfo, cycleData } = useCycleData();
  return { currentCycleInfo, cycleStartDate: cycleData.cycleStartDate, cycleLength: cycleData.cycleLength };
}
