/**
 * Auto-generate a micro-drill (MCQ) for a concept whose retention has decayed
 * below threshold. Keeps the Dashboard "attack cold nodes" loop honest.
 */

import type { AppSettings, BlueprintNode, Drill, Domain } from './types'
import {
  DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  parseCompletionJson,
} from './studyPrompt'
import { openRouterError } from './study'

export class AutoDrillUnavailableError extends Error {}

const AUTO_SYSTEM = `You write one multiple-choice judgement drill for a skill-acquisition app.

The learner's retention on this concept has decayed. Write a single question that
forces active retrieval of the mechanism or a decision the concept changes — not trivia.

Respond with a single JSON object and nothing else:
{
  "title": "short drill name (under 40 chars)",
  "question": "one clear judgement question",
  "options": ["option A", "option B", "option C", "option D"],
  "correctIndex": 0,
  "explanation": "why the correct option is right and the traps are wrong"
}

Rules:
- Exactly 3 or 4 options. correctIndex is 0-based and must be valid.
- Prefer realistic work scenarios over definition quizzes.
- Plain text only inside strings. Never mention that you are an AI.`

function userPrompt(domain: Domain, node: BlueprintNode): string {
  const lines = [
    `Project goal: ${domain.topic}`,
    `Path: ${domain.title}`,
    `Concept id: ${node.id}`,
    `Concept label: ${node.label.replace(' 🔒', '')}`,
  ]
  if (node.summary) lines.push(`Summary: ${node.summary}`)
  if (node.why) lines.push(`Decision it changes: ${node.why}`)
  if (node.learnAbout?.length) lines.push(`Sub-topics: ${node.learnAbout.join('; ')}`)
  lines.push(`Current retention: ${Math.round(node.retention)}% — write one drill that wakes this up.`)
  return lines.join('\n')
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
}

export function normalizeAutoDrill(
  raw: Record<string, unknown>,
  node: BlueprintNode,
  prefix: string,
): Drill | null {
  const question = typeof raw.question === 'string' ? raw.question.trim() : ''
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : `Refresh: ${node.label.replace(' 🔒', '')}`
  const options = Array.isArray(raw.options)
    ? raw.options
        .map((o) => (typeof o === 'string' ? o.trim() : ''))
        .filter(Boolean)
        .slice(0, 4)
    : []
  const correctIndex = typeof raw.correctIndex === 'number' ? raw.correctIndex : -1
  if (!question || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) {
    return null
  }
  return {
    id: `${prefix}-auto-${node.id}-${Date.now()}`,
    conceptId: node.id,
    title,
    kind: 'mcq',
    spec: {
      question,
      options,
      correctIndex,
      explanation:
        typeof raw.explanation === 'string' && raw.explanation.trim()
          ? raw.explanation.trim()
          : 'Review the concept study page for the underlying mechanism.',
    },
  }
}

async function viaOpenRouter(
  domain: Domain,
  node: BlueprintNode,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<Drill> {
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
        'X-Title': 'Domain Engine',
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: AUTO_SYSTEM },
          { role: 'user', content: userPrompt(domain, node) },
        ],
      }),
    })
  } catch {
    throw new AutoDrillUnavailableError('Could not reach OpenRouter.')
  }
  if (!res.ok) throw new AutoDrillUnavailableError(await openRouterError(res))
  const completion = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) throw new AutoDrillUnavailableError('Empty completion from OpenRouter.')
  const parsed = parseCompletionJson(content)
  if (!parsed) throw new AutoDrillUnavailableError('Model did not return JSON.')
  const drill = normalizeAutoDrill(parsed, node, `auto-${slug(domain.title)}`)
  if (!drill) throw new AutoDrillUnavailableError('Model returned an unusable drill.')
  return drill
}

/**
 * Generate one MCQ drill for a cold concept.
 * Requires an OpenRouter key in Settings (browser path only for now).
 */
export async function generateAutoDrill({
  domain,
  node,
  settings,
  signal,
}: {
  domain: Domain
  node: BlueprintNode
  settings: AppSettings
  signal?: AbortSignal
}): Promise<Drill> {
  if (!settings.openRouterKey.trim()) {
    throw new AutoDrillUnavailableError(
      'Add an OpenRouter key in Settings to auto-generate drills for decaying concepts.',
    )
  }
  return viaOpenRouter(domain, node, settings, signal)
}

/** Avoid spamming: skip if we already have an auto- drill for this concept. */
export function needsAutoDrill(domain: Domain, conceptId: string): boolean {
  return !domain.drills.some(
    (d) => d.conceptId === conceptId && d.id.includes('-auto-') && d.id.includes(conceptId),
  )
}
