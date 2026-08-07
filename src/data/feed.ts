/**
 * The Feed — the real home of the app.
 *
 * `buildFeed` is the coach: it looks at dependency order, live retention, weak
 * spots, the schedule's budget for new material, and the novelty/consolidation
 * balance, then emits the next few useful doses as cards. Everything else in
 * the app opens from one of these cards.
 *
 * Cards are derived on every render and never persisted — completing the work
 * behind a card (answering its items, finishing its task) is what makes it
 * disappear, so the Feed can never drift out of sync with reality.
 */

import type { Domain, FeedCard, RetrievalItem } from './types'
import { currentRetrievability, overdueDays } from './fsrs'
import { conceptRetention, frontierConceptIds, liveStreak, rankFor, XP } from './rank'
import { dueItems, newItems } from './retrieval'
import { canAdvanceFrontier, newConceptBudget, paceFor } from './scheduler'

/** Items batched into a single review card — one dose, not a queue. */
const REVIEW_BATCH = 5
/** Seconds per retrieval item, used for the "≈ 90s" estimate on a card. */
const SECONDS_PER_ITEM = 18

const cleanLabel = (label: string): string => label.replace(' 🔒', '').trim()

function conceptLabel(domain: Domain, conceptId: string): string {
  const node = domain.blueprint.nodes.find((n) => n.id === conceptId)
  return node ? cleanLabel(node.label) : conceptId
}

/** Which path a concept belongs to — two routes can teach similarly-named ideas. */
function pathOf(domain: Domain, conceptId: string | undefined): string | undefined {
  if (!conceptId) return undefined
  return domain.blueprint.nodes.find((n) => n.id === conceptId)?.pathId
}

/** Concepts whose prerequisites are all mastered or warm enough to build on. */
function unlockableConcepts(domain: Domain, now: number): string[] {
  const frontier = new Set(frontierConceptIds(domain))
  const incoming = new Map<string, string[]>()
  for (const edge of domain.blueprint.edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from])
  }

  return domain.blueprint.nodes
    .filter((n) => n.status === 'available' && frontier.has(n.id))
    .filter((n) => {
      const prereqs = incoming.get(n.id) ?? []
      // A concept opens when everything feeding it is at least warm — not
      // perfect, or nothing downstream would ever open.
      return prereqs.every((p) => conceptRetention(domain, p, now) >= 45)
    })
    .map((n) => n.id)
}

/** The next layer that is ready to be revealed, if any. */
function nextLayerCard(domain: Domain, now: number): FeedCard | null {
  if (!canAdvanceFrontier(domain, now)) return null
  for (const path of domain.paths.filter((p) => p.selected)) {
    const openIndex = path.layers.findIndex((l) => !l.unlocked)
    if (openIndex <= 0) continue
    const previous = path.layers[openIndex - 1]
    // Every concept in the layer above has to be genuinely warm first.
    const ready = previous.conceptIds.every((id) => conceptRetention(domain, id, now) >= 65)
    if (!ready) continue
    const layer = path.layers[openIndex]
    return {
      id: `layer-${path.id}-${layer.id}`,
      kind: 'layer-unlock',
      title: `New depth unlocked: ${layer.title}`,
      detail: `You have held ${previous.title} steady. The next layer of ${path.title} is ready to open.`,
      reason: 'previous layer is warm',
      estSeconds: 60,
      priority: 92,
      xp: XP.layerUnlock,
      pathId: path.id,
      tone: 'win',
    }
  }
  return null
}

function reviewCards(domain: Domain, now: number): FeedCard[] {
  const due = dueItems(domain, now)
  if (due.length === 0) return []

  // Group by concept so a dose is coherent — five items on one idea beats five
  // unrelated fragments.
  const byConcept = new Map<string, RetrievalItem[]>()
  for (const item of due) {
    byConcept.set(item.conceptId, [...(byConcept.get(item.conceptId) ?? []), item])
  }

  return [...byConcept.entries()]
    .map(([conceptId, items]) => {
      const batch = items.slice(0, REVIEW_BATCH)
      const worst = Math.min(...batch.map((i) => currentRetrievability(i.memory, now)))
      const lateBy = Math.max(...batch.map((i) => overdueDays(i.memory, now)))
      const cold = worst < 0.6
      return {
        id: `review-${conceptId}`,
        kind: 'review' as const,
        title: cold ? `Decaying: ${conceptLabel(domain, conceptId)}` : conceptLabel(domain, conceptId),
        detail: `${batch.length} retrieval ${batch.length === 1 ? 'item' : 'items'} · recall sitting at ${Math.round(worst * 100)}%`,
        reason: lateBy > 2 ? `${Math.round(lateBy)} days overdue` : 'due now',
        estSeconds: batch.length * SECONDS_PER_ITEM,
        // The colder it is, the further up the Feed it goes.
        priority: 70 + Math.round((1 - worst) * 25) + Math.min(5, lateBy),
        xp: batch.length * XP.retrievalHit,
        conceptId,
        pathId: pathOf(domain, conceptId),
        refIds: batch.map((i) => i.id),
        tone: cold ? ('cold' as const) : ('warm' as const),
      }
    })
    .sort((a, b) => b.priority - a.priority)
}

