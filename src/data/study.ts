import type { BlueprintNode, ConceptStudy, Subject } from './types'

/**
 * Serverless endpoint that talks to the cheap generation model (DeepSeek).
 * Kept behind a function so the API key never ships to the browser.
 * See netlify/functions/generate-study.mts.
 */
export const STUDY_ENDPOINT = '/.netlify/functions/generate-study'

export class StudyUnavailableError extends Error {}

interface GenerateArgs {
  subject: Subject
  node: BlueprintNode
  signal?: AbortSignal
}

/** Strip the lock glyph the blueprint labels carry */
export const cleanLabel = (label: string): string => label.replace(' 🔒', '').trim()

/**
 * Build a readable study page from the curriculum fields we already have.
 * Used before anything is generated, and when the generator is unreachable —
 * the concept page is never empty.
 */
export function outlineStudy(subject: Subject, node: BlueprintNode): ConceptStudy {
  const label = cleanLabel(node.label)
  const sections: ConceptStudy['sections'] = [
    {
      heading: `What ${label} covers`,
      body:
        node.overview ??
        `${label} is a stop on the ${subject.title} path. Work it in Terminal or drill it on Dashboard to turn it from a definition into a reflex.`,
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
    tagline: node.summary ?? `Core concept on the ${subject.title} path`,
    whyItMatters:
      node.summary ??
      `This concept sits between the ideas before it and the decisions after it on the ${subject.title} path.`,
    sections,
  }
}

/** Content shown on the concept page: authored/cached study, else the outline. */
export function studyFor(subject: Subject, node: BlueprintNode): ConceptStudy {
  return node.study ?? outlineStudy(subject, node)
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

/**
 * Ask the serverless function for a full study page on this concept.
 * Throws StudyUnavailableError with a human-readable reason on any failure —
 * the concept page keeps showing the outline in that case.
 */
export async function generateStudy({ subject, node, signal }: GenerateArgs): Promise<ConceptStudy> {
  let res: Response
  try {
    res = await fetch(STUDY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        goal: subject.goal,
        subjectTitle: subject.title,
        pathOverview: subject.blueprint.overview ?? null,
        concept: cleanLabel(node.label),
        summary: node.summary ?? null,
        overview: node.overview ?? null,
        learnAbout: node.learnAbout ?? [],
        siblings: subject.blueprint.nodes
          .filter((n) => n.id !== node.id)
          .map((n) => cleanLabel(n.label)),
      }),
    })
  } catch {
    throw new StudyUnavailableError(
      'Could not reach the study generator. It runs as a Netlify function — deploy the site (or run `netlify dev`) to use it.',
    )
  }

  if (res.status === 404) {
    throw new StudyUnavailableError(
      'Study generator not found at this origin. It ships as a Netlify function — plain `vite dev` does not serve it; use `netlify dev` or the deployed site.',
    )
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      `Study generator failed (HTTP ${res.status}).`
    throw new StudyUnavailableError(message)
  }

  return normalizeStudy((payload ?? {}) as RawStudy, outlineStudy(subject, node))
}
