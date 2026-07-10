import type { TutorScript } from './types'

const scripts: TutorScript[] = [
  {
    conceptId: 'uncertainty',
    opening: [
      {
        from: 'tutor',
        text: 'Think of a camera: freeze the motion with a fast shutter and you lose any sense of where it\'s headed. Blur it with a slow shutter and you see the motion, but not the spot.',
      },
      { from: 'tutor', text: 'A quantum particle is like that — except the trade-off isn\'t in the camera. It\'s in the particle itself.' },
    ],
    branches: [
      {
        id: 'math',
        label: 'give me the math',
        turns: [
          { from: 'you', text: 'give me the math' },
          {
            from: 'tutor',
            text: 'Position and momentum are Fourier partners: ψ(x) and its transform φ(p) describe the same state. A narrow ψ(x) forces a wide φ(p).',
          },
          {
            from: 'tutor',
            text: 'The widths obey Δx · Δp ≥ ħ/2 — the same inequality that limits any wave, sound included. Quantum just makes matter wavy.',
          },
        ],
      },
      {
        id: 'tools',
        label: "so it's not the tools being bad?",
        turns: [
          { from: 'you', text: "so it's not the tools being bad?" },
          {
            from: 'tutor',
            text: 'Right — it\'s baked into reality itself. Even a "perfect" instrument reads a wave packet, and a wave packet simply doesn\'t possess a sharp position and a sharp momentum at once.',
          },
        ],
      },
      {
        id: 'example',
        label: 'another example?',
        turns: [
          { from: 'you', text: 'another example?' },
          {
            from: 'tutor',
            text: 'A guitar string: pluck a short "click" and it has no clear pitch. Let it ring and the pitch is sharp but spread over time. Time↔frequency is the same trade-off as position↔momentum.',
          },
        ],
      },
    ],
  },
  {
    conceptId: 'collapse',
    opening: [
      {
        from: 'tutor',
        text: 'Picture a spinning coin. While it spins, "heads or tails?" has no answer — the spin IS the state. Slapping it flat forces an answer.',
      },
      { from: 'tutor', text: 'Measurement is the slap. ψ was the spin; the outcome is the face you see. And the coin stays slapped.' },
    ],
    branches: [
      {
        id: 'random',
        label: 'so the outcome is pure luck?',
        turns: [
          { from: 'you', text: 'so the outcome is pure luck?' },
          {
            from: 'tutor',
            text: 'Loaded luck. ψ fixes the odds exactly — probability = amplitude². What stays random is only which of the weighted options fires.',
          },
        ],
      },
      {
        id: 'why',
        label: 'why does looking change anything?',
        turns: [
          { from: 'you', text: 'why does looking change anything?' },
          {
            from: 'tutor',
            text: '"Looking" means coupling the particle to something big — a detector, the air, you. Information leaks out, and the neat superposition can\'t survive the leak.',
          },
          { from: 'tutor', text: 'That leak has a name — decoherence. It\'s the next node on your map.' },
        ],
      },
      {
        id: 'math',
        label: 'give me the math',
        turns: [
          { from: 'you', text: 'give me the math' },
          {
            from: 'tutor',
            text: 'State |ψ⟩ = Σ cᵢ|i⟩. Measuring the observable with eigenstates |i⟩ returns outcome i with probability |cᵢ|², and the state updates to |i⟩. That update is the collapse.',
          },
        ],
      },
    ],
  },
  {
    conceptId: 'interference',
    opening: [
      {
        from: 'tutor',
        text: 'Drop two pebbles in a pond: where crests meet, the water leaps; where crest meets trough, it goes flat.',
      },
      {
        from: 'tutor',
        text: 'Quantum amplitudes do the same — except the "two pebbles" can be two histories of a single particle.',
      },
    ],
    branches: [
      {
        id: 'one',
        label: 'how can ONE electron interfere?',
        turns: [
          { from: 'you', text: 'how can ONE electron interfere?' },
          {
            from: 'tutor',
            text: 'Because until it\'s measured, the electron isn\'t a dot taking one path — it\'s a wave of amplitude taking every path. The two slit-histories overlap and add before any dot appears.',
          },
        ],
      },
      {
        id: 'math',
        label: 'give me the math',
        turns: [
          { from: 'you', text: 'give me the math' },
          {
            from: 'tutor',
            text: 'P = |A₁ + A₂|² = |A₁|² + |A₂|² + 2·Re(A₁*A₂). That last cross-term is interference — it can be negative, deleting probability where paths disagree.',
          },
        ],
      },
    ],
  },
]

const fallback: TutorScript = {
  conceptId: '*',
  opening: [
    { from: 'tutor', text: "Let's slow down. Tell me which part felt slippery and we'll rebuild it from something you already know." },
  ],
  branches: [
    {
      id: 'simpler',
      label: 'explain it simpler',
      turns: [
        { from: 'you', text: 'explain it simpler' },
        { from: 'tutor', text: 'Strip the jargon: a quantum state is just a list of "maybes", each with a weight. Everything else is rules for how the weights evolve and combine.' },
      ],
    },
  ],
}

export const tutorScriptFor = (conceptId: string): TutorScript =>
  scripts.find((s) => s.conceptId === conceptId) ?? fallback
