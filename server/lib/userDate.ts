// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

// ─── User-local "today" resolution ─────────────────────────────────────────
// CONCERN 2 of the timezone unification (see scheduler.ts for CONCERN 1, the
// UTC/NY-anchored cron TRIGGER, which is a DST workaround and must not change).
//
// This module answers "what calendar day is it for THIS user" — cycle day,
// movement log date, rest date, and the card's "today" all need the user's
// LOCAL day so they roll over at the user's midnight, not UTC's or a
// hardcoded region's. A fork user gets their own midnight once their profile
// timezone is set.
//
// Never falls back to UTC or America/New_York — absent a profile timezone,
// the fallback is the owner's home timezone, named here as a single constant.
export const OWNER_FALLBACK_TZ = 'America/Edmonton';

// Minimal shape this module needs from storage — avoids importing the full
// DatabaseStorage type and keeps this helper usable from anywhere server-side.
export interface UserTimezoneLookup {
  getUserProfile(userId: string): Promise<{ timezone?: string | null } | undefined>;
}

/** SYNC variant for call sites that already hold a tz string (no DB round-trip). */
export function userDateFromTz(tz: string): string {
  // en-CA locale formats as YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

export function mondayOfLocalWeek(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves a user's "today" as YYYY-MM-DD in their profile timezone.
 * Falls back to OWNER_FALLBACK_TZ (never UTC, never a hardcoded region other
 * than the owner's own) when the profile or its timezone is missing.
 */
export async function resolveUserDate(userId: string, storage: UserTimezoneLookup): Promise<string> {
  let tz: string | null | undefined;
  try {
    const profile = await storage.getUserProfile(userId);
    tz = profile?.timezone;
  } catch {
    tz = null;
  }
  return userDateFromTz(tz || OWNER_FALLBACK_TZ);
}
