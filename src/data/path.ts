import type {
  AppSettings,
  Blueprint,
  BlueprintEdge,
  BlueprintNode,
  Drill,
  PracticeTask,
  SrsCard,
  Subject,
  SynthesisPrompt,
} from './types'
import { emptyMetrics } from './types'
import { OPENROUTER_BASE_URL, parseCompletionJson } from './studyPrompt'
import { pathCompletionBody, type PathRequest } from './pathPrompt'
import { openRouterError } from './study'

/**
 * Learning-path generation: a typed goal in, a whole Subject out.
 *
 * Mirrors study.ts — the browser calls OpenRouter directly when the user has
 * their own key in Settings, otherwise it asks the site function, which holds a
 * server-side key. Every failure is a PathUnavailableError with a readable
 * reason; the caller falls back to the generic starter path so no goal is ever
 * rejected.
 */
export const PATH_ENDPOINT = '/.netlify/functions/generate-path'

export class PathUnavailableError extends Error {}

/* ---------------------------------------------------------------- layout --- */

/** Graph coordinate space — BlueprintGraph grows its viewBox to fit. */
const TOP_Y = 52
const ROW_H = 82
const X_MIN = 52
const X_MAX = 208
const X_MID = (X_MIN + X_MAX) / 2

/** Evenly spread a row of concepts across the graph's usable width. */
function rowX(index: number, count: number): number {
  if (count <= 1) return X_MID
  return Math.round(X_MIN + (index * (X_MAX - X_MIN)) / (count - 1))
}

/* ------------------------------------------------------------ normalising --- */

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

const strList = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s): s is string => s !== null)
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Keep a single glyph; anything longer is prose, and the graph falls back to initials. */
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

