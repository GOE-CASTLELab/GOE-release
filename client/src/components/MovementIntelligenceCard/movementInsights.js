// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
//
// Pre-authored insight copy for Movement Intelligence — Zone 1.
// No AI call. Logic picks the right block. Voice: witness, not prescribe.
// "orient not optimise"

// ─── Colour signal meta ────────────────────────────────────────────────────────
export const COLOUR_META = {
  green:       { label: 'Green',       bg: 'bg-emerald-50',  dot: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  yellow:      { label: 'Yellow',      bg: 'bg-amber-50',    dot: 'bg-amber-400',   text: 'text-amber-700',   border: 'border-amber-200',   pill: 'bg-amber-100 text-amber-700 border-amber-200'   },
  orange:      { label: 'Orange',      bg: 'bg-orange-50',   dot: 'bg-orange-500',  text: 'text-orange-700',  border: 'border-orange-200',  pill: 'bg-orange-100 text-orange-700 border-orange-200'  },
  red:         { label: 'Red',         bg: 'bg-rose-50',     dot: 'bg-rose-500',    text: 'text-rose-700',    border: 'border-rose-200',    pill: 'bg-rose-100 text-rose-700 border-rose-200'    },
  unclassified: { label: 'Building',   bg: 'bg-gray-50',     dot: 'bg-gray-400',    text: 'text-gray-600',    border: 'border-gray-200',    pill: 'bg-gray-100 text-gray-600 border-gray-200'    },
};

// Calendar dot colour by signal
export const SIGNAL_DOT_BG = {
  green:   'bg-emerald-400',
  yellow:  'bg-amber-400',
  orange:  'bg-orange-500',
  red:     'bg-rose-500',
};

export function cycleContextSentence(cyclePhase, cycleDay) {
  if (!cyclePhase || !cycleDay) return '';
  if (cyclePhase === 'late luteal')  return `Day ${cycleDay} — late luteal. Hormones are declining and the body is responding.`;
  if (cyclePhase === 'early luteal') return `Day ${cycleDay} — early luteal. Hormones and energy are beginning to fluctuate.`;
  if ((cyclePhase === 'ovulatory' || cyclePhase === 'ovulation'))    return `Day ${cycleDay} — ovulation window. Physical and energetic capacity are at their peak.`;
  if (cyclePhase === 'follicular')   return `Day ${cycleDay} — follicular phase. Energy is building through this window. Allow the alignment of hormones and energy to move the body.`;
  if (cyclePhase === 'menstruation') return `Day ${cycleDay} — the beginning of a new cycle. The body is naturally drawing inward while releasing what no longer serves.`;
  return '';
}


export const MOVEMENT_INFO = {
  "Training HRV Read (i)": [
    [
      "Your Rhythm is your body's reading, taken from your HRV."
    ],
    [
      "RMSSD, the beat-to-beat change in your heart rate, sets Your Rhythm. SDNN, the overall variability across the recording, is shown alongside it."
    ],
    [
      "Each reading is compared with your own readings from the same phase. In transition or postmenopause, it's compared with your recent readings."
    ],
    [
      "The colour shows where today's RMSSD sits against those readings."
    ],
    [
      "Green: above your phase readings. Your body has a high stress-buffer.",
      "Yellow: within your phase readings. Your system is stable and recovering well.",
      "Orange: below your phase readings. Your system is prioritizing internal regulation.",
      "Red: below your phase readings two days running. Your body is in a recharge cycle."
    ],
    [
      "Where you are in your hormonal life shapes what your RMSSD means. A cycling body moves through predictable fluctuation, a body in transition is navigating a new and changing landscape, a postmenopausal body reads from a new and stable floor."
    ],
    [
      "Menstruation: RMSSD often drops in the first days.",
      "Follicular: RMSSD rises with estrogen.",
      "Ovulation: RMSSD can peak, then dip as progesterone rises.",
      "Luteal: RMSSD runs lower as progesterone rises.",
      "Perimenopause: RMSSD shifts unpredictably.",
      "Postmenopause: RMSSD settles on a lower, steady floor."
    ],
    [
      "For a cycling body, the first three readings in each phase show: Observing: your rhythm is building."
    ],
    [
      "For a body in transition or postmenopause, the first three readings overall show: Observing: your rhythm is building."
    ]
  ],
  "Movement Library (i)": [
    [
      "Movement Read is your experience, taken from what you enter: your training readiness, from sluggish to motivated, and your rest and rising."
    ],
    [
      "Your training readiness sets the colour. Night sweats, alcohol or waking in the night shape it."
    ],
    [
      "The colour sets the practices offered."
    ],
    [
      "Green: high demand, build capacity.",
      "Yellow: moderate demand, maintain rhythm.",
      "Orange: low demand, repair and integrate.",
      "Red: minimal demand, deep nervous system rest."
    ],
    [
      "Your cycle phase, state of transition or postmenopause, shapes the language of your Movement Read."
    ]
  ],
  "Movement Archive (i)": [
    [
      "The archive holds three records for each day."
    ],
    [
      "Your Rhythm: your RMSSD that day.",
      "Movement Read: the experience you logged as cell colour.",
      "Movement you chose, coloured by practice as dot on calendar cell."
    ],
    [
      "Side by side they show where your body, your experience and your choice met or moved apart."
    ],
    [
      "A cell without dots: experience recorded, no movement logged.",
      "Dots without a cell: movement logged, no experience recorded.",
      "A blank Rhythm: no HRV reading taken."
    ],
    [
      "RMSSD can change before you consciously register a shift, or after the body is already carrying it."
    ],
    [
      "When RMSSD reads lower than how you feel, your body may be ahead of your awareness."
    ],
    [
      "When RMSSD reads higher, it may not have caught up to a hormonal load yet."
    ],
    [
      "RMSSD shifts within a day with stress, sleep, alcohol and illness. Hormonal shifts take several days to show. Your body, your experience and your choice, side by side."
    ],
    [
      "Moving with the intelligence of your systems, honouring self-knowledge over external data markers."
    ]
  ]
};

const PHASE_LINES = {
  "menstruation": {
    "green": "Your body is releasing and your experience is motivated. What movement would honour both?",
    "yellow": "Your body is releasing and your experience is rising. What movement would support what is already in motion?",
    "orange": "Your body is releasing and your experience is easing. What movement would create space without adding weight?",
    "red": "Your body is releasing and your experience is sluggish. What movement would give to the body without asking for more?"
  },
  "follicular": {
    "green": "Energy is building and your experience is motivated. What movement would meet that fully?",
    "yellow": "Energy is building and your experience is rising. What movement would support what is opening?",
    "orange": "Energy is building and your experience is easing. What movement would tend to what is growing without rushing it?",
    "red": "Energy is building and your experience is sluggish. What movement would protect what is just beginning?"
  },
  "ovulation": {
    "green": "The energy body is at its peak and your experience is motivated. What movement would meet this fully?",
    "yellow": "The energy body is at its peak and your experience is rising. What movement would honour what is available today?",
    "orange": "The energy body is at its peak and your experience is easing. What movement would honour this without tipping into demanding?",
    "red": "The energy body is at its peak and your experience is sluggish. What movement would acknowledge this peak without asking for more?"
  },
  "early luteal": {
    "green": "The energy body is entering a transitional ebb period and your experience is motivated. What movement would make use of what is present in the shifts?",
    "yellow": "The energy body is entering a transitional ebb period and your experience is rising. What movement would support your current capacity?",
    "orange": "The energy body is entering a transitional ebb period and your experience is easing. What movement would work with this shift rather than against it?",
    "red": "The energy body is entering a transitional ebb period and your experience is sluggish. What movement would feel supportive and nurturing?"
  },
  "late luteal": {
    "green": "The body is preparing for renewal and your experience is motivated. What movement would complement this shift with the energy still available?",
    "yellow": "The body is preparing for renewal and your experience is rising. What movement would support turning inward and reviewing what is ready to be released?",
    "orange": "The body is preparing for renewal and your experience is easing. What movement would support this turning inward without adding friction?",
    "red": "The body is preparing for renewal and your experience is sluggish. What movement would honour the approaching threshold?"
  },
  "neutral": {
    "green": "Your experience is motivated. What movement would meet that fully?",
    "yellow": "Your experience is rising. What movement would support what is opening?",
    "orange": "Your experience is easing. What movement would create space without adding weight?",
    "red": "Your experience is sluggish. What movement would give to the body without asking for more?"
  }
};

export const READINESS_NOT_LOGGED_TEXT = 'Your readiness is yet to be logged.';

export function getRhythmText({ signalContext }) {
  if (!signalContext) return '';
  const { rhythm } = signalContext;
  if (rhythm.rhythmColour) return `Your rhythm is recorded as ${rhythm.rhythmColour}.`;
  if (rhythm.status === 'observing') return 'Observing: your rhythm is building.';
  return '';
}

export function getMovementReadText({ signalContext }) {
  if (!signalContext?.movement?.readinessWord) return '';
  const { movement, phaseForWords } = signalContext;
  const colour = movement.movementColour;
  const phaseLine = PHASE_LINES[phaseForWords ?? 'neutral']?.[colour];
  const flags = movement.restFlags ?? [];
  const flagText = flags.length > 1 ? flags.slice(0, -1).join(', ') + ' and ' + flags.at(-1) : flags[0];
  if (!movement.restLogged) return [phaseLine, 'Record rest and rising for a full reading.'].filter(Boolean).join(' ');
  if (movement.appliedDrop > 0) {
    return [`Your rest and rising, with ${flagText}, has lowered your movement read to ${colour}.`, phaseLine]
      .filter(Boolean).join(' ');
  }
  return phaseLine ?? '';
}
