// Keep the personal reading out of context and contributions until opted in.
export function moonCentresEnabled(): boolean {
  return process.env.MOON_CENTRES_ENABLED === 'true';
}
