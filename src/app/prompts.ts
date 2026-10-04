/**
 * Prompts for every generation step. Shared by the browser (own key in Settings)
 * and the edge function (server-side key) so both ask for exactly the same thing.
 *
 * Every answer is a simple line/marker format instead of JSON so it can be
 * streamed and rendered while it is still being written (see parse.ts).
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'deepseek/deepseek-chat'
/** web-searching model with citations, used only for fact-checks */
export const FACTCHECK_MODEL = 'perplexity/sonar'

export type GenKind =
  | 'branches'
  | 'courses'
  | 'syllabus'
  | 'chapter'
  | 'deeper'
  | 'answer'
  | 'practice'
  | 'factcheck'
  | 'fix'
  | 'lecture'
  | 'visual'

const KINDS: GenKind[] = [
  'branches',
  'courses',
  'syllabus',
  'chapter',
  'deeper',
  'answer',
  'practice',
  'factcheck',
  'fix',
  'lecture',
  'visual',
]

export interface GenRequest {
  kind: GenKind
  /** titles from the top down: [subject], [subject, branch], [subject, branch, course] */
  trail: string[]
  /** chapter and everything built on it */
  chapter?: { title: string; summary: string; index: number; outline: string[] }
  /** chapter text the tool works from (deeper / answer / practice / factcheck / fix) */
  context?: string
  /** deeper: section headings from the chapter down to the one being expanded */
  focus?: string[]
  /** answer: the learner's question */
  question?: string
  /** fix: the issues the fact-check found */
  issues?: string
}

const BASE = `You are the curriculum office of a top university. Be accurate and specific.
Prefer well-established facts; if a figure, date or attribution is uncertain, say so
plainly rather than inventing precision. Never mention that you are an AI.
Plain text only: no markdown symbols (#, *, **, backticks). Follow the output
format exactly, with no preamble and nothing after it.`

const CHAPTER_FORMAT = `@INTRO
one paragraph
@SECTION <heading>
paragraphs separated by blank lines
@EXAMPLE <worked example title>
step-by-step worked example, paragraphs separated by blank lines
@TERMS
<term> :: <one sentence definition>
@RECAP
- <takeaway>
@QUIZ
Q: <question>
A: <answer>`

