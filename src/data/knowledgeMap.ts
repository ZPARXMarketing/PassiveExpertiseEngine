import type { Subject, Unit } from './types'

const waves: Unit = {
  id: 'unit-waves',
  index: 1,
  title: 'Wave mechanics',
  totalConcepts: 52,
  masteredConcepts: 52,
  overview:
    'The classical foundation every quantum path rests on: waves that carry energy, interfere, and set the stage for treating particles as wave packets.',
  pathGoals: [
    'Read wavelength, frequency, and phase from a waveform',
    'Predict constructive vs destructive interference',
    'Connect standing waves to bound energy levels',
  ],
  nodes: [
    {
      id: 'wavelength',
      title: 'Wavelength & frequency',
      label: 'wavelength ✓',
      summary: 'How far a wave repeats and how often',
      overview:
        'You will learn to read a wave by eye: wavelength (λ) as the distance between peaks, frequency (f) as cycles per second, and why their product is always the wave speed.',
      learnAbout: [
        'λ, f, and the v = fλ relation',
        'Crests, troughs, and phase along a snapshot',
        'Why higher frequency means more energy for the same amplitude class of waves',
      ],
      status: 'mastered',
      x: 70,
      y: 50,
      labelDx: -40,
      labelDy: 34,
    },
    {
      id: 'superposition-classical',
      title: 'Classical superposition',
      label: 'superposition ✓',
      summary: 'Waves add — they do not bounce off each other',
      overview:
        'When two waves occupy the same space, the medium’s displacement is the sum of both. That simple rule is the engine of every interference pattern you will meet later.',
      learnAbout: [
        'Linear addition of displacements',
        'Why waves pass through one another intact',
        'Preview of quantum amplitudes as a richer version of the same idea',
      ],
      status: 'mastered',
      x: 150,
      y: 110,
      labelDx: -20,
      labelDy: 34,
    },
    {
      id: 'interference-classical',
      title: 'Interference fringes',
      label: 'fringes ✓',
      summary: 'Bright and dark bands from path differences',
      overview:
        'Path-length differences turn into phase differences. You will map when crests meet crests (bright) vs when crests meet troughs (dark) — the classical twin of the double-slit story.',
      learnAbout: [
        'Path difference → phase shift',
        'Constructive and destructive conditions',
        'Young’s double-slit as a worked pattern',
      ],
      status: 'mastered',
      x: 80,
      y: 180,
      labelDx: -30,
      labelDy: 34,
    },
    {
      id: 'standing-waves',
      title: 'Standing waves & nodes',
      label: 'standing ✓',
      summary: 'Bound waves with fixed zeros',
      overview:
        'Reflections pin a wave into discrete modes. Nodes stay still; antinodes swing hard. This is the classical picture behind quantized energy levels in a box.',
      learnAbout: [
        'Boundary conditions that quantize wavelength',
        'Nodes vs antinodes',
        'Why only certain frequencies “fit”',
      ],
      status: 'mastered',
      x: 160,
      y: 250,
      labelDx: -28,
      labelDy: 34,
    },
  ],
  edges: [
    { from: 'wavelength', to: 'superposition-classical' },
    { from: 'superposition-classical', to: 'interference-classical' },
    { from: 'interference-classical', to: 'standing-waves' },
  ],
}

