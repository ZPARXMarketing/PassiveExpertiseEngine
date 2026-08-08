import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  AppSettings,
  ConceptStudy,
  Domain,
  Drill,
  DrillScore,
  PnlTag,
  RetrievalItem,
  RetrievalSeed,
  ReviewGrade,
  ViewId,
} from '../data/types'
import {
  createSeedDomains,
  hydrateDomains,
  resetDomainProgress,
} from '../data/domains'
import { DEFAULT_MODEL } from '../data/studyPrompt'
import { applyLayer, type NormalizedLayer } from '../data/domain'
import { review as fsrsReview } from '../data/fsrs'
import { advanceStreak, dayKey, liveStreak, rankFor, XP, xpForGrade } from '../data/rank'
import { hydrateSeed, hydrateSeeds } from '../data/retrieval'
import { applyRetentionDecay, touchNode } from '../data/retention'
import { buildPlan } from '../data/scheduler'

const PERSIST_KEY = 'pee-v3'
/** The pre-domain save, read once so an existing prototype user keeps their work. */
const LEGACY_KEY = 'pee-v2'
/** Settings live under their own key so the API key is easy to find and clear. */
const SETTINGS_KEY = 'pee-settings-v1'

export type AppView = ViewId

export interface DrillSession {
  drillId: string
  index: number
  correct: number
  total: number
  endsAt: number
  /** for rapid-calc current question answer key */
  currentAnswer?: number
  currentPrompt?: string
  currentTolerance?: number
}

/** One Feed dose of retrieval — a handful of items on one concept, not a queue. */
export interface RetrievalSession {
  /** Feed card that opened this session */
  cardId: string
  conceptId?: string
  itemIds: string[]
  index: number
  revealed: boolean
  correct: number
  /** Last attempt's feedback, shown with the answer */
  feedback: string | null
  lastCorrect: boolean | null
}

export interface AppState {
  view: AppView
  domains: Domain[]
  activeDomainId: string | null
  settings: AppSettings
  /** concept whose study page is open */
  openConceptId: string | null
  studyLoading: boolean
  studyError: string | null
  /** path whose layer is being generated */
  layerLoading: string | null
  layerError: string | null
  openTaskId: string | null
  /** pnl tags for active csv task */
  pnlTags: Record<string, PnlTag>
  taskDraft: string
  sessionActiveSec: number
  sessionIdleSec: number
  sessionRunning: boolean
  sessionIdle: boolean
  /** answers to a teach-back's scaffold questions, index-aligned */
  teachBackDraft: string[]
  teachBackResult: 'pass' | 'fail' | null
  activeSynthId: string | null
  retrieval: RetrievalSession | null
  drill: DrillSession | null
  toast: string | null
}

export type Action =
  | { type: 'setView'; view: AppView }
  | { type: 'setActiveDomain'; id: string }
  | { type: 'addDomain'; domain: Domain; message?: string; navigate?: boolean }
  | { type: 'deleteDomain'; id: string }
  | { type: 'setSettings'; settings: Partial<AppSettings> }
  | { type: 'togglePath'; pathId: string }
  | { type: 'commitPaths' }
  | { type: 'layerLoading'; pathId: string }
  | { type: 'layerFailed'; message: string }
  | { type: 'layerBuilt'; pathId: string; layerIndex: number; built: NormalizedLayer; message?: string }
  | { type: 'revealLayer'; pathId: string; layerIndex: number }
  | { type: 'unlockConcept'; conceptId: string }
  | { type: 'openConcept'; conceptId: string }
  | { type: 'closeConcept' }
  | { type: 'studyLoading' }
  | { type: 'studyFailed'; message: string }
  | { type: 'setStudy'; conceptId: string; study: ConceptStudy }
  | { type: 'addItems'; seeds: RetrievalSeed[]; source?: RetrievalItem['source'] }
  | { type: 'openTask'; taskId: string }
  | { type: 'closeTask' }
  | { type: 'setPnlTag'; rowId: string; tag: PnlTag }
  | { type: 'setTaskDraft'; text: string }
  | { type: 'tickSession' }
  | { type: 'setSessionFocus'; focused: boolean }
  | { type: 'userActivity' }
  | { type: 'startSession' }
  | { type: 'logSessionTime' }
  | { type: 'submitTask'; pass: boolean; message: string }
  | { type: 'startRetrieval'; cardId: string; itemIds: string[]; conceptId?: string }
  | { type: 'gradeItem'; grade: ReviewGrade; feedback: string; correct: boolean }
  | { type: 'nextItem' }
  | { type: 'endRetrieval' }
  | { type: 'setActiveSynth'; id: string | null }
  | { type: 'setTeachBackDraft'; index: number; text: string }
  | { type: 'submitTeachBack'; pass: boolean; feedback: string }
  | { type: 'startDrill'; drill: Drill; firstPrompt?: string; firstAnswer?: number; tolerance?: number }
  | { type: 'setDrillQuestion'; prompt: string; answer: number; tolerance: number }
  | { type: 'answerDrill'; correct: boolean; nextPrompt?: string; nextAnswer?: number; nextTolerance?: number }
  | { type: 'endDrill' }
  | { type: 'acknowledgeRank' }
  | { type: 'rebuildPlan' }
  | { type: 'decayRetention' }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'resetProgress' }

