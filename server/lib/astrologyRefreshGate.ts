// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

export function shouldRunAutomaticAstrologyRefresh(
  env: { NODE_ENV?: string; ASTROAPP_REFRESH_ENABLED?: string },
): boolean {
  return env.NODE_ENV === 'production'
    && env.ASTROAPP_REFRESH_ENABLED !== 'false';
}
