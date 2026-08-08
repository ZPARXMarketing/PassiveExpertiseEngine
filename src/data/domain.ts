/**
 * Domain generation client.
 *
 * Two calls, both defensive, both with an offline fallback so no topic is ever
 * rejected:
 *   - `generateDomain` — the routes through a topic (fast, cheap, no concepts)
 *   - `generateLayer`  — the concepts of one layer of one chosen route
 *
 * Mirrors study.ts: the browser calls OpenRouter directly when the user has
 * their own key in Settings, otherwise it asks the site function, which holds a
 * server-side key. Every failure is a readable error the caller can show.
 */

import type {
  AppSettings,
  Domain,
  DomainPath,
  PathDepth,
  PathLayer,
  RetrievalSeed,
} from './types'
import { emptyMetrics, emptyProgress } from './types'
import { OPENROUTER_BASE_URL, parseCompletionJson, DEFAULT_MODEL } from './studyPrompt'
import { openRouterError } from './study'
import {
  domainCompletionBody,
  layerCompletionBody,
  type DomainRequest,
  type LayerRequest,
} from './domainPrompt'
import {
  LayerUnavailableError,
  normalizeLayer,
  rowOffsetFor,
  slug,
  type LayerContext,
  type NormalizedLayer,
  type RawLayer,
} from './layer'
import { hydrateSeeds } from './retrieval'

export const DOMAIN_ENDPOINT = '/.netlify/functions/generate-domain'
export const LAYER_ENDPOINT = '/.netlify/functions/generate-layer'

export class DomainUnavailableError extends Error {}
export { LayerUnavailableError }
export type { NormalizedLayer }

const NO_KEY_MESSAGE =
  'No OpenRouter key set. Add one in Settings to have the AI map the domain, or deploy the site with OPENROUTER_API_KEY configured.'

/* ------------------------------------------------------------ normalising --- */

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

const strList = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s): s is string => s !== null)
}

const emoji = (v: unknown): string | undefined => {
  const s = str(v)
  if (!s) return undefined
  const glyphs = Array.from(s)
  return glyphs.length <= 3 ? s : undefined
}

const DEPTHS: PathDepth[] = ['shallow', 'moderate', 'deep']
const DEFAULT_WEEKS: Record<PathDepth, number> = { shallow: 3, moderate: 7, deep: 14 }

interface RawDomain {
  title?: unknown
  overview?: unknown
  goals?: unknown
  paths?: unknown
  model?: unknown
}

const MIN_PATHS = 3
const MAX_PATHS = 6

/** How many layers a path is expected to have, before any are generated. */
function plannedLayers(depth: PathDepth): number {
  return depth === 'shallow' ? 2 : depth === 'moderate' ? 3 : 4
}

/** Empty layer shells so the roadmap can show locked depth before it exists. */
function layerShells(pathId: string, depth: PathDepth): PathLayer[] {
  const names = ['Foundations', 'Working depth', 'Advanced', 'Frontier']
  return Array.from({ length: plannedLayers(depth) }, (_, i) => ({
    id: `${pathId}-layer-${i}`,
    title: names[i] ?? `Layer ${i + 1}`,
    conceptIds: [],
    unlocked: false,
    generated: false,
  }))
}

function readPaths(raw: unknown): DomainPath[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const paths: DomainPath[] = []

  for (const entry of raw.slice(0, MAX_PATHS)) {
    const p = entry as {
      id?: unknown
      title?: unknown
      icon?: unknown
      pitch?: unknown
      payoff?: unknown
      depth?: unknown
      weeks?: unknown
    }
    const title = str(p.title) ?? str(p.id)
    const pitch = str(p.pitch)
    if (!title || !pitch) continue

    let id = slug(str(p.id) ?? title) || `path-${paths.length + 1}`
    while (seen.has(id)) id = `${id}-${paths.length + 1}`
    seen.add(id)

    const rawDepth = slug(str(p.depth) ?? '') as PathDepth
    const depth: PathDepth = DEPTHS.includes(rawDepth) ? rawDepth : 'moderate'
    const weeks =
      typeof p.weeks === 'number' && Number.isFinite(p.weeks) && p.weeks > 0
        ? Math.round(p.weeks)
        : DEFAULT_WEEKS[depth]

    paths.push({
      id,
      title,
      pitch,
      payoff: str(p.payoff) ?? 'A working command of this route.',
      depth,
      weeks,
      icon: emoji(p.icon),
      selected: false,
      layers: layerShells(id, depth),
    })
  }

  return paths
}

