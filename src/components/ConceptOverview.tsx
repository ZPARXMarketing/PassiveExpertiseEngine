import type { BlueprintNode } from '../data/types'
import { useApp } from '../state/AppContext'

const statusLabel = (status: BlueprintNode['status']) => {
  switch (status) {
    case 'mastered':
      return 'mastered'
    case 'learning':
      return 'in progress'
    case 'available':
      return 'ready'
    case 'locked':
      return 'locked'
  }
}

export function ConceptOverview({
  node,
  onClose,
}: {
  node: BlueprintNode
  onClose: () => void
}) {
  const { dispatch } = useApp()

  const openTask = () => {
    if (node.status === 'locked') {
      dispatch({
        type: 'showToast',
        message: `${node.label.replace(' 🔒', '')} is locked — finish prerequisites first`,
      })
      return
    }
    if (!node.taskId) {
      dispatch({
        type: 'showToast',
        message: 'No practice task wired — try a drill on Dashboard',
      })
      return
    }
    dispatch({ type: 'openTask', taskId: node.taskId })
  }

  const cta =
    node.status === 'locked'
      ? 'Locked — finish prerequisites'
      : node.taskId
        ? 'Open Terminal task'
        : 'No task yet — use Dashboard drills'

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="concept-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-overview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        <div className="concept-sheet-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="tag neon">{node.is8020 ? '80/20 core' : 'node'}</span>
            <span className={`path-step-status path-step-status--${node.status}`}>
              {node.status === 'locked' ? '🔒 ' : ''}
              {statusLabel(node.status)}
            </span>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close overview">
            ✕
          </button>
        </div>

        <h2 id="concept-overview-title" className="concept-sheet-title">
          {node.label.replace(' 🔒', '')}
        </h2>
        {node.summary && <p className="card-sub" style={{ marginTop: 6 }}>{node.summary}</p>}

        <div className="feed-kicker" style={{ marginTop: 14 }}>
          what you&apos;ll learn
        </div>
        <p className="path-overview-body">
          {node.overview ??
            (node.status === 'locked'
              ? 'Locked until prerequisites are clear. Finish the open nodes feeding this one.'
              : 'Practice this node in Terminal or drill it on Dashboard to lock it in.')}
        </p>

        {node.learnAbout && node.learnAbout.length > 0 && (
          <>
            <div className="feed-kicker" style={{ marginTop: 16 }}>
              covered on this stop
            </div>
            <ul className="path-goals concept-learn-list">
              {node.learnAbout.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}

        <div className="detail-rows" style={{ marginTop: 14 }}>
          <div>
            <span className="stat-label">status</span>
            <div>{node.status}</div>
          </div>
          <div>
            <span className="stat-label">retention</span>
            <div className="stat-num" style={{ fontSize: 20 }}>
              {Math.round(node.retention)}%
            </div>
          </div>
        </div>
        <div className="progress-track" style={{ marginTop: 8 }}>
          <div className="progress-fill" style={{ width: `${node.retention}%` }} />
        </div>

        <button
          type="button"
          className={`concept-cta${node.status === 'locked' || !node.taskId ? ' dim' : ''}`}
          onClick={openTask}
        >
          {cta}
        </button>
      </div>
    </div>
  )
}
