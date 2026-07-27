import type { Subject, Unit } from './types'

const cashFlowUnit: Unit = {
  id: 'unit-cash-flow',
  index: 2,
  title: 'Cash flow & unit economics',
  totalConcepts: 34,
  masteredConcepts: 21,
  paceNote: '13 concepts left · ~8 days at your pace',
  nodes: [
    {
      id: 'revenue-streams',
      label: 'revenue streams ✓',
      x: 60,
      y: 52,
      labelDx: -50,
      labelDy: 34,
      status: 'mastered',
    },
    {
      id: 'burn-rate',
      label: 'burn rate ✓',
      x: 132,
      y: 104,
      labelDx: -8,
      labelDy: 36,
      status: 'mastered',
    },
    {
      id: 'cash-vs-profit',
      label: 'cash ≠ profit — now',
      x: 72,
      y: 178,
      labelDx: -48,
      labelDy: 36,
      status: 'learning',
      lessonId: 'lesson-cash-vs-profit',
    },
    {
      id: 'gross-margin',
      label: 'gross margin',
      x: 172,
      y: 188,
      labelDx: -28,
      labelDy: 34,
      status: 'available',
      lessonId: 'lesson-gross-margin',
    },
    {
      id: 'runway',
      label: 'runway 🔒',
      x: 122,
      y: 258,
      labelDx: -18,
      labelDy: 34,
      status: 'locked',
    },
  ],
  edges: [
    { from: 'revenue-streams', to: 'burn-rate' },
    { from: 'burn-rate', to: 'cash-vs-profit' },
    { from: 'burn-rate', to: 'gross-margin' },
    { from: 'cash-vs-profit', to: 'runway', locked: true },
    { from: 'gross-margin', to: 'runway', locked: true },
  ],
}

export const subject: Subject = {
  name: 'Finance for Small Businesses',
  sourceNote: 'operator track · SBA-shaped · 186 concepts',
  totalConcepts: 186,
  units: [
    {
      id: 'unit-foundations',
      index: 1,
      title: 'Money foundations',
      totalConcepts: 28,
      masteredConcepts: 28,
    },
    cashFlowUnit,
    {
      id: 'unit-pricing',
      index: 3,
      title: 'Pricing & contribution',
      totalConcepts: 32,
      masteredConcepts: 4,
    },
    {
      id: 'unit-funding',
      index: 4,
      title: 'Funding & debt',
      totalConcepts: 41,
      masteredConcepts: 0,
      locked: true,
    },
    {
      id: 'unit-taxes-books',
      index: 5,
      title: 'Books, tax & compliance',
      totalConcepts: 51,
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