/** Model output → a Domain with proposals and nothing unlocked yet. */
export function normalizeDomain(raw: RawDomain, topic: string): Domain {
  const paths = readPaths(raw.paths)
  if (paths.length < MIN_PATHS) {
    throw new DomainUnavailableError(
      'The model did not return usable paths — try again, or pick another model in Settings.',
    )
  }

  const trimmed = topic.trim()
  const rawTitle = str(raw.title) ?? trimmed
  const title = rawTitle.length > 40 ? `${rawTitle.slice(0, 37).trim()}…` : rawTitle

  return {
    id: `dom-${slug(title).slice(0, 24) || 'domain'}-${Date.now()}`,
    topic: trimmed || title,
    title,
    createdAt: new Date().toISOString(),
    source: 'generated',
    model: str(raw.model) ?? undefined,
    paths,
    pathsChosen: false,
    blueprint: {
      overview: str(raw.overview) ?? `Routes through “${title}”.`,
      goals: strList(raw.goals).slice(0, 5),
      nodes: [],
      edges: [],
    },
    tasks: [],
    synthPrompts: [],
    items: [],
    drills: [],
    metrics: emptyMetrics(),
    progress: emptyProgress(),
  }
}

/* ---------------------------------------------------------------- offline --- */

/**
 * Offline domain: real structure, honest about being generic.
 * Used when there is no key or the call fails, so typing a topic always lands
 * somewhere usable rather than on an error.
 */
export function offlineDomain(topic: string): Domain {
  const trimmed = topic.trim() || 'Untitled domain'
  const title = trimmed.length > 40 ? `${trimmed.slice(0, 37).trim()}…` : trimmed
  const base = slug(title).slice(0, 20) || 'domain'

  const specs: Array<Omit<DomainPath, 'layers' | 'selected'>> = [
    {
      id: `${base}-foundations`,
      title: 'Foundations first',
      icon: '🧱',
      pitch: `The vocabulary and mental models everything else in ${title} rests on.`,
      payoff: 'You can read anything in the field without stopping every paragraph.',
      depth: 'moderate',
      weeks: 6,
    },
    {
      id: `${base}-applied`,
      title: 'Applied practice',
      icon: '🛠️',
      pitch: `Learn ${title} by producing artifacts, backfilling theory only when it blocks you.`,
      payoff: 'A portfolio of real work you can point at.',
      depth: 'moderate',
      weeks: 8,
    },
    {
      id: `${base}-judgement`,
      title: 'Judgement and trade-offs',
      icon: '⚖️',
      pitch: `The decisions practitioners of ${title} argue about, and how to take a side.`,
      payoff: 'You can defend a call in a room full of people who know the field.',
      depth: 'deep',
      weeks: 12,
    },
    {
      id: `${base}-fast`,
      title: 'Fast working command',
      icon: '⚡',
      pitch: `The 20% of ${title} that covers most day-to-day situations.`,
      payoff: 'Useful in a fortnight, without pretending to be complete.',
      depth: 'shallow',
      weeks: 3,
    },
  ]

  return {
    id: `dom-${base}-${Date.now()}`,
    topic: trimmed,
    title,
    createdAt: new Date().toISOString(),
    source: 'stub',
    paths: specs.map((s) => ({ ...s, selected: false, layers: layerShells(s.id, s.depth) })),
    pathsChosen: false,
    blueprint: {
      overview: `Starter routes through “${title}”. Add an OpenRouter key in Settings to have these mapped to the real shape of the domain.`,
      goals: [
        'Pick one or two routes and ignore the rest',
        'Keep the visible layer small enough to finish',
        'Prove retention before opening more depth',
      ],
      nodes: [],
      edges: [],
    },
    tasks: [],
    synthPrompts: [],
    items: [],
    drills: [],
    metrics: emptyMetrics(),
    progress: emptyProgress(),
  }
}

