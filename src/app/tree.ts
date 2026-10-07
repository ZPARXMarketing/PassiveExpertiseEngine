/**
 * The catalog tree, shared by Explore and Paths: load a node's children, or generate them
 * once (branches, courses, a syllabus) and save them. Also turns a drafted path plan into
 * real nodes, reusing what the library already has and generating what's missing the same
 * way Explore would, so the tree keeps growing into full courses.
 */

import { generate, type Settings } from './generate.ts'
import { parseBranches, parseCourses, parseSyllabus, type PathPlan, type RawItem } from './parse.ts'
import type { GenKind } from './prompts.ts'
import type { NewNode, Store } from './store.ts'
import { CHILD_LEVEL, type Level, type PathStep, type Syllabus, type TreeNode } from './types.ts'

const GEN_KIND: Partial<Record<Level, GenKind>> = { subject: 'branches', branch: 'courses', course: 'syllabus' }

/**
 * Children of a node: from the store, or generated once and saved. `onPartial` gets the
 * tiles while they stream in. A course also gets its syllabus header saved.
 */
export async function childrenOrGenerate(
  store: Store,
  settings: Settings,
  node: TreeNode,
  trail: string[],
  onPartial?: (items: RawItem[]) => void,
): Promise<{ list: TreeNode[]; syllabus: Syllabus | null }> {
  let list = await store.children(node.id)
  let syllabus = node.level === 'course' ? await store.doc<Syllabus>(node.id) : null
  if (list.length) return { list, syllabus }
  const kind = GEN_KIND[node.level]
  if (!kind) return { list, syllabus }
  const parse = (t: string, complete: boolean): RawItem[] =>
    kind === 'branches' ? parseBranches(t, complete) : kind === 'courses' ? parseCourses(t, complete) : parseSyllabus(t, complete).items
  const { text, model } = await generate({ kind, trail }, settings, onPartial && ((t) => onPartial(parse(t, false))))
  const rows: NewNode[] = parse(text, true).map((it, i) => ({
    parent_id: node.id,
    level: CHILD_LEVEL[node.level]!,
    title: it.title.slice(0, 200),
    summary: it.summary.slice(0, 2000),
    meta: node.level === 'branch' ? { code: it.code ?? '', tier: it.tier ?? '' } : {},
    position: i,
  }))
  if (!rows.length) throw new Error('The model returned nothing usable. Try again.')
  list = await store.addNodes(rows)
  if (node.level === 'course') {
    const { description, objectives } = parseSyllabus(text, true)
    syllabus = { description, objectives }
    await store.saveDoc(node.id, syllabus, model)
  }
  return { list, syllabus }
}

/* ---------------- matching names ---------------- */

const STOP = new Set(['the', 'of', 'and', 'to', 'in', 'a', 'an', 'for', 'on', 'with', 'its', 'principles', 'introduction', 'intro', 'fundamentals', 'basics'])
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** 1 = same name; otherwise word overlap, with "one name contains the other" counted as a match. */
function similarity(a: string, b: string): number {
  if (norm(a) === norm(b)) return 1
  const A = new Set(words(a))
  const B = new Set(words(b))
  if (!A.size || !B.size) return 0
  const both = [...A].filter((w) => B.has(w)).length
  if (both === Math.min(A.size, B.size)) return 0.8
  return both / new Set([...A, ...B]).size
}

/** The existing node that best matches a name (and course code), if it's close enough. */
export function bestMatch(list: TreeNode[], title: string, code = ''): TreeNode | undefined {
  const c = norm(code)
  if (c) {
    const byCode = list.find((n) => norm(n.meta?.code ?? '') === c)
    if (byCode && similarity(byCode.title, title) >= 0.34) return byCode
  }
  let best: TreeNode | undefined
  let score = 0
  for (const n of list) {
    const s = similarity(n.title, title)
    if (s > score) [best, score] = [n, s]
  }
  return score >= 0.6 ? best : undefined
}

/* ---------------- inventory for the planner ---------------- */

/** "subject | branch | code | course | ch; ch; ch" lines describing what the library holds. */
export function inventory(nodes: TreeNode[], max = 20000): string {
  const kids = new Map<string | null, TreeNode[]>()
  for (const n of nodes) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n])
  const sorted = (id: string | null) => (kids.get(id) ?? []).sort((a, b) => a.position - b.position)
  const out: string[] = []
  for (const s of sorted(null).filter((n) => n.level === 'subject')) {
    const branches = sorted(s.id)
    if (!branches.length) out.push(`${s.title} | | | |`)
    for (const b of branches) {
      const courses = sorted(b.id)
      if (!courses.length) out.push(`${s.title} | ${b.title} | | |`)
      for (const c of courses)
        out.push(`${s.title} | ${b.title} | ${c.meta?.code ?? ''} | ${c.title} | ${sorted(c.id).map((ch) => ch.title).join('; ')}`)
    }
  }
  let text = ''
  for (const line of out) {
    if (text.length + line.length > max) break
    text += line + '\n'
  }
  return text
}

/* ---------------- plan → nodes ---------------- */

export interface BuildResult {
  steps: PathStep[]
  /** every list loaded or created on the way, by parent id (so the UI can show them) */
  lists: Record<string, TreeNode[]>
  /** how many nodes were newly made */
  made: number
}

/**
 * Walk each planned step down subject → branch → course → chapter. At each level reuse
 * the closest existing node; otherwise generate that level's full list the way Explore
 * does (a catalog, a syllabus) and match into it; only if nothing fits, add the planned
 * one. So a new course arrives with its whole syllabus, not just the one chapter.
 */
export async function buildPath(
  store: Store,
  settings: Settings,
  plan: PathPlan,
  onStatus: (s: string) => void,
): Promise<BuildResult> {
  const lists: Record<string, TreeNode[]> = {}
  let subjects = await store.subjects()
  let made = 0
  const listOf = async (node: TreeNode, trail: string[]) => {
    if (!lists[node.id]) {
      onStatus(`Laying out ${node.title}…`)
      lists[node.id] = (await childrenOrGenerate(store, settings, node, trail)).list
    }
    return lists[node.id]
  }
  const add = async (parent: TreeNode | null, level: Level, title: string, extra: Partial<NewNode> = {}) => {
    const siblings = parent ? lists[parent.id] ?? [] : subjects
    const [n] = await store.addNodes([
      { parent_id: parent?.id ?? null, level, title: title.slice(0, 200), summary: extra.summary ?? '', meta: extra.meta ?? {}, position: siblings.length },
    ])
    made++
    if (parent) lists[parent.id] = [...siblings, n]
    else subjects = [n, ...subjects]
    return n
  }

  const steps: PathStep[] = []
  for (const [i, st] of plan.steps.entries()) {
    onStatus(`Step ${i + 1} of ${plan.steps.length}: ${st.chapter}`)
    const subject = bestMatch(subjects, st.subject) ?? (await add(null, 'subject', st.subject))
    const branch = bestMatch(await listOf(subject, [subject.title]), st.branch) ?? (await add(subject, 'branch', st.branch))
    const course =
      bestMatch(await listOf(branch, [subject.title, branch.title]), st.course, st.code) ??
      (await add(branch, 'course', st.course, { meta: { code: st.code, tier: '' } }))
    const chapter =
      bestMatch(await listOf(course, [subject.title, branch.title, course.title]), st.chapter) ??
      (await add(course, 'chapter', st.chapter, { summary: st.note }))
    if (!steps.some((x) => x.node_id === chapter.id)) steps.push({ node_id: chapter.id, note: st.note, minutes: st.minutes })
  }
  return { steps, lists, made }
}
