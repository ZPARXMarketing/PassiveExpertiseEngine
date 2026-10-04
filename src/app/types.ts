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

/** A Library entry: a whole node (course, chapter…) or a highlighted snippet of a chapter. */
export interface SavedItem {
  id: string
  node_id: string
  kind: 'node' | 'snippet'
  text: string
  created_at: string
}

/** ids from the root down to this node, as far as `have` knows */
export function chainIds(id: string, have: Record<string, TreeNode>): string[] {
  const out: string[] = []
  let cur: string | null = id
  while (cur && out.length < 5) {
    out.unshift(cur)
    cur = have[cur]?.parent_id ?? null
  }
  return out
}

export interface PracticeProblem {
  problem: string
  solution: string
}

export interface CheckIssue {
  claim: string
  problem: string
  correction: string
  source: string
}

export interface CheckResult {
  verdict: 'ok' | 'issues' | 'fixed'
  issues: CheckIssue[]
  sources: string[]
  checkedAt: string
}

export type ExtraKind = 'deeper' | 'answer' | 'practice' | 'check' | 'fixed' | 'lecture' | 'visual'

/** Study-tool output hung off a chapter. Newest row per (kind, key) wins. */
export interface Extra {
  id: string
  node_id: string
  kind: ExtraKind
  key: string
  body: unknown
  created_at: string
}

/** busy / streaming key for one study tool on one chapter */
export const liveKey = (chapterId: string, kind: string, key: string) => `${chapterId}:${kind}:${key}`

export interface Teacher {
  voice: string
  style: string
  /** playback speed */
  speed: number
}

export interface LectureBody {
  script: string
  audioUrl: string
  voice: string
  style: string
  /** section heading, or '' for the whole chapter */
  section: string
  fileName: string
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'flow'
  title: string
  caption: string
  illustrative: boolean
  source: string
  xLabel: string
  yLabel: string
  series: { name: string; points: [number, number][] }[]
  categories: string[]
  bars: { name: string; values: number[] }[]
  slices: { label: string; value: number }[]
  nodes: { id: string; label: string }[]
  edges: { from: string; to: string; label: string }[]
  /** what the learner asked for, if anything */
  request?: string
}