/**
 * Offline layer: four generic concepts shaped like the real thing.
 * Keeps a selected path walkable with no key, and is replaced wholesale the
 * moment a real layer is generated over the top of it.
 */
export function offlineLayer(path: DomainPath, ctx: LayerContext): NormalizedLayer {
  if (ctx.layerIndex > 0) return offlineDeeperLayer(path, ctx)
  const raw: RawLayer = {
    layerTitle: 'Getting oriented',
    concepts: [
      {
        id: 'outcome',
        label: 'the outcome',
        icon: '🎯',
        core: true,
        tier: 0,
        summary: 'What “done” looks like on this route',
        why: 'Stops you optimising work that does not move the payoff.',
        overview: `Name the concrete result ${path.title} is supposed to produce, in terms you could check today.`,
        learnAbout: ['Outcome vs activity', 'Checkable success criteria', 'Scope cuts that protect focus'],
      },
      {
        id: 'vocabulary',
        label: 'core vocabulary',
        icon: '📖',
        core: true,
        tier: 1,
        prereqs: ['outcome'],
        summary: 'The words practitioners use and what they actually mean',
        why: 'Lets you read source material without a translation pass.',
        overview: 'Collect the terms that keep appearing, and write a one-line definition you could defend.',
        learnAbout: ['Terms that carry weight', 'False friends from adjacent fields', 'What you can safely skip'],
      },
      {
        id: 'first-model',
        label: 'first working model',
        icon: '🧠',
        core: false,
        tier: 2,
        prereqs: ['vocabulary'],
        summary: 'A simplification good enough to reason with',
        why: 'Gives you something to be wrong with, which is how the corrections land.',
        overview: 'Build the smallest mental model that explains the cases you have already seen.',
        learnAbout: ['What the model explains', 'Where it breaks', 'When to reach for a better one'],
      },
      {
        id: 'first-artifact',
        label: 'first artifact',
        icon: '🛠️',
        core: true,
        tier: 3,
        prereqs: ['first-model'],
        summary: 'One thing you produced, not one thing you read',
        why: 'Reading feels like progress; the artifact is what proves it.',
        overview: 'Ship one small concrete piece of work using everything above.',
        learnAbout: ['Inputs → artifact', 'Time-boxing', 'How you know it is good'],
      },
    ],
    tasks: [
      {
        conceptId: 'first-artifact',
        title: `First block: ${path.title}`,
        prompt: `Spend 45 focused minutes producing one artifact on the "${path.title}" route. State the inputs you used, the output, and how you know it is right. Notes are not an artifact.`,
        starterText: 'Artifact I will produce:\n\nInputs:\n\nDone when:\n',
        evalNote: 'Starter route — any focused write-up counts as a completed block in the prototype.',
      },
    ],
    items: [
      {
        conceptId: 'outcome',
        kind: 'discrimination',
        prompt: 'Which of these is an outcome rather than an activity?',
        options: [
          'A working artifact someone else could check',
          'Two hours spent reading about the topic',
          'A list of resources bookmarked for later',
        ],
        correctIndex: 0,
        explanation:
          'Activities consume time; outcomes survive it. If nobody could verify it tomorrow, it was an activity.',
      },
      {
        conceptId: 'vocabulary',
        kind: 'application',
        prompt: 'You hit an unfamiliar term twice in one week. What do you do, and why?',
        keyPoints: ['write a one-line definition', 'find a concrete example', 'check it against a real case'],
        answer:
          'Define it in one line you could defend, attach a concrete example, then check the definition against a case you have already seen.',
      },
      {
        conceptId: 'first-model',
        kind: 'mcq',
        prompt: 'Your working model fails on a new case. Best next move?',
        options: [
          'Note exactly where it broke and patch the model',
          'Discard the model and start from scratch',
          'Ignore the case as an exception',
        ],
        correctIndex: 0,
        explanation:
          'The break is the information. A model that has never failed has never been tested hard enough to trust.',
      },
    ],
    teachBack: [
      {
        conceptId: 'outcome',
        prompt: `Explain what "done" means on the ${path.title} route to someone deciding whether to start it.`,
        scaffold: [
          'What is the concrete result?',
          'How would someone else check it?',
          'What is deliberately out of scope?',
        ],
        rubricKeywords: ['outcome', 'result', 'check', 'scope', 'artifact', 'decide'],
        passFeedback: 'Clear enough to aim at.',
        failFeedback: 'Name the result, how it is checked, and what you are deliberately not doing.',
      },
    ],
    drills: [
      {
        conceptId: 'first-artifact',
        title: 'Next-move check',
        question: 'You have read the overview material and understood it. Best next move?',
        options: [
          'Produce a small artifact using it',
          'Read a second overview to be sure',
          'Wait until you feel ready',
        ],
        correctIndex: 0,
        explanation:
          'Understanding on the page is not retrievable under pressure. Production is what converts it.',
      },
    ],
  }
  return normalizeLayer(raw, ctx)
}