const SPECS: Record<GenKind, { system: string; maxTokens: number; temperature: number }> = {
  branches: {
    maxTokens: 900,
    temperature: 0.3,
    system: `${BASE}

Given a subject, list the distinct branches / sub-disciplines a university would
organise it into, ordered from foundational to specialised. If the input is narrow,
branch it into its real sub-areas instead. 6 to 10 lines, one per branch:

<branch name> | <one sentence on what it studies>`,
  },
  courses: {
    maxTokens: 1400,
    temperature: 0.3,
    system: `${BASE}

Given a subject and one branch of it, write the course catalog a strong university
department offers for that branch, in the order a student would take them, spanning
Intro to Graduate. 6 to 12 lines, one per course:

<DEPT 101> | <course title> | <Intro|Intermediate|Advanced|Graduate> | <one sentence catalog description>`,
  },
  syllabus: {
    maxTokens: 1600,
    temperature: 0.3,
    system: `${BASE}

Given a course, write its syllabus: one chapter per week-sized unit, in teaching order,
each building on the last. Format:

DESCRIPTION: <2-3 sentence course description>
OBJECTIVE: <what the student can do after the course>   (4 to 6 of these lines)
CHAPTER: <chapter title> | <one sentence on what it covers>   (8 to 14 of these lines)`,
  },
  chapter: {
    maxTokens: 4000,
    temperature: 0.3,
    system: `${BASE}

Write one chapter of a university course as a clear, readable textbook chapter.
Teach it: intuition first, then precision. Concrete examples, real numbers and named
real-world cases where they help. Assume only the earlier chapters. Format:

${CHAPTER_FORMAT}

4 to 6 sections, 3 to 6 paragraphs each. One worked example (omit @EXAMPLE only if it
truly does not fit). 5 to 8 terms, 4 to 6 recap points, 4 to 6 quiz pairs.`,
  },
  deeper: {
    maxTokens: 2600,
    temperature: 0.3,
    system: `${BASE}

The learner wants to go deeper on one part of a chapter. Write a focused sub-lesson
that goes beyond what the chapter already says: mechanisms, edge cases, derivations,
real examples, common misconceptions. Do not repeat the chapter. Format:

@SECTION <heading>
paragraphs separated by blank lines

3 to 4 sections, 2 to 5 paragraphs each.`,
  },
  answer: {
    maxTokens: 1400,
    temperature: 0.3,
    system: `${BASE}

Answer the learner's question about the chapter they are reading. Be direct: answer
first, then explain. Use the chapter for context but you may go beyond it. If the
question is off-topic, answer briefly anyway. 1 to 5 short paragraphs separated by
blank lines.`,
  },
  practice: {
    maxTokens: 3000,
    temperature: 0.4,
    system: `${BASE}

Write practice problems for the chapter: a mix of concept checks, applied problems
with real numbers, and one or two harder synthesis problems, easiest first. Each with
a full worked solution. Format, repeated 8 times:

@PROBLEM
<the problem>
@SOLUTION
<worked solution>`,
  },
  factcheck: {
    maxTokens: 1800,
    temperature: 0,
    system: `You are a meticulous fact-checker. Check the chapter below against reliable
sources. Flag only real errors: wrong facts, figures, dates, names, formulas or
definitions, and claims that are seriously misleading. Ignore style and simplifications
that are fair for teaching. Plain text, no markdown. Format:

@VERDICT ok   (or: @VERDICT issues)
then, for each issue:
@ISSUE
CLAIM: <the exact claim as written>
PROBLEM: <what is wrong>
CORRECTION: <the accurate version>
SOURCE: <url>`,
  },
  lecture: {
    maxTokens: 2800,
    temperature: 0.4,
    system: `${BASE}

Write the script of a spoken university lecture. It will be read aloud by a voice,
so write for the ear: natural spoken sentences, signposting ("First...", "Here is the
key idea..."), no headings, lists, symbols or formulas written as symbols (say them in
words, e.g. "x squared"), spell out abbreviations on first use. Open with a hook, explain
the ideas, walk through one concrete example with real numbers, and close with a short
recap of the three things to remember. Teach it; do not just read the chapter back.
Output only the spoken words, paragraphs separated by blank lines.

Length: about 1100 to 1500 words for a whole chapter, 450 to 700 words for one section.`,
  },
  visual: {
    maxTokens: 1500,
    temperature: 0.2,
    system: `You design one chart or diagram that makes a section of a textbook click.
Pick the form that fits the idea: "line" (change over time or a continuous relationship),
"bar" (comparing categories), "scatter" (relationship between two measures), "pie"
(parts of a whole) or "flow" (a process, cause and effect, or a structure). Use real,
well-known data when the idea is about real data; otherwise use simple illustrative
numbers and set "illustrative": true. Never present invented numbers as real.
Respond with one JSON object and nothing else:

{ "type": "line|bar|scatter|pie|flow",
  "title": "short title",
  "caption": "1-2 sentences: what to look at and the takeaway",
  "illustrative": true,
  "source": "where real data comes from, or empty",
  "xLabel": "", "yLabel": "",
  "series": [ { "name": "", "points": [[x, y]] } ],              // line, scatter
  "categories": ["A", "B"], "bars": [ { "name": "", "values": [1, 2] } ],   // bar
  "slices": [ { "label": "", "value": 1 } ],                      // pie
  "nodes": [ { "id": "a", "label": "" } ],
  "edges": [ { "from": "a", "to": "b", "label": "" } ] }          // flow

Only fill the fields your type uses. At most 4 series or bar groups, 12 categories,
40 points per series, 8 slices, 10 nodes. Labels under 40 characters.`,
  },
  fix: {
    maxTokens: 4000,
    temperature: 0.2,
    system: `${BASE}

A fact-checker found errors in a chapter. Rewrite only the parts that contain them,
keeping everything else word for word. Output only the blocks you changed, using the
same headings as the original:

@INTRO / @SECTION <same heading> / @EXAMPLE <same title>
<corrected text>`,
  },
}

