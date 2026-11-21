import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { moonCentresEnabled } from '@/lib/moonCentres';
import { MOON_PATTERN_QUERY_KEY, connectMoonPattern } from '@/lib/moonPatternClientState';
import { calculateMoonCenter } from '@/utils/cycleCalculations';
import { moonPatternRevisionKey, type MoonPatternResponse } from '@shared/moonPattern';

export function useMoonPattern() {
  const { isAuthenticated } = useAuth();
  const query = useQuery<MoonPatternResponse>({
    queryKey: MOON_PATTERN_QUERY_KEY,
    queryFn: async () => (await apiRequest('GET', '/api/cycle/moon-pattern')).json(),
    enabled: isAuthenticated,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
  });
  const enabled = isAuthenticated && moonCentresEnabled && !!query.data?.effectiveEnabled;
  const moonPattern = enabled ? query.data?.pattern || null : null;
  const asOfDate = query.data?.asOfDate;
  return {
    moonPattern,
    connectedMoonPattern: query.data?.pattern || null,
    moonPatternRevision: moonPatternRevisionKey(query.data?.pattern, enabled),
    currentMoonCenter: calculateMoonCenter(asOfDate ? new Date(`${asOfDate}T12:00:00`) : new Date(), moonPattern),
    connectMoonPattern,
  };
}