/**
 * Offline layer beyond the first. Deeper starter layers are about stressing what
 * the entry layer built rather than repeating it, so the concepts differ.
 */
function offlineDeeperLayer(path: DomainPath, ctx: LayerContext): NormalizedLayer {
  const raw: RawLayer = {
    layerTitle: ctx.layerIndex === 1 ? 'Where it breaks' : `Layer ${ctx.layerIndex + 1}`,
    concepts: [
      {
        id: 'edge-cases',
        label: 'edge cases',
        icon: '🧨',
        core: true,
        tier: 0,
        summary: 'The cases your first model gets wrong',
        why: 'Tells you when to stop trusting the simple story.',
        overview: `Collect the situations in ${path.title} where the entry-layer model gives the wrong answer.`,
        learnAbout: ['Failure modes', 'Boundary conditions', 'What the simplification hid'],
      },
      {
        id: 'second-model',
        label: 'second model',
        icon: '🔭',
        core: true,
        tier: 1,
        prereqs: ['edge-cases'],
        summary: 'A richer account that covers the breaks',
        why: 'Buys accuracy at the cost of effort — you choose when that trade is worth it.',
        overview: 'Upgrade the model so it explains the edge cases without discarding what already worked.',
        learnAbout: ['What the upgrade adds', 'What it costs to use', 'When the simple model still wins'],
      },
      {
        id: 'transfer',
        label: 'transfer',
        icon: '🔀',
        core: false,
        tier: 2,
        prereqs: ['second-model'],
        summary: 'Using it somewhere it was not taught',
        why: 'Transfer is the only real evidence you understood rather than memorised.',
        overview: 'Apply the idea in a context nobody handed you, and notice what does not carry over.',
        learnAbout: ['Surface vs deep similarity', 'What travels', 'What was local to the example'],
      },
      {
        id: 'teach-it',
        label: 'teaching it',
        icon: '🗣️',
        core: true,
        tier: 3,
        prereqs: ['transfer'],
        summary: 'Explaining it to someone who will push back',
        why: 'Exposes the joints you have been gliding over.',
        overview: 'Explain the upgraded model to someone who will ask why, and repair whatever collapses.',
        learnAbout: ['Explaining without jargon', 'Handling the obvious objection', 'Where your account is thin'],
      },
    ],
    tasks: [
      {
        conceptId: 'transfer',
        title: `Transfer block: ${path.title}`,
        prompt: `Find a situation outside anything you have studied on the "${path.title}" route, apply the idea to it, and write down where it held and where it did not.`,
        starterText: 'New situation:\n\nWhat carried over:\n\nWhat did not:\n',
        evalNote: 'Starter route — any focused write-up counts as a completed block in the prototype.',
      },
    ],
    items: [
      {
        conceptId: 'edge-cases',
        kind: 'mcq',
        prompt: 'Your model works on every case you have tried. What does that most likely mean?',
        options: [
          'You have not tried a hard enough case yet',
          'The model is complete',
          'The domain is simpler than people claim',
        ],
        correctIndex: 0,
        explanation:
          'An untested model and a correct model look identical from the inside. The information is in the cases you have avoided.',
      },
      {
        conceptId: 'second-model',
        kind: 'application',
        prompt: 'When is the simpler model still the right one to reach for? Give the condition, not a platitude.',
        keyPoints: [
          'when the edge case cannot occur in this situation',
          'when the cost of the richer model exceeds the error it removes',
        ],
        answer:
          'When the situation cannot hit the edge cases, or when the extra effort of the richer model costs more than the error it would remove.',
      },
      {
        conceptId: 'transfer',
        kind: 'discrimination',
        prompt: 'Which of these is real transfer?',
        options: [
          'Applying the idea in a domain nobody showed you, and noticing what fails',
          'Solving another textbook problem of the same type',
          'Restating the idea in your own words',
        ],
        correctIndex: 0,
        explanation:
          'Same-type problems test practice; restatement tests phrasing. Transfer is the untaught context.',
      },
    ],
    teachBack: [
      {
        conceptId: 'teach-it',
        prompt: `Explain the strongest objection to how you currently think about ${path.title}, and answer it.`,
        scaffold: [
          'What is the objection?',
          'What does it get right?',
          'Why does your account survive it?',
        ],
        rubricKeywords: ['objection', 'because', 'case', 'model', 'evidence', 'wrong'],
        passFeedback: 'You argued with yourself and won on the merits.',
        failFeedback: 'State a real objection, concede what it gets right, then show what still holds.',
      },
    ],
    drills: [
      {
        conceptId: 'edge-cases',
        title: 'Break-it check',
        question: 'Fastest way to find out whether you actually understand something?',
        options: [
          'Look for the case that breaks your explanation',
          'Re-read the material more carefully',
          'Explain it to someone who agrees with you',
        ],
        correctIndex: 0,
        explanation:
          'Confirmation is cheap and uninformative. The break is where the learning is.',
      },
    ],
  }
  return normalizeLayer(raw, ctx)
}