interface RawPath {
  title?: unknown
  overview?: unknown
  goals?: unknown
  concepts?: unknown
  tasks?: unknown
  feynman?: unknown
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

const MIN_CONCEPTS = 3
const MAX_CONCEPTS = 8

/** Model output → concepts with unique slugs and only resolvable prereqs. */
function readConcepts(raw: unknown): Concept[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const concepts: Concept[] = []

  for (const item of raw.slice(0, MAX_CONCEPTS)) {
    const c = item as RawConcept
    const label = str(c.label) ?? str(c.id)
    if (!label) continue

    let id = slug(str(c.id) ?? label) || `concept-${concepts.length + 1}`
    while (seen.has(id)) id = `${id}-${concepts.length + 1}`
    seen.add(id)

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

  // Only prereqs pointing at an *earlier* concept survive: that keeps the graph
  // acyclic no matter what the model emitted.
  return concepts.map((c, i) => {
    const earlier = new Set(concepts.slice(0, i).map((p) => p.id))
    return { ...c, prereqs: c.prereqs.filter((p) => earlier.has(p)) }
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

/** A fresh path: entry concepts in progress, everything downstream available. */
function nodesFor(concepts: Concept[], rows: number[]): BlueprintNode[] {
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
    x: rowX(indexInRow[i], perRow.get(rows[i]) ?? 1),
    y: TOP_Y + rows[i] * ROW_H,
    status: rows[i] === 0 ? 'learning' : 'available',
    is8020: c.core,
    retention: rows[i] === 0 ? 12 : 0,
    summary: c.summary,
    why: c.why,
    overview: c.overview,
    learnAbout: c.learnAbout.length ? c.learnAbout : undefined,
  }))
}

/** Reset a generated subject to its day-one state without losing the curriculum. */
export function freshenGeneratedNodes(blueprint: Blueprint): BlueprintNode[] {
  const hasIncoming = new Set(blueprint.edges.map((e) => e.to))
  return blueprint.nodes.map((n) => ({
    ...n,
    status: hasIncoming.has(n.id) ? 'available' : 'learning',
    retention: hasIncoming.has(n.id) ? 0 : 12,
  }))
}

function tasksFor(raw: unknown, ids: Set<string>, prefix: string): PracticeTask[] {
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
      const conceptId = slug(str(t.conceptId) ?? '')
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

function synthFor(raw: unknown, ids: Set<string>, prefix: string): SynthesisPrompt[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      const f = item as {
        conceptId?: unknown
        prompt?: unknown
        rubricKeywords?: unknown
        passFeedback?: unknown
        failFeedback?: unknown
        cards?: unknown
      }
      const conceptId = slug(str(f.conceptId) ?? '')
      const prompt = str(f.prompt)
      const rubricKeywords = strList(f.rubricKeywords).map((k) => k.toLowerCase())
      if (!prompt || !ids.has(conceptId) || rubricKeywords.length < 3) return null

      const cards: SynthesisPrompt['cardsOnPass'] = (Array.isArray(f.cards) ? f.cards : [])
        .map((c, j) => {
          const card = c as { front?: unknown; back?: unknown }
          const front = str(card.front)
          const back = str(card.back)
          if (!front || !back) return null
          return { id: `${prefix}-card-${i + 1}-${j + 1}`, conceptId, front, back }
        })
        .filter((c): c is Pick<SrsCard, 'id' | 'conceptId' | 'front' | 'back'> => c !== null)

      return {
        id: `${prefix}-synth-${i + 1}`,
        conceptId,
        prompt,
        rubricKeywords,
        passFeedback: str(f.passFeedback) ?? 'Solid — atomized into review cards.',
        failFeedback:
          str(f.failFeedback) ??
          'Name the mechanism and one concrete consequence, in your own words.',
        cardsOnPass: cards,
      }
    })
    .filter((s): s is SynthesisPrompt => s !== null)
}

function drillsFor(raw: unknown, ids: Set<string>, prefix: string): Drill[] {
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
      const conceptId = slug(str(d.conceptId) ?? '')
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

/** A first deep-work block, when the model returned none we could use. */
function withFallbackTask(
  tasks: PracticeTask[],
  anchor: Concept,
  title: string,
  prefix: string,
): PracticeTask[] {
  if (tasks.length > 0) return tasks
  return [
    {
      id: `${prefix}-task-fallback`,
      conceptId: anchor.id,
      title: `First block: ${anchor.label}`,
      prompt: `Spend 45 focused minutes on "${anchor.label}" for ${title}. Produce one artifact you could show someone — notes are not an artifact. State the inputs you used, the output, and how you know it is right.`,
      kind: 'text',
      starterText: 'Artifact I will produce:\n\nInputs:\n\nDone when:\n',
      evalNote: 'Generated path — the prototype accepts any focused write-up as a completed block.',
    },
  ]
}

/** An explain-back prompt, when the model returned none we could use. */
function withFallbackSynth(
  prompts: SynthesisPrompt[],
  anchor: Concept,
  prefix: string,
): SynthesisPrompt[] {
  if (prompts.length > 0) return prompts
  const keywords = [
    ...anchor.label.split(/\s+/).filter((w) => w.length > 3),
    ...anchor.learnAbout.flatMap((t) => t.toLowerCase().split(/\s+/).filter((w) => w.length > 4)),
  ].slice(0, 6)

  return [
    {
      id: `${prefix}-synth-fallback`,
      conceptId: anchor.id,
      prompt: `Explain "${anchor.label}" to a smart beginner in two minutes: what it is, why it changes a decision, and one concrete example.`,
      rubricKeywords: keywords.length >= 3 ? keywords : [anchor.label, 'because', 'example'],
      passFeedback: 'Clear enough to teach from — atomized into a review card.',
      failFeedback:
        'Name the mechanism, the decision it changes, and one concrete example. Avoid definitions you could not use at work.',
      cardsOnPass: [
        {
          id: `${prefix}-card-fallback`,
          conceptId: anchor.id,
          front: `In one line: ${anchor.label}`,
          back: anchor.summary ?? '(Fill from your own explanation once it holds up.)',
        },
      ],
    },
  ]
}

/**
 * Model output → a complete Subject: graph coordinates, statuses, task/synth/
 * drill wiring. Throws PathUnavailableError when the response is too thin to
 * study from, so the caller can fall back to the starter path.
 */
export function normalizePath(raw: RawPath, goal: string): Subject {
  const concepts = readConcepts(raw.concepts)
  if (concepts.length < MIN_CONCEPTS) {
    throw new PathUnavailableError(
      'The model did not return a usable path — try again, or pick another model in Settings.',
    )
  }

  const trimmedGoal = goal.trim()
  const rawTitle = str(raw.title) ?? trimmedGoal
  const title = rawTitle.length > 48 ? `${rawTitle.slice(0, 45).trim()}…` : rawTitle
  const prefix = `gen-${slug(title).slice(0, 24) || 'path'}-${Date.now()}`

  const rows = rowsFor(concepts)
  const nodes = nodesFor(concepts, rows)
  const edges = edgesFor(concepts, nodes, rows)
  const ids = new Set(concepts.map((c) => c.id))

  // Practice must exist even when the model only returned a graph, so the
  // Terminal and Synthesis stages are never empty on a brand-new project.
  const anchor = concepts.find((c) => c.core) ?? concepts[0]
  const tasks = withFallbackTask(tasksFor(raw.tasks, ids, prefix), anchor, title, prefix)
  const synthPrompts = withFallbackSynth(synthFor(raw.feynman, ids, prefix), anchor, prefix)
  const drills = drillsFor(raw.drills, ids, prefix)

  // Concepts open their own practice task straight from the study page.
  const taskByConcept = new Map(tasks.map((t) => [t.conceptId, t.id]))
  const wiredNodes = nodes.map((n) =>
    taskByConcept.has(n.id) ? { ...n, taskId: taskByConcept.get(n.id) } : n,
  )

  return {
    id: `sub-${slug(title).slice(0, 24) || 'path'}-${Date.now()}`,
    goal: trimmedGoal || title,
    title,
    createdAt: new Date().toISOString(),
    source: 'generated',
    model: str(raw.model) ?? undefined,
    blueprint: {
      overview: str(raw.overview) ?? `Skill path for “${title}”.`,
      goals: strList(raw.goals).slice(0, 5),
      nodes: wiredNodes,
      edges,
    },
    tasks,
    synthPrompts,
    srs: [],
    drills,
    metrics: emptyMetrics(),
  }
}

/* --------------------------------------------------------------- fetching --- */

/** Browser → OpenRouter directly, using the key the user stored in Settings. */
async function generateViaOpenRouter(
  request: PathRequest,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<RawPath> {
  const model = settings.model.trim() || 'deepseek/deepseek-chat'
  let res: Response
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.openRouterKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Expertise Engine',
      },
      body: JSON.stringify(pathCompletionBody(request, model)),
    })
  } catch {
    throw new PathUnavailableError('Could not reach OpenRouter. Check your connection.')
  }

  if (!res.ok) throw new PathUnavailableError(await openRouterError(res))

  const completion = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) {
    throw new PathUnavailableError('OpenRouter returned an empty completion. Try again.')
  }
  const parsed = parseCompletionJson(content)
  if (!parsed) {
    throw new PathUnavailableError(
      'The model did not return JSON. Try again or pick another model.',
    )
  }
  return { ...parsed, model } as RawPath
}

