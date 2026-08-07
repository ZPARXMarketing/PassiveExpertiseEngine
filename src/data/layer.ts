/**
 * Turning a generated layer into domain content.
 *
 * The model returns one layer of one path: 5–8 concepts plus the practice
 * hanging off them. This module is the defensive boundary — ids are slugged and
 * namespaced to their path, prerequisites that point at unknown or later
 * concepts are dropped, and anything aimed at a concept that does not exist is
 * discarded. A layer with fewer than three usable concepts is rejected outright
 * rather than shown.
 */

import type {
  Blueprint,
  BlueprintEdge,
  BlueprintNode,
  Drill,
  PracticeTask,
  RetrievalKind,
  RetrievalSeed,
  SynthesisPrompt,
} from './types'

/* ---------------------------------------------------------------- layout --- */

/** Graph coordinate space — the optional map view grows its viewBox to fit. */
const TOP_Y = 52
const ROW_H = 82
const COL_W = 280
const X_MIN = 52
const X_MAX = 208
const X_MID = (X_MIN + X_MAX) / 2

/** Evenly spread a row of concepts across one path's column. */
function rowX(index: number, count: number, column: number): number {
  const offset = column * COL_W
  if (count <= 1) return offset + X_MID
  return Math.round(offset + X_MIN + (index * (X_MAX - X_MIN)) / (count - 1))
}

/* ------------------------------------------------------------ normalising --- */

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

const strList = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s): s is string => s !== null)
}

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Keep a single glyph; anything longer is prose, and the map falls back to initials. */
const emoji = (v: unknown): string | undefined => {
  const s = str(v)
  if (!s) return undefined
  const glyphs = Array.from(s)
  return glyphs.length <= 3 ? s : undefined
}

interface RawConcept {
  id?: unknown
  label?: unknown
  icon?: unknown
  core?: unknown
  tier?: unknown
  prereqs?: unknown
  summary?: unknown
  why?: unknown
  overview?: unknown
  learnAbout?: unknown
}

export interface RawLayer {
  layerTitle?: unknown
  concepts?: unknown
  tasks?: unknown
  items?: unknown
  teachBack?: unknown
  drills?: unknown
  model?: unknown
}

interface Concept {
  id: string
  label: string
  icon?: string
  core: boolean
  tier?: number
  prereqs: string[]
  summary?: string
  why?: string
  overview?: string
  learnAbout: string[]
}

export class LayerUnavailableError extends Error {}

const MIN_CONCEPTS = 3
const MAX_CONCEPTS = 8

/** Model output → concepts with unique, path-namespaced ids and resolvable prereqs. */
function readConcepts(raw: unknown, pathId: string, taken: Set<string>): Concept[] {
  if (!Array.isArray(raw)) return []
  const local = new Map<string, string>()
  const concepts: Concept[] = []

  for (const item of raw.slice(0, MAX_CONCEPTS)) {
    const c = item as RawConcept
    const label = str(c.label) ?? str(c.id)
    if (!label) continue

    const base = slug(str(c.id) ?? label) || `concept-${concepts.length + 1}`
    // Concepts are namespaced by path so two routes can both teach "notation"
    // without colliding in the shared node pool.
    let id = `${pathId}-${base}`
    while (taken.has(id)) id = `${id}-${concepts.length + 1}`
    taken.add(id)
    local.set(base, id)

    concepts.push({
      id,
      label: label.toLowerCase(),
      icon: emoji(c.icon),
      core: c.core === true,
      tier: typeof c.tier === 'number' && Number.isFinite(c.tier) ? c.tier : undefined,
      prereqs: strList(c.prereqs).map(slug),
      summary: str(c.summary) ?? undefined,
      why: str(c.why) ?? undefined,
      overview: str(c.overview) ?? undefined,
      learnAbout: strList(c.learnAbout).slice(0, 5),
    })
  }

  // Only prereqs pointing at an *earlier* concept in this layer survive: that
  // keeps the graph acyclic no matter what the model emitted.
  return concepts.map((c, i) => {
    const earlier = new Set(concepts.slice(0, i).map((p) => p.id))
    return {
      ...c,
      prereqs: c.prereqs
        .map((p) => local.get(p))
        .filter((p): p is string => p !== undefined && earlier.has(p)),
    }
  })
}