/* --------------------------------------------------------------- fetching --- */

async function viaOpenRouter<T>(
  body: object,
  settings: AppSettings,
  ErrorClass: new (message: string) => Error,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.openRouterKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Domain Engine',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ErrorClass('Could not reach OpenRouter. Check your connection.')
  }

  if (!res.ok) throw new ErrorClass(await openRouterError(res))

  const completion = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) throw new ErrorClass('OpenRouter returned an empty completion. Try again.')
  const parsed = parseCompletionJson(content)
  if (!parsed) {
    throw new ErrorClass('The model did not return JSON. Try again or pick another model.')
  }
  return parsed as T
}

async function viaFunction<T>(
  endpoint: string,
  request: object,
  ErrorClass: new (message: string) => Error,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(request),
    })
  } catch {
    throw new ErrorClass(NO_KEY_MESSAGE)
  }

  // Under plain `vite dev` there is no function: the SPA fallback answers with
  // index.html, which is a 200 that is very much not JSON.
  if (res.status === 404 || !res.headers.get('content-type')?.includes('json')) {
    throw new ErrorClass(NO_KEY_MESSAGE)
  }

  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new ErrorClass(payload?.error ?? `Generator failed (HTTP ${res.status}).`)
  return (payload ?? {}) as T
}

/** Map a topic into 4–6 broad paths. Nothing is generated below path level yet. */
export async function generateDomain({
  topic,
  settings,
  signal,
}: {
  topic: string
  settings: AppSettings
  signal?: AbortSignal
}): Promise<Domain> {
  const request: DomainRequest = { topic: topic.trim() }
  const model = settings.model.trim() || DEFAULT_MODEL
  const raw = settings.openRouterKey.trim()
    ? {
        ...(await viaOpenRouter<RawDomain>(
          domainCompletionBody(request, model),
          settings,
          DomainUnavailableError,
          signal,
        )),
        model,
      }
    : await viaFunction<RawDomain>(DOMAIN_ENDPOINT, request, DomainUnavailableError, signal)
  return normalizeDomain(raw, topic)
}