function newItemCards(domain: Domain, now: number): FeedCard[] {
  const fresh = newItems(domain)
  if (fresh.length === 0) return []
  const frontier = new Set(frontierConceptIds(domain))

  const byConcept = new Map<string, RetrievalItem[]>()
  for (const item of fresh) {
    if (!frontier.has(item.conceptId)) continue
    byConcept.set(item.conceptId, [...(byConcept.get(item.conceptId) ?? []), item])
  }

  return [...byConcept.entries()].map(([conceptId, items]) => {
    const batch = items.slice(0, REVIEW_BATCH)
    const warmth = conceptRetention(domain, conceptId, now)
    return {
      id: `first-pass-${conceptId}`,
      kind: 'review' as const,
      title: `First pass: ${conceptLabel(domain, conceptId)}`,
      detail: `${batch.length} new retrieval ${batch.length === 1 ? 'item' : 'items'} — find out what already stuck`,
      reason: 'never attempted',
      estSeconds: batch.length * SECONDS_PER_ITEM,
      priority: warmth > 0 ? 66 : 60,
      xp: batch.length * XP.retrievalHit,
      conceptId,
      pathId: pathOf(domain, conceptId),
      refIds: batch.map((i) => i.id),
      tone: 'new' as const,
    }
  })
}

function unlockCards(domain: Domain, now: number): FeedCard[] {
  const budget = newConceptBudget(domain, now)
  if (budget === 0) return []
  return unlockableConcepts(domain, now)
    .slice(0, budget)
    .map((conceptId) => {
      const node = domain.blueprint.nodes.find((n) => n.id === conceptId)!
      return {
        id: `unlock-${conceptId}`,
        kind: 'unlock' as const,
        title: `Unlock: ${cleanLabel(node.label)}`,
        detail: node.summary ?? 'The next concept on this path is ready.',
        reason: 'prerequisites are warm',
        estSeconds: 180,
        priority: 80,
        xp: XP.conceptUnlock,
        conceptId,
        pathId: node.pathId,
        tone: 'new' as const,
      }
    })
}