/**
 * Dependency depth per concept, used as the graph row.
 * Prefers real prereqs; falls back to the model's own tier, then to pairs.
 */
function rowsFor(concepts: Concept[]): number[] {
  const byId = new Map(concepts.map((c, i) => [c.id, i]))
  const depth = concepts.map(() => 0)
  concepts.forEach((c, i) => {
    let resolved = false
    for (const p of c.prereqs) {
      const pi = byId.get(p)
      if (pi !== undefined && pi < i) {
        depth[i] = Math.max(depth[i], depth[pi] + 1)
        resolved = true
      }
    }
    // Declared a dependency we could not resolve: keep it downstream anyway
    // rather than promoting it into the entry row the learner starts from.
    if (!resolved && (c.prereqs.length > 0 || (c.tier ?? 0) > 0)) {
      depth[i] = Math.max(1, i > 0 ? depth[i - 1] : 1)
    }
  })
  if (Math.max(...depth) > 0) return depth

  const tiers = concepts.map((c) => c.tier)
  if (tiers.every((t) => t !== undefined) && new Set(tiers).size > 1) {
    const sorted = [...new Set(tiers as number[])].sort((a, b) => a - b)
    return (tiers as number[]).map((t) => sorted.indexOf(t))
  }
  // No usable dependency data at all — lay it out two per row, in order.
  return concepts.map((_, i) => Math.floor(i / 2))
}

/** Prereq edges, plus a link into any concept the model left dangling. */
function edgesFor(concepts: Concept[], nodes: BlueprintNode[], rows: number[]): BlueprintEdge[] {
  const edges: BlueprintEdge[] = []
  const hasIncoming = new Set<string>()

  concepts.forEach((c) => {
    for (const p of c.prereqs) {
      edges.push({ from: p, to: c.id })
      hasIncoming.add(c.id)
    }
  })

  concepts.forEach((c, i) => {
    if (rows[i] === 0 || hasIncoming.has(c.id)) return
    // Attach to the closest node one row up so nothing floats unconnected.
    const above = nodes.filter((_, j) => rows[j] === rows[i] - 1)
    if (above.length === 0) return
    const nearest = above.reduce((best, n) =>
      Math.abs(n.x - nodes[i].x) < Math.abs(best.x - nodes[i].x) ? n : best,
    )
    edges.push({ from: nearest.id, to: c.id })
  })

  return edges
}

export interface LayerContext {
  pathId: string
  layerIndex: number
  /** Which column of the map this path occupies */
  column: number
  /** Graph rows already used by shallower layers of this path */
  rowOffset: number
  /** Node ids already in the domain, so a new layer never collides */
  taken: Set<string>
}

function nodesFor(concepts: Concept[], rows: number[], ctx: LayerContext): BlueprintNode[] {
  const perRow = new Map<number, number>()
  const indexInRow = rows.map((r) => {
    const n = perRow.get(r) ?? 0
    perRow.set(r, n + 1)
    return n
  })

  return concepts.map((c, i) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    x: rowX(indexInRow[i], perRow.get(rows[i]) ?? 1, ctx.column),
    y: TOP_Y + (ctx.rowOffset + rows[i]) * ROW_H,
    // Only the entry row of the entry layer starts open; the rest of the layer
    // is available but not yet in progress.
    status: rows[i] === 0 && ctx.layerIndex === 0 ? 'learning' : 'available',
    is8020: c.core,
    retention: rows[i] === 0 && ctx.layerIndex === 0 ? 12 : 0,
    pathId: ctx.pathId,
    layer: ctx.layerIndex,
    summary: c.summary,
    why: c.why,
    overview: c.overview,
    learnAbout: c.learnAbout.length ? c.learnAbout : undefined,
  }))
}

