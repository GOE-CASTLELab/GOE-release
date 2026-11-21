// Identity catalogue only. Alphabetical keys are NOT a personal cycle order.
// Descriptions preserved verbatim from the existing moon-centre detail catalogue.
export const MOON_CENTRE_CATALOGUE = {
  'breasts': {
    name: "Breasts",
    location: "Chest",
    theme: "Nurture, deep emotionality",
    neuroEmotional: "Oxytocin system",
    insight: "Oxytocin supports bonding, emotional openness, and social empathy.",
    focus: "Compassion & forgiveness",
    kriya: "Meditation to Remove Fear of the Future",
    kriyaExplanation: "Crossed-thumb mudra and steady breath calm subconscious fear loops → clears anxiety from the heart center, restoring compassion, nurturance, and emotional openness."
  },
  'cheeks': {
    name: "Cheeks",
    location: "Cheekbones",
    theme: "Radiance, playfulness",
    neuroEmotional: "Mirror neurons",
    insight: "Mirror neurons fire both when performing an action and when observing the same action in others, underpinning empathy and social connection.",
    focus: "Joyful presence & connection",
    kriya: "Fists of Anger",
    kriyaExplanation: "Cathartic arm + breath practice discharges suppressed emotion through face/jaw circuits → restores authentic radiance/playfulness."
  },
  'clitoris': {
    name: "Clitoris",
    location: "Pelvic root",
    theme: "Magnetism, sensual creativity",
    neuroEmotional: "Dopamine system",
    insight: "Dopamine is linked to pleasure, motivation, and vitality.",
    focus: "Kundalini energy & empowerment",
    kriya: "Ego Eradicator",
    kriyaExplanation: "Breath of Fire creates a euphoric dopamine surge; arms open aura = magnetic radiance, clearing shame and energizing sensual vitality."
  },
  'earlobes': {
    name: "Earlobes",
    location: "Ears",
    theme: "Discernment, boundary setting",
    neuroEmotional: "Amygdala",
    insight: "The amygdala processes emotions and evaluates trustworthiness, influencing emotional clarity and boundaries.",
    focus: "Emotional clarity & self-trust",
    kriya: "Meditation to Conquer Self-Animosity",
    kriyaExplanation: "Alternating breath pattern regulates limbic reactivity; builds emotional steadiness and clear self-boundaries."
  },
  'eyebrows': {
    name: "Eyebrows",
    location: "3rd Eye / Brow",
    theme: "Intuition, clarity",
    neuroEmotional: "Prefrontal cortex",
    insight: "The prefrontal cortex, particularly the ventromedial region, integrates emotional and cognitive information, facilitating intuitive decision-making.",
    focus: "Executive function, intuition, vision",
    kriya: "Intelligence Meditation",
    kriyaExplanation: "Jupiter/Saturn finger mudra + visualization activates higher-order cognition, linking intuition with decision-making."
  },
  'hairline': {
    name: "Hairline",
    location: "Forehead hairline",
    theme: "Cosmic perception, gateway",
    neuroEmotional: "Default mode network + pineal",
    insight: "The DMN supports introspection, identity, and meditative self-awareness. The pineal gland regulates inner cycles and visual-spatial imagination.",
    focus: "Meditative vision & higher self-connection",
    kriya: "Meditation for Healing Addiction",
    kriyaExplanation: "Temple pressure + silent Sa-Ta-Na-Ma loop rebalance pituitary-pineal axis; frees compulsive loops for cosmic perception."
  },
  'inner-thighs': {
    name: "Inner Thighs",
    location: "Inner legs",
    theme: "Grounded intimacy, safety",
    neuroEmotional: "Somatic self-awareness",
    insight: "Somatic practices improve interoception and felt sense of bodily safety and grounding.",
    focus: "Deep embodiment & sensual grounding",
    kriya: "Guan Chakra Kriya",
    kriyaExplanation: "Circular arm movements orbit the head while thighs and pelvic floor stabilize → builds embodied grounding, strengthens connection with lower triangle, cultivates safety and intimacy."
  },
  'lips': {
    name: "Lips",
    location: "Mouth/Lips",
    theme: "Expression, sensuality",
    neuroEmotional: "Broca's area",
    insight: "Broca's area is crucial for speech production and language processing.",
    focus: "Communication & sacred speech",
    kriya: "Kirtan Kriya (Sa Ta Na Ma)",
    kriyaExplanation: "Mantra + mudra integrate speech and memory centers, rewiring expression through 'sacred speech.'"
  },
  'nape-of-neck': {
    name: "Nape of Neck",
    location: "Base of skull",
    theme: "Receptivity, vulnerability",
    neuroEmotional: "Vagus nerve",
    insight: "The vagus nerve regulates the parasympathetic nervous system, fostering calm, trust, and regulation.",
    focus: "Surrender & nervous system regulation",
    kriya: "Meditation to Still the Moving Mind",
    kriyaExplanation: "Khechari mudra + nose-tip gaze calm vagal/autonomic turbulence, increasing surrender and receptivity."
  },
  'navel': {
    name: "Navel",
    location: "Solar plexus",
    theme: "Willpower, identity",
    neuroEmotional: "Gut-brain axis",
    insight: "The gut-brain axis influences mood, drive, and self-concept through complex hormonal signaling.",
    focus: "Confidence & power alignment",
    kriya: "Sat Kriya",
    kriyaExplanation: "Navel pumping directly engages gut-brain feedback, strengthening core willpower; mantra imprints 'Truth is my Identity.'"
  },
  'vagina': {
    name: "Vagina",
    location: "Womb entrance",
    theme: "Inner truth, mystery",
    neuroEmotional: "Root-brain connection",
    insight: "The pelvic region is richly innervated and influences autonomic and emotional states, though not classically linked to brain centers.",
    focus: "Root chakra anchoring & womb wisdom",
    kriya: "Meditation Into Being (I Am, I Am)",
    kriyaExplanation: "Links finite and Infinite self; hand at heart bridges root-autonomic drives with higher soul identity and inner truth."
  },
} as const;

export type MoonCentreId = keyof typeof MOON_CENTRE_CATALOGUE;