function drillCards(domain: Domain, now: number): FeedCard[] {
  const frontier = new Set(frontierConceptIds(domain))
  return domain.drills
    .filter((d) => frontier.has(d.conceptId))
    .map((drill) => {
      const warmth = conceptRetention(domain, drill.conceptId, now)
      return {
        id: `drill-${drill.id}`,
        kind: 'drill' as const,
        title: drill.title,
        detail: `Timed drill on ${conceptLabel(domain, drill.conceptId)}`,
        reason: warmth < 55 ? 'weak spot' : 'keeps the reflex fast',
        estSeconds: 60,
        // Only worth surfacing high when the concept is actually shaky.
        priority: warmth < 55 ? 64 : 34,
        xp: XP.drillPerCorrect * 3,
        conceptId: drill.conceptId,
        pathId: pathOf(domain, drill.conceptId),
        refIds: [drill.id],
        tone: warmth < 55 ? ('cold' as const) : ('warm' as const),
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
}

function practiceCards(domain: Domain): FeedCard[] {
  const frontier = new Set(frontierConceptIds(domain))
  return domain.tasks
    .filter((t) => !domain.metrics.tasksCompleted.includes(t.id) && frontier.has(t.conceptId))
    .slice(0, 2)
    .map((task) => ({
      id: `practice-${task.id}`,
      kind: 'practice' as const,
      title: task.title,
      detail: task.prompt.slice(0, 140),
      reason: 'turns the concept into an artifact',
      estSeconds: 1800,
      // A 30-minute block is real work, but it is not a *dose*. It sits below
      // the short items so the top of the Feed stays something you can finish.
      priority: 46,
      xp: XP.practiceBlock,
      conceptId: task.conceptId,
      pathId: pathOf(domain, task.conceptId),
      refIds: [task.id],
      tone: 'new' as const,
    }))
}

function teachBackCards(domain: Domain, now: number): FeedCard[] {
  const frontier = new Set(frontierConceptIds(domain))
  return domain.synthPrompts
    .filter((p) => !domain.metrics.synthPassed.includes(p.id) && frontier.has(p.conceptId))
    .filter((p) => conceptRetention(domain, p.conceptId, now) >= 50)
    .slice(0, 2)
    .map((prompt) => ({
      id: `teach-${prompt.id}`,
      kind: 'teach-back' as const,
      title: `Teach it back: ${conceptLabel(domain, prompt.conceptId)}`,
      detail: prompt.scaffold?.length
        ? `${prompt.scaffold.length} short answers — no essay required`
        : prompt.prompt.slice(0, 140),
      reason: 'you know it well enough to explain it',
      estSeconds: 150,
      priority: 60,
      xp: XP.teachBack,
      conceptId: prompt.conceptId,
      pathId: pathOf(domain, prompt.conceptId),
      refIds: [prompt.id],
      tone: 'warm' as const,
    }))
}

function rankUpCard(domain: Domain): FeedCard | null {
  const rank = rankFor(domain.progress.xp)
  if (domain.progress.acknowledgedRank === rank.id || rank.id === 'novice') return null
  return {
    id: `rank-${rank.id}`,
    kind: 'rank-up',
    title: `Rank up — ${rank.label}`,
    detail: rank.blurb,
    reason: `${domain.progress.xp} XP earned in this domain`,
    estSeconds: 10,
    priority: 100,
    xp: 0,
    tone: 'win',
  }
}

/** Unselected paths, surfaced occasionally so the domain still feels open. */
function sideQuestCards(domain: Domain, now: number): FeedCard[] {
  // Only offered once the current frontier is under control — the whole point
  // is that a side quest is a reward, not another obligation.
  if (!canAdvanceFrontier(domain, now)) return []
  const unselected = domain.paths.filter((p) => !p.selected)
  if (unselected.length === 0) return []
  const pick = unselected[0]
  return [
    {
      id: `quest-${pick.id}`,
      kind: 'side-quest',
      title: `Side quest: ${pick.title}`,
      detail: pick.pitch,
      reason: 'your current paths are holding',
      estSeconds: 60,
      priority: 26,
      xp: XP.pathSelected,
      pathId: pick.id,
      tone: 'quest',
    },
  ]
}

export interface FeedContext {
  pace: ReturnType<typeof paceFor>
  streak: number
  dosesToday: number
  dailyTarget: number
}

/**
 * Build today's Feed.
 * Ordering is by priority, then interleaved so the top of the Feed never shows
 * three of the same kind in a row — novelty and consolidation alternate. The
 * limit is deliberately small: a Feed you cannot finish is the same overwhelm
 * problem in a different shape.
 */
export function buildFeed(domain: Domain, now = Date.now(), limit = 8): FeedCard[] {
  const cards: FeedCard[] = []

  const rank = rankUpCard(domain)
  if (rank) cards.push(rank)
  const layer = nextLayerCard(domain, now)
  if (layer) cards.push(layer)

  cards.push(
    ...reviewCards(domain, now),
    ...unlockCards(domain, now),
    ...newItemCards(domain, now),
    ...drillCards(domain, now),
    ...teachBackCards(domain, now),
    ...practiceCards(domain),
    ...sideQuestCards(domain, now),
  )

  const sorted = cards.sort((a, b) => b.priority - a.priority)
  return interleave(sorted).slice(0, limit)
}

/**
 * Keep two cards of the same kind from sitting adjacent when an alternative is
 * available. Priority still wins — this only breaks ties in presentation.
 */
function interleave(cards: FeedCard[]): FeedCard[] {
  const out: FeedCard[] = []
  const pool = [...cards]
  while (pool.length > 0) {
    const lastKind = out[out.length - 1]?.kind
    const index = pool.findIndex((c) => c.kind !== lastKind)
    out.push(...pool.splice(index === -1 ? 0 : index, 1))
  }
  return out
}

export function feedContext(domain: Domain, dailyTarget: number, now = Date.now()): FeedContext {
  return {
    pace: paceFor(domain, now),
    streak: liveStreak(domain.progress),
    dosesToday: domain.progress.dosesToday,
    dailyTarget,
  }
}

/** Human-readable time estimate for a card. */
export function estimateLabel(seconds: number): string {
  if (seconds < 90) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes} min`
}