function tasksFor(raw: unknown, ids: Set<string>, local: Map<string, string>, prefix: string): PracticeTask[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      const t = item as {
        conceptId?: unknown
        title?: unknown
        prompt?: unknown
        starterText?: unknown
        evalNote?: unknown
      }
      const conceptId = local.get(slug(str(t.conceptId) ?? '')) ?? ''
      const prompt = str(t.prompt)
      if (!prompt || !ids.has(conceptId)) return null
      const task: PracticeTask = {
        id: `${prefix}-task-${i + 1}`,
        conceptId,
        title: str(t.title) ?? 'Practice block',
        prompt,
        kind: 'text',
        starterText: str(t.starterText) ?? undefined,
        evalNote:
          str(t.evalNote) ??
          'Generated path — the prototype accepts any focused write-up as a completed block.',
      }
      return task
    })
    .filter((t): t is PracticeTask => t !== null)
}

const ITEM_KINDS: RetrievalKind[] = ['mcq', 'discrimination', 'application', 'short-answer']

function itemsFor(
  raw: unknown,
  ids: Set<string>,
  local: Map<string, string>,
  prefix: string,
): RetrievalSeed[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry, i): RetrievalSeed | null => {
      const r = entry as {
        conceptId?: unknown
        kind?: unknown
        prompt?: unknown
        options?: unknown
        correctIndex?: unknown
        keyPoints?: unknown
        answer?: unknown
        explanation?: unknown
      }
      const conceptId = local.get(slug(str(r.conceptId) ?? '')) ?? ''
      const prompt = str(r.prompt)
      if (!prompt || !ids.has(conceptId)) return null

      const rawKind = slug(str(r.kind) ?? '') as RetrievalKind
      const kind: RetrievalKind = ITEM_KINDS.includes(rawKind) ? rawKind : 'mcq'
      const options = strList(r.options).slice(0, 4)
      const correctIndex = typeof r.correctIndex === 'number' ? r.correctIndex : -1
      const keyPoints = strList(r.keyPoints).slice(0, 4)

      if (kind === 'mcq' || kind === 'discrimination') {
        if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return null
        return {
          id: `${prefix}-item-${i + 1}`,
          conceptId,
          kind,
          prompt,
          options,
          correctIndex,
          answer: str(r.answer) ?? undefined,
          explanation: str(r.explanation) ?? undefined,
        }
      }

      // A written item with no rubric cannot be graded, so it is not worth showing.
      if (keyPoints.length === 0) return null
      return {
        id: `${prefix}-item-${i + 1}`,
        conceptId,
        kind,
        prompt,
        keyPoints,
        answer: str(r.answer) ?? undefined,
        explanation: str(r.explanation) ?? undefined,
      }
    })
    .filter((s): s is RetrievalSeed => s !== null)
}

function teachBackFor(
  raw: unknown,
  ids: Set<string>,
  local: Map<string, string>,
  prefix: string,
): SynthesisPrompt[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry, i): SynthesisPrompt | null => {
      const f = entry as {
        conceptId?: unknown
        prompt?: unknown
        scaffold?: unknown
        rubricKeywords?: unknown
        passFeedback?: unknown
        failFeedback?: unknown
      }
      const conceptId = local.get(slug(str(f.conceptId) ?? '')) ?? ''
      const prompt = str(f.prompt)
      const rubricKeywords = strList(f.rubricKeywords).map((k) => k.toLowerCase())
      if (!prompt || !ids.has(conceptId) || rubricKeywords.length < 3) return null

      const scaffold = strList(f.scaffold).slice(0, 3)
      return {
        id: `${prefix}-teach-${i + 1}`,
        conceptId,
        prompt,
        scaffold: scaffold.length ? scaffold : undefined,
        rubricKeywords,
        passFeedback: str(f.passFeedback) ?? 'Clear enough to teach from.',
        failFeedback:
          str(f.failFeedback) ??
          'Name the mechanism and one concrete consequence, in your own words.',
        // Passing a teach-back seeds retrieval items built from the learner's
        // own framing of the concept.
        itemsOnPass: [
          {
            id: `${prefix}-teach-${i + 1}-item`,
            conceptId,
            kind: 'short-answer' as const,
            prompt,
            keyPoints: rubricKeywords.slice(0, 4),
          },
        ],
      }
    })
    .filter((s): s is SynthesisPrompt => s !== null)
}