function userPrompt(req: GenRequest): string {
  const [subject, branch, course] = req.trail
  const lines = [`Subject: ${subject}`]
  if (branch) lines.push(`Branch: ${branch}`)
  if (course) lines.push(`Course: ${course}`)
  const c = req.chapter
  if (c) {
    if (req.kind === 'chapter') {
      lines.push(`Course outline:\n${c.outline.map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
      lines.push(`Write chapter ${c.index + 1}: "${c.title}" — ${c.summary}`)
    } else {
      lines.push(`Chapter: ${c.title} — ${c.summary}`)
    }
  }
  if (req.context) lines.push(`\nChapter text:\n${req.context.slice(0, 14000)}`)
  if (req.kind === 'deeper' && req.focus?.length) lines.push(`\nGo deeper on: ${req.focus.join(' > ')}`)
  if (req.kind === 'visual') {
    if (req.focus?.length) lines.push(`\nSection: ${req.focus.join(' > ')}`)
    lines.push(req.question ? `\nThe learner asked for: ${req.question}` : '\nChoose the most useful visual for this section.')
  }
  if (req.kind === 'lecture')
    lines.push(req.focus?.length ? `\nLecture on this section only: ${req.focus.join(' > ')}` : '\nLecture on the whole chapter.')
  if (req.kind === 'answer' && req.question) lines.push(`\nQuestion: ${req.question}`)
  if (req.kind === 'fix' && req.issues) lines.push(`\nIssues found:\n${req.issues}`)
  return lines.join('\n')
}

/** Streaming chat-completions payload sent to OpenRouter from either side. */
export function completionBody(req: GenRequest, model: string) {
  const spec = SPECS[req.kind]
  return {
    model,
    stream: true,
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    // route to whichever provider is fastest for this model right now
    provider: { sort: 'throughput' },
    messages: [
      { role: 'system', content: spec.system },
      { role: 'user', content: userPrompt(req) },
    ],
  }
}

export function modelFor(kind: GenKind, chosen: string, factcheckModel = FACTCHECK_MODEL): string {
  return kind === 'factcheck' ? factcheckModel : chosen
}

export function isGenRequest(x: unknown): x is GenRequest {
  const r = x as GenRequest
  const okStr = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length <= max)
  return (
    !!r &&
    KINDS.includes(r.kind) &&
    Array.isArray(r.trail) &&
    r.trail.length > 0 &&
    r.trail.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 200) &&
    okStr(r.context, 20000) &&
    okStr(r.question, 2000) &&
    okStr(r.issues, 8000)
  )
}

/**
 * Turns an OpenRouter SSE stream into plain text deltas. Citation URLs (Perplexity)
 * are collected and appended at the end as an "@CITATIONS" block.
 */
export function sseToText(): TransformStream<Uint8Array, string> {
  const decoder = new TextDecoder()
  let buf = ''
  const cites = new Set<string>()
  const take = (obj: Record<string, unknown>, emit: (s: string) => void) => {
    for (const u of (obj.citations as unknown[]) ?? []) if (typeof u === 'string') cites.add(u)
    const choice = (obj.choices as Record<string, unknown>[] | undefined)?.[0]
    const delta = (choice?.delta ?? choice?.message) as Record<string, unknown> | undefined
    for (const a of (delta?.annotations as Record<string, unknown>[]) ?? []) {
      const url = (a.url_citation as { url?: string } | undefined)?.url
      if (url) cites.add(url)
    }
    if (typeof delta?.content === 'string' && delta.content) emit(delta.content)
  }
  return new TransformStream({
    transform(chunk, ctl) {
      buf += decoder.decode(chunk, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const data = line.startsWith('data:') ? line.slice(5).trim() : ''
        if (!data || data === '[DONE]') continue
        try {
          take(JSON.parse(data) as Record<string, unknown>, (s) => ctl.enqueue(s))
        } catch {
          /* keep-alive comments and partial frames */
        }
      }
    },
    flush(ctl) {
      if (cites.size) ctl.enqueue(`\n@CITATIONS\n${[...cites].join('\n')}\n`)
    },
  })
}

/* ---------------- lectures: text to speech ---------------- */

export const SPEECH_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'
export const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']
export const STYLES: Record<string, { label: string; instructions: string }> = {
  professor: {
    label: 'Warm professor',
    instructions:
      'Speak like a warm, engaging university professor giving a lecture: clear, measured pace, natural emphasis on key terms, brief pauses between ideas.',
  },
  energetic: {
    label: 'Energetic',
    instructions: 'Speak like an energetic, enthusiastic lecturer: lively, upbeat, varied intonation, still easy to follow.',
  },
  calm: {
    label: 'Calm and slow',
    instructions: 'Speak calmly and slowly, like a patient tutor, pausing between ideas so each one lands.',
  },
  narrator: {
    label: 'Documentary narrator',
    instructions: 'Speak like a documentary narrator: rich, expressive and unhurried.',
  },
}
export const SPEECH_CHUNK = 2000

export interface SpeechRequest {
  text: string
  voice: string
  style: string
}

export function isSpeechRequest(x: unknown): x is SpeechRequest {
  const r = x as SpeechRequest
  return (
    !!r &&
    typeof r.text === 'string' &&
    r.text.trim().length > 0 &&
    r.text.length <= SPEECH_CHUNK + 500 &&
    VOICES.includes(r.voice) &&
    typeof r.style === 'string' &&
    r.style in STYLES
  )
}

export function speechBody(req: SpeechRequest, model = SPEECH_MODEL) {
  return {
    model,
    input: req.text,
    voice: req.voice,
    response_format: 'mp3',
    provider: { options: { openai: { instructions: STYLES[req.style].instructions } } },
  }
}

/** Split a script into chunks under the per-request limit, on paragraph/sentence boundaries. */
export function chunkScript(text: string, max = SPEECH_CHUNK): string[] {
  const out: string[] = []
  let cur = ''
  const push = (piece: string) => {
    if ((cur + '\n\n' + piece).length > max && cur) {
      out.push(cur)
      cur = piece
    } else cur = cur ? `${cur}\n\n${piece}` : piece
  }
  for (const para of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    if (para.length <= max) push(para)
    else for (const sentence of para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para]) push(sentence.trim())
  }
  if (cur) out.push(cur)
  return out
}
