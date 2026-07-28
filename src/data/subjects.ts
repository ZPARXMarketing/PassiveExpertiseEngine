import type { BlueprintNode, Subject } from './types'
import { emptyMetrics } from './types'
import { createFinanceSubject } from './samples/finance'
import { createB2bSubject } from './samples/b2b'
import { createStubSubject } from './samples/stub'
import { freshenGeneratedNodes } from './path'

/** Seed subjects shown on first launch (independent localStorage saves). */
export function createSeedSubjects(): Subject[] {
  // Stable-ish ids for demo so reloads of "fresh" install get clean seeds only when empty
  const finance: Subject = { ...createFinanceSubject(), id: 'sub-finance-seed', source: 'sample' }
  const b2b: Subject = { ...createB2bSubject(), id: 'sub-b2b-seed', source: 'sample' }
  return [finance, b2b]
}

/**
 * Merge path/concept overview copy from a template subject onto a persisted one.
 * Keeps progress (retention, status, metrics) while filling in curriculum text
 * added after the user first saved.
 */
function enrichFromTemplate(subject: Subject, template: Subject): Subject {
  const byId = Object.fromEntries(template.blueprint.nodes.map((n) => [n.id, n]))
  const nodes: BlueprintNode[] = subject.blueprint.nodes.map((n) => {
    const t = byId[n.id]
    if (!t) return n
    return {
      ...n,
      icon: n.icon ?? t.icon,
      summary: n.summary ?? t.summary,
      overview: n.overview ?? t.overview,
      learnAbout: n.learnAbout ?? t.learnAbout,
      // Keep a generated study page; otherwise pick up newly authored content.
      study: n.study?.source === 'generated' ? n.study : (t.study ?? n.study),
    }
  })
  return {
    ...subject,
    blueprint: {
      ...subject.blueprint,
      overview: subject.blueprint.overview ?? template.blueprint.overview,
      goals: subject.blueprint.goals ?? template.blueprint.goals,
      nodes,
    },
  }
}

/** Upgrade older localStorage subjects so path/concept overviews still show. */
export function hydrateSubjects(subjects: Subject[]): Subject[] {
  const financeTpl = createFinanceSubject()
  const b2bTpl = createB2bSubject()
  return subjects.map((s) => {
    // A model-designed path is its own curriculum — never overwrite it from a template.
    if (s.source === 'generated') return s
    const ids = new Set(s.blueprint.nodes.map((n) => n.id))
    // Finance sample signature nodes
    if (ids.has('cash-vs-profit') && ids.has('gross-margin')) {
      return enrichFromTemplate(s, financeTpl)
    }
    // B2B sample signature nodes
    if (ids.has('icp') && ids.has('cpc')) {
      return enrichFromTemplate(s, b2bTpl)
    }
    // Generic stub-style graphs
    if (ids.has('fundamentals') && ids.has('retrieval')) {
      return enrichFromTemplate(s, createStubSubject(s.goal || s.title))
    }
    return s
  })
}

/**
 * Authored sample curriculum for a goal, when one covers it.
 * These ship fully written (including the CSV P&L task), so they beat anything
 * generated and are used before the model is asked for a path.
 */
export function sampleSubjectForGoal(goal: string): Subject | null {
  const g = goal.trim().toLowerCase()
  if (
    g.includes('finance') ||
    g.includes('small business') ||
    g.includes('smb') ||
    g.includes('p&l') ||
    g.includes('cash flow') ||
    g.includes('med-spa') ||
    g.includes('medspa')
  ) {
    return { ...createFinanceSubject(goal.trim()), source: 'sample' }
  }
  if (
    g.includes('lead') ||
    g.includes('b2b') ||
    g.includes('outbound') ||
    g.includes('pipeline') ||
    g.includes('demand gen')
  ) {
    return { ...createB2bSubject(goal.trim()), source: 'sample' }
  }
  return null
}

/**
 * Map a free-text goal to a sample blueprint when it matches known domains;
 * otherwise ship a generic stub so any project is accepted. This is the offline
 * path — SubjectsHome asks the model to design a path first.
 */
export function subjectFromGoal(goal: string): Subject {
  return sampleSubjectForGoal(goal) ?? { ...createStubSubject(goal), source: 'stub' }
}

/**
 * Wipe progress for one project while keeping its curriculum.
 * Sample and stub curricula are rebuilt from their factory; a generated path
 * cannot be rebuilt without another model call, so it is reset in place —
 * statuses and retention back to day one, content untouched.
 */
export function resetSubjectProgress(current: Subject): Subject {
  if (current.source === 'generated') {
    return {
      ...current,
      srs: [],
      metrics: emptyMetrics(),
      blueprint: { ...current.blueprint, nodes: freshenGeneratedNodes(current.blueprint) },
    }
  }

  const fresh = subjectFromGoal(current.goal)
  fresh.id = current.id
  fresh.title = current.title
  // Generated study pages are content, not progress — a reset keeps them.
  const generated = new Map(
    current.blueprint.nodes
      .filter((n) => n.study?.source === 'generated')
      .map((n) => [n.id, n.study!]),
  )
  fresh.blueprint = {
    ...fresh.blueprint,
    nodes: fresh.blueprint.nodes.map((n) =>
      generated.has(n.id) ? { ...n, study: generated.get(n.id) } : n,
    ),
  }
  return fresh
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