function drillsFor(raw: unknown, ids: Set<string>, local: Map<string, string>, prefix: string): Drill[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      const d = item as {
        conceptId?: unknown
        title?: unknown
        question?: unknown
        options?: unknown
        correctIndex?: unknown
        explanation?: unknown
      }
      const conceptId = local.get(slug(str(d.conceptId) ?? '')) ?? ''
      const question = str(d.question)
      const options = strList(d.options).slice(0, 4)
      const correctIndex = typeof d.correctIndex === 'number' ? d.correctIndex : -1
      if (!question || options.length < 2 || !ids.has(conceptId)) return null
      if (correctIndex < 0 || correctIndex >= options.length) return null
      const drill: Drill = {
        id: `${prefix}-drill-${i + 1}`,
        conceptId,
        title: str(d.title) ?? 'Judgement check',
        kind: 'mcq',
        spec: {
          question,
          options,
          correctIndex,
          explanation: str(d.explanation) ?? 'Review the concept page for why this one holds.',
        },
      }
      return drill
    })
    .filter((d): d is Drill => d !== null)
}

export interface NormalizedLayer {
  layerTitle: string
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
  tasks: PracticeTask[]
  items: RetrievalSeed[]
  synthPrompts: SynthesisPrompt[]
  drills: Drill[]
  /** Rows this layer consumed, so the next one stacks under it on the map */
  rows: number
}

/** Model output → one layer's worth of domain content. */
export function normalizeLayer(raw: RawLayer, ctx: LayerContext): NormalizedLayer {
  const concepts = readConcepts(raw.concepts, ctx.pathId, ctx.taken)
  if (concepts.length < MIN_CONCEPTS) {
    throw new LayerUnavailableError(
      'The model did not return a usable layer — try again, or pick another model in Settings.',
    )
  }

  const rows = rowsFor(concepts)
  const nodes = nodesFor(concepts, rows, ctx)
  const edges = edgesFor(concepts, nodes, rows)
  const ids = new Set(concepts.map((c) => c.id))
  // The model refers to concepts by its own slugs; map those onto our ids.
  const local = new Map(concepts.map((c) => [c.id.slice(ctx.pathId.length + 1), c.id]))
  const prefix = `${ctx.pathId}-l${ctx.layerIndex}`

  const tasks = tasksFor(raw.tasks, ids, local, prefix)
  const synthPrompts = teachBackFor(raw.teachBack, ids, local, prefix)
  const drills = drillsFor(raw.drills, ids, local, prefix)
  const items = itemsFor(raw.items, ids, local, prefix)

  // Concepts open their own practice task straight from the study page.
  const taskByConcept = new Map(tasks.map((t) => [t.conceptId, t.id]))
  const wiredNodes = nodes.map((n) =>
    taskByConcept.has(n.id) ? { ...n, taskId: taskByConcept.get(n.id) } : n,
  )

  return {
    layerTitle: str(raw.layerTitle) ?? `Layer ${ctx.layerIndex + 1}`,
    nodes: wiredNodes,
    edges,
    tasks,
    items,
    synthPrompts,
    drills,
    rows: Math.max(...rows) + 1,
  }
}

/** Rows a path's already-generated layers occupy on the map. */
export function rowOffsetFor(blueprint: Blueprint, pathId: string): number {
  const ys = blueprint.nodes.filter((n) => n.pathId === pathId).map((n) => n.y)
  if (ys.length === 0) return 0
  return Math.round((Math.max(...ys) - TOP_Y) / ROW_H) + 1
}
