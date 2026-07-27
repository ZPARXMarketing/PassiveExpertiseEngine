import type { BlueprintNode, Subject } from './types'
import { createFinanceSubject } from './samples/finance'
import { createB2bSubject } from './samples/b2b'
import { createStubSubject } from './samples/stub'

/** Seed subjects shown on first launch (independent localStorage saves). */
export function createSeedSubjects(): Subject[] {
  // Stable-ish ids for demo so reloads of "fresh" install get clean seeds only when empty
  const finance = createFinanceSubject()
  finance.id = 'sub-finance-seed'
  const b2b = createB2bSubject()
  b2b.id = 'sub-b2b-seed'
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
      summary: n.summary ?? t.summary,
      overview: n.overview ?? t.overview,
      learnAbout: n.learnAbout ?? t.learnAbout,
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
 * Map a free-text goal to a sample blueprint when it matches known domains;
 * otherwise ship a generic stub so any project is accepted.
 */
export function subjectFromGoal(goal: string): Subject {
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
    return createFinanceSubject(goal.trim())
  }
  if (
    g.includes('lead') ||
    g.includes('b2b') ||
    g.includes('outbound') ||
    g.includes('pipeline') ||
    g.includes('demand gen')
  ) {
    return createB2bSubject(goal.trim())
  }
  return createStubSubject(goal)
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
