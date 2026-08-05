/**
 * LLM grading for Feynman / Synthesis explanations.
 *
 * Scores three axes the learner must hit:
 *   1. Mechanism — how the thing actually works
 *   2. Decision impact — what choice it changes at work
 *   3. Concrete example — a specific, usable illustration
 *
 * Pass when the average score is high enough and no axis is empty.
 * On pass we still atomize into the prompt's cardsOnPass (or optional model cards).
 */

import type { AppSettings, SynthesisPrompt } from './types'
import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  parseCompletionJson,
} from './studyPrompt'
import { openRouterError } from './study'

export const GRADE_ENDPOINT = '/.netlify/functions/generate-grade'

export class GradeUnavailableError extends Error {}

export interface GradeAxes {
  mechanism: number
  decisionImpact: number
  concreteExample: number
}

export interface GradeResult {
  pass: boolean
  scores: GradeAxes
  feedback: string
  /** Optional cards the model suggests; otherwise use prompt.cardsOnPass */
  suggestedCards?: Array<{ front: string; back: string }>
}

interface GradeRequest {
  conceptLabel: string
  prompt: string
  explanation: string
  rubricKeywords: string[]
  goal?: string
}

const GRADE_SYSTEM = `You grade a learner's Feynman-style explanation for a skill-acquisition app.

Score three axes from 0 to 5 (integers only):
- mechanism: does the answer explain how the concept actually works (causal structure), not just name it?
- decisionImpact: does it say what real decision or action changes because of this idea?
- concreteExample: is there a specific, concrete example a practitioner could reuse?

Pass only if ALL of:
1. average of the three scores >= 3.5
2. every axis score >= 2
3. the explanation is at least ~80 words of substance (not keyword soup)

Respond with a single JSON object and nothing else:
{
  "mechanism": 0-5,
  "decisionImpact": 0-5,
  "concreteExample": 0-5,
  "pass": true|false,
  "feedback": "one or two sentences of specific coaching — what landed, what was missing",
  "cards": [ { "front": "retrieval prompt", "back": "tight answer" } ]
}

Rules:
- "cards" is optional; 0–3 cards only when pass is true. Prefer the learner's own wording.
- feedback must be useful even on fail: name the weakest axis.
- Never mention that you are an AI. Plain text only inside strings.`

function gradeUserPrompt(req: GradeRequest): string {
  const lines = [
    `Concept: ${req.conceptLabel}`,
    `Explain-back prompt given to the learner: ${req.prompt}`,
  ]
  if (req.goal) lines.push(`Learner's project goal: ${req.goal}`)
  if (req.rubricKeywords.length) {
    lines.push(`Useful terms (soft signal only, not a keyword checklist): ${req.rubricKeywords.join(', ')}`)
  }
  lines.push('--- Learner explanation ---')
  lines.push(req.explanation.trim())
  lines.push('--- End ---')
  lines.push('Grade the explanation on mechanism, decision impact, and concrete example.')
  return lines.join('\n')
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(5, Math.round(v)))
}

function normalizeGrade(raw: Record<string, unknown>, fallbackFail: string): GradeResult {
  const scores: GradeAxes = {
    mechanism: clampScore(raw.mechanism),
    decisionImpact: clampScore(raw.decisionImpact),
    concreteExample: clampScore(raw.concreteExample),
  }
  const avg = (scores.mechanism + scores.decisionImpact + scores.concreteExample) / 3
  const modelPass = raw.pass === true
  const hardPass =
    modelPass &&
    avg >= 3.5 &&
    scores.mechanism >= 2 &&
    scores.decisionImpact >= 2 &&
    scores.concreteExample >= 2

  const feedback =
    typeof raw.feedback === 'string' && raw.feedback.trim()
      ? raw.feedback.trim()
      : hardPass
        ? 'Clear enough to teach from — atomized into review cards.'
        : fallbackFail

  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .map((c) => {
          const item = c as { front?: unknown; back?: unknown }
          const front = typeof item.front === 'string' ? item.front.trim() : ''
          const back = typeof item.back === 'string' ? item.back.trim() : ''
          if (!front || !back) return null
          return { front, back }
        })
        .filter((c): c is { front: string; back: string } => c !== null)
        .slice(0, 3)
    : []

  return {
    pass: hardPass,
    scores,
    feedback,
    suggestedCards: hardPass && cards.length ? cards : undefined,
  }
}

