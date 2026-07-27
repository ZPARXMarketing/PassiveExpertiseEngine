import { useState } from 'react'
import { useApp } from '../state/AppContext'
import type { BlueprintNode } from '../data/types'

function nodeFill(n: BlueprintNode): string {
  if (n.status === 'locked') return 'var(--text-faint)'
  if (n.status === 'mastered') return 'var(--neon)'
  if (n.status === 'learning') return 'var(--cyan)'
  return 'var(--violet)'
}

export function BlueprintScreen() {
  const { activeSubject, dispatch } = useApp()
  const [selected, setSelected] = useState<string | null>(null)

  if (!activeSubject) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create or select a project on Subjects first.</p>
      </main>
    )
  }

  const { nodes, edges } = activeSubject.blueprint
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const sel = nodes.find((n) => n.id === selected) ?? null

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">metalearning · curriculum aggregator</div>
        <h1 className="feed-title">Blueprint</h1>
        <p className="page-lead">
          80/20 dependency graph for <strong>{activeSubject.title}</strong>. Core nodes glow.
          Tap a node to open its practice task in Terminal.
        </p>
      </header>

      <div className="blueprint-layout">
        <div className="card blueprint-canvas">
          <svg className="blueprint-svg" viewBox="0 0 260 300" role="img" aria-label="Skill blueprint">
            {edges.map((e) => {
              const a = byId[e.from]
              const b = byId[e.to]
              if (!a || !b) return null
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={e.locked ? 'var(--text-faint)' : 'rgba(42,255,163,0.35)'}
                  strokeWidth={e.locked ? 1 : 1.5}
                  strokeDasharray={e.locked ? '4 4' : undefined}
                />
              )
            })}
            {nodes.map((n) => (
              <g
                key={n.id}
                className={`bp-node${n.is8020 ? ' core' : ''}${selected === n.id ? ' sel' : ''}`}
                onClick={() => setSelected(n.id)}
                style={{ cursor: n.status === 'locked' ? 'default' : 'pointer' }}
              >
                {n.is8020 && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={18}
                    fill="none"
                    stroke="var(--neon)"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={11}
                  fill={nodeFill(n)}
                  opacity={n.status === 'locked' ? 0.35 : 1}
                />
                <text
                  x={n.x + (n.labelDx ?? 14)}
                  y={n.y + (n.labelDy ?? 4)}
                  className={n.status === 'locked' ? 'locked' : n.status === 'learning' ? 'now' : ''}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
          <div className="const-legend">
            <span>● mastered</span>
            <span style={{ color: 'var(--cyan)' }}>● learning</span>
            <span style={{ color: 'var(--violet)' }}>● available</span>
            <span>◎ 80/20 core</span>
          </div>
        </div>

        <aside className="card blueprint-detail">
          {sel ? (
            <>
              <div className="tag neon">{sel.is8020 ? '80/20 core' : 'node'}</div>
              <h2 className="card-title">{sel.label}</h2>
              <div className="detail-rows">
                <div>
                  <span className="stat-label">status</span>
                  <div>{sel.status}</div>
                </div>
                <div>
                  <span className="stat-label">retention</span>
                  <div className="stat-num" style={{ fontSize: 20 }}>
                    {Math.round(sel.retention)}%
                  </div>
                </div>
              </div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${sel.retention}%` }} />
              </div>
              {sel.status === 'locked' ? (
                <p className="card-sub">Locked — clear prerequisites first.</p>
              ) : sel.taskId ? (
                <button
                  type="button"
                  className="pill primary"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => dispatch({ type: 'openTask', taskId: sel.taskId! })}
                >
                  Open Terminal task
                </button>
              ) : (
                <p className="card-sub">No practice task wired — drill this on Dashboard.</p>
              )}
            </>
          ) : (
            <>
              <div className="feed-kicker">select a node</div>
              <p className="card-sub">
                Core nodes (ringed) are the leverage points. Learning nodes are your current
                edge.
              </p>
              <ul className="core-list">
                {nodes
                  .filter((n) => n.is8020)
                  .map((n) => (
                    <li key={n.id}>
                      <button type="button" className="text-btn" onClick={() => setSelected(n.id)}>
                        {n.label} · {Math.round(n.retention)}%
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
