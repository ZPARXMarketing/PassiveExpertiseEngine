/**
 * Time-based retention decay for blueprint nodes.
 *
 * Retention is a 0–100 score bumped by practice. Without practice it decays
 * toward 0 on a roughly weekly half-life so the heat map stays honest instead
 * of freezing at the last bump forever.
 *
 * Decay runs on app load and once per calendar day (see AppContext).
 */

import type { BlueprintNode, Domain } from './types'

/** Approximate half-life in days — after this many idle days, retention ~halves. */
export const RETENTION_HALF_LIFE_DAYS = 7

/** Floor so a node never goes fully dark from pure time alone without practice history. */
export const RETENTION_FLOOR = 2

/** Concepts below this after decay trigger auto-drill generation. */
export const LOW_RETENTION_THRESHOLD = 40

const MS_PER_DAY = 86_400_000

/** Days since an ISO timestamp; 0 if missing/invalid. */
export function daysSince(iso: string | undefined | null, now = Date.now()): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, (now - t) / MS_PER_DAY)
}

/**
 * Continuous exponential decay: retention * 0.5^(days / halfLife).
 * Applied only to the portion above the floor so long-idle nodes settle near floor.
 */
export function decayRetention(
  retention: number,
  daysIdle: number,
  halfLifeDays = RETENTION_HALF_LIFE_DAYS,
): number {
  if (daysIdle <= 0 || retention <= RETENTION_FLOOR) {
    return Math.min(100, Math.max(0, retention))
  }
  const factor = Math.pow(0.5, daysIdle / halfLifeDays)
  const aboveFloor = retention - RETENTION_FLOOR
  const next = RETENTION_FLOOR + aboveFloor * factor
  return Math.min(100, Math.max(0, Math.round(next * 10) / 10))
}

/** Apply time decay to one node using its lastTouchedAt (or leave untouched if never practiced). */
export function decayNode(node: BlueprintNode, now = Date.now()): BlueprintNode {
  if (node.status === 'locked') return node
  // Never practiced: keep authored seed retention (demo seeds) but still allow
  // a gentle drift if the project is old — use created-ish via missing = no decay.
  if (!node.lastTouchedAt) return node
  const idle = daysSince(node.lastTouchedAt, now)
  if (idle < 0.04) return node // < ~1 hour, skip noise
  const next = decayRetention(node.retention, idle)
  if (Math.abs(next - node.retention) < 0.05) return node
  return { ...node, retention: next }
}

/** Decay every non-locked node on a domain; returns a new domain only if something changed. */
export function applyRetentionDecay(domain: Domain, now = Date.now()): Domain {
  let changed = false
  const nodes = domain.blueprint.nodes.map((n) => {
    const next = decayNode(n, now)
    if (next !== n) changed = true
    return next
  })
  if (!changed) return domain
  return {
    ...domain,
    blueprint: { ...domain.blueprint, nodes },
  }
}

/** Stamp lastTouchedAt and optionally bump retention (clamped). */
export function touchNode(
  node: BlueprintNode,
  opts: { delta?: number; at?: string } = {},
): BlueprintNode {
  const at = opts.at ?? new Date().toISOString()
  const retention =
    opts.delta !== undefined
      ? Math.min(100, Math.max(0, node.retention + opts.delta))
      : node.retention
  return { ...node, retention, lastTouchedAt: at }
}

/** Nodes that are cold enough to warrant an auto-generated drill. */
export function coldConcepts(domain: Domain, threshold = LOW_RETENTION_THRESHOLD): BlueprintNode[] {
  return domain.blueprint.nodes.filter(
    (n) => n.status !== 'locked' && n.retention < threshold && n.retention > 0,
  )
}
