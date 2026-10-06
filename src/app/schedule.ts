/**
 * Study planner. Lays every unfinished step of the scheduled paths into the learner's free
 * time, from now on, steps in path order, a long step split across blocks. Pure and
 * instant, so the plan re-flows whenever a step is ticked off, a path changes or
 * availability changes (falling behind = the rest moves forward).
 *
 * Priority (who gets the earliest free time):
 *   1. Pressing — marked by hand, or a dated path that would otherwise miss its date
 *      (it gets promoted automatically and pushes the rest back)
 *   2. ASAP
 *   3. By a date, earliest due first
 *   4. No rush — whatever time is left
 */

import type { Availability, Path, PathStep } from './types.ts'

export type Timing = 'asap' | 'date' | 'none'
/** per-path scheduling settings, kept in the synced prefs (key "pathMeta") */
export type PathMeta = Record<string, { timing?: Timing; pressing?: boolean }>
export const timingOf = (p: Path, meta: PathMeta): Timing => meta[p.id]?.timing ?? (p.due ? 'date' : 'none')

export interface Session {
  date: string
  start: string
  end: string
  minutes: number
  pathId: string
  nodeId: string
  /** "1/2" when a step is split across blocks */
  part: string
}

export interface PathOutlook {
  pathId: string
  /** date the last step is planned for, '' if nothing is left */
  finish: string
  /** minutes that couldn't be placed before the horizon */
  unplaced: number
  /** planned to finish after the due date (or couldn't be placed at all) */
  late: boolean
  timing: Timing
  /** getting the earliest time: marked by hand, or promoted because it would miss its date */
  pressing: boolean
  /** promoted automatically (not marked by hand) */
  promoted: boolean
}

/** smallest piece worth scheduling when a step has to be split */
const MIN_PIECE = 20
/** plan at least this far ahead, and always past the latest due date (up to two years) */
const MIN_DAYS = 180
const MAX_DAYS = 730

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** Free blocks on one date: that date's override if there is one, otherwise the weekly pattern. */
export function blocksOn(date: Date, a: Availability): { start: string; end: string }[] {
  const key = dateKey(date)
  const o = a.overrides.find((x) => x.date === key)
  const list = o ? o.blocks : a.weekly.filter((b) => b.day === date.getDay())
  return [...list].sort((x, y) => x.start.localeCompare(y.start))
}

const RANK: Record<Timing, number> = { asap: 1, date: 2, none: 3 }

export function planSchedule(
  paths: Path[],
  done: Set<string>,
  avail: Availability,
  meta: PathMeta = {},
  now = new Date(),
): { sessions: Session[]; outlook: PathOutlook[] } {
  const live = paths.filter((p) => !p.archived && p.steps.length)
  const promoted = new Set<string>()
  // place, then promote any dated path that misses its date and place again (a few rounds)
  let out = place(live, done, avail, meta, promoted, now)
  for (let round = 0; round < 4; round++) {
    const missing = out.outlook.filter((o) => o.timing === 'date' && o.late && !o.pressing).map((o) => o.pathId)
    if (!missing.length) break
    for (const id of missing) promoted.add(id)
    out = place(live, done, avail, meta, promoted, now)
  }
  return out
}

