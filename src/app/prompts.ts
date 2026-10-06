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
/** drafts Paths: reads pasted text, photos and PDFs of the assignment */
export const PATH_MODEL = 'google/gemini-3.8-flash'

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
  | 'path'
  | 'availability'

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
  'path',
  'availability',
]

/** A file the learner attached (photo or PDF of the assignment), as a data: URL. */
export interface Attachment {
  name: string
  type: string
  data: string
}
/** largest attachment accepted, as a data: URL (about 4 MB of file) */
export const MAX_ATTACHMENT = 5_600_000

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
  /** lecture: how long */
  length?: 'short' | 'medium' | 'long'
  /** path: what the learner wants to be able to do */
  goal?: string
  /** path: pasted assignment / syllabus text. availability: what the learner typed */
  material?: string
  /** path: what the learner's library already has (subject | branch | code | course | chapters) */
  inventory?: string
  /** path: photos / PDFs of the assignment */
  attachments?: Attachment[]
  /** availability: today's date (YYYY-MM-DD, weekday) so "this Thursday" resolves */
  today?: string
}

/** Lecture lengths: target words at a speaking pace of roughly 150 words a minute. */
export const LECTURE_LENGTHS = {
  short: { label: 'Short', minutes: 3, words: '400 to 550' },
  medium: { label: 'Medium', minutes: 7, words: '950 to 1150' },
  long: { label: 'Long', minutes: 12, words: '1650 to 1900' },
} as const

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
    maxTokens: 3400,
    temperature: 0.4,
    system: `${BASE}

Write the script of a spoken university lecture. It will be read aloud by a voice,
so write for the ear: natural spoken sentences, signposting ("First...", "Here is the
key idea..."), no headings, lists, symbols or formulas written as symbols (say them in
words, e.g. "x squared"), spell out abbreviations on first use. Open with a hook, explain
the ideas, walk through one concrete example with real numbers, and close with a short
recap of the three things to remember. Teach it; do not just read the chapter back.
Output only the spoken words, paragraphs separated by blank lines. Hit the requested length.`,
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
  path: {
    maxTokens: 2600,
    temperature: 0.3,
    system: `You are the academic advisor of a top university. A learner has one specific goal
(an assignment, exam, project or skill). Design the shortest sequential study path that
gets them to excel at exactly that goal: the material it actually needs, in the order to
learn it, with just enough foundations. Skip what the goal doesn't need.

Place every step in a real university structure: subject > branch > course > chapter, the
way a university catalog would file it (e.g. Mathematics > Calculus > MATH 151 Calculus I >
Limits and Continuity). The learner's library is listed below: when a subject, branch,
course or chapter there fits, use its name EXACTLY as written so it is reused. Only invent
new ones where nothing fits, named the way a university would. Never invent facts about the
assignment that the learner did not give you.

Plain text, no markdown, no preamble. Format:

TITLE: <short name for the path>
FOCUS: <2 to 4 sentences: what matters most for this goal and how the path gets there>
STEP: <subject> | <branch> | <course code> | <course title> | <chapter title> | <minutes> | <what to focus on in this chapter for this goal>

6 to 16 STEP lines in learning order. Minutes = realistic focused study time for that
chapter (20 to 120).`,
  },
  availability: {
    maxTokens: 900,
    temperature: 0,
    system: `Turn a learner's description of when they can study into time blocks. Use 24-hour
times. Weekdays are Sun Mon Tue Wed Thu Fri Sat. Resolve relative dates ("this Thursday",
"next week") from today's date. Only free time for studying; leave out anything they say
they are busy. If they give no times for a day, leave it out. No preamble. Lines:

WEEKLY: <day> | <HH:MM start> | <HH:MM end>     (repeats every week)
DATE: <YYYY-MM-DD> | <HH:MM start> | <HH:MM end>  (a one-off free block; replaces that day's weekly blocks)
BUSY: <YYYY-MM-DD>                                (not free at all that day)`,
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
  if (req.kind === 'path')
    return [
      `Goal: ${req.goal ?? req.trail[0]}`,
      req.material ? `\nWhat the learner pasted (assignment, rubric, syllabus or notes):\n${req.material.slice(0, 20000)}` : '',
      req.attachments?.length ? `\n${req.attachments.length} attached file(s) follow: read them as the assignment.` : '',
      `\nThe learner's library (subject | branch | course code | course | chapters):\n${req.inventory?.slice(0, 20000) || '(empty)'}`,
    ].join('\n')
  if (req.kind === 'availability') return `Today: ${req.today ?? ''}\n\nThe learner says:\n${req.material ?? ''}`
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
  if (req.kind === 'lecture') {
    lines.push(
      req.focus?.length
        ? `\nLecture covering ${req.focus.length > 1 ? 'these sections, tied together' : 'this section only'}: ${req.focus.join('; ')}`
        : '\nLecture on the whole chapter.',
    )
    const len = LECTURE_LENGTHS[req.length ?? 'medium']
    lines.push(`Length: ${len.words} words (about ${len.minutes} minutes spoken).`)
  }
  if (req.kind === 'answer' && req.question) lines.push(`\nQuestion: ${req.question}`)
  if (req.kind === 'fix' && req.issues) lines.push(`\nIssues found:\n${req.issues}`)
  return lines.join('\n')
}

