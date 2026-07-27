export type NodeStatus = 'mastered' | 'learning' | 'available' | 'locked'

export type ViewId = 'subjects' | 'blueprint' | 'terminal' | 'synthesis' | 'dashboard'

export type PnlTag = 'revenue' | 'cogs' | 'opex'

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
}

export interface BlueprintEdge {
  from: string
  to: string
  locked?: boolean
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
  blueprint: {
    nodes: BlueprintNode[]
    edges: BlueprintEdge[]
  }
  tasks: PracticeTask[]
  synthPrompts: SynthesisPrompt[]
  srs: SrsCard[]
  drills: Drill[]
  metrics: SubjectMetrics
}

export const emptyMetrics = (): SubjectMetrics => ({
  sessionSecondsActive: 0,
  sessionSecondsIdle: 0,
  sessionLog: [],
  tasksCompleted: [],
  drillScores: [],
  synthPassed: [],
})
