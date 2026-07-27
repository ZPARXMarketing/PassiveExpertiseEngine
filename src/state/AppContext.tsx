import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { FeedItem } from '../data/types'
import { todaysThread } from '../data/feed'
import { lessonById } from '../data/lessons'

export type Tab = 'feed' | 'map' | 'you'

export interface PlayerState {
  lessonId: string
  beat: number
  sourceItemId: string
}

export interface AppState {
  tab: Tab
  player: PlayerState | null
  tutorFromBeat: number | null // non-null = tutor sheet open, remembering the beat
  /** Open unit path (roadmap drill-in). Null = closed. */
  pathUnitId: string | null
  /** Concept overview sheet within the open path. */
  pathConceptId: string | null
  completedLessons: string[]
  checkAnswers: Record<string, number> // feed item id -> chosen option index
  revealedRefreshes: string[]
  queuedLessonIds: string[] // queued from the path, surfaced atop the feed
  toast: string | null
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'openLesson'; lessonId: string; itemId: string }
  | { type: 'closePlayer' }
  | { type: 'setBeat'; beat: number }
  | { type: 'completeLesson'; lessonId: string; itemId: string; answer: number }
  | { type: 'openTutor'; beat: number }
  | { type: 'closeTutor' }
  | { type: 'answerCheck'; itemId: string; answer: number }
  | { type: 'revealRefresh'; itemId: string }
  | { type: 'openPath'; unitId: string }
  | { type: 'closePath' }
  | { type: 'openConceptOverview'; conceptId: string }
  | { type: 'closeConceptOverview' }
  | { type: 'queueLesson'; lessonId: string }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'resetProgress' }

const PERSIST_KEY = 'pee-progress-v1'

type Persisted = Pick<
  AppState,
  'completedLessons' | 'checkAnswers' | 'revealedRefreshes' | 'queuedLessonIds'
>

const emptyProgress: Persisted = {
  completedLessons: [],
  checkAnswers: {},
  revealedRefreshes: [],
  queuedLessonIds: [],
}

const loadProgress = (): Persisted => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return emptyProgress
    return { ...emptyProgress, ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    return emptyProgress
  }
}

const initialState: AppState = {
  tab: 'feed',
  player: null,
  tutorFromBeat: null,
  pathUnitId: null,
  pathConceptId: null,
  toast: null,
  ...loadProgress(),
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab }
    case 'openLesson':
      return {
        ...state,
        player: { lessonId: action.lessonId, beat: 0, sourceItemId: action.itemId },
        tutorFromBeat: null,
      }
    case 'closePlayer':
      return { ...state, player: null, tutorFromBeat: null }
    case 'setBeat':
      return state.player ? { ...state, player: { ...state.player, beat: action.beat } } : state
    case 'completeLesson':
      return {
        ...state,
        player: null,
        tutorFromBeat: null,
        completedLessons: state.completedLessons.includes(action.lessonId)
          ? state.completedLessons
          : [...state.completedLessons, action.lessonId],
        checkAnswers: { ...state.checkAnswers, [action.itemId]: action.answer },
        toast: 'Lesson locked in — back to the thread',
      }
    case 'openTutor':
      return { ...state, tutorFromBeat: action.beat }
    case 'closeTutor':
      return { ...state, tutorFromBeat: null }
    case 'answerCheck':
      return { ...state, checkAnswers: { ...state.checkAnswers, [action.itemId]: action.answer } }
    case 'revealRefresh':
      return state.revealedRefreshes.includes(action.itemId)
        ? state
        : { ...state, revealedRefreshes: [...state.revealedRefreshes, action.itemId] }
    case 'openPath':
      return { ...state, pathUnitId: action.unitId, pathConceptId: null }
    case 'closePath':
      return { ...state, pathUnitId: null, pathConceptId: null }
    case 'openConceptOverview':
      return { ...state, pathConceptId: action.conceptId }
    case 'closeConceptOverview':
      return { ...state, pathConceptId: null }
    case 'queueLesson':
      if (
        state.queuedLessonIds.includes(action.lessonId) ||
        state.completedLessons.includes(action.lessonId)
      ) {
        return { ...state, toast: 'Already in your thread' }
      }
      return {
        ...state,
        queuedLessonIds: [...state.queuedLessonIds, action.lessonId],
        pathConceptId: null,
        pathUnitId: null,
        tab: 'feed',
        toast: `Queued next in your feed: ${lessonById(action.lessonId).title}`,
      }
    case 'showToast':
      return { ...state, toast: action.message }
    case 'clearToast':
      return { ...state, toast: null }
    case 'resetProgress':
      return { ...initialState, ...emptyProgress, tab: 'you', toast: 'Progress reset' }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
  feedItems: FeedItem[]
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const { completedLessons, checkAnswers, revealedRefreshes, queuedLessonIds } = state
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ completedLessons, checkAnswers, revealedRefreshes, queuedLessonIds }),
    )
  }, [state])

  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'clearToast' }), 2600)
    return () => clearTimeout(t)
  }, [state.toast])

  const feedItems = useMemo<FeedItem[]>(() => {
    const queued: FeedItem[] = state.queuedLessonIds.map((lessonId) => ({
      kind: 'lesson',
      id: `queued-${lessonId}`,
      lessonId,
      queuedByUser: true,
    }))
    return [...queued, ...todaysThread]
  }, [state.queuedLessonIds])

  const value = useMemo(() => ({ state, dispatch, feedItems }), [state, feedItems])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
