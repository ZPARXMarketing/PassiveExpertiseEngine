import { useApp } from '../state/AppContext'
import { totalThreadMinutes } from '../data/feed'
import { LessonCard } from './LessonCard'
import { QuickCheckCard } from './QuickCheckCard'
import { RefreshCard } from './RefreshCard'

export function FeedScreen() {
  const { state, feedItems } = useApp()

  const done = feedItems.every((item) => {
    if (item.kind === 'lesson') return state.completedLessons.includes(item.lessonId)
    if (item.kind === 'quickCheck') return item.id in state.checkAnswers
    return state.revealedRefreshes.includes(item.id)
  })

  return (
    <main className="screen">
      <header className="feed-header">
        <div className="feed-kicker">Small-business finance · unit 2</div>
        <h1 className="feed-title">
          Today's thread <span>· {totalThreadMinutes} min</span>
        </h1>
      </header>

      {feedItems.map((item) => {
        switch (item.kind) {
          case 'lesson':
            return <LessonCard key={item.id} item={item} />
          case 'quickCheck':
            return <QuickCheckCard key={item.id} item={item} />
          case 'refresh':
            return <RefreshCard key={item.id} item={item} />
        }
      })}

      {done && (
        <div className="card end-card">
          <div className="card-title">Thread complete ✦</div>
          <div className="card-sub">
            The engine is composing your next thread — expected in your next idle window, ~2h.
          </div>
        </div>
      )}
    </main>
  )
}
