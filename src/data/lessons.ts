import type { Lesson } from './types'

export const lessons: Lesson[] = [
  {
    id: 'lesson-heisenberg',
    conceptId: 'uncertainty',
    tag: 'Heisenberg',
    title: 'Heisenberg: a trade-off, not a limit',
    durationSec: 75,
    whyNow: 'builds on "wave function" (yesterday)',
    beats: [
      {
        headline: 'You already know the rumor.',
        body: '"You can\'t know where a particle is AND how fast it\'s going." True — but almost everyone gets why wrong.',
        visual: 'camera',
      },
      {
        headline: "It's not clumsy instruments.",
        body: 'The story goes that measuring position "bumps" the particle. That was Heisenberg\'s first guess too. It\'s not the real reason.',
        visual: 'orbit',
      },
      {
        headline: 'A particle is a wave packet.',
        body: 'Its position lives in how tightly the wave is bunched. Its momentum lives in the wavelength. One object, two readings.',
        visual: 'wave',
      },
      {
        headline: 'Sharper position, blurrier momentum.',
        body: 'Squeeze the packet to pin down where it is, and you must mix in many wavelengths — momentum smears out. And vice versa. Forever.',
        visual: 'rings',
      },
      {
        headline: "It's baked into reality.",
        body: 'Δx · Δp ≥ ħ/2. Not a technology problem — a property of waves themselves. Better tools will never beat it.',
        visual: 'dice',
      },
    ],
    check: {
      question: "Which pair can't be known together?",
      options: ['position + momentum', 'mass + charge'],
      correctIndex: 0,
      explanation:
        'Position and momentum are two readings of one wave — sharpening one smears the other. Mass and charge are just fixed labels.',
    },
  },
  {
    id: 'lesson-collapse',
    conceptId: 'collapse',
    tag: 'Collapse',
    title: 'Collapse: the moment ψ picks a side',
    durationSec: 80,
    whyNow: 'you just finished "amplitudes"',
    beats: [
      {
        headline: 'Before you look, everything is options.',
        body: 'The wave function ψ holds every outcome at once, each with its own amplitude — a weight for "how much" of that possibility exists.',
        visual: 'wave',
      },
      {
        headline: 'Measurement is an ultimatum.',
        body: 'Ask the particle "where ARE you?" and it can no longer answer "everywhere a little." It must commit to one value.',
        visual: 'camera',
      },
      {
        headline: 'The dice are loaded by ψ.',
        body: 'Which value? Random — but not uniform. The probability of each outcome is its amplitude squared. That\'s the Born rule.',
        visual: 'dice',
      },
      {
        headline: 'After: a new, sharper ψ.',
        body: 'The wave function collapses onto the answer you got. Measure again immediately and you get the same value — the options are gone.',
        visual: 'rings',
      },
      {
        headline: 'Nobody fully agrees on why.',
        body: 'Collapse is where quantum theory meets philosophy: Copenhagen shrugs, many-worlds says every option happens. The math, though, everyone shares.',
        visual: 'orbit',
      },
    ],
    check: {
      question: 'Right after measuring position, measure it again. You get…',
      options: ['the same value', 'a fresh random value'],
      correctIndex: 0,
      explanation:
        'Collapse leaves ψ concentrated on the outcome you observed — the immediate repeat is locked in.',
    },
  },
  {
    id: 'lesson-interference',
    conceptId: 'interference',
    tag: 'Interference',
    title: 'Interference: when possibilities collide',
    durationSec: 75,
    whyNow: 'queued by you from the map',
    beats: [
      {
        headline: 'Amplitudes can cancel.',
        body: "Probabilities only add. Amplitudes carry a sign — a phase — so two ways of reaching the same outcome can erase each other.",
        visual: 'wave',
      },
      {
        headline: 'One electron. Two slits. Both at once.',
        body: 'Send electrons through a double slit one at a time. Each takes "both paths" as a superposition — and the paths interfere.',
        visual: 'slit',
      },
      {
        headline: 'The stripes are the fingerprint.',
        body: 'Where the two path-amplitudes agree, electrons pile up. Where they cancel, none land — ever. Single particles, drawing a wave pattern.',
        visual: 'rings',
      },
      {
        headline: 'Watch the slits, lose the stripes.',
        body: "Add a detector that learns which slit was used, and the pattern dies. Knowing the path destroys the superposition that made it.",
        visual: 'camera',
      },
      {
        headline: 'This is the engine of quantum tech.',
        body: 'Quantum computers choreograph interference so wrong answers cancel and right ones reinforce. Cancellation is a feature, not a bug.',
        visual: 'orbit',
      },
    ],
    check: {
      question: 'Why do dark bands appear in the double-slit pattern?',
      options: ['path amplitudes cancel there', 'electrons repel each other'],
      correctIndex: 0,
      explanation:
        'It happens even one electron at a time — the two path-amplitudes arrive out of phase and sum to zero.',
    },
  },
]

export const lessonById = (id: string): Lesson => {
  const lesson = lessons.find((l) => l.id === id)
  if (!lesson) throw new Error(`Unknown lesson: ${id}`)
  return lesson
}
