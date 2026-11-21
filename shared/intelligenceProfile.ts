// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

/**
 * SharedIntelligenceProfile
 *
 * The central client data contract for GOE. Each card writes to its own section.
 * Server chat does not send this whole object on every message. It uses the
 * owner-scoped provider registry in server/cardContext.ts to select approved,
 * compact sibling context only when the question calls for it.
 *
 * Vocabulary follows the UI labels — not renamed unless the UI changes.
 * Kundalini moon centres (Eyebrows, Cheeks, Lips etc.) live under cyclical.moonCenter.
 * Human Design centres live under profile.humanDesign — two different systems.
 */
export interface SharedIntelligenceProfile {
  cyclical: {
    currentDay: number | null;
    currentPhase: 'Menstruation' | 'Follicular' | 'Ovulatory' | 'Early Luteal' | 'Late Luteal' | null;
    cycleLength: number;
    isFertile: boolean;
    cycleStartDate: string | null;
    moonCenter: string | null;   // GOE somatic centre (Eyebrows, Cheeks, Lips, etc.)
    moonPhase: string | null;    // Lunar phase (New, Waxing Crescent, Full, etc.)
  };
  rest: {
    energySignal: string | null;        // Evening: raw dropdown selection
    sleepJourney: string | null;        // Morning: sleep process
    wakingQuality: string | null;       // Morning: waking state
    nervousSystemState: 'resourced' | 'activated' | 'depleted' | null; // Synthesized from all three
    nightWakings: '0' | '1-2' | '3+' | null;
    nightSweats: boolean | null;        // Perimenopause-gated
    alcoholConsumed: boolean | null;    // Evening
    lastRestDate: string | null;
    lastRisingDate: string | null;
  };
  movement: {
    todayRmssd: number | null;
    todaySdnn: number | null;
    rhythmColour?: 'green' | 'yellow' | 'orange' | 'red' | null;
    movementColour?: 'green' | 'yellow' | 'orange' | 'red' | null;
    signalContext?: import('./movementSignal').MovementSignalSnapshot | null;
    readyToTrain: number | null;        // 1–10 subjective scale
    lastLogDate: string | null;
  };
  astrology: {
    currentTransitHighlight: string | null;   // Top transit summary for GOE88
    weeklySkySummary: string | null;           // Personal weekly current sky insight
    weeklyTransitSummary: string | null;       // Personal weekly transits insight
    lastRefreshed: string | null;
  };
  profile: {
    /**
     * GK and HD are parallel tab structures inside the Astrology card.
     * No separate files — this interface describes the shape of that existing data
     * so GOE88 knows what fields are available.
     */
    geneKeys: {
      geniusSequence: Array<{ role: string; geneKey: string; shadow: string; gift: string; siddhi: string }>;
      loveSequence: Array<{ role: string; geneKey: string; shadow: string; gift: string; siddhi: string }>;
      prosperitySequence: Array<{ role: string; geneKey: string; shadow: string; gift: string; siddhi: string }>;
      wisdomSequence: Array<{ role: string; geneKey: string; shadow: string; gift: string; siddhi: string }>;
    } | null;
    humanDesign: {
      type: string | null;
      authority: string | null;
      profile: string | null;
      definition: string | null;
      definedCentres: string[];
      undefinedCentres: string[];  // Centres the moon activates as it transits
    } | null;
    lifeStage: 'cycling' | 'perimenopause' | 'postmenopause' | null; // Self-selected, unlocks perimenopause fields
    birthDate: string | null;
    birthTime: string | null;
    birthLocation: string | null;
  };
}

export const defaultIntelligenceProfile: SharedIntelligenceProfile = {
  cyclical: {
    currentDay: null,
    currentPhase: null,
    cycleLength: 28,
    isFertile: false,
    cycleStartDate: null,
    moonCenter: null,
    moonPhase: null,
  },
  rest: {
    energySignal: null,
    sleepJourney: null,
    wakingQuality: null,
    nervousSystemState: null,
    nightWakings: null,
    nightSweats: null,
    alcoholConsumed: null,
    lastRestDate: null,
    lastRisingDate: null,
  },
  movement: {
    todayRmssd: null,
    todaySdnn: null,
    readyToTrain: null,
    lastLogDate: null,
  },
  astrology: {
    currentTransitHighlight: null,
    weeklySkySummary: null,
    weeklyTransitSummary: null,
    lastRefreshed: null,
  },
  profile: {
    geneKeys: null,
    humanDesign: null,
    lifeStage: null,
    birthDate: null,
    birthTime: null,
    birthLocation: null,
  },
};