const superposition: Unit = {
  id: 'unit-superposition',
  index: 2,
  title: 'Superposition & measurement',
  totalConcepts: 37,
  masteredConcepts: 23,
  paceNote: '14 concepts left · ~9 days at your pace',
  overview:
    'The core quantum move: a system can hold many possibilities at once until measurement forces a single outcome. This path turns that slogan into precise, usable ideas.',
  pathGoals: [
    'Write a state as a weighted sum of basis outcomes',
    'Predict probabilities with the Born rule',
    'Explain collapse vs unitary evolution in plain language',
  ],
  nodes: [
    {
      id: 'basis-states',
      title: 'Basis states',
      label: 'basis states ✓',
      summary: 'The allowed “answers” a measurement can return',
      overview:
        'Every measurement question comes with a menu of outcomes. Basis states are those menu items — the pure answers a system can give when you ask a particular question.',
      learnAbout: [
        'What a basis is for a given observable',
        'Why “up” and “down” form a spin basis',
        'How changing the question changes the basis',
      ],
      status: 'mastered',
      x: 60,
      y: 52,
      labelDx: -46,
      labelDy: 34,
    },
    {
      id: 'amplitudes',
      title: 'Complex amplitudes',
      label: 'amplitudes ✓',
      summary: 'Weights that can cancel, not just add',
      overview:
        'Quantum weights are complex amplitudes — they carry size and phase. You will see why phase is invisible in a single path but decisive when paths recombine.',
      learnAbout: [
        'Amplitude as magnitude + phase',
        'Why probabilities alone are not enough',
        'How two paths can erase each other',
      ],
      status: 'mastered',
      x: 132,
      y: 104,
      labelDx: -8,
      labelDy: 36,
    },
    {
      id: 'collapse',
      title: 'Wave-function collapse',
      label: 'collapse — now',
      summary: 'Measurement turns options into one fact',
      overview:
        'Before you look, ψ holds every outcome with its amplitude. Measurement is an ultimatum: the system commits to one value, with odds set by |amplitude|². Afterward, ψ is sharper.',
      learnAbout: [
        'Pre-measurement superposition of outcomes',
        'The Born rule (probability = amplitude squared)',
        'Why an immediate re-measure repeats the answer',
        'Where interpretation debates begin — and what the math still shares',
      ],
      status: 'learning',
      lessonId: 'lesson-collapse',
      x: 72,
      y: 178,
      labelDx: -40,
      labelDy: 36,
    },
    {
      id: 'interference',
      title: 'Quantum interference',
      label: 'interference',
      summary: 'Possibilities that cancel or reinforce',
      overview:
        'Amplitudes from different paths can add or cancel. You will walk the double-slit with single particles, see dark bands as cancellation, and glimpse why quantum computers choreograph interference on purpose.',
      learnAbout: [
        'Path amplitudes that erase each other',
        'Single-particle double-slit fringes',
        'Which-path information kills the pattern',
        'Interference as a design tool in quantum tech',
      ],
      status: 'available',
      lessonId: 'lesson-interference',
      x: 172,
      y: 188,
      labelDx: -30,
      labelDy: 34,
    },
    {
      id: 'decoherence',
      title: 'Decoherence',
      label: 'decoherence 🔒',
      summary: 'How the environment steals quantum weirdness',
      overview:
        'Real systems leak information into the environment. Decoherence explains why everyday objects look classical: entanglement with the room destroys usable interference without a philosophical collapse postulate.',
      learnAbout: [
        'System + environment entanglement',
        'Why interference terms die in the open',
        'Pointer states and emergent classicality',
        'How long a lab qubit can stay coherent',
      ],
      status: 'locked',
      x: 122,
      y: 258,
      labelDx: -30,
      labelDy: 34,
    },
  ],
  edges: [
    { from: 'basis-states', to: 'amplitudes' },
    { from: 'amplitudes', to: 'collapse' },
    { from: 'amplitudes', to: 'interference' },
    { from: 'collapse', to: 'decoherence', locked: true },
    { from: 'interference', to: 'decoherence', locked: true },
  ],
}