type Persisted = Pick<AppState, 'domains' | 'activeDomainId' | 'view' | 'openConceptId'>

const seeded = (): Persisted => {
  const domains = createSeedDomains()
  return {
    domains,
    activeDomainId: domains[0]?.id ?? null,
    view: 'domains',
    openConceptId: null,
  }
}

/** Views that only make sense with a concept or a chosen path behind them. */
function safeView(view: AppView, openConceptId: string | null): AppView {
  if (view === 'concept' && !openConceptId) return 'feed'
  if (view === 'retrieval' || view === 'terminal') return 'feed'
  return view
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(PERSIST_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return seeded()
    const parsed = JSON.parse(raw) as { subjects?: unknown[]; domains?: unknown[] } & Partial<Persisted>
    // `subjects` is the pre-domain key; hydrateDomains migrates it in place.
    const stored = parsed.domains ?? parsed.subjects
    if (!stored?.length) return seeded()
    const domains = hydrateDomains(stored)
    const openConceptId = parsed.openConceptId ?? null
    return {
      domains,
      activeDomainId: parsed.activeDomainId ?? domains[0]?.id ?? null,
      view: safeView(parsed.view ?? 'feed', openConceptId),
      openConceptId,
    }
  } catch {
    return seeded()
  }
}

const defaultSettings = (): AppSettings => ({
  openRouterKey: '',
  model: DEFAULT_MODEL,
  dailyDoses: 4,
})

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      openRouterKey: typeof parsed.openRouterKey === 'string' ? parsed.openRouterKey : '',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_MODEL,
      dailyDoses:
        typeof parsed.dailyDoses === 'number' && parsed.dailyDoses > 0
          ? Math.min(12, Math.round(parsed.dailyDoses))
          : 4,
    }
  } catch {
    return defaultSettings()
  }
}

const loaded = load()

const initialState: AppState = {
  view: loaded.view,
  domains: loaded.domains,
  activeDomainId: loaded.activeDomainId,
  settings: loadSettings(),
  openConceptId: loaded.openConceptId,
  studyLoading: false,
  studyError: null,
  layerLoading: null,
  layerError: null,
  openTaskId: null,
  pnlTags: {},
  taskDraft: '',
  sessionActiveSec: 0,
  sessionIdleSec: 0,
  sessionRunning: false,
  sessionIdle: false,
  teachBackDraft: [],
  teachBackResult: null,
  activeSynthId: null,
  retrieval: null,
  drill: null,
  toast: null,
}

function updateDomain(domains: Domain[], id: string, fn: (d: Domain) => Domain): Domain[] {
  return domains.map((d) => (d.id === id ? fn(d) : d))
}

/**
 * Credit XP and advance the streak for a completed dose.
 * `dose: false` still pays XP but does not touch the streak — only finishing a
 * real unit of work counts as showing up today.
 */
