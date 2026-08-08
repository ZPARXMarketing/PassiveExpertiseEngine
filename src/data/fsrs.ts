/**
 * FSRS-style scheduling at the retrieval-item level.
 *
 * The old SM-2 loop ("ease × interval") is replaced by an explicit memory model:
 * every item carries **stability** (days until recall probability falls to the
 * request retention) and **difficulty** (1–10, how much work this item is for
 * this learner). Retrievability is a decay curve over the days elapsed since the
 * last review, which is what makes concept-level retention honest — we can ask
 * "how likely is recall right now?" instead of reading a stale counter.
 *
 * This is the FSRS-4.5 formulation with the published default weights. It is
 * deliberately self-contained: no dependency, no optimiser, no review history
 * beyond what an item already stores.
 */

import type { MemoryState, ReviewGrade } from './types'

/** Default FSRS-4.5 weights. Indices follow the reference implementation. */
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const

/** Power-law decay exponent and the factor that makes R(S, S) == 0.9. */
const DECAY = -0.5
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1 // ≈ 19/81

/** Target recall probability when an item comes back up. */
export const REQUEST_RETENTION = 0.9

const MIN_STABILITY = 0.1
const MAX_INTERVAL_DAYS = 365
const MS_PER_DAY = 86_400_000

const clampDifficulty = (d: number): number => Math.min(10, Math.max(1, d))
const clampStability = (s: number): number =>
  Math.min(36500, Math.max(MIN_STABILITY, Number.isFinite(s) ? s : MIN_STABILITY))

/**
 * Probability of recalling an item after `elapsedDays` with the given stability.
 * 1.0 for a brand-new item that has never been shown (nothing has decayed yet).
 */
export function retrievability(stability: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 1
  const s = clampStability(stability)
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY)
}

/** Days from now until this item drops to the request retention. */
export function intervalFor(stability: number): number {
  const s = clampStability(stability)
  const days = (s / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1)
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)))
}

/** Fresh memory state for an item the learner has never seen. */
export function newMemory(dueAt = new Date().toISOString()): MemoryState {
  return {
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    dueAt,
    state: 'new',
  }
}

const initialStability = (grade: ReviewGrade): number => clampStability(W[grade - 1])

const initialDifficulty = (grade: ReviewGrade): number =>
  clampDifficulty(W[4] - Math.exp(W[5] * (grade - 1)) + 1)

/** Difficulty drifts toward the "easy" anchor, so a bad streak is recoverable. */
function nextDifficulty(difficulty: number, grade: ReviewGrade): number {
  const delta = -W[6] * (grade - 3)
  const damped = difficulty + delta * ((10 - difficulty) / 9)
  const anchor = initialDifficulty(4)
  return clampDifficulty(W[7] * anchor + (1 - W[7]) * damped)
}

/** Stability after a successful recall — bigger jump when recall was unlikely. */
function stabilityAfterRecall(
  stability: number,
  difficulty: number,
  r: number,
  grade: ReviewGrade,
): number {
  const hardPenalty = grade === 2 ? W[15] : 1
  const easyBonus = grade === 4 ? W[16] : 1
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    Math.pow(stability, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus
  return clampStability(stability * (1 + growth))
}

/** Stability after a lapse — collapses, but not all the way back to zero. */
function stabilityAfterLapse(stability: number, difficulty: number, r: number): number {
  const next =
    W[11] *
    Math.pow(difficulty, -W[12]) *
    (Math.pow(stability + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r))
  return clampStability(Math.min(next, stability))
}

/**
 * Grade one review and return the item's next memory state.
 * `grade`: 1 again · 2 hard · 3 good · 4 easy.
 */
export function review(memory: MemoryState, grade: ReviewGrade, now = Date.now()): MemoryState {
  const at = new Date(now).toISOString()
  const first = memory.state === 'new' || memory.reps === 0 || memory.stability <= 0

  let stability: number
  let difficulty: number

  if (first) {
    stability = initialStability(grade)
    difficulty = initialDifficulty(grade)
  } else {
    const elapsed = memory.lastReviewedAt
      ? Math.max(0, (now - new Date(memory.lastReviewedAt).getTime()) / MS_PER_DAY)
      : 0
    const r = retrievability(memory.stability, elapsed)
    difficulty = nextDifficulty(memory.difficulty || initialDifficulty(3), grade)
    stability =
      grade === 1
        ? stabilityAfterLapse(memory.stability, difficulty, r)
        : stabilityAfterRecall(memory.stability, difficulty, r, grade)
  }

  const lapsed = grade === 1
  // A lapse comes back inside the same session rather than tomorrow: the point
  // is to re-encode while the miss is still fresh.
  const dueAt = lapsed
    ? new Date(now + 8 * 60_000).toISOString()
    : new Date(now + intervalFor(stability) * MS_PER_DAY).toISOString()

  return {
    stability,
    difficulty,
    reps: memory.reps + 1,
    lapses: memory.lapses + (lapsed ? 1 : 0),
    dueAt,
    lastReviewedAt: at,
    state: lapsed ? 'relearning' : first ? 'learning' : 'review',
  }
}

/** Current recall probability for an item, 0–1. New items read as 0. */
export function currentRetrievability(memory: MemoryState, now = Date.now()): number {
  if (memory.state === 'new' || !memory.lastReviewedAt || memory.stability <= 0) return 0
  const elapsed = Math.max(0, (now - new Date(memory.lastReviewedAt).getTime()) / MS_PER_DAY)
  return retrievability(memory.stability, elapsed)
}

export function isDue(memory: MemoryState, now = Date.now()): boolean {
  return new Date(memory.dueAt).getTime() <= now
}

/** How overdue an item is, in days — used to sort the review queue. */
export function overdueDays(memory: MemoryState, now = Date.now()): number {
  return (now - new Date(memory.dueAt).getTime()) / MS_PER_DAY
}
