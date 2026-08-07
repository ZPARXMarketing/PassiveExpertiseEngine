import type { BlueprintNode, Domain, DomainPath, PathLayer, RetrievalItem } from './types'
import { emptyMetrics, emptyProgress } from './types'
import { createFinanceDomain } from './samples/finance'
import { createB2bDomain } from './samples/b2b'
import { offlineDomain } from './domain'
import { newMemory } from './fsrs'

/** Seed domains shown on first launch (independent localStorage saves). */
export function createSeedDomains(): Domain[] {
  const finance: Domain = { ...createFinanceDomain(), id: 'dom-finance-seed' }
  const b2b: Domain = { ...createB2bDomain(), id: 'dom-b2b-seed' }
  return [finance, b2b]
}

/**
 * Merge authored copy from a template domain onto a persisted one.
 * Keeps progress (retention, status, metrics, XP) while filling in content
 * added after the user first saved.
 */
function enrichFromTemplate(domain: Domain, template: Domain): Domain {
  const byId = Object.fromEntries(template.blueprint.nodes.map((n) => [n.id, n]))
  const nodes: BlueprintNode[] = domain.blueprint.nodes.map((n) => {
    const t = byId[n.id]
    if (!t) return n
    return {
      ...n,
      icon: n.icon ?? t.icon,
      summary: n.summary ?? t.summary,
      why: n.why ?? t.why,
      overview: n.overview ?? t.overview,
      learnAbout: n.learnAbout ?? t.learnAbout,
      pathId: n.pathId ?? t.pathId,
      layer: n.layer ?? t.layer,
      // Keep a generated study page; otherwise pick up newly authored content.
      study: n.study?.source === 'generated' ? n.study : (t.study ?? n.study),
    }
  })
  return {
    ...domain,
    // A saved domain keeps its own path selections; only unseen paths are added.
    paths: mergePaths(domain.paths, template.paths),
    blueprint: {
      ...domain.blueprint,
      overview: domain.blueprint.overview ?? template.blueprint.overview,
      goals: domain.blueprint.goals ?? template.blueprint.goals,
      nodes,
    },
  }
}

function mergePaths(saved: DomainPath[], template: DomainPath[]): DomainPath[] {
  const savedIds = new Set(saved.map((p) => p.id))
  return [...saved, ...template.filter((p) => !savedIds.has(p.id))]
}

/* --------------------------------------------------------------- legacy --- */

/** The shape persisted before domains existed — a flat subject with an SRS deck. */
interface LegacySubject {
  id?: string
  goal?: string
  title?: string
  createdAt?: string
  source?: string
  blueprint?: { overview?: string; goals?: string[]; nodes?: BlueprintNode[]; edges?: unknown[] }
  tasks?: unknown[]
  synthPrompts?: unknown[]
  srs?: Array<{ id: string; conceptId: string; front: string; back: string; dueAt?: string }>
  drills?: unknown[]
  metrics?: Domain['metrics']
}

export function isLegacySubject(value: unknown): boolean {
  const v = value as LegacySubject & { paths?: unknown; topic?: unknown }
  return !!v && v.paths === undefined && (v.goal !== undefined || v.srs !== undefined)
}

/**
 * Lift a pre-domain save into the new model.
 * Everything the learner already did is kept: the whole old graph becomes the
 * first layer of a single selected path, and old SRS cards become recall items
 * with fresh memory state (SM-2 ease does not translate into FSRS stability, so
 * inventing one would be worse than re-measuring).
 */
export function migrateLegacySubject(raw: unknown): Domain {
  const legacy = raw as LegacySubject
  const nodes = (legacy.blueprint?.nodes ?? []) as BlueprintNode[]
  const pathId = 'core-path'
  const title = legacy.title ?? legacy.goal ?? 'Untitled domain'

  const layer: PathLayer = {
    id: `${pathId}-layer-0`,
    title: 'Core concepts',
    conceptIds: nodes.map((n) => n.id),
    unlocked: true,
    unlockedAt: legacy.createdAt ?? new Date().toISOString(),
    generated: true,
  }

  const items: RetrievalItem[] = (legacy.srs ?? []).map((card) => ({
    id: card.id,
    conceptId: card.conceptId,
    kind: 'recall' as const,
    prompt: card.front,
    answer: card.back,
    keyPoints: [card.back],
    source: 'authored' as const,
    memory: newMemory(card.dueAt),
  }))

  return {
    id: legacy.id ?? `dom-migrated-${Date.now()}`,
    topic: legacy.goal ?? title,
    title,
    createdAt: legacy.createdAt ?? new Date().toISOString(),
    source: (legacy.source as Domain['source']) ?? 'stub',
    pathsChosen: true,
    paths: [
      {
        id: pathId,
        title: 'Core path',
        icon: '🧭',
        pitch: `Everything you had already started on “${title}”.`,
        payoff: 'Carried over from before this domain had routes.',
        depth: 'moderate',
        weeks: 6,
        selected: true,
        selectedAt: legacy.createdAt ?? new Date().toISOString(),
        layers: [layer],
      },
    ],
    blueprint: {
      overview: legacy.blueprint?.overview,
      goals: legacy.blueprint?.goals,
      nodes: nodes.map((n) => ({ ...n, pathId, layer: 0 })),
      edges: (legacy.blueprint?.edges ?? []) as Domain['blueprint']['edges'],
    },
    tasks: (legacy.tasks ?? []) as Domain['tasks'],
    // Old Feynman prompts carried a `cardsOnPass` deck; drop the deck rather
    // than guess at its new shape — the prompt itself still works.
    synthPrompts: ((legacy.synthPrompts ?? []) as Array<Record<string, unknown>>).map((p) => ({
      ...(p as unknown as Domain['synthPrompts'][number]),
      itemsOnPass: [],
    })),
    items,
    drills: (legacy.drills ?? []) as Domain['drills'],
    metrics: { ...emptyMetrics(), ...(legacy.metrics ?? {}), reviewLog: legacy.metrics?.reviewLog ?? [] },
    progress: emptyProgress(),
  }
}

