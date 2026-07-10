import type { FeedItem } from './types'

export const todaysThread: FeedItem[] = [
  { kind: 'lesson', id: 'feed-heisenberg', lessonId: 'lesson-heisenberg' },
  {
    kind: 'quickCheck',
    id: 'feed-check-super',
    tag: 'Superposition',
    check: {
      question: 'Measure a qubit in an equal superposition. You get…',
      options: ['one definite state, 50/50', 'a blur of both states'],
      correctIndex: 0,
      explanation:
        'Measurement always returns one outcome — superposition lives in the odds, never in the reading.',
    },
  },
  {
    kind: 'refresh',
    id: 'feed-refresh-psi',
    tag: 'refresh · 3d ago',
    daysAgo: 3,
    title: 'Wave function ψ — what it encodes',
    prompt: 'Finish the thought: ψ assigns every possible outcome an…',
    reveal:
      'amplitude — a complex weight whose square gives the probability of that outcome.',
    durationSec: 30,
  },
  { kind: 'lesson', id: 'feed-collapse', lessonId: 'lesson-collapse' },
  {
    kind: 'quickCheck',
    id: 'feed-check-heisenberg',
    tag: 'Heisenberg',
    check: {
      question: 'The uncertainty principle is ultimately a limit of…',
      options: ['waves themselves', 'our best instruments'],
      correctIndex: 0,
      explanation:
        'Δx·Δp ≥ ħ/2 follows from wave math alone — no instrument, however perfect, can beat it.',
    },
  },
  {
    kind: 'refresh',
    id: 'feed-refresh-slit',
    tag: 'refresh · 6d ago',
    daysAgo: 6,
    title: 'Double-slit — 30s recap',
    prompt: 'One electron at a time still makes stripes because…',
    reveal:
      'each electron traverses both slits in superposition and interferes with itself.',
    durationSec: 30,
  },
]

export const totalThreadMinutes = 4
