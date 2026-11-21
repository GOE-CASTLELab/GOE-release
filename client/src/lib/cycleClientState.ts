import { queryClient } from '@/lib/queryClient';

export const CYCLE_QUERY_KEY = ['/api/cycle/data'] as const;
export const CYCLE_DATA_UPDATED_EVENT = 'goe-cycle-data-updated';

export type CycleClientData = {
  cycleStartDate: string;
  cycleLength?: number;
  moonCenterStartDate?: string | null;
  periodEndDate?: string | null;
  periodData?: Array<{ startDate: string; endDate: string | null }> | null;
  asOfDate?: string;
};

export function publishCycleData(data: CycleClientData) {
  queryClient.setQueryData(CYCLE_QUERY_KEY, data);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CYCLE_DATA_UPDATED_EVENT, { detail: data }));
  }
}

export function cycleDataFromUpdateEvent(event: Event): CycleClientData | null {
  const detail = (event as CustomEvent<CycleClientData>).detail;
  return detail?.cycleStartDate ? detail : null;
}