/** Upgrade older localStorage saves so authored copy and new fields still show. */
export function hydrateDomains(raw: unknown[]): Domain[] {
  const financeTpl = createFinanceDomain()
  const b2bTpl = createB2bDomain()

  return raw.map((entry) => {
    const domain = isLegacySubject(entry) ? migrateLegacySubject(entry) : (entry as Domain)
    const safe: Domain = {
      ...domain,
      paths: domain.paths ?? [],
      items: domain.items ?? [],
      progress: { ...emptyProgress(), ...(domain.progress ?? {}) },
      metrics: { ...emptyMetrics(), ...(domain.metrics ?? {}) },
    }

    // A model-designed domain is its own content — never overwrite it.
    if (safe.source === 'generated') return safe

    const ids = new Set(safe.blueprint.nodes.map((n) => n.id))
    if (ids.has('cash-vs-profit') && ids.has('gross-margin')) return enrichFromTemplate(safe, financeTpl)
    if (ids.has('icp') && ids.has('cpc')) return enrichFromTemplate(safe, b2bTpl)
    return safe
  })
}

/* --------------------------------------------------------------- samples --- */

/**
 * Authored sample domain for a topic, when one covers it.
 * These ship fully written (including the CSV P&L task), so they beat anything
 * generated and are used before the model is asked to map the domain.
 */
export function sampleDomainForTopic(topic: string): Domain | null {
  const t = topic.trim().toLowerCase()
  if (
    t.includes('finance') ||
    t.includes('small business') ||
    t.includes('smb') ||
    t.includes('p&l') ||
    t.includes('cash flow') ||
    t.includes('med-spa') ||
    t.includes('medspa')
  ) {
    return createFinanceDomain(topic.trim())
  }
  if (
    t.includes('lead') ||
    t.includes('b2b') ||
    t.includes('outbound') ||
    t.includes('pipeline') ||
    t.includes('demand gen')
  ) {
    return createB2bDomain(topic.trim())
  }
  return null
}

/** The offline path — used when generation is unavailable, so no topic is rejected. */
export function domainFromTopic(topic: string): Domain {
  return sampleDomainForTopic(topic) ?? offlineDomain(topic)
}

/* ----------------------------------------------------------------- reset --- */

/**
 * Wipe progress for one domain while keeping its content.
 * Sample domains are rebuilt from their factory; a generated domain cannot be
 * rebuilt without more model calls, so it is reset in place — statuses,
 * retention and memory back to day one, content untouched.
 */
export function resetDomainProgress(current: Domain): Domain {
  if (current.source === 'sample') {
    const fresh = sampleDomainForTopic(current.topic) ?? current
    // Generated study pages are content, not progress — a reset keeps them.
    const generated = new Map(
      current.blueprint.nodes
        .filter((n) => n.study?.source === 'generated')
        .map((n) => [n.id, n.study!]),
    )
    return {
      ...fresh,
      id: current.id,
      title: current.title,
      blueprint: {
        ...fresh.blueprint,
        nodes: fresh.blueprint.nodes.map((n) =>
          generated.has(n.id) ? { ...n, study: generated.get(n.id) } : n,
        ),
      },
    }
  }

  const incoming = new Set(current.blueprint.edges.map((e) => e.to))
  return {
    ...current,
    blueprint: {
      ...current.blueprint,
      nodes: current.blueprint.nodes.map((n) => ({
        ...n,
        status: n.status === 'locked' ? 'locked' : incoming.has(n.id) ? 'available' : 'learning',
        retention: incoming.has(n.id) ? 0 : 12,
        lastTouchedAt: undefined,
      })),
    },
    items: current.items.map((i) => ({ ...i, memory: newMemory() })),
    metrics: emptyMetrics(),
    progress: emptyProgress(),
    plan: undefined,
  }
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h ${rm}m`
  }
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}