/** Streaming chat-completions payload sent to OpenRouter from either side. */
export function completionBody(req: GenRequest, model: string) {
  const spec = SPECS[req.kind]
  const text = userPrompt(req)
  const files = req.attachments ?? []
  // photos and PDFs go along as content parts (only the path model reads them)
  const content = files.length
    ? [
        { type: 'text', text },
        ...files.map((f) =>
          f.type.startsWith('image/')
            ? { type: 'image_url', image_url: { url: f.data } }
            : { type: 'file', file: { filename: f.name, file_data: f.data } },
        ),
      ]
    : text
  const thinking = model.startsWith('google/gemini')
  return {
    model,
    stream: true,
    temperature: spec.temperature,
    // thinking models spend output tokens reasoning first; keep that small and leave headroom
    max_tokens: thinking ? spec.maxTokens + 1500 : spec.maxTokens,
    ...(thinking ? { reasoning: { effort: 'minimal' } } : {}),
    // route to whichever provider is fastest for this model right now
    provider: { sort: 'throughput' },
    messages: [
      { role: 'system', content: spec.system },
      { role: 'user', content },
    ],
  }
}

export function modelFor(kind: GenKind, chosen: string, factcheckModel = FACTCHECK_MODEL): string {
  return kind === 'factcheck' ? factcheckModel : kind === 'path' ? PATH_MODEL : chosen
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
    okStr(r.issues, 8000) &&
    okStr(r.goal, 2000) &&
    okStr(r.material, 24000) &&
    okStr(r.inventory, 24000) &&
    okStr(r.today, 40) &&
    (r.attachments === undefined ||
      (Array.isArray(r.attachments) &&
        r.attachments.length <= 4 &&
        r.attachments.every(
          (a) =>
            typeof a?.name === 'string' &&
            a.name.length <= 200 &&
            /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(a.type) &&
            typeof a.data === 'string' &&
            a.data.startsWith(`data:${a.type};base64,`) &&
            a.data.length <= MAX_ATTACHMENT,
        ))) &&
    (r.length === undefined || ['short', 'medium', 'long'].includes(r.length)) &&
    (r.focus === undefined || (Array.isArray(r.focus) && r.focus.length <= 12 && r.focus.every((f) => typeof f === 'string' && f.length <= 300)))
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

/** preferred voice model; if OpenRouter doesn't list it, pickSpeechModel chooses one it does */
export const SPEECH_MODEL = 'microsoft/mai-voice-2.1-flash'
export const DEFAULT_VOICE = 'en-US-Harper:MAI-Voice-2.1-Flash'
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
  /** TTS model slug; defaults to SPEECH_MODEL */
  model?: string
}

export function isSpeechRequest(x: unknown): x is SpeechRequest {
  const r = x as SpeechRequest
  return (
    !!r &&
    typeof r.text === 'string' &&
    r.text.trim().length > 0 &&
    r.text.length <= SPEECH_CHUNK + 500 &&
    typeof r.voice === 'string' &&
    /^[\w.:-]{1,100}$/.test(r.voice) &&
    typeof r.style === 'string' &&
    r.style in STYLES &&
    (r.model === undefined || /^[\w.-]+\/[\w.:-]+$/.test(r.model))
  )
}

