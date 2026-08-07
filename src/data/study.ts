import type { AppSettings, BlueprintNode, ConceptStudy, Domain } from './types'
import {
  completionBody,
  OPENROUTER_BASE_URL,
  parseCompletionJson,
  type StudyRequest,
} from './studyPrompt'

/**
 * Serverless fallback used when the site has a server-side OPENROUTER_API_KEY
 * and the user has not entered their own in Settings.
 * See netlify/functions/generate-study.mts.
 */
export const STUDY_ENDPOINT = '/.netlify/functions/generate-study'

export class StudyUnavailableError extends Error {}

interface GenerateArgs {
  domain: Domain
  node: BlueprintNode
  settings: AppSettings
  signal?: AbortSignal
}

/** Strip the lock glyph the blueprint labels carry */
export const cleanLabel = (label: string): string => label.replace(' 🔒', '').trim()

/**
 * Build a readable study page from the curriculum fields we already have.
 * Used before anything is generated, and when the generator is unreachable —
 * the concept page is never empty.
 */
export function outlineStudy(domain: Domain, node: BlueprintNode): ConceptStudy {
  const label = cleanLabel(node.label)
  const sections: ConceptStudy['sections'] = [
    {
      heading: `What ${label} covers`,
      body:
        node.overview ??
        `${label} is a stop on the ${domain.title} path. Work it in Terminal or drill it on Dashboard to turn it from a definition into a reflex.`,
      bullets: node.learnAbout,
    },
  ]

  if (node.status === 'locked') {
    sections.push({
      heading: 'Why this is locked',
      body: 'Prerequisite concepts feed this one. Finish the nodes pointing into it on the blueprint and it opens — the numbers here only mean something once the upstream ideas are solid.',
    })
  }

  sections.push({
    heading: 'How to study it',
    body: 'Read the outline, then do something with it in the same sitting: run the practice task, explain it out loud in Synthesis, and let the review queue defend it. Passive reading decays inside a week.',
    bullets: [
      'Read once for the shape, not for memorisation',
      'Do the Terminal task while the idea is warm',
      'Explain it back in Synthesis without notes',
      'Let spaced review catch what leaked',
    ],
  })

  return {
    source: 'authored',
    tagline: node.summary ?? `Core concept on the ${domain.title} path`,
    // Falling back to the summary here would just repeat the tagline above it.
    whyItMatters:
      node.why ??
      `This concept sits between the ideas before it and the decisions after it on the ${domain.title} path.`,
    sections,
  }
}

/** Content shown on the concept page: authored/cached study, else the outline. */
export function studyFor(domain: Domain, node: BlueprintNode): ConceptStudy {
  return node.study ?? outlineStudy(domain, node)
}

interface RawStudy {
  tagline?: unknown
  whyItMatters?: unknown
  sections?: unknown
  formulas?: unknown
  keyTerms?: unknown
  mistakes?: unknown
  checkYourself?: unknown
  model?: unknown
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

const strList = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out = v.map(str).filter((s): s is string => s !== null)
  return out.length ? out : undefined
}

