import type { Subject, Unit } from './types'

const superposition: Unit = {
  id: 'unit-superposition',
  index: 2,
  title: 'Superposition & measurement',
  totalConcepts: 37,
  masteredConcepts: 23,
  paceNote: '14 concepts left · ~9 days at your pace',
  nodes: [
    { id: 'basis-states', label: 'basis states ✓', x: 60, y: 52, labelDx: -46, labelDy: 34, status: 'mastered' },
    { id: 'amplitudes', label: 'amplitudes ✓', x: 132, y: 104, labelDx: -8, labelDy: 36, status: 'mastered' },
    { id: 'collapse', label: 'collapse — now', x: 72, y: 178, labelDx: -40, labelDy: 36, status: 'learning', lessonId: 'lesson-collapse' },
    { id: 'interference', label: 'interference', x: 172, y: 188, labelDx: -30, labelDy: 34, status: 'available', lessonId: 'lesson-interference' },
    { id: 'decoherence', label: 'decoherence 🔒', x: 122, y: 258, labelDx: -30, labelDy: 34, status: 'locked' },
  ],
  edges: [
    { from: 'basis-states', to: 'amplitudes' },
    { from: 'amplitudes', to: 'collapse' },
    { from: 'amplitudes', to: 'interference' },
    { from: 'collapse', to: 'decoherence', locked: true },
    { from: 'interference', to: 'decoherence', locked: true },
  ],
}

export const subject: Subject = {
  name: 'Quantum Physics',
  sourceNote: 'mirrors MIT 8.04 · 310 concepts',
  totalConcepts: 310,
  units: [
    {
      id: 'unit-waves',
      index: 1,
      title: 'Wave mechanics',
      totalConcepts: 52,
      masteredConcepts: 52,
    },
    superposition,
    {
      id: 'unit-entanglement',
      index: 3,
      title: 'Entanglement',
      totalConcepts: 41,
      masteredConcepts: 5,
    },
    {
      id: 'unit-qft',
      index: 4,
      title: 'Quantum field theory',
      totalConcepts: 96,
      masteredConcepts: 0,
      locked: true,
    },
    {
      id: 'unit-applications',
      index: 5,
      title: 'Applications & computing',
      totalConcepts: 84,
      masteredConcepts: 0,
      locked: true,
    },
  ],
}

export const unitById = (id: string): Unit => {
  const unit = subject.units.find((u) => u.id === id)
  if (!unit) throw new Error(`Unknown unit: ${id}`)
  return unit
}

export const unitProgress = (unit: Unit, bonusMastered = 0): number =>
  Math.min(100, Math.round(((unit.masteredConcepts + bonusMastered) / unit.totalConcepts) * 100))
