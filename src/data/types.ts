export type Visual = 'wave' | 'orbit' | 'slit' | 'dice' | 'camera' | 'rings'

export interface Beat {
  headline: string
  body: string
  visual: Visual
}

export interface QuickCheck {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface Lesson {
  id: string
  conceptId: string
  tag: string
  title: string
  durationSec: number
  whyNow?: string
  beats: Beat[]
  check: QuickCheck
}

export type FeedItem =
  | { kind: 'lesson'; id: string; lessonId: string; queuedByUser?: boolean }
  | { kind: 'quickCheck'; id: string; tag: string; check: QuickCheck }
  | {
      kind: 'refresh'
      id: string
      tag: string
      daysAgo: number
      title: string
      prompt: string
      reveal: string
      durationSec: number
    }

export type NodeStatus = 'mastered' | 'learning' | 'available' | 'locked'

export interface ConceptNode {
  id: string
  /** Short label used on the constellation graph */
  label: string
  /** Clean display title for path lists & overviews */
  title: string
  /** One-line blurb on the path list */
  summary: string
  /** Longer overview of what you will learn when you open the concept */
  overview: string
  /** Bullet points of topics covered */
  learnAbout: string[]
  x?: number
  y?: number
  labelDx?: number
  labelDy?: number
  status: NodeStatus
  lessonId?: string
}

export interface ConceptEdge {
  from: string
  to: string
  locked?: boolean
}

export interface Unit {
  id: string
  index: number
  title: string
  totalConcepts: number
  masteredConcepts: number
  locked?: boolean
  paceNote?: string
  /** Overview of this unit path as a whole */
  overview?: string
  /** What finishing this path unlocks or covers */
  pathGoals?: string[]
  nodes?: ConceptNode[]
  edges?: ConceptEdge[]
}

export interface Subject {
  name: string
  sourceNote: string
  totalConcepts: number
  units: Unit[]
}

export interface TutorTurn {
  from: 'tutor' | 'you'
  text: string
}

export interface TutorBranch {
  id: string
  label: string
  turns: TutorTurn[]
}

export interface TutorScript {
  conceptId: string
  opening: TutorTurn[]
  branches: TutorBranch[]
}
