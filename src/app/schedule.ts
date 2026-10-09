/**
 * Study planner. Lays every unfinished step of the scheduled paths into the learner's free
 * time, from now on, steps in path order, a long step split across blocks. Pure and
 * instant, so the plan re-flows whenever a step is ticked off, a path changes or
 * availability changes (falling behind = the rest moves forward).
 *
 * Each day is shared by the top few paths with work left (up to SUBJECTS_PER_DAY), taking
 * turns in sittings of up to an hour, weighted so the higher a path is the bigger its share.
 * One path alone keeps the day to itself, and a path that finishes hands its place on.
 *
 * Priority = the learner's own order (the Cal list, top first). Paths not placed in that
 * list yet fall in by timing: ASAP first, then by due date, then No rush. Nothing moves
 * on its own: if the order makes a dated path late, the outlook says so and the learner
 * decides (make it fit, put due dates first, or keep the order anyway).
 */

import type { Availability, Path, PathStep } from './types.ts'

export type Timing = 'asap' | 'date' | 'none'
/** per-path scheduling settings, kept in the synced prefs (key "pathMeta") */
export type PathMeta = Record<string, { timing?: Timing; pressing?: boolean; shelved?: boolean }>
/** where a path stands: in the plan, saved but not planned, or put away */
export type PathStatus = 'scheduled' | 'unscheduled' | 'archived'
export const statusOf = (p: Path, meta: PathMeta): PathStatus => (!p.archived ? 'scheduled' : meta[p.id]?.shelved ? 'archived' : 'unscheduled')
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
  /** its unfinished chapters are all studied in a path higher up */
  covered: boolean
}

/** smallest piece worth scheduling when a step has to be split */
const MIN_PIECE = 20
/** most paths studied on one day, and each one's share of the day by rank (top gets most) */
const SUBJECTS_PER_DAY = 3
const SHARE = [3, 2, 1]
/** longest sitting before another path gets a turn (when there is another path that day) */
const SITTING = 60
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

/** Scheduled paths in priority order: the learner's list first, then any not in it yet by timing. */
export function priorityOrder(paths: Path[], meta: PathMeta, order: string[]): Path[] {
  const live = paths.filter((p) => !p.archived && p.steps.length)
  const at = new Map(order.map((id, i) => [id, i]))
  const due = (p: Path) => (timingOf(p, meta) === 'date' && p.due ? p.due : '9999')
  const fallback = (a: Path, b: Path) =>
    RANK[timingOf(a, meta)] - RANK[timingOf(b, meta)] || due(a).localeCompare(due(b)) || a.created_at.localeCompare(b.created_at)
  const placed = live.filter((p) => at.has(p.id)).sort((a, b) => at.get(a.id)! - at.get(b.id)!)
  const rest = live.filter((p) => !at.has(p.id)).sort(fallback)
  // new ASAP paths join at the top, the rest at the bottom
  return [...rest.filter((p) => timingOf(p, meta) === 'asap'), ...placed, ...rest.filter((p) => timingOf(p, meta) !== 'asap')]
}

/** The order that lets dated paths make their dates: earliest due first, then the rest as they were. */
export function dueFirst(ordered: Path[], meta: PathMeta): string[] {
  const dated = ordered.filter((p) => timingOf(p, meta) === 'date' && p.due).sort((a, b) => a.due!.localeCompare(b.due!))
  return [...dated, ...ordered.filter((p) => !dated.includes(p))].map((p) => p.id)
}

export function planSchedule(
  paths: Path[],
  done: Set<string>,
  avail: Availability,
  meta: PathMeta = {},
  order: string[] = [],
  now = new Date(),
): { sessions: Session[]; outlook: PathOutlook[] } {
  return place(priorityOrder(paths, meta, order), done, avail, meta, now)
}

function place(order: Path[], done: Set<string>, avail: Availability, meta: PathMeta, now: Date) {
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
    const used = new Map<(typeof queues)[number], number>()
    for (const b of blocksOn(day, avail)) {
      let at = Math.max(toMin(b.start), i === 0 ? Math.ceil(startMin / 5) * 5 : 0)
      const end = toMin(b.end)
      while (end - at >= MIN_PIECE) {
        // the top paths with work left share the day; whoever is furthest behind their share goes next
        const active = queues.filter((x) => x.steps.length).slice(0, SUBJECTS_PER_DAY)
        if (!active.length) break
        const behind = (n: number) => (used.get(active[n]) ?? 0) / SHARE[n]
        const q = active[active.reduce((best, _, n) => (behind(n) < behind(best) ? n : best), 0)]
        const step = q.steps[0]
        let take = Math.min(step.left, end - at)
        // cap the sitting so others get a turn, unless that would leave a scrap of step or block
        if (active.length > 1 && take > SITTING && step.left - SITTING >= MIN_PIECE && end - at - SITTING >= MIN_PIECE) take = SITTING
        const last = sessions[sessions.length - 1]
        if (last && last.date === key && last.end === fromMin(at) && last.pathId === q.path.id && last.nodeId === step.node_id) {
          // straight on with the same step: one longer session, not two pieces
          last.end = fromMin(at + take)
          last.minutes += take
        } else {
          step.pieces++
          sessions.push({ date: key, start: fromMin(at), end: fromMin(at + take), minutes: take, pathId: q.path.id, nodeId: step.node_id, part: '' })
        }
        used.set(q, (used.get(q) ?? 0) + take)
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
      pressing: false,
      promoted: false,
      covered: !q.steps.length && !mine.length && q.path.steps.some((s) => !done.has(s.node_id)),
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
  order: string[] = [],
): { factor: number; steps: Record<string, PathStep[]> } | null {
  const live = paths.filter((p) => !p.archived && p.steps.length)
  const scaled = (f: number) =>
    live.map((p) => ({
      ...p,
      steps: p.steps.map((s) => (done.has(s.node_id) ? s : { ...s, minutes: Math.max(MIN_STEP, Math.round((s.minutes * f) / 5) * 5) })),
    }))
  const fits = (f: number) => !planSchedule(scaled(f), done, avail, meta, order).outlook.some((o) => o.late || o.unplaced)
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
