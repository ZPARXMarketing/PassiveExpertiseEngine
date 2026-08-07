export type NodeStatus = 'mastered' | 'learning' | 'available' | 'locked'

/**
 * Top-level surfaces.
 *
 * `feed` is the home: a live list of the next useful doses. Everything else is
 * the execution layer the Feed calls into — a concept study page, a practice
 * block, a retrieval session — plus the path picker and the identity screen.
 */
export type ViewId =
  | 'domains'
  | 'feed'
  | 'paths'
  | 'concept'
  | 'terminal'
  | 'retrieval'
  | 'progress'
  | 'settings'

/** User-configurable generation settings, stored in this browser only. */
export interface AppSettings {
  /** OpenRouter API key; empty means fall back to the site's server-side key */
  openRouterKey: string
  /** OpenRouter model slug, e.g. "deepseek/deepseek-chat" */
  model: string
  /** How many Feed doses a day the schedule aims for */
  dailyDoses: number
}

export type PnlTag = 'revenue' | 'cogs' | 'opex'

/* ------------------------------------------------------------------ study --- */

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
 * `authored` content ships with the sample domains; `generated` content comes
 * back from the study-page function and is cached on the domain.
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

/* ------------------------------------------------------------- blueprint --- */

export interface BlueprintNode {
  id: string
  label: string
  x: number
  y: number
  labelDx?: number
  labelDy?: number
  status: NodeStatus
  /** 80/20 core skill — highlighted on the roadmap and the map */
  is8020?: boolean
  /** 0–100 retention; decays over time without practice */
  retention: number
  /**
   * ISO time of the last practice/review/drill that raised retention.
   * Used by time-based decay so the heat map stays honest.
   */
  lastTouchedAt?: string
  /** Path this concept belongs to. Concepts are never shown outside their path. */
  pathId?: string
  /** Zoom depth inside the path: 0 is the first visible layer. */
  layer?: number
  taskId?: string
  /** Emoji glyph shown inside the round concept icon */
  icon?: string
  /** One-line blurb under the concept icon */
  summary?: string
  /** One sentence on the decision this concept changes — heads the study page */
  why?: string
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
  /** Overview of the whole domain */
  overview?: string
  /** Outcomes working this domain unlocks */
  goals?: string[]
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
}

/* ------------------------------------------------------------------ paths --- */

export type PathDepth = 'shallow' | 'moderate' | 'deep'

/**
 * One layer of a path — the only granularity ever revealed at once.
 * Layer 0 opens when the path is selected; deeper layers stay collapsed until
 * the learner masters the layer above or deliberately unlocks it.
 */
export interface PathLayer {
  id: string
  title: string
  /** Concept node ids, in teaching order */
  conceptIds: string[]
  unlocked: boolean
  unlockedAt?: string
  /** Layer content is generated on unlock; empty conceptIds means "not built yet" */
  generated?: boolean
}

/**
 * A broad route through the domain. The AI proposes 4–6 of these on create;
 * the learner picks 1–2. Everything not picked stays collapsed.
 */
export interface DomainPath {
  id: string
  title: string
  /** One-line pitch shown on the proposal card */
  pitch: string
  /** What the learner can do at the end */
  payoff: string
  depth: PathDepth
  /** Depth estimate in weeks at the current dose rate */
  weeks: number
  icon?: string
  /** Chosen as a primary path */
  selected: boolean
  selectedAt?: string
  layers: PathLayer[]
}

/* -------------------------------------------------------------- retrieval --- */

/**
 * Retrieval item kinds, ordered roughly by how much writing they cost.
 * `recall` and `mcq` are the default diet; free writing is opt-in and lives on
 * `teach-back`, which is never required to advance.
 */
export type RetrievalKind =
  | 'mcq'
  | 'discrimination'
  | 'application'
  | 'short-answer'
  | 'reconstruction'
  | 'recall'
  | 'teach-back'

/** FSRS memory state for one item. */
export interface MemoryState {
  /** Days until retrievability falls to the request retention */
  stability: number
  /** 1–10; how hard this item is for this learner */
  difficulty: number
  reps: number
  lapses: number
  dueAt: string
  lastReviewedAt?: string
  state: 'new' | 'learning' | 'review' | 'relearning'
}

/** An item before it has memory state — how authored and generated content ships. */
export interface RetrievalSeed {
  id: string
  conceptId: string
  kind: RetrievalKind
  prompt: string
  /** Model answer revealed after the attempt */
  answer?: string
  /** mcq / discrimination */
  options?: string[]
  correctIndex?: number
  /** short-answer / application — phrases a real answer contains */
  keyPoints?: string[]
  /** reconstruction — the correct order, shuffled for the learner */
  steps?: string[]
  explanation?: string
  /** discrimination — the neighbouring idea this must be told apart from */
  contrastWith?: string
}

export interface RetrievalItem extends RetrievalSeed {
  memory: MemoryState
  source: 'authored' | 'generated' | 'derived'
}

