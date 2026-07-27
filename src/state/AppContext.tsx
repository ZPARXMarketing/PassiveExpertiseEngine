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
  Drill,
  DrillScore,
  PnlTag,
  Subject,
  ViewId,
} from '../data/types'
import { createSeedSubjects, subjectFromGoal } from '../data/subjects'
import type { SrsCard } from '../data/types'

const PERSIST_KEY = 'pee-v2'

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

export interface AppState {
  view: AppView
  subjects: Subject[]
  activeSubjectId: string | null
  openTaskId: string | null
  /** pnl tags for active csv task */
  pnlTags: Record<string, PnlTag>
  taskDraft: string
  sessionActiveSec: number
  sessionIdleSec: number
  sessionRunning: boolean
  sessionIdle: boolean
  feynmanDraft: string
  feynmanResult: 'pass' | 'fail' | null
  activeSynthId: string | null
  reviewIndex: number
  cardFlipped: boolean
  drill: DrillSession | null
  toast: string | null
}

export type Action =
  | { type: 'setView'; view: AppView }
  | { type: 'setActiveSubject'; id: string }
  | { type: 'createSubject'; goal: string }
  | { type: 'deleteSubject'; id: string }
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
  | { type: 'setActiveSynth'; id: string | null }
  | { type: 'setFeynmanDraft'; text: string }
  | { type: 'submitFeynman'; pass: boolean; feedback: string }
  | { type: 'flipCard' }
  | { type: 'reviewCard'; grade: 'again' | 'good' | 'easy' }
  | { type: 'startDrill'; drill: Drill; firstPrompt?: string; firstAnswer?: number; tolerance?: number }
  | { type: 'setDrillQuestion'; prompt: string; answer: number; tolerance: number }
  | { type: 'answerDrill'; correct: boolean; nextPrompt?: string; nextAnswer?: number; nextTolerance?: number }
  | { type: 'endDrill' }
  | { type: 'bumpRetention'; conceptId: string; delta: number }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'resetProgress' }

type Persisted = Pick<AppState, 'subjects' | 'activeSubjectId' | 'view'>

function load(): Persisted {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) {
      const subjects = createSeedSubjects()
      return { subjects, activeSubjectId: subjects[0]?.id ?? null, view: 'subjects' }
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>
    if (!parsed.subjects?.length) {
      const subjects = createSeedSubjects()
      return { subjects, activeSubjectId: subjects[0]?.id ?? null, view: 'subjects' }
    }
    return {
      subjects: parsed.subjects,
      activeSubjectId: parsed.activeSubjectId ?? parsed.subjects[0]?.id ?? null,
      view: parsed.view ?? 'subjects',
    }
  } catch {
    const subjects = createSeedSubjects()
    return { subjects, activeSubjectId: subjects[0]?.id ?? null, view: 'subjects' }
  }
}

const loaded = load()

const initialState: AppState = {
  view: loaded.view,
  subjects: loaded.subjects,
  activeSubjectId: loaded.activeSubjectId,
  openTaskId: null,
  pnlTags: {},
  taskDraft: '',
  sessionActiveSec: 0,
  sessionIdleSec: 0,
  sessionRunning: false,
  sessionIdle: false,
  feynmanDraft: '',
  feynmanResult: null,
  activeSynthId: null,
  reviewIndex: 0,
  cardFlipped: false,
  drill: null,
  toast: null,
}

function updateSubject(subjects: Subject[], id: string, fn: (s: Subject) => Subject): Subject[] {
  return subjects.map((s) => (s.id === id ? fn(s) : s))
}