/** Build one layer of one path. Called on select, and again on each unlock. */
export async function generateLayer({
  domain,
  path,
  layerIndex,
  settings,
  signal,
}: {
  domain: Domain
  path: DomainPath
  layerIndex: number
  settings: AppSettings
  signal?: AbortSignal
}): Promise<NormalizedLayer> {
  const covered = domain.blueprint.nodes
    .filter((n) => n.pathId === path.id && (n.layer ?? 0) < layerIndex)
    .map((n) => n.label)

  const request: LayerRequest = {
    topic: domain.topic,
    domainTitle: domain.title,
    pathTitle: path.title,
    pathPitch: path.pitch,
    pathPayoff: path.payoff,
    layerIndex,
    covered,
  }

  const ctx = layerContext(domain, path, layerIndex)
  const model = settings.model.trim() || DEFAULT_MODEL
  const raw = settings.openRouterKey.trim()
    ? await viaOpenRouter<RawLayer>(
        layerCompletionBody(request, model),
        settings,
        LayerUnavailableError,
        signal,
      )
    : await viaFunction<RawLayer>(LAYER_ENDPOINT, request, LayerUnavailableError, signal)

  return normalizeLayer(raw, ctx)
}

/** Where a new layer sits on the map, and which ids it must avoid. */
export function layerContext(domain: Domain, path: DomainPath, layerIndex: number): LayerContext {
  const column = Math.max(
    0,
    domain.paths.filter((p) => p.selected).findIndex((p) => p.id === path.id),
  )
  return {
    pathId: path.id,
    layerIndex,
    column,
    rowOffset: rowOffsetFor(domain.blueprint, path.id),
    taken: new Set(domain.blueprint.nodes.map((n) => n.id)),
  }
}

/* ---------------------------------------------------------------- merging --- */

/** Fold a generated layer into the domain, unlocking it. */
export function applyLayer(domain: Domain, pathId: string, layerIndex: number, built: NormalizedLayer): Domain {
  const seeds: RetrievalSeed[] = built.items
  const paths = domain.paths.map((p) => {
    if (p.id !== pathId) return p
    const layers = [...p.layers]
    const shell: PathLayer = layers[layerIndex] ?? {
      id: `${pathId}-layer-${layerIndex}`,
      title: built.layerTitle,
      conceptIds: [],
      unlocked: false,
    }
    layers[layerIndex] = {
      ...shell,
      title: built.layerTitle || shell.title,
      conceptIds: built.nodes.map((n) => n.id),
      unlocked: true,
      unlockedAt: new Date().toISOString(),
      generated: true,
    }
    return { ...p, layers }
  })

  return {
    ...domain,
    paths,
    blueprint: {
      ...domain.blueprint,
      nodes: [...domain.blueprint.nodes, ...built.nodes],
      edges: [...domain.blueprint.edges, ...built.edges],
    },
    tasks: [...domain.tasks, ...built.tasks],
    synthPrompts: [...domain.synthPrompts, ...built.synthPrompts],
    drills: [...domain.drills, ...built.drills],
    items: [...domain.items, ...hydrateSeeds(seeds, 'generated')],
  }
}
