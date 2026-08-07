/**
 * Retrieval items — the unit the Feed actually reviews.
 *
 * The old default was a blank textarea and a keyword rubric, which taxes the
 * learner for typing rather than for remembering. The diet here is inverted:
 * high-discrimination MCQs, application scenarios and structured reconstruction
 * first, classic front/back recall second, free writing only when the learner
 * opts into a teach-back.
 *
 * Items are derived from content the app already has — the concept's study page
 * (check-yourself pairs, key terms, mistakes, formulas) and its siblings on the
 * same path, which supply the distractors that make discrimination items sharp.
 */

import type {
  BlueprintNode,
  ConceptStudy,
  Domain,
  RetrievalItem,
  RetrievalKind,
  RetrievalSeed,
  ReviewGrade,
} from './types'
import { currentRetrievability, isDue, newMemory, overdueDays } from './fsrs'

/** Kinds that need no free text at all. */
export const LOW_FRICTION_KINDS: RetrievalKind[] = ['mcq', 'discrimination', 'reconstruction', 'recall']

export function isWritingFree(kind: RetrievalKind): boolean {
  return LOW_FRICTION_KINDS.includes(kind)
}

/** Give a seed its day-one memory state. */
export function hydrateSeed(
  seed: RetrievalSeed,
  source: RetrievalItem['source'] = 'authored',
  dueAt?: string,
): RetrievalItem {
  return { ...seed, source, memory: newMemory(dueAt) }
}

export function hydrateSeeds(
  seeds: RetrievalSeed[],
  source: RetrievalItem['source'] = 'authored',
): RetrievalItem[] {
  return seeds.map((s) => hydrateSeed(s, source))
}

/* --------------------------------------------------------------- grading --- */

export interface AttemptResult {
  correct: boolean
  grade: ReviewGrade
  /** What to show after the attempt */
  feedback: string
}

const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Score a short-answer or application attempt against its key points.
 * Deliberately generous on wording and strict on coverage: the learner must
 * touch most of the points, but may phrase them however they like.
 */
export function gradeKeyPoints(answer: string, keyPoints: string[]): AttemptResult {
  const text = normalise(answer)
  if (text.length < 3) {
    return { correct: false, grade: 1, feedback: 'Nothing to grade — say it in a sentence.' }
  }
  if (keyPoints.length === 0) {
    // No rubric to check against: treat a real attempt as a pass, an empty one as a miss.
    const ok = text.split(' ').length >= 6
    return {
      correct: ok,
      grade: ok ? 3 : 1,
      feedback: ok ? 'Logged.' : 'Give it one more sentence of substance.',
    }
  }

  const hits = keyPoints.filter((point) => {
    const words = normalise(point)
      .split(' ')
      .filter((w) => w.length > 3)
    if (words.length === 0) return text.includes(normalise(point))
    // A point counts when most of its content words show up anywhere in the answer.
    const found = words.filter((w) => text.includes(w)).length
    return found / words.length >= 0.6
  }).length

  const ratio = hits / keyPoints.length
  const missed = keyPoints.filter((point) => {
    const words = normalise(point)
      .split(' ')
      .filter((w) => w.length > 3)
    if (words.length === 0) return !text.includes(normalise(point))
    return words.filter((w) => text.includes(w)).length / words.length < 0.6
  })

  if (ratio >= 0.85) return { correct: true, grade: 4, feedback: 'All of it — nothing missing.' }
  if (ratio >= 0.6) return { correct: true, grade: 3, feedback: `Got it. Also worth naming: ${missed[0] ?? '—'}.` }
  if (ratio >= 0.35) {
    return {
      correct: true,
      grade: 2,
      feedback: `Partial. Missing: ${missed.slice(0, 2).join('; ')}.`,
    }
  }
  return {
    correct: false,
    grade: 1,
    feedback: `Not there yet. A full answer names: ${keyPoints.slice(0, 3).join('; ')}.`,
  }
}

/** Score one attempt on any item kind. `choice` is an option index or the typed text. */
export function gradeAttempt(item: RetrievalItem, choice: number | string): AttemptResult {
  switch (item.kind) {
    case 'mcq':
    case 'discrimination': {
      const picked = typeof choice === 'number' ? choice : -1
      const correct = picked === item.correctIndex
      return {
        correct,
        grade: correct ? 3 : 1,
        feedback: item.explanation ?? (correct ? 'Correct.' : 'Not that one.'),
      }
    }
    case 'reconstruction': {
      // The learner submits the step order as a comma-joined index list.
      const given = String(choice)
        .split(',')
        .map((s) => Number(s.trim()))
      const correct =
        given.length === (item.steps?.length ?? 0) && given.every((v, i) => v === i)
      return {
        correct,
        grade: correct ? 4 : 1,
        feedback: correct
          ? 'Order holds.'
          : item.explanation ?? 'Out of order — reread the sequence and rebuild it.',
      }
    }
    default:
      return gradeKeyPoints(String(choice), item.keyPoints ?? [])
  }
}

/* -------------------------------------------------------------- deriving --- */

