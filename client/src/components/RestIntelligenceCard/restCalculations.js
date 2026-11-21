// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

// Nervous system state classification for Rest & Restore Intelligence
// Canonical source — unified with Movement readiness signal colour language

export {
  classifyRestField,
  classifyNervousSystemState,
} from '@shared/restRisingCore';

export const NERVOUS_SYSTEM = {
  resourced: {
    symbol: '◯',
    label: 'Resourced',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    description: 'Integrated, present, grounded'
  },
  activated: {
    symbol: '◇',
    label: 'Activated',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    description: 'Energised or wired, seeking discharge'
  },
  depleted: {
    symbol: '✦',
    label: 'Depleted',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    description: 'Overwhelmed, checked out, needs restoration'
  }
};

// Phase-aware rest guidance brief (short copy for Zone 1)
export const getPhaseRestGuidance = (phase) => {
  switch (phase) {
    case 'Menstruation': return 'Deep rest is the work. Your body is clearing — honour slowness.';
    case 'Follicular':   return 'Sleep rebuilds. You may need less and still feel restored.';
    case 'Ovulatory':    return 'Lighter sleep is natural. Your energy is at its apex.';
    case 'Early Luteal': return 'Your body demands more. Prioritise quality rest and nourishment.';
    case 'Late Luteal':  return 'Sleep fragments as hormones fall. Protect quality rest, ease the load.';
    default:             return 'Tune into what your body is asking for tonight.';
  }
};
