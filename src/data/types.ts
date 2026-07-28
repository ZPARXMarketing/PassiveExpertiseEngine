export type NodeStatus = 'mastered' | 'learning' | 'available' | 'locked'

export type ViewId =
  | 'subjects'
  | 'blueprint'
  | 'concept'
  | 'terminal'
  | 'synthesis'
  | 'dashboard'
  | 'settings'

/** User-configurable generation settings, stored in this browser only. */
export interface AppSettings {
  /** OpenRouter API key; empty means fall back to the site's server-side key */
  openRouterKey: string
  /** OpenRouter model slug, e.g. "deepseek/deepseek-chat" */
  model: string
}

export type PnlTag = 'revenue' | 'cogs' | 'opex'

/** One prose block on a concept study page */
export interface StudySection {
  heading: string
  body: string
  bullets?: string[]
}

export interface StudyTerm {
  term: string
  definition: string
}

export interface StudyFormula {
  name: string
  expression: string
  note?: string
}

export interface StudyCheck {
  q: string
  a: string
}

/**
 * Long-form study page for a single concept.
 * `authored` content ships with the sample curricula; `generated` content comes
 * back from the study-page function (DeepSeek) and is cached on the subject.
 */
export interface ConceptStudy {
  source: 'authored' | 'generated'
  /** model id when source === 'generated' */
  model?: string
  generatedAt?: string
  tagline: string
  whyItMatters: string
  sections: StudySection[]
  formulas?: StudyFormula[]
  keyTerms?: StudyTerm[]
  mistakes?: string[]
  checkYourself?: StudyCheck[]
}

export interface BlueprintNode {
  id: string
  label: string
  x: number
  y: number
  labelDx?: number
  labelDy?: number
  status: NodeStatus
  /** 80/20 core skill — highlighted on the blueprint */
  is8020?: boolean
  /** 0–100 retention; decays over time without practice */
  retention: number
  taskId?: string
  /** Emoji glyph shown inside the round concept icon */
  icon?: string
  /** One-line blurb under the concept icon */
  summary?: string
  /** Longer overview of what you will learn at this stop */
  overview?: string
  /** Bullet topics covered when you open the concept */
  learnAbout?: string[]
  /** Full study page — authored in samples, or generated + cached */
  study?: ConceptStudy
}

export interface BlueprintEdge {
  from: string
  to: string
  locked?: boolean
}

export interface Blueprint {
  /** Overview of the whole skill path for this subject */
  overview?: string
  /** Outcomes finishing this path unlocks */
  goals?: string[]
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
}

export interface CsvRow {
  id: string
  description: string
  amount: number
}

export interface PracticeTask {
  id: string
  conceptId: string
  title: string
  prompt: string
  kind: 'csv-pnl' | 'editor' | 'text'
  dataset?: CsvRow[]
  correct?: {
    tags: Record<string, PnlTag>
    grossMarginPct: number
    netMarginPct: number
  }
  evalNote: string
  starterText?: string
}

export interface SrsCard {
  id: string
  conceptId: string
  front: string
  back: string
  ease: number
  intervalDays: number
  dueAt: string
  reps: number
}

export interface SynthesisPrompt {
  id: string
  conceptId: string
  prompt: string
  rubricKeywords: string[]
  passFeedback: string
  failFeedback: string
  cardsOnPass: Array<Pick<SrsCard, 'id' | 'conceptId' | 'front' | 'back'>>
}

export interface RapidCalcSpec {
  formula: 'net-profit-margin' | 'gross-margin' | 'cpc'
  rounds: number
  timeLimitSec: number
}

export interface McqSpec {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface Drill {
  id: string
  conceptId: string
  title: string
  kind: 'rapid-calc' | 'mcq'
  spec: RapidCalcSpec | McqSpec
}

export interface SessionLogEntry {
  at: string
  activeSec: number
  idleSec: number
}

export interface DrillScore {
  drillId: string
  correct: number
  total: number
  at: string
}

export interface SubjectMetrics {
  sessionSecondsActive: number
  sessionSecondsIdle: number
  sessionLog: SessionLogEntry[]
  tasksCompleted: string[]
  drillScores: DrillScore[]
  synthPassed: string[]
}

export interface Subject {
  id: string
  goal: string
  title: string
  createdAt: string
  blueprint: Blueprint
  tasks: PracticeTask[]
  synthPrompts: SynthesisPrompt[]
  srs: SrsCard[]
  drills: Drill[]
  metrics: SubjectMetrics
}

/** Attach authored study pages to a subject's blueprint nodes by concept id. */
export function attachStudy(subject: Subject, pages: Record<string, ConceptStudy>): Subject {
  return {
    ...subject,
    blueprint: {
      ...subject.blueprint,
      nodes: subject.blueprint.nodes.map((n) => (pages[n.id] ? { ...n, study: pages[n.id] } : n)),
    },
  }
}

export const emptyMetrics = (): SubjectMetrics => ({
  sessionSecondsActive: 0,
  sessionSecondsIdle: 0,
  sessionLog: [],
  tasksCompleted: [],
  drillScores: [],
  synthPassed: [],
})