/** 1–4, FSRS convention. */
export type ReviewGrade = 1 | 2 | 3 | 4

/* --------------------------------------------------------------- practice --- */

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

/**
 * A teach-back micro. Structured by default: the learner answers 2–3 short
 * prompts rather than writing an essay. Free writing is still allowed, and the
 * LLM grader reads either shape.
 */
export interface SynthesisPrompt {
  id: string
  conceptId: string
  prompt: string
  /** Short structured prompts that replace the blank textarea */
  scaffold?: string[]
  rubricKeywords: string[]
  passFeedback: string
  failFeedback: string
  itemsOnPass: RetrievalSeed[]
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

/* -------------------------------------------------------------- schedule --- */

export type Pace = 'remedial' | 'steady' | 'accelerated'

export interface PlanWeek {
  index: number
  label: string
  /** Concepts this week pushes into the Feed */
  conceptIds: string[]
  intent: 'new' | 'consolidate' | 'mixed'
}

/**
 * Rolling multi-week plan built once paths are chosen and rebuilt whenever the
 * frontier moves. The Feed reads it to decide how much new material to inject.
 */
export interface SchedulePlan {
  builtAt: string
  /** Doses per day the plan is pacing against */
  dailyDoses: number
  pace: Pace
  weeks: PlanWeek[]
}

/* ------------------------------------------------------------------ feed --- */

export type FeedCardKind =
  | 'unlock'
  | 'study'
  | 'review'
  | 'drill'
  | 'teach-back'
  | 'practice'
  | 'layer-unlock'
  | 'rank-up'
  | 'side-quest'

/** Feed cards are derived from domain state on every render — never persisted. */
export interface FeedCard {
  id: string
  kind: FeedCardKind
  title: string
  detail: string
  /** Why the coach surfaced this card, in one short clause */
  reason: string
  estSeconds: number
  /** Higher sorts first */
  priority: number
  xp: number
  conceptId?: string
  pathId?: string
  /** Retrieval item ids for a review card, drill id for a drill, etc. */
  refIds?: string[]
  tone: 'new' | 'warm' | 'cold' | 'win' | 'quest'
}

/* --------------------------------------------------------------- metrics --- */

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

export interface DomainMetrics {
  sessionSecondsActive: number
  sessionSecondsIdle: number
  sessionLog: SessionLogEntry[]
  tasksCompleted: string[]
  drillScores: DrillScore[]
  synthPassed: string[]
  /** Rolling record of retrieval outcomes, newest last — drives pace adaptation */
  reviewLog: ReviewLogEntry[]
}

export interface ReviewLogEntry {
  at: string
  conceptId: string
  grade: ReviewGrade
}

/** Identity layer: the numbers that make the domain feel like a character sheet. */
export interface DomainProgress {
  xp: number
  streakDays: number
  bestStreakDays: number
  /** Local YYYY-MM-DD of the last completed dose */
  lastDoseDay?: string
  dosesToday: number
  /** Rank id already celebrated, so the rank-up card fires once */
  acknowledgedRank?: string
}

/* ---------------------------------------------------------------- domain --- */

/**
 * The aggregate. A Domain is what the user types — "Quantum Mechanics" — not a
 * finished curriculum. It holds every proposed path, the concepts of whichever
 * layers have been unlocked, and all the execution-layer content hanging off
 * them.
 */
export interface Domain {
  id: string
  /** The topic exactly as typed */
  topic: string
  title: string
  createdAt: string
  /**
   * Where the content came from: an authored sample, the generic starter
   * domain, or a model-designed one.
   */
  source?: 'sample' | 'stub' | 'generated'
  /** model id when source === 'generated' */
  model?: string
  paths: DomainPath[]
  /** True once the learner has committed to their primary paths */
  pathsChosen: boolean
  blueprint: Blueprint
  tasks: PracticeTask[]
  synthPrompts: SynthesisPrompt[]
  items: RetrievalItem[]
  drills: Drill[]
  metrics: DomainMetrics
  progress: DomainProgress
  plan?: SchedulePlan
}

/** Attach authored study pages to a domain's concepts by id. */
export function attachStudy(domain: Domain, pages: Record<string, ConceptStudy>): Domain {
  return {
    ...domain,
    blueprint: {
      ...domain.blueprint,
      nodes: domain.blueprint.nodes.map((n) => (pages[n.id] ? { ...n, study: pages[n.id] } : n)),
    },
  }
}

export const emptyMetrics = (): DomainMetrics => ({
  sessionSecondsActive: 0,
  sessionSecondsIdle: 0,
  sessionLog: [],
  tasksCompleted: [],
  drillScores: [],
  synthPassed: [],
  reviewLog: [],
})

export const emptyProgress = (): DomainProgress => ({
  xp: 0,
  streakDays: 0,
  bestStreakDays: 0,
  dosesToday: 0,
})