const trim = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1).trim()}…` : s)

const cleanConceptLabel = (label: string): string => label.replace(' 🔒', '').trim()

/**
 * Build a spread of retrieval items for one concept from its study page.
 * Siblings supply distractors, which is what turns a definition into a
 * discrimination item — the thing classic flashcards never test.
 */
export function deriveItems(
  node: BlueprintNode,
  study: ConceptStudy | undefined,
  siblings: BlueprintNode[],
  max = 6,
): RetrievalSeed[] {
  const label = cleanConceptLabel(node.label)
  const seeds: RetrievalSeed[] = []
  const id = (kind: string, n: number) => `derived-${node.id}-${kind}-${n}`

  // 1. Discrimination against the nearest sibling concepts — highest value first.
  const others = siblings
    .filter((s) => s.id !== node.id && s.summary)
    .slice(0, 3)
    .map((s) => cleanConceptLabel(s.label))
  if (node.summary && others.length >= 2) {
    const options = [label, ...others].slice(0, 4)
    seeds.push({
      id: id('disc', 1),
      conceptId: node.id,
      kind: 'discrimination',
      prompt: `Which concept is this: “${node.summary}”?`,
      options,
      correctIndex: 0,
      explanation: `That is ${label}. The others sit next to it on this path but answer a different question.`,
      contrastWith: others[0],
    })
  }

  // 2. Application scenario off the "why it matters" line.
  if (node.why || study?.whyItMatters) {
    seeds.push({
      id: id('app', 1),
      conceptId: node.id,
      kind: 'application',
      prompt: `A colleague is about to make a call where ${label} applies. In two sentences, what do you tell them to check first, and why?`,
      keyPoints: [label, ...(node.learnAbout ?? []).slice(0, 2)],
      answer: node.why ?? study?.whyItMatters,
    })
  }

  // 3. Check-yourself pairs become short answers — the study page already
  //    phrased these as retrieval questions.
  for (const [i, check] of (study?.checkYourself ?? []).slice(0, 3).entries()) {
    seeds.push({
      id: id('short', i + 1),
      conceptId: node.id,
      kind: 'short-answer',
      prompt: check.q,
      answer: check.a,
      keyPoints: check.a
        .split(/[;.]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12)
        .slice(0, 3),
    })
  }

  // 4. Mistakes become discrimination MCQs — "which of these is the trap?"
  const mistakes = study?.mistakes ?? []
  if (mistakes.length >= 3) {
    seeds.push({
      id: id('trap', 1),
      conceptId: node.id,
      kind: 'mcq',
      prompt: `Working with ${label}, which of these is the actual mistake?`,
      options: [trim(mistakes[0], 110), trim(mistakes[1], 110), trim(mistakes[2], 110)],
      correctIndex: 0,
      explanation: mistakes[0],
    })
  }

  // 5. Formulas are worth a plain recall item — they are the one thing that
  //    genuinely benefits from rote.
  for (const [i, formula] of (study?.formulas ?? []).slice(0, 2).entries()) {
    seeds.push({
      id: id('formula', i + 1),
      conceptId: node.id,
      kind: 'recall',
      prompt: `${formula.name} — write the expression`,
      answer: formula.expression,
      keyPoints: [formula.expression],
    })
  }

  // 6. Key terms fill any remaining slots.
  for (const [i, term] of (study?.keyTerms ?? []).slice(0, 2).entries()) {
    seeds.push({
      id: id('term', i + 1),
      conceptId: node.id,
      kind: 'recall',
      prompt: `In one line: ${term.term}`,
      answer: term.definition,
      keyPoints: [term.definition],
    })
  }

  // Nothing authored yet — one honest item beats an empty concept.
  if (seeds.length === 0) {
    seeds.push({
      id: id('short', 0),
      conceptId: node.id,
      kind: 'short-answer',
      prompt: `What does ${label} let you decide that you could not decide before?`,
      answer: node.why ?? node.summary,
      keyPoints: node.summary ? [node.summary] : [],
    })
  }

  return seeds.slice(0, max)
}

/** Items a concept does not have yet, ready to hydrate. */
export function missingItems(domain: Domain, node: BlueprintNode, max = 6): RetrievalSeed[] {
  const have = new Set(domain.items.map((i) => i.id))
  const siblings = domain.blueprint.nodes.filter((n) => n.pathId === node.pathId)
  return deriveItems(node, node.study, siblings.length > 1 ? siblings : domain.blueprint.nodes, max).filter(
    (s) => !have.has(s.id),
  )
}

/* ---------------------------------------------------------------- queues --- */

/** Due items, most overdue and weakest first. */
export function dueItems(domain: Domain, now = Date.now()): RetrievalItem[] {
  return domain.items
    .filter((i) => i.memory.state !== 'new' && isDue(i.memory, now))
    .sort((a, b) => overdueDays(b.memory, now) - overdueDays(a.memory, now))
}

/** Items never attempted — the Feed introduces these alongside reviews. */
export function newItems(domain: Domain): RetrievalItem[] {
  return domain.items.filter((i) => i.memory.state === 'new')
}

/** Concepts whose live recall probability has slipped below `threshold` (0–1). */
export function weakConceptIds(domain: Domain, threshold = 0.75, now = Date.now()): string[] {
  const byConcept = new Map<string, number[]>()
  for (const item of domain.items) {
    if (item.memory.state === 'new') continue
    const list = byConcept.get(item.conceptId) ?? []
    list.push(currentRetrievability(item.memory, now))
    byConcept.set(item.conceptId, list)
  }
  return [...byConcept.entries()]
    .map(([id, values]) => ({ id, mean: values.reduce((a, b) => a + b, 0) / values.length }))
    .filter((c) => c.mean < threshold)
    .sort((a, b) => a.mean - b.mean)
    .map((c) => c.id)
}
