/**
 * Prompts for every generation step. Shared by the browser (own key in Settings)
 * and the Netlify function (server-side key) so both ask for exactly the same thing.
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'deepseek/deepseek-chat'

export type GenKind = 'branches' | 'courses' | 'syllabus' | 'chapter'

export interface GenRequest {
  kind: GenKind
  /** titles from the top down: [subject], [subject, branch], [subject, branch, course] */
  trail: string[]
  /** chapter only */
  chapter?: { title: string; summary: string; index: number; outline: string[] }
}

const BASE = `You are the curriculum office of a top university. Be accurate, specific and
academically sound. Never mention that you are an AI. Respond with one JSON object
and nothing else. Plain text inside strings: no markdown symbols.`

const SPECS: Record<GenKind, { system: string; maxTokens: number; temperature: number }> = {
  branches: {
    maxTokens: 1200,
    temperature: 0.4,
    system: `${BASE}

Given a subject, list the distinct branches / sub-disciplines a university would
organise it into (e.g. Economics -> Microeconomics, Macroeconomics, Econometrics,
Behavioral Economics, ...). Order from foundational to specialised.

{ "items": [ { "title": "short name", "summary": "one sentence on what it studies" } ] }

6 to 10 items. If the input is narrow, branch it into its real sub-areas instead.`,
  },
  courses: {
    maxTokens: 1800,
    temperature: 0.4,
    system: `${BASE}

Given a subject and one branch of it, write the course catalog a strong university
department offers for that branch, in the order a student would take them.

{ "items": [ { "code": "DEPT 101", "title": "course title", "tier": "Intro|Intermediate|Advanced|Graduate", "summary": "one sentence catalog description" } ] }

6 to 12 courses, spanning Intro to Graduate.`,
  },
  syllabus: {
    maxTokens: 2200,
    temperature: 0.4,
    system: `${BASE}

Given a course, write its syllabus: one chapter per week-sized unit, in teaching order,
each building on the last.

{ "description": "2-3 sentence course description",
  "objectives": ["what the student can do after the course"],
  "items": [ { "title": "chapter title", "summary": "one sentence on what the chapter covers" } ] }

8 to 14 chapters. 4 to 6 objectives.`,
  },
  chapter: {
    maxTokens: 4000,
    temperature: 0.5,
    system: `${BASE}

Write one chapter of a university course as a clear, readable textbook chapter.
Teach it: build intuition first, then precision. Concrete examples, real numbers
and named real-world cases where they help. Assume only the earlier chapters.

{ "intro": "1 paragraph on what this chapter covers and why it matters",
  "sections": [ { "heading": "short heading", "body": "3-6 paragraphs separated by blank lines" } ],
  "example": { "title": "worked example title", "body": "step-by-step worked example, paragraphs separated by blank lines" },
  "keyTerms": [ { "term": "...", "definition": "one sentence" } ],
  "recap": ["key takeaway"],
  "quiz": [ { "q": "question", "a": "answer" } ] }

4 to 6 sections. 5 to 8 keyTerms, 4 to 6 recap points, 4 to 6 quiz pairs.
Use "example": null only if a worked example truly does not fit.`,
  },
}

function userPrompt(req: GenRequest): string {
  const [subject, branch, course] = req.trail
  const lines = [`Subject: ${subject}`]
  if (branch) lines.push(`Branch: ${branch}`)
  if (course) lines.push(`Course: ${course}`)
  if (req.kind === 'chapter' && req.chapter) {
    const c = req.chapter
    lines.push(`Course outline:\n${c.outline.map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
    lines.push(`Write chapter ${c.index + 1}: "${c.title}" — ${c.summary}`)
  }
  return lines.join('\n')
}

/** Chat-completions payload sent to OpenRouter from either side. */
export function completionBody(req: GenRequest, model: string) {
  const spec = SPECS[req.kind]
  return {
    model,
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: spec.system },
      { role: 'user', content: userPrompt(req) },
    ],
  }
}

export function isGenRequest(x: unknown): x is GenRequest {
  const r = x as GenRequest
  return (
    !!r &&
    ['branches', 'courses', 'syllabus', 'chapter'].includes(r.kind) &&
    Array.isArray(r.trail) &&
    r.trail.length > 0 &&
    r.trail.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 200)
  )
}

/** Models sometimes wrap JSON in prose or fences; take the outermost object. */
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
