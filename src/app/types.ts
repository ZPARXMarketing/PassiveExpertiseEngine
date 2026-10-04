/** One step down the drill: subject → branch → course → chapter. */
export type Level = 'subject' | 'branch' | 'course' | 'chapter'

export const CHILD_LEVEL: Record<Level, Level | null> = {
  subject: 'branch',
  branch: 'course',
  course: 'chapter',
  chapter: null,
}

export interface NodeMeta {
  /** course: catalog code, e.g. "ECON 301" */
  code?: string
  /** course: Intro / Intermediate / Advanced / Graduate */
  tier?: string
}

/** Stored against a course when its chapters are generated. */
export interface Syllabus {
  description: string
  objectives: string[]
}

export interface TreeNode {
  id: string
  parent_id: string | null
  level: Level
  title: string
  summary: string
  meta: NodeMeta
  position: number
  created_at: string
}

export interface LessonSection {
  heading: string
  body: string
}

export interface Lesson {
  intro: string
  sections: LessonSection[]
  example?: { title: string; body: string } | null
  keyTerms: { term: string; definition: string }[]
  recap: string[]
  quiz: { q: string; a: string }[]
}