/** Defensive normaliser — a cheap model will occasionally drift from the schema. */
export function normalizeStudy(raw: RawStudy, fallback: ConceptStudy): ConceptStudy {
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((s) => {
          const sec = s as { heading?: unknown; body?: unknown; bullets?: unknown }
          const heading = str(sec.heading)
          const body = str(sec.body)
          if (!heading || !body) return null
          return { heading, body, bullets: strList(sec.bullets) }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
    : []

  if (sections.length === 0) {
    throw new StudyUnavailableError('The model returned no usable sections — try again.')
  }

  const formulas = Array.isArray(raw.formulas)
    ? raw.formulas
        .map((f) => {
          const item = f as { name?: unknown; expression?: unknown; note?: unknown }
          const name = str(item.name)
          const expression = str(item.expression)
          if (!name || !expression) return null
          return { name, expression, note: str(item.note) ?? undefined }
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
    : []

  const keyTerms = Array.isArray(raw.keyTerms)
    ? raw.keyTerms
        .map((t) => {
          const item = t as { term?: unknown; definition?: unknown }
          const term = str(item.term)
          const definition = str(item.definition)
          if (!term || !definition) return null
          return { term, definition }
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
    : []

  const checkYourself = Array.isArray(raw.checkYourself)
    ? raw.checkYourself
        .map((c) => {
          const item = c as { q?: unknown; a?: unknown }
          const q = str(item.q)
          const a = str(item.a)
          if (!q || !a) return null
          return { q, a }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : []

  return {
    source: 'generated',
    model: str(raw.model) ?? undefined,
    generatedAt: new Date().toISOString(),
    tagline: str(raw.tagline) ?? fallback.tagline,
    whyItMatters: str(raw.whyItMatters) ?? fallback.whyItMatters,
    sections,
    formulas: formulas.length ? formulas : undefined,
    keyTerms: keyTerms.length ? keyTerms : undefined,
    mistakes: strList(raw.mistakes),
    checkYourself: checkYourself.length ? checkYourself : undefined,
  }
}

/** Everything the model needs to know about this concept. */
function requestFor(domain: Domain, node: BlueprintNode): StudyRequest {
  return {
    goal: domain.topic,
    subjectTitle: domain.title,
    pathOverview: domain.blueprint.overview ?? null,
    concept: cleanLabel(node.label),
    summary: node.summary ?? null,
    overview: node.overview ?? null,
    learnAbout: node.learnAbout ?? [],
    siblings: domain.blueprint.nodes
      .filter((n) => n.id !== node.id)
      .map((n) => cleanLabel(n.label)),
  }
}

/** Readable message from an OpenRouter error body, whatever shape it arrives in. */
export async function openRouterError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as
    | { error?: { message?: string } | string }
    | null
  const raw = typeof body?.error === 'string' ? body.error : body?.error?.message
  if (res.status === 401) {
    return raw ?? 'OpenRouter rejected the API key. Check it in Settings.'
  }
  if (res.status === 402) {
    return raw ?? 'OpenRouter reports insufficient credit for this model.'
  }
  if (res.status === 404) {
    return raw ?? 'OpenRouter does not recognise that model id. Check it in Settings.'
  }
  if (res.status === 429) {
    return raw ?? 'OpenRouter rate-limited this key. Wait a moment and retry.'
  }
  return raw ?? `OpenRouter returned HTTP ${res.status}.`
}

/** Browser → OpenRouter directly, using the key the user stored in Settings. */
async function generateViaOpenRouter(
  request: StudyRequest,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<RawStudy> {
  const model = settings.model.trim() || 'deepseek/deepseek-chat'
  let res: Response
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.openRouterKey.trim()}`,
        // OpenRouter attributes usage to the calling app with these
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Domain Engine',
      },
      body: JSON.stringify(completionBody(request, model)),
    })
  } catch {
    throw new StudyUnavailableError('Could not reach OpenRouter. Check your connection.')
  }

  if (!res.ok) throw new StudyUnavailableError(await openRouterError(res))

  const completion = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) {
    throw new StudyUnavailableError('OpenRouter returned an empty completion. Try again.')
  }
  const parsed = parseCompletionJson(content)
  if (!parsed) {
    throw new StudyUnavailableError('The model did not return JSON. Try again or pick another model.')
  }
  return { ...parsed, model } as RawStudy
}

/** Fallback path: the site's own function, which holds a server-side key. */
async function generateViaFunction(
  request: StudyRequest,
  signal?: AbortSignal,
): Promise<RawStudy> {
  let res: Response
  try {
    res = await fetch(STUDY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(request),
    })
  } catch {
    throw new StudyUnavailableError(
      'No OpenRouter key set. Add one in Settings, or deploy the site with OPENROUTER_API_KEY configured.',
    )
  }

  if (res.status === 404) {
    throw new StudyUnavailableError(
      'No OpenRouter key set in Settings, and this origin has no study function. Add your key in Settings to generate.',
    )
  }

  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) {
    throw new StudyUnavailableError(payload?.error ?? `Study generator failed (HTTP ${res.status}).`)
  }
  return (payload ?? {}) as RawStudy
}

/**
 * Generate a full study page for this concept.
 * Prefers the user's own OpenRouter key from Settings (kept in this browser);
 * otherwise asks the site function, which uses a server-side key.
 * Throws StudyUnavailableError with a human-readable reason on any failure —
 * the concept page keeps showing the authored outline in that case.
 */
export async function generateStudy({
  domain,
  node,
  settings,
  signal,
}: GenerateArgs): Promise<ConceptStudy> {
  const request = requestFor(domain, node)
  const raw = settings.openRouterKey.trim()
    ? await generateViaOpenRouter(request, settings, signal)
    : await generateViaFunction(request, signal)
  return normalizeStudy(raw, outlineStudy(domain, node))
}

/** One cheap call that proves the key and model in Settings actually work. */
export async function testOpenRouterKey(settings: AppSettings): Promise<string> {
  const key = settings.openRouterKey.trim()
  if (!key) throw new StudyUnavailableError('Enter an OpenRouter key first.')
  const model = settings.model.trim() || 'deepseek/deepseek-chat'

  let res: Response
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Domain Engine',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
  } catch {
    throw new StudyUnavailableError('Could not reach OpenRouter. Check your connection.')
  }

  if (!res.ok) throw new StudyUnavailableError(await openRouterError(res))
  return `Key works with ${model}.`
}
