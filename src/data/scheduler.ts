/**
 * Adaptive long-term scheduler.
 *
 * Once paths are chosen the scheduler lays a rolling multi-week plan over the
 * chosen subgraph and decides how fast the frontier is allowed to move. It does
 * not own the day: it sets the budget, and the Feed spends it.
 *
 * Two signals drive the pace:
 *   - recent retrieval accuracy (are the last ~20 attempts landing?)
 *   - how much of the unlocked frontier is currently warm
 *
 * Crushing it opens new material sooner; struggling inserts consolidation weeks
 * and holds the frontier still until the backlog is warm again.
 */

import type { Domain, DomainPath, Pace, PlanWeek, SchedulePlan } from './types'
import { conceptRetention, frontierConceptIds } from './rank'

/** Concepts introduced per week at each pace. */
const NEW_PER_WEEK: Record<Pace, number> = {
  remedial: 1,
  steady: 2,
  accelerated: 4,
}

/** How warm the frontier must be before new material is allowed through. */
const FRONTIER_WARM_THRESHOLD = 60

const RECENT_WINDOW = 20

/** Share of the last `RECENT_WINDOW` graded attempts that were not lapses. */
export function recentAccuracy(domain: Domain): number | null {
  const log = domain.metrics.reviewLog.slice(-RECENT_WINDOW)
  if (log.length < 5) return null
  const hits = log.filter((e) => e.grade > 1).length
  return hits / log.length
}

/** Mean live retention across the unlocked frontier, 0–100. */
export function frontierWarmth(domain: Domain, now = Date.now()): number {
  const ids = frontierConceptIds(domain)
  if (ids.length === 0) return 0
  const total = ids.reduce((sum, id) => sum + conceptRetention(domain, id, now), 0)
  return Math.round(total / ids.length)
}

/**
 * Pick the pace from live performance.
 * Accuracy is the primary signal; warmth breaks the tie so a learner who is
 * answering well but leaving a cold backlog is not accelerated into it.
 */
export function paceFor(domain: Domain, now = Date.now()): Pace {
  const accuracy = recentAccuracy(domain)
  const warmth = frontierWarmth(domain, now)

  if (accuracy === null) return 'steady'
  if (accuracy < 0.6) return 'remedial'
  if (accuracy >= 0.85 && warmth >= FRONTIER_WARM_THRESHOLD) return 'accelerated'
  if (warmth < 40) return 'remedial'
  return 'steady'
}

/** True when the frontier is warm enough to justify revealing more of it. */
export function canAdvanceFrontier(domain: Domain, now = Date.now()): boolean {
  return frontierWarmth(domain, now) >= FRONTIER_WARM_THRESHOLD
}

/** Concepts of a path in teaching order across its unlocked layers. */
function pathConceptOrder(path: DomainPath): string[] {
  return path.layers.filter((l) => l.unlocked).flatMap((l) => l.conceptIds)
}

/**
 * Build the rolling plan.
 * Weeks alternate between introducing new concepts and consolidating what the
 * previous week opened, so review and new material are never separate queues.
 */
export function buildPlan(domain: Domain, dailyDoses: number, now = Date.now()): SchedulePlan {
  const pace = paceFor(domain, now)
  const perWeek = NEW_PER_WEEK[pace]
  const selected = domain.paths.filter((p) => p.selected)

  // Interleave the chosen paths so a learner with two paths makes progress on
  // both rather than finishing one and forgetting the other.
  const queues = selected.map(pathConceptOrder)
  const ordered: string[] = []
  for (let i = 0; queues.some((q) => i < q.length); i += 1) {
    for (const q of queues) if (i < q.length) ordered.push(q[i])
  }
  const pool = ordered.length > 0 ? ordered : domain.blueprint.nodes.map((n) => n.id)

  const weeks: PlanWeek[] = []
  let cursor = 0
  let index = 0
  while (cursor < pool.length && weeks.length < 12) {
    const fresh = pool.slice(cursor, cursor + perWeek)
    cursor += perWeek
    weeks.push({
      index,
      label: `Week ${index + 1}`,
      conceptIds: fresh,
      intent: index === 0 ? 'new' : 'mixed',
    })
    index += 1

    // Remedial pace earns an explicit consolidation week between introductions.
    if (pace === 'remedial' && cursor < pool.length && weeks.length < 12) {
      weeks.push({
        index,
        label: `Week ${index + 1}`,
        conceptIds: fresh,
        intent: 'consolidate',
      })
      index += 1
    }
  }

  return {
    builtAt: new Date(now).toISOString(),
    dailyDoses,
    pace,
    weeks,
  }
}

/** Which plan week the learner is on, by elapsed time since the plan was built. */
export function currentWeek(plan: SchedulePlan | undefined, now = Date.now()): PlanWeek | null {
  if (!plan || plan.weeks.length === 0) return null
  const elapsedWeeks = Math.floor((now - new Date(plan.builtAt).getTime()) / (7 * 86_400_000))
  return plan.weeks[Math.min(elapsedWeeks, plan.weeks.length - 1)] ?? null
}

/**
 * How many *new* concepts the Feed may introduce today.
 * Zero when the frontier is cold — that is the whole point of the adaptive
 * layer: struggling slows the frontier instead of piling more on top.
 */
export function newConceptBudget(domain: Domain, now = Date.now()): number {
  if (!canAdvanceFrontier(domain, now)) return 0
  const pace = paceFor(domain, now)
  return pace === 'accelerated' ? 2 : pace === 'steady' ? 1 : 0
}

export function paceBlurb(pace: Pace): string {
  switch (pace) {
    case 'accelerated':
      return 'Accelerating — recall is holding, so the frontier is opening faster.'
    case 'remedial':
      return 'Consolidating — new material is paused until the current layer is warm.'
    case 'steady':
      return 'Steady — one new concept at a time, mixed with review.'
  }
}
