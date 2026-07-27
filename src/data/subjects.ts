export interface SubjectOption {
  id: string
  name: string
  blurb: string
  sourceNote: string
  concepts: number
  /** Only SMB finance has full prototype content today */
  available: boolean
  accent: 'neon' | 'cyan' | 'violet'
}

/** Catalog shown during onboarding — pick one, engine "builds" the map. */
export const subjectCatalog: SubjectOption[] = [
  {
    id: 'smb-finance',
    name: 'Finance for Small Businesses',
    blurb: 'Cash vs profit, margins, runway — the operator’s money map.',
    sourceNote: 'operator track · SBA-shaped · 186 concepts',
    concepts: 186,
    available: true,
    accent: 'neon',
  },
  {
    id: 'quantum',
    name: 'Quantum Physics',
    blurb: 'Superposition, measurement, entanglement — MIT 8.04 shaped.',
    sourceNote: 'mirrors MIT 8.04 · 310 concepts',
    concepts: 310,
    available: false,
    accent: 'cyan',
  },
  {
    id: 'lin-alg',
    name: 'Linear Algebra',
    blurb: 'Vectors, eigenstuff, and the geometry behind every model.',
    sourceNote: 'mirrors MIT 18.06 · ~240 concepts',
    concepts: 240,
    available: false,
    accent: 'violet',
  },
  {
    id: 'neuro',
    name: 'Neuroscience',
    blurb: 'From synapses to systems — how brains compute.',
    sourceNote: 'mirrors undergrad core · ~280 concepts',
    concepts: 280,
    available: false,
    accent: 'cyan',
  },
]

export function subjectById(id: string): SubjectOption {
  return subjectCatalog.find((s) => s.id === id) ?? subjectCatalog[0]
}

/** Steps shown while the engine "builds" the syllabus after subject pick. */
export const buildSteps = [
  'Mapping the field into a prerequisite graph…',
  'Breaking concepts into 60–90s lessons…',
  'Weaving spaced repetition into the stream…',
  'Finding your first idle-window thread…',
] as const