function place(live: Path[], done: Set<string>, avail: Availability, meta: PathMeta, promoted: Set<string>, now: Date) {
  const pressing = (p: Path) => !!meta[p.id]?.pressing || promoted.has(p.id)
  const rank = (p: Path) => (pressing(p) ? 0 : RANK[timingOf(p, meta)])
  const due = (p: Path) => (timingOf(p, meta) === 'date' && p.due ? p.due : '9999')
  const order = [...live].sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b)) || a.created_at.localeCompare(b.created_at))
  // a chapter in more than one path is studied once, for the path that comes first
  const taken = new Set<string>()
  const queues = order.map((p) => ({
    path: p,
    steps: p.steps
      .filter((s) => !done.has(s.node_id) && !taken.has(s.node_id) && taken.add(s.node_id))
      .map((s) => ({ ...s, left: s.minutes, pieces: 0 })),
  }))
  const sessions: Session[] = []
  const startMin = now.getHours() * 60 + now.getMinutes()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const lastDue = order.reduce((m, p) => (p.due && p.due > m ? p.due : m), '')
  const toDue = lastDue ? Math.ceil((new Date(`${lastDue}T12:00:00`).getTime() - day.getTime()) / 86_400_000) + 1 : 0
  const horizon = Math.min(MAX_DAYS, Math.max(MIN_DAYS, toDue + 60))
  for (let i = 0; i < horizon && queues.some((q) => q.steps.length); i++, day.setDate(day.getDate() + 1)) {
    const key = dateKey(day)
    for (const b of blocksOn(day, avail)) {
      let at = Math.max(toMin(b.start), i === 0 ? Math.ceil(startMin / 5) * 5 : 0)
      const end = toMin(b.end)
      while (end - at >= MIN_PIECE) {
        const q = queues.find((x) => x.steps.length)
        if (!q) break
        const step = q.steps[0]
        const take = Math.min(step.left, end - at)
        step.pieces++
        sessions.push({ date: key, start: fromMin(at), end: fromMin(at + take), minutes: take, pathId: q.path.id, nodeId: step.node_id, part: '' })
        step.left -= take
        at += take
        if (step.left <= 0) {
          // label the pieces of a split step "1/3, 2/3, 3/3"
          if (step.pieces > 1) {
            const mine = sessions.filter((s) => s.pathId === q.path.id && s.nodeId === step.node_id)
            mine.forEach((s, n) => (s.part = `${n + 1}/${mine.length}`))
          }
          q.steps.shift()
        }
      }
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  const outlook: PathOutlook[] = queues.map((q) => {
    const mine = sessions.filter((s) => s.pathId === q.path.id)
    const finish = mine.length ? mine[mine.length - 1].date : ''
    const unplaced = q.steps.reduce((t, s) => t + s.left, 0)
    const timing = timingOf(q.path, meta)
    return {
      pathId: q.path.id,
      finish,
      unplaced,
      late: unplaced > 0 || (timing === 'date' && !!q.path.due && !!finish && finish > q.path.due),
      timing,
      pressing: pressing(q.path),
      promoted: promoted.has(q.path.id) && !meta[q.path.id]?.pressing,
    }
  })
  return { sessions, outlook }
}

/** shortest a chapter is ever shrunk to */
export const MIN_STEP = 15

/**
 * The smallest across-the-board cut to study times (never under 15 min a chapter) that
 * lets every scheduled path fit, and finish by its date. Returns the new steps per path,
 * or null if even the shortest times can't fit.
 */
export function shrinkToFit(
  paths: Path[],
  done: Set<string>,
  avail: Availability,
  meta: PathMeta,
): { factor: number; steps: Record<string, PathStep[]> } | null {
  const live = paths.filter((p) => !p.archived && p.steps.length)
  const scaled = (f: number) =>
    live.map((p) => ({
      ...p,
      steps: p.steps.map((s) => (done.has(s.node_id) ? s : { ...s, minutes: Math.max(MIN_STEP, Math.round((s.minutes * f) / 5) * 5) })),
    }))
  const fits = (f: number) => !planSchedule(scaled(f), done, avail, meta).outlook.some((o) => o.late || o.unplaced)
  if (fits(1)) return { factor: 1, steps: {} }
  if (!fits(0)) return null
  let lo = 0
  let hi = 1
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  const best = scaled(lo)
  return { factor: lo, steps: Object.fromEntries(best.map((p) => [p.id, p.steps])) }
}

/** Free minutes from now through the end of `until` (YYYY-MM-DD). */
export function freeMinutesUntil(avail: Availability, until: string, now = new Date()): number {
  let total = 0
  const startMin = now.getHours() * 60 + now.getMinutes()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < MAX_DAYS && dateKey(day) <= until; i++, day.setDate(day.getDate() + 1))
    for (const b of blocksOn(day, avail)) total += Math.max(0, toMin(b.end) - Math.max(toMin(b.start), i === 0 ? startMin : 0))
  return total
}

/** Minutes of free time per week (for "you have X h a week"). */
export const weeklyMinutes = (a: Availability) => a.weekly.reduce((t, b) => t + Math.max(0, toMin(b.end) - toMin(b.start)), 0)

export const EMPTY_AVAILABILITY: Availability = { weekly: [], overrides: [], text: '' }