const entanglement: Unit = {
  id: 'unit-entanglement',
  index: 3,
  title: 'Entanglement',
  totalConcepts: 41,
  masteredConcepts: 5,
  paceNote: '36 concepts left · start after unit 2',
  overview:
    'Two particles, one joint state: measuring one instantly constrains the other. This path builds the language of multi-particle systems and the experiments that made “spooky action” precise.',
  pathGoals: [
    'Distinguish product states from entangled ones',
    'Read a Bell pair and its correlations',
    'State what Bell tests rule out',
  ],
  nodes: [
    {
      id: 'product-states',
      title: 'Product states',
      label: 'product states ✓',
      summary: 'Independent particles, factorable wavefunctions',
      overview:
        'Sometimes two systems really are separate: the joint state is just state A times state B. You will learn to spot product states and why they cannot show the weird correlations of entanglement.',
      learnAbout: [
        'Tensor-product notation |a⟩ ⊗ |b⟩',
        'When a joint state factors cleanly',
        'Local measurements on product pairs',
      ],
      status: 'mastered',
      x: 70,
      y: 60,
      labelDx: -42,
      labelDy: 34,
    },
    {
      id: 'bell-pairs',
      title: 'Bell pairs',
      label: 'Bell pairs',
      summary: 'The simplest maximally entangled two-qubit state',
      overview:
        'A Bell pair is the workhorse of quantum information: neither qubit has a definite state alone, yet together they are pure. You will write the singlet and triplet forms and predict perfect anti-correlations.',
      learnAbout: [
        'The four Bell states',
        'Why reduced states look mixed',
        'Correlation tables for spin measurements',
      ],
      status: 'learning',
      x: 140,
      y: 130,
      labelDx: -20,
      labelDy: 34,
    },
    {
      id: 'epr',
      title: 'EPR argument',
      label: 'EPR',
      summary: 'Einstein’s challenge to completeness',
      overview:
        'EPR argued that if quantum mechanics is complete, it must allow “spooky” non-local influences — or else hidden variables exist. You will follow their thought experiment and where modern theory answers it.',
      learnAbout: [
        'Elements of reality and completeness',
        'The EPR pair thought experiment',
        'What Bohr’s reply claimed — and what it left open',
      ],
      status: 'available',
      x: 70,
      y: 200,
      labelDx: -10,
      labelDy: 34,
    },
    {
      id: 'bell-inequality',
      title: 'Bell inequalities',
      label: 'Bell 🔒',
      summary: 'A number that local realism cannot beat',
      overview:
        'Bell turned philosophy into an inequality. Local hidden-variable theories must respect a bound; quantum mechanics predicts violations. Experiments have taken quantum’s side.',
      learnAbout: [
        'CHSH and the classical bound of 2',
        'Quantum prediction up to 2√2',
        'What “closing loopholes” means experimentally',
      ],
      status: 'locked',
      x: 150,
      y: 260,
      labelDx: -18,
      labelDy: 34,
    },
  ],
  edges: [
    { from: 'product-states', to: 'bell-pairs' },
    { from: 'bell-pairs', to: 'epr' },
    { from: 'epr', to: 'bell-inequality', locked: true },
  ],
}

const qft: Unit = {
  id: 'unit-qft',
  index: 4,
  title: 'Quantum field theory',
  totalConcepts: 96,
  masteredConcepts: 0,
  locked: true,
  overview:
    'Particles as excitations of fields that fill space. Locked until you finish the entanglement path — the math assumes multi-particle states and relativistic bookkeeping.',
  pathGoals: [
    'See particles as field quanta',
    'Read Feynman diagrams as bookkeeping',
    'Connect QED to everyday electromagnetism',
  ],
}

const applications: Unit = {
  id: 'unit-applications',
  index: 5,
  title: 'Applications & computing',
  totalConcepts: 84,
  masteredConcepts: 0,
  locked: true,
  overview:
    'Quantum sensing, cryptography, and algorithms — where the abstract units pay off in devices and code. Unlocks after field theory foundations are in place.',
  pathGoals: [
    'Map algorithms to interference and entanglement',
    'Know what NISQ devices can and cannot do',
    'Spot real vs hype quantum advantage claims',
  ],
}

export const subject: Subject = {
  name: 'Quantum Physics',
  sourceNote: 'mirrors MIT 8.04 · 310 concepts',
  totalConcepts: 310,
  units: [waves, superposition, entanglement, qft, applications],
}

export const unitById = (id: string): Unit => {
  const unit = subject.units.find((u) => u.id === id)
  if (!unit) throw new Error(`Unknown unit: ${id}`)
  return unit
}

export const conceptById = (unitId: string, conceptId: string) => {
  const unit = unitById(unitId)
  const concept = unit.nodes?.find((n) => n.id === conceptId)
  if (!concept) throw new Error(`Unknown concept: ${conceptId} in ${unitId}`)
  return concept
}

export const unitProgress = (unit: Unit, bonusMastered = 0): number =>
  Math.min(100, Math.round(((unit.masteredConcepts + bonusMastered) / unit.totalConcepts) * 100))
