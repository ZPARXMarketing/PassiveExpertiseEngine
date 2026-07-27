import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { FeedItem } from '../data/types'
import { todaysThread } from '../data/feed'
import { lessonById, lessons } from '../data/lessons'

const VALID_LESSON_IDS = new Set(lessons.map((l) => l.id))

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
  constellationUnitId: string | null
  completedLessons: string[]
  checkAnswers: Record<string, number> // feed item id -> chosen option index
  revealedRefreshes: string[]
  queuedLessonIds: string[] // queued from the constellation, surfaced atop the feed
  toast: string | null
  /** False until onboarding finishes (or user skips via legacy progress). */
  onboarded: boolean
  subjectId: string
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
  | { type: 'openConstellation'; unitId: string }
  | { type: 'closeConstellation' }
  | { type: 'queueLesson'; lessonId: string }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'completeOnboarding'; subjectId: string }
  | { type: 'restartOnboarding' }
  | { type: 'resetProgress' }

const PERSIST_KEY = 'pee-progress-v1'

type Persisted = Pick<
  AppState,
  'completedLessons' | 'checkAnswers' | 'revealedRefreshes' | 'queuedLessonIds' | 'onboarded' | 'subjectId'
>

const emptyProgress: Persisted = {
  completedLessons: [],
  checkAnswers: {},
  revealedRefreshes: [],
  queuedLessonIds: [],
  onboarded: false,
  subjectId: 'smb-finance',
}

const loadProgress = (): Persisted => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<Persisted>
    // Existing demos that already have progress skip onboarding once.
    const hasProgress =
      (parsed.completedLessons?.length ?? 0) > 0 ||
      Object.keys(parsed.checkAnswers ?? {}).length > 0 ||
      (parsed.revealedRefreshes?.length ?? 0) > 0 ||
      (parsed.queuedLessonIds?.length ?? 0) > 0
    // Migrate pre-finance prototype subject id + drop stale lesson ids.
    const subjectId =
      !parsed.subjectId || parsed.subjectId === 'quantum' ? 'smb-finance' : parsed.subjectId
    return {
      ...emptyProgress,
      ...parsed,
      onboarded: parsed.onboarded ?? hasProgress,
      subjectId,
      completedLessons: (parsed.completedLessons ?? []).filter((id) => VALID_LESSON_IDS.has(id)),
      queuedLessonIds: (parsed.queuedLessonIds ?? []).filter((id) => VALID_LESSON_IDS.has(id)),
    }
  } catch {
    return emptyProgress
  }
}

const initialState: AppState = {
  tab: 'feed',
  player: null,
  tutorFromBeat: null,
  constellationUnitId: null,
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
    case 'openConstellation':
      return { ...state, constellationUnitId: action.unitId }
    case 'closeConstellation':
      return { ...state, constellationUnitId: null }
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
        constellationUnitId: null,
        tab: 'feed',
        toast: `Queued next in your feed: ${lessonById(action.lessonId).title}`,
      }
    case 'showToast':
      return { ...state, toast: action.message }
    case 'clearToast':
      return { ...state, toast: null }
    case 'completeOnboarding':
      return {
        ...state,
        onboarded: true,
        subjectId: action.subjectId,
        tab: 'feed',
        toast: 'Your map is ready — first thread below',
      }
    case 'restartOnboarding':
      return {
        ...state,
        ...emptyProgress,
        onboarded: false,
        player: null,
        tutorFromBeat: null,
        constellationUnitId: null,
        toast: null,
      }
    case 'resetProgress':
      return {
        ...state,
        ...emptyProgress,
        onboarded: true,
        subjectId: state.subjectId,
        tab: 'you',
        player: null,
        tutorFromBeat: null,
        constellationUnitId: null,
        toast: 'Progress reset',
      }
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
    const {
      completedLessons,
      checkAnswers,
      revealedRefreshes,
      queuedLessonIds,
      onboarded,
      subjectId,
    } = state
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        completedLessons,
        checkAnswers,
        revealedRefreshes,
        queuedLessonIds,
        onboarded,
        subjectId,
      }),
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
