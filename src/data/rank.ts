/**
 * Scoring and identity: the numbers that turn a Domain into a character sheet.
 *
 * XP is only awarded for things that imply memory actually moved — a successful
 * retrieval, an unlocked concept, a finished practice block. Opening a page or
 * scrolling the Feed is worth nothing, and the streak multiplier is capped so a
 * long streak never outweighs real recall.
 */

import type { Domain, DomainPath, ReviewGrade } from './types'
import { currentRetrievability } from './fsrs'

export interface Rank {
  id: string
  label: string
  minXp: number
  blurb: string
}

export const RANKS: Rank[] = [
  { id: 'novice', label: 'Novice', minXp: 0, blurb: 'Naming things for the first time' },
  { id: 'initiate', label: 'Initiate', minXp: 250, blurb: 'The vocabulary is starting to stick' },
  { id: 'practitioner', label: 'Practitioner', minXp: 800, blurb: 'You can use this at work' },
  { id: 'specialist', label: 'Specialist', minXp: 2000, blurb: 'Depth in a chosen line' },
  { id: 'authority', label: 'Authority', minXp: 4500, blurb: 'You can teach it cold' },
  { id: 'master', label: 'Master', minXp: 9000, blurb: 'The frontier is yours to extend' },
]

export function rankFor(xp: number): Rank {
  let current = RANKS[0]
  for (const r of RANKS) if (xp >= r.minXp) current = r
  return current
}

export function nextRank(xp: number): Rank | null {
  return RANKS.find((r) => r.minXp > xp) ?? null
}

/** 0–1 progress through the current rank band. */
export function rankProgress(xp: number): number {
  const current = rankFor(xp)
  const next = nextRank(xp)
  if (!next) return 1
  return Math.min(1, Math.max(0, (xp - current.minXp) / (next.minXp - current.minXp)))
}

/* -------------------------------------------------------------------- xp --- */

export const XP = {
  /** Per successfully recalled retrieval item */
  retrievalHit: 10,
  /** A miss still counts for something — you found the hole */
  retrievalMiss: 3,
  conceptUnlock: 40,
  layerUnlock: 120,
  practiceBlock: 70,
  teachBack: 45,
  drillPerCorrect: 6,
  pathSelected: 25,
} as const

/**
 * Streak multiplier, capped at 1.5×. Tied to days on which a dose was actually
 * completed, so it cannot be farmed by opening the app.
 */
export function streakMultiplier(streakDays: number): number {
  if (streakDays <= 1) return 1
  return Math.min(1.5, 1 + (streakDays - 1) * 0.05)
}

/** Grade-weighted XP for one retrieval outcome. */
export function xpForGrade(grade: ReviewGrade, streakDays: number): number {
  const base = grade === 1 ? XP.retrievalMiss : XP.retrievalHit * (grade === 2 ? 0.8 : grade === 4 ? 1.1 : 1)
  return Math.round(base * streakMultiplier(streakDays))
}

/* ---------------------------------------------------------------- mastery --- */

/** Concepts belonging to paths the learner actually chose. */
export function selectedPaths(domain: Domain): DomainPath[] {
  return domain.paths.filter((p) => p.selected)
}

/** Every concept id inside unlocked layers of the selected paths. */
export function frontierConceptIds(domain: Domain): string[] {
  const ids = new Set<string>()
  for (const path of selectedPaths(domain)) {
    for (const layer of path.layers) {
      if (!layer.unlocked) continue
      for (const id of layer.conceptIds) ids.add(id)
    }
  }
  // A domain that predates paths (or a sample with loose nodes) still has a frontier.
  if (ids.size === 0) for (const n of domain.blueprint.nodes) if (n.status !== 'locked') ids.add(n.id)
  return [...ids]
}

/** Every concept id the selected paths will eventually cover, unlocked or not. */
export function chosenSubgraphIds(domain: Domain): string[] {
  const ids = new Set<string>()
  for (const path of selectedPaths(domain)) {
    for (const layer of path.layers) for (const id of layer.conceptIds) ids.add(id)
  }
  if (ids.size === 0) for (const n of domain.blueprint.nodes) ids.add(n.id)
  return [...ids]
}

/**
 * Live recall probability for one concept, 0–100.
 * Retrieval items are the ground truth; a concept with no items yet falls back
 * to the decayed node retention so a freshly unlocked concept is not read as
 * "forgotten".
 */
export function conceptRetention(domain: Domain, conceptId: string, now = Date.now()): number {
  const items = domain.items.filter((i) => i.conceptId === conceptId)
  const seen = items.filter((i) => i.memory.state !== 'new')
  if (seen.length === 0) {
    return domain.blueprint.nodes.find((n) => n.id === conceptId)?.retention ?? 0
  }
  const mean = seen.reduce((sum, i) => sum + currentRetrievability(i.memory, now), 0) / seen.length
  // Items you have never attempted are unproven coverage, so they dilute the score.
  const coverage = seen.length / items.length
  return Math.round(mean * 100 * (0.7 + 0.3 * coverage))
}

/**
 * Mastery of the learner's chosen subgraph, 0–100.
 * A concept counts fully only when it is both unlocked and warm.
 */
export function masteryPct(domain: Domain, now = Date.now()): number {
  const ids = chosenSubgraphIds(domain)
  if (ids.length === 0) return 0
  const unlocked = new Set(frontierConceptIds(domain))
  const total = ids.reduce((sum, id) => {
    if (!unlocked.has(id)) return sum
    return sum + conceptRetention(domain, id, now) / 100
  }, 0)
  return Math.round((total / ids.length) * 100)
}

/** How much of the chosen subgraph has been revealed at all, 0–100. */
export function frontierPct(domain: Domain): number {
  const all = chosenSubgraphIds(domain)
  if (all.length === 0) return 0
  return Math.round((frontierConceptIds(domain).length / all.length) * 100)
}

/* --------------------------------------------------------------- streaks --- */

/** Local calendar day key. Streaks follow the learner's clock, not UTC. */
export function dayKey(at: Date | number = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const first = Date.UTC(ay, am - 1, ad)
  const second = Date.UTC(by, bm - 1, bd)
  return Math.round((second - first) / 86_400_000)
}

/**
 * Advance the streak for a dose completed today.
 * Same day keeps it, yesterday extends it, anything older restarts at 1.
 */
export function advanceStreak(
  progress: { streakDays: number; bestStreakDays: number; lastDoseDay?: string; dosesToday: number },
  today = dayKey(),
): { streakDays: number; bestStreakDays: number; lastDoseDay: string; dosesToday: number } {
  const last = progress.lastDoseDay
  let streakDays: number
  let dosesToday: number

  if (last === today) {
    streakDays = Math.max(1, progress.streakDays)
    dosesToday = progress.dosesToday + 1
  } else if (last && daysBetweenKeys(last, today) === 1) {
    streakDays = progress.streakDays + 1
    dosesToday = 1
  } else {
    streakDays = 1
    dosesToday = 1
  }

  return {
    streakDays,
    bestStreakDays: Math.max(progress.bestStreakDays, streakDays),
    lastDoseDay: today,
    dosesToday,
  }
}

/** A streak that has already been broken by the calendar reads as 0, not stale. */
export function liveStreak(progress: { streakDays: number; lastDoseDay?: string }, today = dayKey()): number {
  if (!progress.lastDoseDay) return 0
  const gap = daysBetweenKeys(progress.lastDoseDay, today)
  return gap <= 1 ? progress.streakDays : 0
}