function credit(domain: Domain, xp: number, dose = true): Domain {
  const streak = dose
    ? advanceStreak(domain.progress, dayKey())
    : {
        streakDays: domain.progress.streakDays,
        bestStreakDays: domain.progress.bestStreakDays,
        lastDoseDay: domain.progress.lastDoseDay,
        dosesToday: domain.progress.dosesToday,
      }
  return {
    ...domain,
    progress: {
      ...domain.progress,
      ...streak,
      xp: domain.progress.xp + Math.max(0, Math.round(xp)),
    },
  }
}

/** Mark a concept touched: warm it, stamp the clock, and move it off "available". */
function warmConcept(domain: Domain, conceptId: string | undefined, delta: number): Domain {
  if (!conceptId) return domain
  return {
    ...domain,
    blueprint: {
      ...domain.blueprint,
      nodes: domain.blueprint.nodes.map((n) => {
        if (n.id !== conceptId) return n
        const touched = touchNode(n, { delta })
        return {
          ...touched,
          status:
            n.status === 'locked'
              ? 'locked'
              : touched.retention >= 80
                ? 'mastered'
                : n.status === 'available'
                  ? 'learning'
                  : n.status,
        }
      }),
    },
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setView':
      return { ...state, view: action.view, drill: null }

    case 'setActiveDomain':
      return {
        ...state,
        activeDomainId: action.id,
        openConceptId: null,
        studyLoading: false,
        studyError: null,
        layerError: null,
        view: state.view === 'concept' ? 'feed' : state.view,
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
        sessionRunning: false,
        teachBackDraft: [],
        teachBackResult: null,
        activeSynthId: null,
        retrieval: null,
        drill: null,
      }

    case 'addDomain': {
      const { domain } = action
      return {
        ...state,
        domains: [...state.domains, domain],
        activeDomainId: domain.id,
        // Failed generations stay put so the reason stays on screen next to the input.
        view: action.navigate === false ? state.view : domain.pathsChosen ? 'feed' : 'paths',
        openConceptId: null,
        toast: action.message ?? `Domain created: ${domain.title}`,
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
      }
    }

    case 'deleteDomain': {
      const domains = state.domains.filter((d) => d.id !== action.id)
      const activeDomainId =
        state.activeDomainId === action.id ? (domains[0]?.id ?? null) : state.activeDomainId
      return { ...state, domains, activeDomainId, toast: 'Domain removed' }
    }

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }

    /* ------------------------------------------------------------- paths --- */

    case 'togglePath': {
      if (!state.activeDomainId) return state
      const domain = state.domains.find((d) => d.id === state.activeDomainId)
      if (!domain) return state
      const target = domain.paths.find((p) => p.id === action.pathId)
      if (!target) return state
      const selectedCount = domain.paths.filter((p) => p.selected).length
      if (!target.selected && selectedCount >= 2) {
        return { ...state, toast: 'Two paths is the limit — deselect one first.' }
      }
      return {
        ...state,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => ({
          ...d,
          paths: d.paths.map((p) =>
            p.id === action.pathId
              ? {
                  ...p,
                  selected: !p.selected,
                  selectedAt: !p.selected ? new Date().toISOString() : undefined,
                }
              : p,
          ),
        })),
      }
    }

    case 'commitPaths': {
      if (!state.activeDomainId) return state
      const domain = state.domains.find((d) => d.id === state.activeDomainId)
      if (!domain || domain.paths.every((p) => !p.selected)) {
        return { ...state, toast: 'Pick at least one path to start.' }
      }
      const selected = domain.paths.filter((p) => p.selected).length
      return {
        ...state,
        domains: updateDomain(state.domains, state.activeDomainId, (d) =>
          credit({ ...d, pathsChosen: true }, XP.pathSelected * selected, false),
        ),
      }
    }

    case 'layerLoading':
      return { ...state, layerLoading: action.pathId, layerError: null }

    case 'layerFailed':
      return { ...state, layerLoading: null, layerError: action.message }

    case 'layerBuilt': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        layerLoading: null,
        layerError: null,
        // Deliberately does not navigate: whoever asked for this layer is still
        // on screen, and unmounting them would abort any build queued behind it.
        toast: action.message ?? `${action.built.layerTitle} unlocked`,
        domains: updateDomain(state.domains, state.activeDomainId, (d) =>
          credit(
            applyLayer(d, action.pathId, action.layerIndex, action.built),
            action.layerIndex === 0 ? 0 : XP.layerUnlock,
            action.layerIndex > 0,
          ),
        ),
      }
    }

    case 'revealLayer': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        toast: 'Layer opened',
        domains: updateDomain(state.domains, state.activeDomainId, (d) => {
          const path = d.paths.find((p) => p.id === action.pathId)
          const layer = path?.layers[action.layerIndex]
          if (!path || !layer || layer.unlocked) return d
          const revealed = new Set(layer.conceptIds)
          return credit(
            {
              ...d,
              paths: d.paths.map((p) =>
                p.id !== action.pathId
                  ? p
                  : {
                      ...p,
                      layers: p.layers.map((l, i) =>
                        i === action.layerIndex
                          ? { ...l, unlocked: true, unlockedAt: new Date().toISOString() }
                          : l,
                      ),
                    },
              ),
              // Concepts that were held back become available the moment their
              // layer opens — nothing stays locked behind a revealed layer.
              blueprint: {
                ...d.blueprint,
                nodes: d.blueprint.nodes.map((n) =>
                  revealed.has(n.id) && n.status === 'locked' ? { ...n, status: 'available' } : n,
                ),
              },
            },
            XP.layerUnlock,
          )
        }),
      }
    }

    case 'unlockConcept': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        view: 'concept',
        openConceptId: action.conceptId,
        studyError: null,
        domains: updateDomain(state.domains, state.activeDomainId, (d) =>
          credit(
            {
              ...d,
              blueprint: {
                ...d.blueprint,
                nodes: d.blueprint.nodes.map((n) =>
                  n.id === action.conceptId && n.status === 'available'
                    ? { ...n, status: 'learning', retention: Math.max(n.retention, 10) }
                    : n,
                ),
              },
            },
            XP.conceptUnlock,
          ),
        ),
      }
    }

    /* ------------------------------------------------------------- study --- */

    case 'openConcept':
      return {
        ...state,
        view: 'concept',
        openConceptId: action.conceptId,
        studyLoading: false,
        studyError: null,
        drill: null,
      }

    case 'closeConcept':
      return { ...state, view: 'feed', openConceptId: null, studyLoading: false }

    case 'studyLoading':
      return { ...state, studyLoading: true, studyError: null }

    case 'studyFailed':
      return { ...state, studyLoading: false, studyError: action.message }

    case 'setStudy': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        studyLoading: false,
        studyError: null,
        toast: 'Study page generated',
        domains: updateDomain(state.domains, state.activeDomainId, (d) => ({
          ...d,
          blueprint: {
            ...d.blueprint,
            nodes: d.blueprint.nodes.map((n) =>
              n.id === action.conceptId ? { ...n, study: action.study } : n,
            ),
          },
        })),
      }
    }

    case 'addItems': {
      if (!state.activeDomainId || action.seeds.length === 0) return state
      return {
        ...state,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => {
          const have = new Set(d.items.map((i) => i.id))
          const fresh = action.seeds.filter((s) => !have.has(s.id))
          if (fresh.length === 0) return d
          return { ...d, items: [...d.items, ...hydrateSeeds(fresh, action.source ?? 'derived')] }
        }),
      }
    }

    /* ---------------------------------------------------------- practice --- */

    case 'openTask': {
      const domain = state.domains.find((d) => d.id === state.activeDomainId)
      const task = domain?.tasks.find((t) => t.id === action.taskId)
      return {
        ...state,
        view: 'terminal',
        openTaskId: action.taskId,
        pnlTags: {},
        taskDraft: task?.starterText ?? '',
        sessionRunning: true,
        sessionActiveSec: 0,
        sessionIdleSec: 0,
        sessionIdle: false,
      }
    }

    case 'closeTask':
      return { ...state, openTaskId: null, sessionRunning: false, view: 'feed' }

    case 'setPnlTag':
      return {
        ...state,
        pnlTags: { ...state.pnlTags, [action.rowId]: action.tag },
        sessionIdle: false,
      }

    case 'setTaskDraft':
      return { ...state, taskDraft: action.text, sessionIdle: false }

    case 'startSession':
      return { ...state, sessionRunning: true, sessionIdle: false }

    case 'tickSession':
      if (!state.sessionRunning) return state
      return state.sessionIdle
        ? { ...state, sessionIdleSec: state.sessionIdleSec + 1 }
        : { ...state, sessionActiveSec: state.sessionActiveSec + 1 }

    case 'setSessionFocus':
      return { ...state, sessionIdle: !action.focused }

    case 'userActivity':
      return state.sessionIdle ? { ...state, sessionIdle: false } : state

    case 'logSessionTime': {
      if (!state.activeDomainId) return state
      const active = state.sessionActiveSec
      const idle = state.sessionIdleSec
      return {
        ...state,
        sessionRunning: false,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => ({
          ...d,
          metrics: {
            ...d.metrics,
            sessionSecondsActive: d.metrics.sessionSecondsActive + active,
            sessionSecondsIdle: d.metrics.sessionSecondsIdle + idle,
            sessionLog: [
              ...d.metrics.sessionLog,
              { at: new Date().toISOString(), activeSec: active, idleSec: idle },
            ],
          },
        })),
      }
    }

    case 'submitTask': {
      if (!state.activeDomainId || !state.openTaskId) return state
      const taskId = state.openTaskId
      const conceptId =
        state.domains
          .find((d) => d.id === state.activeDomainId)
          ?.tasks.find((t) => t.id === taskId)?.conceptId ?? undefined
      return {
        ...state,
        openTaskId: action.pass ? null : state.openTaskId,
        sessionRunning: !action.pass,
        view: action.pass ? 'feed' : state.view,
        toast: action.message,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => {
          const withTime: Domain = {
            ...d,
            metrics: {
              ...d.metrics,
              sessionSecondsActive: d.metrics.sessionSecondsActive + state.sessionActiveSec,
              sessionSecondsIdle: d.metrics.sessionSecondsIdle + state.sessionIdleSec,
              tasksCompleted:
                action.pass && !d.metrics.tasksCompleted.includes(taskId)
                  ? [...d.metrics.tasksCompleted, taskId]
                  : d.metrics.tasksCompleted,
            },
          }
          if (!action.pass) return withTime
          return credit(warmConcept(withTime, conceptId, 18), XP.practiceBlock)
        }),
        sessionActiveSec: action.pass ? 0 : state.sessionActiveSec,
        sessionIdleSec: action.pass ? 0 : state.sessionIdleSec,
      }
    }

    /* --------------------------------------------------------- retrieval --- */

    case 'startRetrieval':
      if (action.itemIds.length === 0) {
        return { ...state, toast: 'Nothing to retrieve on that card yet.' }
      }
      return {
        ...state,
        view: 'retrieval',
        retrieval: {
          cardId: action.cardId,
          conceptId: action.conceptId,
          itemIds: action.itemIds,
          index: 0,
          revealed: false,
          correct: 0,
          feedback: null,
          lastCorrect: null,
        },
      }

    case 'gradeItem': {
      if (!state.retrieval || !state.activeDomainId) return state
      const session = state.retrieval
      const itemId = session.itemIds[session.index]
      const now = Date.now()

      return {
        ...state,
        retrieval: {
          ...session,
          revealed: true,
          correct: session.correct + (action.correct ? 1 : 0),
          feedback: action.feedback,
          lastCorrect: action.correct,
        },
        domains: updateDomain(state.domains, state.activeDomainId, (d) => {
          const item = d.items.find((i) => i.id === itemId)
          if (!item) return d
          const graded: RetrievalItem = {
            ...item,
            memory: fsrsReview(item.memory, action.grade, now),
          }
          const streak = liveStreak(d.progress)
          const withItem: Domain = {
            ...d,
            items: d.items.map((i) => (i.id === itemId ? graded : i)),
            metrics: {
              ...d.metrics,
              reviewLog: [
                ...d.metrics.reviewLog.slice(-99),
                { at: new Date(now).toISOString(), conceptId: item.conceptId, grade: action.grade },
              ],
            },
          }
          // Retention on the node follows the item outcome so the map, the
          // roadmap and the Feed all read from the same event.
          const warmed = warmConcept(withItem, item.conceptId, action.correct ? 8 : -6)
          return credit(warmed, xpForGrade(action.grade, streak), false)
        }),
      }
    }

    case 'nextItem': {
      if (!state.retrieval) return state
      const next = state.retrieval.index + 1
      if (next >= state.retrieval.itemIds.length) {
        // Finishing the batch is the dose — that is what moves the streak.
        return {
          ...state,
          view: 'feed',
          retrieval: null,
          toast: `Dose done — ${state.retrieval.correct}/${state.retrieval.itemIds.length} recalled`,
          domains: state.activeDomainId
            ? updateDomain(state.domains, state.activeDomainId, (d) => credit(d, 0))
            : state.domains,
        }
      }
      return {
        ...state,
        retrieval: { ...state.retrieval, index: next, revealed: false, feedback: null, lastCorrect: null },
      }
    }

    case 'endRetrieval':
      return { ...state, retrieval: null, view: 'feed' }

    /* --------------------------------------------------------- teachback --- */

    case 'setActiveSynth':
      if (action.id === state.activeSynthId) return state
      return {
        ...state,
        activeSynthId: action.id,
        teachBackDraft: [],
        teachBackResult: null,
      }

    case 'setTeachBackDraft': {
      const draft = [...state.teachBackDraft]
      draft[action.index] = action.text
      return { ...state, teachBackDraft: draft }
    }

    case 'submitTeachBack': {
      if (!state.activeDomainId || !state.activeSynthId) return state
      const synthId = state.activeSynthId
      const domain = state.domains.find((d) => d.id === state.activeDomainId)
      const prompt = domain?.synthPrompts.find((p) => p.id === synthId)
      if (!prompt) return state

      if (!action.pass) {
        return { ...state, teachBackResult: 'fail', toast: action.feedback }
      }

      return {
        ...state,
        teachBackResult: 'pass',
        toast: action.feedback,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => {
          const have = new Set(d.items.map((i) => i.id))
          const fresh = prompt.itemsOnPass.filter((s) => !have.has(s.id))
          const withItems: Domain = {
            ...d,
            items: [...d.items, ...fresh.map((s) => hydrateSeed(s, 'authored'))],
            metrics: {
              ...d.metrics,
              synthPassed: d.metrics.synthPassed.includes(synthId)
                ? d.metrics.synthPassed
                : [...d.metrics.synthPassed, synthId],
            },
          }
          return credit(warmConcept(withItems, prompt.conceptId, 12), XP.teachBack)
        }),
      }
    }

    /* ------------------------------------------------------------ drills --- */

    case 'startDrill':
      return {
        ...state,
        drill: {
          drillId: action.drill.id,
          index: 0,
          correct: 0,
          total: 0,
          endsAt:
            Date.now() +
            ((action.drill.kind === 'rapid-calc'
              ? (action.drill.spec as { timeLimitSec: number }).timeLimitSec
              : 60) *
              1000),
          currentPrompt: action.firstPrompt,
          currentAnswer: action.firstAnswer,
          currentTolerance: action.tolerance,
        },
      }

    case 'setDrillQuestion':
      if (!state.drill) return state
      return {
        ...state,
        drill: {
          ...state.drill,
          currentPrompt: action.prompt,
          currentAnswer: action.answer,
          currentTolerance: action.tolerance,
        },
      }

    case 'answerDrill': {
      if (!state.drill || !state.activeDomainId) return state
      const correct = state.drill.correct + (action.correct ? 1 : 0)
      const total = state.drill.total + 1
      const domain = state.domains.find((d) => d.id === state.activeDomainId)!
      const drill = domain.drills.find((d) => d.id === state.drill!.drillId)
      const rounds = drill?.kind === 'rapid-calc' ? (drill.spec as { rounds: number }).rounds : 1
      const done = total >= rounds || Date.now() > state.drill.endsAt

      if (done) {
        const score: DrillScore = {
          drillId: state.drill.drillId,
          correct,
          total,
          at: new Date().toISOString(),
        }
        const accuracy = correct / Math.max(1, total)
        return {
          ...state,
          drill: null,
          toast: `Drill done — ${correct}/${total}`,
          domains: updateDomain(state.domains, state.activeDomainId, (d) => {
            const scored: Domain = {
              ...d,
              metrics: { ...d.metrics, drillScores: [...d.metrics.drillScores, score] },
            }
            const warmed = warmConcept(scored, drill?.conceptId, accuracy * 20 - 4)
            return credit(warmed, XP.drillPerCorrect * correct)
          }),
        }
      }

      return {
        ...state,
        drill: {
          ...state.drill,
          index: state.drill.index + 1,
          correct,
          total,
          currentPrompt: action.nextPrompt ?? state.drill.currentPrompt,
          currentAnswer: action.nextAnswer ?? state.drill.currentAnswer,
          currentTolerance: action.nextTolerance ?? state.drill.currentTolerance,
        },
      }
    }

    case 'endDrill':
      return { ...state, drill: null }

    /* ---------------------------------------------------------- identity --- */

    case 'acknowledgeRank': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => ({
          ...d,
          progress: { ...d.progress, acknowledgedRank: rankFor(d.progress.xp).id },
        })),
      }
    }

    case 'rebuildPlan': {
      if (!state.activeDomainId) return state
      return {
        ...state,
        domains: updateDomain(state.domains, state.activeDomainId, (d) => ({
          ...d,
          plan: buildPlan(d, state.settings.dailyDoses),
        })),
      }
    }

    case 'decayRetention':
      return { ...state, domains: state.domains.map((d) => applyRetentionDecay(d)) }

    case 'showToast':
      return { ...state, toast: action.message }

    case 'clearToast':
      return { ...state, toast: null }

    case 'resetProgress': {
      if (!state.activeDomainId) return state
      const current = state.domains.find((d) => d.id === state.activeDomainId)
      if (!current) return state
      const fresh = resetDomainProgress(current)
      return {
        ...state,
        domains: state.domains.map((d) => (d.id === state.activeDomainId ? fresh : d)),
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
        teachBackDraft: [],
        teachBackResult: null,
        retrieval: null,
        drill: null,
        toast: 'Domain progress reset',
      }
    }

    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
  activeDomain: Domain | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const payload: Persisted = {
      domains: state.domains,
      activeDomainId: state.activeDomainId,
      view: state.view,
      openConceptId: state.openConceptId,
    }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload))
  }, [state.domains, state.activeDomainId, state.view, state.openConceptId])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
  }, [state.settings])

  // Retention decays with the clock, not with visits — catch up on load and
  // again each hour so a tab left open overnight still tells the truth.
  useEffect(() => {
    dispatch({ type: 'decayRetention' })
    const t = setInterval(() => dispatch({ type: 'decayRetention' }), 3_600_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'clearToast' }), 2800)
    return () => clearTimeout(t)
  }, [state.toast])

  useEffect(() => {
    if (!state.sessionRunning) return
    const t = setInterval(() => dispatch({ type: 'tickSession' }), 1000)
    return () => clearInterval(t)
  }, [state.sessionRunning])

  useEffect(() => {
    if (!state.sessionRunning) return
    const onBlur = () => dispatch({ type: 'setSessionFocus', focused: false })
    const onFocus = () => dispatch({ type: 'setSessionFocus', focused: true })
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [state.sessionRunning])

  // Idle after 45s without interaction while a session is running
  useEffect(() => {
    if (!state.sessionRunning) return
    let idleTimer: ReturnType<typeof setTimeout>
    const bump = () => {
      dispatch({ type: 'userActivity' })
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => dispatch({ type: 'setSessionFocus', focused: false }), 45_000)
    }
    bump()
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      clearTimeout(idleTimer)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [state.sessionRunning])

  const activeDomain = useMemo(
    () => state.domains.find((d) => d.id === state.activeDomainId) ?? null,
    [state.domains, state.activeDomainId],
  )

  const value = useMemo(() => ({ state, dispatch, activeDomain }), [state, activeDomain])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
