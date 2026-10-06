/**
 * Study planner. Lays every unfinished path step into the learner's free time, from now
 * on: earliest due date first, steps in path order, a long step split across blocks.
 * Pure and instant, so the plan simply re-flows whenever a step is ticked off, a path
 * changes or availability changes (falling behind = the rest moves forward).
 */

import type { Availability, Path } from './types.ts'

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

export function planSchedule(
  paths: Path[],
  done: Set<string>,
  avail: Availability,
  now = new Date(),
): { sessions: Session[]; outlook: PathOutlook[] } {
  const live = paths
    .filter((p) => !p.archived)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.created_at.localeCompare(b.created_at))
  // a chapter in more than one path is studied once, for the path due first
  const taken = new Set<string>()
  const queues = live.map((p) => ({
    path: p,
    steps: p.steps
      .filter((s) => !done.has(s.node_id) && !taken.has(s.node_id) && taken.add(s.node_id))
      .map((s) => ({ ...s, left: s.minutes, pieces: 0 })),
  }))
  const sessions: Session[] = []
  const startMin = now.getHours() * 60 + now.getMinutes()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const lastDue = live.reduce((m, p) => (p.due && p.due > m ? p.due : m), '')
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
        const room = end - at
        // don't start a split piece that's too small to be worth sitting down for
        if (room < step.left && room < MIN_PIECE) break
        const take = Math.min(step.left, room)
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

  const outlook = queues.map((q) => {
    const mine = sessions.filter((s) => s.pathId === q.path.id)
    const finish = mine.length ? mine[mine.length - 1].date : ''
    const unplaced = q.steps.reduce((t, s) => t + s.left, 0)
    return {
      pathId: q.path.id,
      finish,
      unplaced,
      late: unplaced > 0 || (!!q.path.due && !!finish && finish > q.path.due),
    }
  })
  return { sessions, outlook }
}

/** Minutes of free time per week (for "you have X h a week"). */
export const weeklyMinutes = (a: Availability) => a.weekly.reduce((t, b) => t + Math.max(0, toMin(b.end) - toMin(b.start)), 0)

export const EMPTY_AVAILABILITY: Availability = { weekly: [], overrides: [], text: '' }
