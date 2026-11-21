// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import { MoonPhase } from "astronomy-engine";

const PHASES = [
  { minimum: 337.5, maximum: 360, name: "New", emoji: "🌑" },
  { minimum: 0, maximum: 22.5, name: "New", emoji: "🌑" },
  { minimum: 22.5, maximum: 67.5, name: "Waxing Crescent", emoji: "🌒" },
  { minimum: 67.5, maximum: 112.5, name: "First Quarter", emoji: "🌓" },
  { minimum: 112.5, maximum: 157.5, name: "Waxing Gibbous", emoji: "🌔" },
  { minimum: 157.5, maximum: 202.5, name: "Full", emoji: "🌕" },
  { minimum: 202.5, maximum: 247.5, name: "Waning Gibbous", emoji: "🌖" },
  { minimum: 247.5, maximum: 292.5, name: "Last Quarter", emoji: "🌗" },
  { minimum: 292.5, maximum: 337.5, name: "Waning Crescent", emoji: "🌘" },
] as const;

export function getMoonPhase(date = new Date()): { name: string; emoji: string } {
  const longitude = MoonPhase(date);
  const phase = PHASES.find(({ minimum, maximum }) => longitude >= minimum && longitude < maximum)
    ?? PHASES[0];
  return { name: phase.name, emoji: phase.emoji };
}
