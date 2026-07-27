import { useApp } from '../state/AppContext'
import { conceptById } from '../data/knowledgeMap'
import { lessonById } from '../data/lessons'
import type { NodeStatus } from '../data/types'

export function ConceptOverview({
  unitId,
  conceptId,
}: {
  unitId: string
  conceptId: string
}) {
  const { state, dispatch } = useApp()
  const concept = conceptById(unitId, conceptId)

  const status: NodeStatus =
    concept.lessonId && state.completedLessons.includes(concept.lessonId)
      ? 'mastered'
      : concept.status

  const lesson = concept.lessonId
    ? (() => {
        try {
          return lessonById(concept.lessonId)
        } catch {
          return null
        }
      })()
    : null

  const queued = concept.lessonId
    ? state.queuedLessonIds.includes(concept.lessonId)
    : false

  const primaryAction = () => {
    if (status === 'locked') {
      dispatch({
        type: 'showToast',
        message: `${concept.title} is locked — finish its prerequisites first`,
      })
      return
    }
    if (status === 'mastered') {
      dispatch({
        type: 'showToast',
        message: 'Mastered — it will resurface as a refresh when it starts to fade',
      })
      return
    }
    if (concept.lessonId) {
      if (queued) {
        dispatch({ type: 'showToast', message: 'Already in your thread' })
        return
      }
      dispatch({ type: 'queueLesson', lessonId: concept.lessonId })
      return
    }
    dispatch({
      type: 'showToast',
      message: 'Lesson for this concept is still being composed',
    })
  }

  const ctaLabel = () => {
    if (status === 'locked') return 'Locked — finish prerequisites'
    if (status === 'mastered') return 'Already mastered'
    if (queued) return 'Already queued in feed'
    if (concept.lessonId) return 'Queue in today\'s feed'
    return 'Coming soon'
  }

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={() => dispatch({ type: 'closeConceptOverview' })}
    >
      <div
        className="concept-sheet"
        role="dialog"
        aria-labelledby="concept-overview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        <div className="concept-sheet-head">
          <span className={`path-step-status path-step-status--${status}`}>
            {status === 'locked' ? '🔒 ' : ''}
            {status}
          </span>
          <button
            type="button"
            className="sheet-close"
            onClick={() => dispatch({ type: 'closeConceptOverview' })}
          >
            ✕
          </button>
        </div>

        <h2 id="concept-overview-title" className="concept-sheet-title">
          {concept.title}
        </h2>

        {lesson && (
          <div className="concept-lesson-meta">
            <span className="tag cyan">{lesson.durationSec}s lesson</span>
            {lesson.whyNow && <span className="card-sub">why now: {lesson.whyNow}</span>}
          </div>
        )}

        <div className="feed-kicker" style={{ marginTop: 14 }}>
          what you&apos;ll learn
        </div>
        <p className="path-overview-body">{concept.overview}</p>

        <div className="feed-kicker" style={{ marginTop: 16 }}>
          covered on this stop
        </div>
        <ul className="path-goals concept-learn-list">
          {concept.learnAbout.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <button
          type="button"
          className={`concept-cta${status === 'locked' || status === 'mastered' || queued ? ' dim' : ''}`}
          onClick={primaryAction}
        >
          {ctaLabel()}
        </button>
      </div>
    </div>
  )
}
