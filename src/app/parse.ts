/**
 * Parsers for the streamed line/marker formats in prompts.ts. All of them accept
 * partial text, so the UI can render while the model is still writing.
 */

import type { ChartSpec, CheckResult, Extra, Lesson, LessonSection, PracticeProblem, Syllabus } from './types.ts'

const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').trim()

export interface RawItem {
  title: string
  summary: string
  code?: string
  tier?: string
}

/** "a | b | c" lines; `complete` drops a trailing line that may still be mid-write. */
function pipeLines(text: string, complete: boolean): string[][] {
  const lines = text.split('\n')
  if (!complete) lines.pop()
  return lines
    .map((l) => clean(l.replace(/^\s*(\d+[.)]|[-•])\s*/, '')))
    .filter((l) => l.includes('|'))
    .map((l) => l.split('|').map((p) => p.trim()))
}

export function parseBranches(text: string, complete = true): RawItem[] {
  return pipeLines(text, complete)
    .map(([title, summary = '']) => ({ title, summary }))
    .filter((x) => x.title)
}

export function parseCourses(text: string, complete = true): RawItem[] {
  return pipeLines(text, complete)
    .map((p) =>
      p.length >= 4
        ? { code: p[0], title: p[1], tier: p[2], summary: p.slice(3).join(' | ') }
        : { code: '', title: p[0], tier: '', summary: p[1] ?? '' },
    )
    .filter((x) => x.title)
}

export function parseSyllabus(text: string, complete = true): Syllabus & { items: RawItem[] } {
  const lines = text.split('\n')
  if (!complete) lines.pop()
  const out: Syllabus & { items: RawItem[] } = { description: '', objectives: [], items: [] }
  for (const raw of lines) {
    const l = clean(raw)
    const m = l.match(/^(DESCRIPTION|OBJECTIVE|CHAPTER)\s*:\s*(.*)$/i)
    if (!m) continue
    const [, tag, rest] = m
    if (/^d/i.test(tag)) out.description = rest
    else if (/^o/i.test(tag)) out.objectives.push(rest)
    else {
      const [title, ...sum] = rest.split('|').map((s) => s.trim())
      if (title) out.items.push({ title, summary: sum.join(' | ') })
    }
  }
  return out
}

/** "@TAG rest\nbody…" blocks */
function blocks(text: string): { tag: string; arg: string; body: string }[] {
  const out: { tag: string; arg: string; body: string }[] = []
  let cur: { tag: string; arg: string; lines: string[] } | null = null
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*@([A-Z]+)\b\s*(.*)$/)
    if (m) {
      if (cur) out.push({ tag: cur.tag, arg: cur.arg, body: cur.lines.join('\n').trim() })
      cur = { tag: m[1], arg: clean(m[2]), lines: [] }
    } else if (cur) {
      cur.lines.push(line)
    }
  }
  if (cur) out.push({ tag: cur.tag, arg: cur.arg, body: cur.lines.join('\n').trim() })
  return out
}

const bodyText = (s: string) => clean(s).replace(/\n{3,}/g, '\n\n')

export function parseLesson(text: string): Lesson {
  const lesson: Lesson = { intro: '', sections: [], example: null, keyTerms: [], recap: [], quiz: [] }
  for (const b of blocks(text)) {
    if (b.tag === 'INTRO') lesson.intro = bodyText(b.body)
    else if (b.tag === 'SECTION') lesson.sections.push({ heading: b.arg || 'Section', body: bodyText(b.body) })
    else if (b.tag === 'EXAMPLE') lesson.example = { title: b.arg, body: bodyText(b.body) }
    else if (b.tag === 'TERMS') {
      for (const l of b.body.split('\n')) {
        const [term, ...def] = clean(l).split('::')
        if (term?.trim() && def.length) lesson.keyTerms.push({ term: term.trim(), definition: def.join('::').trim() })
      }
    } else if (b.tag === 'RECAP') {
      for (const l of b.body.split('\n')) {
        const t = clean(l.replace(/^\s*[-•\d.)]+\s*/, ''))
        if (t) lesson.recap.push(t)
      }
    } else if (b.tag === 'QUIZ') {
      let q = ''
      for (const l of b.body.split('\n').map(clean)) {
        if (/^Q\s*:/i.test(l)) q = l.replace(/^Q\s*:\s*/i, '')
        else if (/^A\s*:/i.test(l) && q) {
          lesson.quiz.push({ q, a: l.replace(/^A\s*:\s*/i, '') })
          q = ''
        }
      }
    }
  }
  return lesson
}

