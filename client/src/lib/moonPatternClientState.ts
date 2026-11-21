import { queryClient, apiRequest } from '@/lib/queryClient';
import { connectMoonPatternSchema, type ConnectMoonPattern, type MoonPatternResponse } from '@shared/moonPattern';

export const MOON_PATTERN_QUERY_KEY = ['/api/cycle/moon-pattern'] as const;
export const MOON_PATTERN_UPDATED_EVENT = 'goe-moon-pattern-updated';
export function publishMoonPattern(data: MoonPatternResponse) {
  queryClient.setQueryData(MOON_PATTERN_QUERY_KEY, data);
  void queryClient.invalidateQueries({ queryKey: ['/api/rest-practice/today'] });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOON_PATTERN_UPDATED_EVENT, { detail: data }));
  }
}

// Public receiving contract for setup / a future workshop. Draft edits remain
// with the caller; only a successful atomic connect publishes a new active read.
export async function connectMoonPattern(input: ConnectMoonPattern): Promise<MoonPatternResponse> {
  const payload = connectMoonPatternSchema.parse(input);
  const response = await apiRequest('PUT', '/api/cycle/moon-pattern', payload);
  const saved: MoonPatternResponse = await response.json();
  publishMoonPattern(saved);
  return saved;
}
