import { useApp } from '../state/AppContext'
import type { FeedItem } from '../data/types'

export function RefreshCard({ item }: { item: Extract<FeedItem, { kind: 'refresh' }> }) {
  const { state, dispatch } = useApp()
  const revealed = state.revealedRefreshes.includes(item.id)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tag">{item.durationSec}s refresh · {item.daysAgo}d ago</span>
      </div>
      <div className="card-title" style={{ fontSize: 15.5 }}>
        {item.title}
      </div>
      <div className="card-sub">{item.prompt}</div>
      {revealed ? (
        <div className="reveal-body">{item.reveal}</div>
      ) : (
        <>
          <div className="card-hint">say it in your head, then reveal</div>
          <button
            className="pill primary"
            onClick={() => dispatch({ type: 'revealRefresh', itemId: item.id })}
          >
            reveal
          </button>
        </>
      )}
    </div>
  )
}
