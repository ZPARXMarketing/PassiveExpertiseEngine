import { useApp } from '../state/AppContext'
import { lessonById } from '../data/lessons'
import type { FeedItem } from '../data/types'

export function LessonCard({ item }: { item: Extract<FeedItem, { kind: 'lesson' }> }) {
  const { state, dispatch } = useApp()
  const lesson = lessonById(item.lessonId)
  const done = state.completedLessons.includes(item.lessonId)

  return (
    <button
      className={`card${done ? '' : ' highlight'}`}
      style={{ width: '100%' }}
      onClick={() => {
        if (!done) dispatch({ type: 'openLesson', lessonId: item.lessonId, itemId: item.id })
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {done ? (
          <span className="lesson-done-check">✓ locked in</span>
        ) : (
          <>
            <span className="tag neon">new · {lesson.durationSec}s</span>
            {item.queuedByUser && <span className="tag violet">queued by you</span>}
          </>
        )}
      </div>
      <div className="card-title" style={done ? { color: 'var(--text-dim)' } : undefined}>
        {lesson.title}
      </div>
      {!done && lesson.whyNow && <div className="card-sub">why now: {lesson.whyNow}</div>}
      {!done && <div className="card-hint">tap → opens the story player · stuck? summon the tutor</div>}
    </button>
  )
}
