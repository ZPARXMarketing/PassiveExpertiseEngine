import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { FeedItem } from '../data/types'
import type { Benchmark, Component, Resource } from '../data/blueprints'
import { todaysThread } from '../data/feed'
import { lessonById } from '../data/lessons'

export type Tab = 'feed' | 'map' | 'you'

export interface PlayerState {
  lessonId: string
  beat: number
  sourceItemId: string
}

/** A course the user mapped via the 80/20 audit — a self-contained snapshot. */
export interface MappedCourse {
  id: string
  blueprintId: string
  subject: string
  field: string
  oneLiner: string
  isTemplate?: boolean
  totalHours: number
  mappingHours: number // 10% of total (Young's rule)
  benchmarks: Benchmark[]
  resources: Resource[]
  components: Component[] // the full deconstruction
  selectedIds: string[] // the vital ~20% the user kept
  createdAt: number
}

export interface AppState {
  tab: Tab
  player: PlayerState | null
  tutorFromBeat: number | null // non-null = tutor sheet open, remembering the beat
  constellationUnitId: string | null
  onboardingOpen: boolean // the "Map a course" 80/20 audit flow
  cheatSheetCourseId: string | null // viewing a mapped course's one-page sheet
  mappedCourses: MappedCourse[]
  completedLessons: string[]
  checkAnswers: Record<string, number> // feed item id -> chosen option index
  revealedRefreshes: string[]
  queuedLessonIds: string[] // queued from the constellation, surfaced atop the feed
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
  | { type: 'openConstellation'; unitId: string }
  | { type: 'closeConstellation' }
  | { type: 'queueLesson'; lessonId: string }
  | { type: 'openOnboarding' }
  | { type: 'closeOnboarding' }
  | { type: 'saveCourse'; course: MappedCourse }
  | { type: 'viewCheatSheet'; courseId: string }
  | { type: 'closeCheatSheet' }
  | { type: 'removeCourse'; courseId: string }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'resetProgress' }

const PERSIST_KEY = 'pee-progress-v1'

type Persisted = Pick<
  AppState,
  'completedLessons' | 'checkAnswers' | 'revealedRefreshes' | 'queuedLessonIds' | 'mappedCourses'
>

const emptyProgress: Persisted = {
  completedLessons: [],
  checkAnswers: {},
  revealedRefreshes: [],
  queuedLessonIds: [],
  mappedCourses: [],
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
  constellationUnitId: null,
  onboardingOpen: false,
  cheatSheetCourseId: null,
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
    case 'openOnboarding':
      return { ...state, onboardingOpen: true }
    case 'closeOnboarding':
      return { ...state, onboardingOpen: false }
    case 'saveCourse':
      return {
        ...state,
        onboardingOpen: false,
        mappedCourses: [
          action.course,
          ...state.mappedCourses.filter((c) => c.id !== action.course.id),
        ],
        tab: 'map',
        cheatSheetCourseId: action.course.id,
        toast: `${action.course.subject} mapped — here's your one page`,
      }
    case 'viewCheatSheet':
      return { ...state, cheatSheetCourseId: action.courseId }
    case 'closeCheatSheet':
      return { ...state, cheatSheetCourseId: null }
    case 'removeCourse':
      return {
        ...state,
        cheatSheetCourseId: state.cheatSheetCourseId === action.courseId ? null : state.cheatSheetCourseId,
        mappedCourses: state.mappedCourses.filter((c) => c.id !== action.courseId),
        toast: 'Course removed',
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
    const { completedLessons, checkAnswers, revealedRefreshes, queuedLessonIds, mappedCourses } =
      state
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        completedLessons,
        checkAnswers,
        revealedRefreshes,
        queuedLessonIds,
        mappedCourses,
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