/** Keyword fallback when no API key / model is unavailable — still better than pure length. */
export function keywordFallbackGrade(
  explanation: string,
  prompt: SynthesisPrompt,
): GradeResult {
  const lower = explanation.toLowerCase()
  const hits = prompt.rubricKeywords.filter((k) => lower.includes(k.toLowerCase())).length
  const need = Math.min(3, Math.ceil(prompt.rubricKeywords.length * 0.35))
  const longEnough = explanation.trim().length >= 120
  const pass = longEnough && hits >= need

  // Rough axis proxies from keyword buckets / length
  const mechanism = Math.min(5, Math.round((hits / Math.max(1, prompt.rubricKeywords.length)) * 5))
  const decisionImpact = lower.match(/decision|choose|when to|because|so that|lever|trade-?off/)
    ? 4
    : pass
      ? 3
      : 1
  const concreteExample = lower.match(/example|for instance|e\.g\.|suppose|imagine|\$\d|percent|%/)
    ? 4
    : pass
      ? 2
      : 1

  return {
    pass,
    scores: { mechanism, decisionImpact, concreteExample },
    feedback: pass ? prompt.passFeedback : prompt.failFeedback,
  }
}

async function gradeViaOpenRouter(
  request: GradeRequest,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<GradeResult> {
  const model = settings.model.trim() || DEFAULT_MODEL
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
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GRADE_SYSTEM },
          { role: 'user', content: gradeUserPrompt(request) },
        ],
      }),
    })
  } catch {
    throw new GradeUnavailableError('Could not reach OpenRouter. Check your connection.')
  }

  if (!res.ok) throw new GradeUnavailableError(await openRouterError(res))

  const completion = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) throw new GradeUnavailableError('OpenRouter returned an empty completion.')
  const parsed = parseCompletionJson(content)
  if (!parsed) throw new GradeUnavailableError('The model did not return JSON.')
  return normalizeGrade(parsed, 'Name the mechanism, the decision it changes, and one concrete example.')
}

async function gradeViaFunction(request: GradeRequest, signal?: AbortSignal): Promise<GradeResult> {
  let res: Response
  try {
    res = await fetch(GRADE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(request),
    })
  } catch {
    throw new GradeUnavailableError(
      'No OpenRouter key set. Add one in Settings, or deploy with OPENROUTER_API_KEY.',
    )
  }

  if (res.status === 404 || !res.headers.get('content-type')?.includes('json')) {
    throw new GradeUnavailableError(
      'No OpenRouter key set in Settings, and this origin has no grade function.',
    )
  }

  const payload = (await res.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: string })
    | null
  if (!res.ok) {
    throw new GradeUnavailableError(payload?.error ?? `Grader failed (HTTP ${res.status}).`)
  }
  return normalizeGrade(payload ?? {}, 'Name the mechanism, the decision it changes, and one concrete example.')
}

/**
 * Grade a Feynman explanation.
 * Prefers the user's OpenRouter key; otherwise the site function; on total failure
 * the caller should fall back to keywordFallbackGrade.
 */
export async function gradeFeynman({
  conceptLabel,
  prompt,
  explanation,
  settings,
  goal,
  signal,
}: {
  conceptLabel: string
  prompt: SynthesisPrompt
  explanation: string
  settings: AppSettings
  goal?: string
  signal?: AbortSignal
}): Promise<GradeResult> {
  const request: GradeRequest = {
    conceptLabel,
    prompt: prompt.prompt,
    explanation,
    rubricKeywords: prompt.rubricKeywords,
    goal,
  }

  if (settings.openRouterKey.trim()) {
    return gradeViaOpenRouter(request, settings, signal)
  }
  return gradeViaFunction(request, signal)
}
