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
  label: string
  x: number
  y: number
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