export function speechBody(req: SpeechRequest, model: string, withStyle = true) {
  return {
    model,
    input: req.text,
    voice: req.voice,
    response_format: 'mp3',
    ...(withStyle && model.startsWith('openai/')
      ? { provider: { options: { openai: { instructions: STYLES[req.style].instructions } } } }
      : {}),
  }
}

/**
 * Call OpenRouter's speech endpoint. If it rejects the request (400) with the speaking-style
 * option attached, try once more without it. Returns the audio response, or the error detail.
 */
export async function synthesize(
  apiKey: string,
  req: SpeechRequest,
  model: string,
  headers: Record<string, string> = {},
): Promise<{ ok: true; res: Response } | { ok: false; status: number; detail: string }> {
  let last = { status: 0, detail: '' }
  for (const withStyle of [true, false]) {
    const res = await fetch(`${OPENROUTER_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'X-Title': 'Expertise Engine', ...headers },
      body: JSON.stringify(speechBody(req, model, withStyle)),
    })
    if (res.ok && res.body) return { ok: true, res }
    last = { status: res.status, detail: errorDetail(await res.text().catch(() => '')) }
    if (res.status !== 400) break
  }
  return { ok: false, ...last }
}

/** OpenRouter error JSON → its human-readable message. */
export function errorDetail(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string; metadata?: { raw?: string } } | string }
    const e = j.error
    if (typeof e === 'string') return e.slice(0, 300)
    return (e?.metadata?.raw || e?.message || body).toString().slice(0, 300)
  } catch {
    return body.slice(0, 300)
  }
}

export interface SpeechModel {
  id: string
  name: string
  voices: string[]
}

/**
 * The model to use: the wanted one if OpenRouter lists it, otherwise the closest it does
 * (an OpenAI mini TTS, then any OpenAI voice model, then the first listed).
 */
export function pickSpeechModel(models: SpeechModel[], wanted: string): string {
  if (!models.length || models.some((m) => m.id === wanted)) return wanted
  return (
    models.find((m) => /mai-voice-2\.1-flash/.test(m.id))?.id ??
    models.find((m) => /gemini.*tts/.test(m.id))?.id ??
    models.find((m) => m.voices.length)?.id ??
    models[0].id
  )
}

/** English voices first (most models list voices for many languages). */
export function sortVoices(voices: string[]): string[] {
  const en = (v: string) => (/^en[-_]?US/i.test(v) ? 0 : /^(en|gb|af|am|bf|bm)[-_]/i.test(v) || /english/i.test(v) ? 1 : 2)
  return [...voices].sort((a, b) => en(a) - en(b))
}

/** "en-US-Harper:MAI-Voice-2.1-Flash" → "Harper (en-US)"; other names tidied. */
export function voiceLabel(v: string): string {
  const mai = v.match(/^([a-z]{2}-[A-Z]{2})-([^:]+):/)
  if (mai) return `${mai[2]} (${mai[1]})`
  return v.replace(/^aura-2-|^flux-|^English_/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** The speech models OpenRouter offers right now, with the voices each supports. */
export async function listSpeechModels(apiKey?: string): Promise<SpeechModel[]> {
  const get = async (q: string) => {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models${q}`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {} })
    if (!res.ok) return []
    return ((await res.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null)?.data ?? []
  }
  let data = await get('?output_modalities=speech')
  // if the filter isn't honoured, scan everything for models that output speech/audio
  if (!data.length || data.length > 100)
    data = (await get('')).filter((m) => {
      const out = (m.architecture as { output_modalities?: string[] } | undefined)?.output_modalities ?? []
      return out.some((o) => /speech|audio/i.test(o)) || /tts/i.test(String(m.id))
    })
  // voices aren't in a guaranteed place: take the first string array under a key that mentions "voice"
  const findVoices = (o: unknown, depth = 0): string[] => {
    if (!o || typeof o !== 'object' || depth > 3) return []
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (/voice/i.test(k) && Array.isArray(v)) {
        const names = v.map((x) => (typeof x === 'string' ? x : (x as { id?: string; name?: string })?.id ?? (x as { name?: string })?.name)).filter(
          (x): x is string => typeof x === 'string',
        )
        if (names.length) return names
      }
      const deeper = findVoices(v, depth + 1)
      if (deeper.length) return deeper
    }
    return []
  }
  return data
    .map((m) => ({ id: String(m.id ?? ''), name: String(m.name ?? m.id ?? ''), voices: findVoices(m) }))
    .filter((m) => m.id)
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