export function parseSections(text: string): LessonSection[] {
  return parseLesson(text).sections
}

export function parsePractice(text: string): PracticeProblem[] {
  const out: PracticeProblem[] = []
  for (const b of blocks(text)) {
    if (b.tag === 'PROBLEM') out.push({ problem: bodyText(b.body), solution: '' })
    else if (b.tag === 'SOLUTION' && out.length) out[out.length - 1].solution = bodyText(b.body)
  }
  return out.filter((p) => p.problem)
}

export function parseCheck(text: string): CheckResult {
  const res: CheckResult = { verdict: 'ok', issues: [], sources: [], checkedAt: new Date().toISOString() }
  for (const b of blocks(text)) {
    if (b.tag === 'VERDICT') res.verdict = /issue/i.test(b.arg + b.body) ? 'issues' : 'ok'
    else if (b.tag === 'ISSUE') {
      const get = (k: string) => b.body.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? ''
      const issue = { claim: clean(get('CLAIM')), problem: clean(get('PROBLEM')), correction: clean(get('CORRECTION')), source: get('SOURCE') }
      if (issue.claim || issue.correction) res.issues.push(issue)
    } else if (b.tag === 'CITATIONS') {
      res.sources.push(...b.body.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)))
    }
  }
  for (const i of res.issues) if (/^https?:\/\//.test(i.source) && !res.sources.includes(i.source)) res.sources.push(i.source)
  if (res.issues.length) res.verdict = 'issues'
  return res
}

/** Apply a fix response (only changed blocks) onto the original lesson. */
export function applyFix(original: Lesson, text: string): Lesson {
  const fixed: Lesson = structuredClone(original)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  for (const b of blocks(text)) {
    const body = bodyText(b.body)
    if (!body) continue
    if (b.tag === 'INTRO') fixed.intro = body
    else if (b.tag === 'EXAMPLE' && fixed.example) fixed.example = { ...fixed.example, body }
    else if (b.tag === 'SECTION') {
      const s = fixed.sections.find((x) => norm(x.heading) === norm(b.arg))
      if (s) s.body = body
    }
  }
  return fixed
}