function scheduleCard(card: SrsCard, grade: 'again' | 'good' | 'easy'): SrsCard {
  let { ease, intervalDays, reps } = card
  if (grade === 'again') {
    intervalDays = 0
    ease = Math.max(1.3, ease - 0.2)
    reps = 0
  } else if (grade === 'good') {
    intervalDays = reps === 0 ? 1 : Math.max(1, Math.round(intervalDays * ease))
    reps += 1
  } else {
    intervalDays = reps === 0 ? 3 : Math.max(2, Math.round(intervalDays * ease * 1.3))
    ease += 0.15
    reps += 1
  }
  const due = new Date()
  due.setDate(due.getDate() + intervalDays)
  if (grade === 'again') due.setTime(Date.now() + 10 * 60_000)
  return { ...card, ease, intervalDays, reps, dueAt: due.toISOString() }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setView':
      return { ...state, view: action.view, drill: null }
    case 'setActiveSubject':
      return {
        ...state,
        activeSubjectId: action.id,
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
        sessionRunning: false,
        feynmanDraft: '',
        feynmanResult: null,
        activeSynthId: null,
        reviewIndex: 0,
        cardFlipped: false,
        drill: null,
      }
    case 'createSubject': {
      const subject = subjectFromGoal(action.goal)
      return {
        ...state,
        subjects: [...state.subjects, subject],
        activeSubjectId: subject.id,
        view: 'blueprint',
        toast: `Project created: ${subject.title}`,
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
      }
    }
    case 'deleteSubject': {
      const subjects = state.subjects.filter((s) => s.id !== action.id)
      const activeSubjectId =
        state.activeSubjectId === action.id ? (subjects[0]?.id ?? null) : state.activeSubjectId
      return { ...state, subjects, activeSubjectId, toast: 'Project removed' }
    }
    case 'openTask': {
      const sub = state.subjects.find((s) => s.id === state.activeSubjectId)
      const task = sub?.tasks.find((t) => t.id === action.taskId)
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
      return { ...state, openTaskId: null, sessionRunning: false }
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
      if (!state.activeSubjectId) return state
      const active = state.sessionActiveSec
      const idle = state.sessionIdleSec
      return {
        ...state,
        sessionRunning: false,
        subjects: updateSubject(state.subjects, state.activeSubjectId, (s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            sessionSecondsActive: s.metrics.sessionSecondsActive + active,
            sessionSecondsIdle: s.metrics.sessionSecondsIdle + idle,
            sessionLog: [
              ...s.metrics.sessionLog,
              { at: new Date().toISOString(), activeSec: active, idleSec: idle },
            ],
          },
        })),
      }
    }
    case 'submitTask': {
      if (!state.activeSubjectId || !state.openTaskId) return state
      const taskId = state.openTaskId
      const conceptId =
        state.subjects
          .find((s) => s.id === state.activeSubjectId)
          ?.tasks.find((t) => t.id === taskId)?.conceptId ?? null
      return {
        ...state,
        openTaskId: action.pass ? null : state.openTaskId,
        sessionRunning: !action.pass,
        toast: action.message,
        subjects: updateSubject(state.subjects, state.activeSubjectId, (s) => {
          const tasksCompleted = action.pass
            ? s.metrics.tasksCompleted.includes(taskId)
              ? s.metrics.tasksCompleted
              : [...s.metrics.tasksCompleted, taskId]
            : s.metrics.tasksCompleted
          const nodes = s.blueprint.nodes.map((n) => {
            if (!action.pass || n.id !== conceptId) return n
            return {
              ...n,
              status: n.status === 'locked' ? n.status : 'mastered',
              retention: Math.min(100, n.retention + 18),
            } as typeof n
          })
          return {
            ...s,
            blueprint: { ...s.blueprint, nodes },
            metrics: {
              ...s.metrics,
              tasksCompleted,
              sessionSecondsActive: s.metrics.sessionSecondsActive + state.sessionActiveSec,
              sessionSecondsIdle: s.metrics.sessionSecondsIdle + state.sessionIdleSec,
            },
          }
        }),
        sessionActiveSec: action.pass ? 0 : state.sessionActiveSec,
        sessionIdleSec: action.pass ? 0 : state.sessionIdleSec,
      }
    }
    case 'setActiveSynth':
      if (action.id === state.activeSynthId) return state
      return {
        ...state,
        activeSynthId: action.id,
        // Keep draft when first binding a prompt; clear only when switching prompts.
        feynmanDraft: state.activeSynthId === null ? state.feynmanDraft : '',
        feynmanResult: null,
      }
    case 'setFeynmanDraft':
      return { ...state, feynmanDraft: action.text }
    case 'submitFeynman': {
      if (!state.activeSubjectId || !state.activeSynthId) return state
      const synthId = state.activeSynthId
      const sub = state.subjects.find((s) => s.id === state.activeSubjectId)!
      const prompt = sub.synthPrompts.find((p) => p.id === synthId)
      if (!prompt) return state

      if (!action.pass) {
        return { ...state, feynmanResult: 'fail', toast: action.feedback }
      }

      const existingIds = new Set(sub.srs.map((c) => c.id))
      const newCards: SrsCard[] = prompt.cardsOnPass
        .filter((c) => !existingIds.has(c.id))
        .map((c) => ({
          ...c,
          ease: 2.5,
          intervalDays: 0,
          dueAt: new Date().toISOString(),
          reps: 0,
        }))

      return {
        ...state,
        feynmanResult: 'pass',
        toast: action.feedback,
        subjects: updateSubject(state.subjects, state.activeSubjectId, (s) => ({
          ...s,
          srs: [...s.srs, ...newCards],
          metrics: {
            ...s.metrics,
            synthPassed: s.metrics.synthPassed.includes(synthId)
              ? s.metrics.synthPassed
              : [...s.metrics.synthPassed, synthId],
          },
          blueprint: {
            ...s.blueprint,
            nodes: s.blueprint.nodes.map((n) =>
              n.id === prompt.conceptId
                ? { ...n, retention: Math.min(100, n.retention + 12), status: 'mastered' as const }
                : n,
            ),
          },
        })),
      }
    }
    case 'flipCard':
      return { ...state, cardFlipped: !state.cardFlipped }
    case 'reviewCard': {
      if (!state.activeSubjectId) return state
      const sub = state.subjects.find((s) => s.id === state.activeSubjectId)!
      const due = [...sub.srs]
        .filter((c) => new Date(c.dueAt).getTime() <= Date.now())
        .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
      const card = due[state.reviewIndex]
      if (!card) return state
      const graded = scheduleCard(card, action.grade)
      const subjects = updateSubject(state.subjects, state.activeSubjectId, (s) => ({
        ...s,
        srs: s.srs.map((c) => (c.id === card.id ? graded : c)),
        blueprint: {
          ...s.blueprint,
          nodes: s.blueprint.nodes.map((n) =>
            n.id === card.conceptId
              ? {
                  ...n,
                  retention: Math.min(
                    100,
                    n.retention + (action.grade === 'again' ? -8 : action.grade === 'good' ? 6 : 10),
                  ),
                }
              : n,
          ),
        },
      }))
      const nextDue = subjects
        .find((s) => s.id === state.activeSubjectId)!
        .srs.filter((c) => new Date(c.dueAt).getTime() <= Date.now())
      return {
        ...state,
        subjects,
        cardFlipped: false,
        reviewIndex: Math.min(state.reviewIndex, Math.max(0, nextDue.length - 1)),
        toast:
          action.grade === 'again'
            ? 'Back soon — interval reset'
            : `Next review in ${graded.intervalDays || '<1'}d`,
      }
    }
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
      if (!state.drill || !state.activeSubjectId) return state
      const correct = state.drill.correct + (action.correct ? 1 : 0)
      const total = state.drill.total + 1
      const sub = state.subjects.find((s) => s.id === state.activeSubjectId)!
      const drill = sub.drills.find((d) => d.id === state.drill!.drillId)
      const rounds =
        drill?.kind === 'rapid-calc' ? (drill.spec as { rounds: number }).rounds : 1
      const done = total >= rounds || Date.now() > state.drill.endsAt

      if (done) {
        const score: DrillScore = {
          drillId: state.drill.drillId,
          correct,
          total,
          at: new Date().toISOString(),
        }
        const conceptId = drill?.conceptId
        return {
          ...state,
          drill: null,
          toast: `Drill done — ${correct}/${total}`,
          subjects: updateSubject(state.subjects, state.activeSubjectId, (s) => ({
            ...s,
            metrics: { ...s.metrics, drillScores: [...s.metrics.drillScores, score] },
            blueprint: {
              ...s.blueprint,
              nodes: s.blueprint.nodes.map((n) =>
                n.id === conceptId
                  ? {
                      ...n,
                      retention: Math.min(
                        100,
                        Math.max(0, n.retention + (correct / Math.max(1, total)) * 20 - 4),
                      ),
                    }
                  : n,
              ),
            },
          })),
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
    case 'bumpRetention': {
      if (!state.activeSubjectId) return state
      return {
        ...state,
        subjects: updateSubject(state.subjects, state.activeSubjectId, (s) => ({
          ...s,
          blueprint: {
            ...s.blueprint,
            nodes: s.blueprint.nodes.map((n) =>
              n.id === action.conceptId
                ? {
                    ...n,
                    retention: Math.min(100, Math.max(0, n.retention + action.delta)),
                  }
                : n,
            ),
          },
        })),
      }
    }
    case 'showToast':
      return { ...state, toast: action.message }
    case 'clearToast':
      return { ...state, toast: null }
    case 'resetProgress': {
      if (!state.activeSubjectId) return state
      const fresh = subjectFromGoal(
        state.subjects.find((s) => s.id === state.activeSubjectId)?.goal ?? 'reset',
      )
      fresh.id = state.activeSubjectId
      fresh.title = state.subjects.find((s) => s.id === state.activeSubjectId)?.title ?? fresh.title
      return {
        ...state,
        subjects: state.subjects.map((s) => (s.id === state.activeSubjectId ? fresh : s)),
        openTaskId: null,
        pnlTags: {},
        taskDraft: '',
        feynmanDraft: '',
        feynmanResult: null,
        drill: null,
        toast: 'Active project progress reset',
      }
    }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
  activeSubject: Subject | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const payload: Persisted = {
      subjects: state.subjects,
      activeSubjectId: state.activeSubjectId,
      view: state.view,
    }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload))
  }, [state.subjects, state.activeSubjectId, state.view])

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

  // Idle after 45s without interaction while session running
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

  const activeSubject = useMemo(
    () => state.subjects.find((s) => s.id === state.activeSubjectId) ?? null,
    [state.subjects, state.activeSubjectId],
  )

  const value = useMemo(
    () => ({ state, dispatch, activeSubject }),
    [state, activeSubject],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
