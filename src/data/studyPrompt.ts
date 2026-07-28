/**
 * Prompt + request shape for study-page generation.
 * Shared by the browser (when the user supplies their own OpenRouter key in
 * Settings) and by the Netlify function (when the site has a server-side key),
 * so both paths ask for exactly the same thing.
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'deepseek/deepseek-chat'

export interface StudyRequest {
  goal?: string
  subjectTitle?: string
  pathOverview?: string | null
  concept?: string
  summary?: string | null
  overview?: string | null
  learnAbout?: string[]
  siblings?: string[]
}

export const SYSTEM_PROMPT = `You write single-concept study pages for a skill-acquisition app.

The reader is a working adult studying one concept in depth. Write like a sharp
practitioner explaining the idea to a smart peer: concrete, specific, numeric
where numbers help. No filler, no motivational padding, no "in today's fast-paced
world". Never mention that you are an AI or describe your own output.

Respond with a single JSON object and nothing else, matching exactly:

{
  "tagline": "one sentence, under 120 chars, what this concept really is",
  "whyItMatters": "2-3 sentences on the decisions this concept changes",
  "sections": [
    { "heading": "short heading",
      "body": "2-5 sentences of substance",
      "bullets": ["optional supporting points"] }
  ],
  "formulas": [ { "name": "...", "expression": "...", "note": "when to use it" } ],
  "keyTerms": [ { "term": "...", "definition": "one tight sentence" } ],
  "mistakes": ["common mistake and what it costs"],
  "checkYourself": [ { "q": "retrieval question", "a": "the answer" } ]
}

Rules:
- 5 to 7 sections. At least one is a concrete worked example with real numbers.
- 4 to 8 keyTerms, 3 to 5 mistakes, 4 to 6 checkYourself pairs.
- "formulas" only when the concept genuinely has them; otherwise use [].
- Plain text only inside strings: no markdown, no headings, no bullet characters.`

export function userPrompt(body: StudyRequest): string {
  const lines = [
    `Concept: ${body.concept}`,
    `Part of the skill path: ${body.subjectTitle ?? body.goal ?? 'general skill'}`,
  ]
  if (body.goal) lines.push(`Learner's stated goal: ${body.goal}`)
  if (body.pathOverview) lines.push(`Path overview: ${body.pathOverview}`)
  if (body.summary) lines.push(`One-line summary already shown in the app: ${body.summary}`)
  if (body.overview) lines.push(`Existing short overview: ${body.overview}`)
  if (body.learnAbout?.length) {
    lines.push(`Sub-topics the app promises to cover: ${body.learnAbout.join('; ')}`)
  }
  if (body.siblings?.length) {
    lines.push(
      `Other concepts on the same path (stay in your lane, reference them at most in passing): ${body.siblings.join('; ')}`,
    )
  }
  lines.push(
    `Write the study page for "${body.concept}" so the learner can study it once and use it at work tomorrow.`,
  )
  return lines.join('\n')
}

/** Chat-completions payload sent to OpenRouter from either side. */
export function completionBody(body: StudyRequest, model: string) {
  return {
    model,
    temperature: 0.4,
    max_tokens: 2600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(body) },
    ],
  }
}

/** Pull the JSON object out of a completion, tolerating prose or code fences. */
export function parseCompletionJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}