const NO_KEY_MESSAGE =
  'No OpenRouter key set. Add one in Settings to have the AI design the path, or deploy the site with OPENROUTER_API_KEY configured.'

/** Fallback path: the site's own function, which holds a server-side key. */
async function generateViaFunction(
  request: PathRequest,
  signal?: AbortSignal,
): Promise<RawPath> {
  let res: Response
  try {
    res = await fetch(PATH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(request),
    })
  } catch {
    throw new PathUnavailableError(NO_KEY_MESSAGE)
  }

  // Under plain `vite dev` there is no function: the SPA fallback answers with
  // index.html, which is a 200 that is very much not a path.
  if (res.status === 404 || !res.headers.get('content-type')?.includes('json')) {
    throw new PathUnavailableError(NO_KEY_MESSAGE)
  }

  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) {
    throw new PathUnavailableError(payload?.error ?? `Path generator failed (HTTP ${res.status}).`)
  }
  return (payload ?? {}) as RawPath
}

/**
 * Design a full learning path for a free-text goal.
 * Prefers the user's own OpenRouter key from Settings; otherwise asks the site
 * function. Throws PathUnavailableError with a readable reason on any failure.
 */
export async function generatePath({
  goal,
  settings,
  signal,
}: {
  goal: string
  settings: AppSettings
  signal?: AbortSignal
}): Promise<Subject> {
  const request: PathRequest = { goal: goal.trim() }
  const raw = settings.openRouterKey.trim()
    ? await generateViaOpenRouter(request, settings, signal)
    : await generateViaFunction(request, signal)
  return normalizePath(raw, goal)
}