/** Lesson → plain text, as context for the study tools. */
export function lessonText(l: Lesson): string {
  return [
    l.intro,
    ...l.sections.map((s) => `${s.heading}\n${s.body}`),
    l.example ? `Worked example: ${l.example.title}\n${l.example.body}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const paras = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/** Newest saved output for one tool + key. */
export function latest(extras: Extra[], kind: Extra['kind'], key = ''): Extra | undefined {
  for (let i = extras.length - 1; i >= 0; i--) if (extras[i].kind === kind && extras[i].key === key) return extras[i]
  return undefined
}


/** Model JSON → a chart spec the renderer can trust (bad fields dropped, sizes capped). */
export function parseChart(text: string): ChartSpec | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(m[0].replace(/\/\/[^\n"]*$/gm, '')) as Record<string, unknown>
  } catch {
    return null
  }
  const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v))
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  const type = (['line', 'bar', 'scatter', 'pie', 'flow'] as const).find((t) => t === raw.type)
  if (!type) return null
  const spec: ChartSpec = {
    type,
    title: str(raw.title, 120),
    caption: str(raw.caption, 400),
    illustrative: raw.illustrative !== false,
    source: str(raw.source, 200),
    xLabel: str(raw.xLabel),
    yLabel: str(raw.yLabel),
    series: arr(raw.series)
      .slice(0, 4)
      .map((s) => ({
        name: str(s.name),
        points: (Array.isArray(s.points) ? (s.points as unknown[][]) : [])
          .slice(0, 60)
          .map((p) => [num(p?.[0]), num(p?.[1])] as [number, number])
          .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
      }))
      .filter((s) => s.points.length),
    categories: (Array.isArray(raw.categories) ? raw.categories : []).slice(0, 12).map((c) => str(c, 40)),
    bars: arr(raw.bars)
      .slice(0, 4)
      .map((b) => ({ name: str(b.name), values: (Array.isArray(b.values) ? b.values : []).slice(0, 12).map(num) })),
    slices: arr(raw.slices)
      .slice(0, 8)
      .map((s) => ({ label: str(s.label, 40), value: num(s.value) }))
      .filter((s) => s.value > 0),
    nodes: arr(raw.nodes)
      .slice(0, 12)
      .map((n) => ({ id: str(n.id, 40), label: str(n.label, 60) }))
      .filter((n) => n.id),
    edges: arr(raw.edges)
      .slice(0, 20)
      .map((e) => ({ from: str(e.from, 40), to: str(e.to, 40), label: str(e.label, 40) })),
  }
  const ok =
    type === 'pie' ? spec.slices.length > 1
    : type === 'flow' ? spec.nodes.length > 1
    : type === 'bar' ? spec.categories.length > 0 && spec.bars.some((b) => b.values.some(Number.isFinite))
    : spec.series.length > 0
  return ok ? spec : null
}

/* ---------------- paths and availability ---------------- */

export interface PlanStep {
  subject: string
  branch: string
  code: string
  course: string
  chapter: string
  minutes: number
  note: string
}
export interface PathPlan {
  title: string
  focus: string
  steps: PlanStep[]
}

/** TITLE / FOCUS / STEP lines (see the "path" prompt). Partial text is fine. */
export function parsePathPlan(text: string, complete = true): PathPlan {
  const lines = text.split('\n')
  if (!complete) lines.pop()
  const out: PathPlan = { title: '', focus: '', steps: [] }
  for (const raw of lines) {
    const l = clean(raw)
    const m = l.match(/^(TITLE|FOCUS|STEP)\s*:\s*(.*)$/i)
    if (!m) continue
    const tag = m[1].toUpperCase()
    if (tag === 'TITLE') out.title = m[2].slice(0, 200)
    else if (tag === 'FOCUS') out.focus = m[2].slice(0, 2000)
    else {
      const p = m[2].split('|').map((x) => x.trim())
      if (p.length < 5 || !p[0] || !p[1] || !p[3] || !p[4]) continue
      const minutes = Math.round(Number(p[5]))
      out.steps.push({
        subject: p[0].slice(0, 200),
        branch: p[1].slice(0, 200),
        code: p[2].slice(0, 30),
        course: p[3].slice(0, 200),
        chapter: p[4].slice(0, 200),
        minutes: minutes >= 5 && minutes <= 600 ? minutes : 30,
        note: p.slice(6).join(' | ').slice(0, 600),
      })
    }
  }
  return out
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const hhmm = (t: string) => {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m || +m[1] > 24 || +m[2] > 59) return ''
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/** WEEKLY / DATE / BUSY lines → availability (keeps only well-formed, non-empty blocks). */
export function parseAvailability(text: string): { weekly: { day: number; start: string; end: string }[]; overrides: { date: string; blocks: { start: string; end: string }[] }[] } {
  const weekly: { day: number; start: string; end: string }[] = []
  const byDate = new Map<string, { start: string; end: string }[]>()
  for (const raw of text.split('\n')) {
    const l = clean(raw)
    const m = l.match(/^(WEEKLY|DATE|BUSY)\s*:\s*(.*)$/i)
    if (!m) continue
    const p = m[2].split('|').map((x) => x.trim())
    const tag = m[1].toUpperCase()
    if (tag === 'BUSY') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(p[0])) byDate.set(p[0], byDate.get(p[0]) ?? [])
      continue
    }
    const start = hhmm(p[1] ?? '')
    const end = hhmm(p[2] ?? '')
    if (!start || !end || end <= start) continue
    if (tag === 'WEEKLY') {
      const day = DAYS.indexOf(p[0].slice(0, 3).toLowerCase())
      if (day >= 0) weekly.push({ day, start, end })
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(p[0])) byDate.set(p[0], [...(byDate.get(p[0]) ?? []), { start, end }])
  }
  return { weekly, overrides: [...byDate].map(([date, blocks]) => ({ date, blocks })) }
}
