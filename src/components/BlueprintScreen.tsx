import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { BlueprintNode, NodeStatus } from '../data/types'
import { ConceptOverview } from './ConceptOverview'

function nodeFill(n: BlueprintNode): string {
  if (n.status === 'locked') return 'var(--text-faint)'
  if (n.status === 'mastered') return 'var(--neon)'
  if (n.status === 'learning') return 'var(--cyan)'
  return 'var(--violet)'
}

const statusLabel = (status: NodeStatus): string => {
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

export function BlueprintScreen() {
  const { activeSubject } = useApp()
  const [selected, setSelected] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)

  // Reset selection when switching projects so overviews don't stick across subjects
  useEffect(() => {
    setSelected(null)
  }, [activeSubject?.id])

  if (!activeSubject) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create or select a project on Subjects first.</p>
      </main>
    )
  }

  const { nodes, edges, overview, goals } = activeSubject.blueprint
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const sel = nodes.find((n) => n.id === selected) ?? null
  const avgRetention = nodes.length
    ? Math.round(nodes.reduce((s, n) => s + n.retention, 0) / nodes.length)
    : 0

  const selectNode = (id: string) => {
    setSelected(id)
    // On tablet the side detail is in-view; on phone the sheet covers the gap
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">metalearning · curriculum aggregator</div>
        <h1 className="feed-title">Blueprint</h1>
        <p className="page-lead">
          Skill path for <strong>{activeSubject.title}</strong>. Read the path overview, then tap
          any concept for what you&apos;ll learn.
        </p>
      </header>

      <section className="card path-overview">
        <div className="feed-kicker">path overview</div>
        <p className="path-overview-body">
          {overview ??
            `Dependency graph and practice path for “${activeSubject.goal}”. Work core nodes first.`}
        </p>
        {goals && goals.length > 0 && (
          <ul className="path-goals">
            {goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
        <div className="path-overview-meta">
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${avgRetention}%` }} />
          </div>
          <span className="unit-pct">{avgRetention}% avg retention</span>
        </div>
      </section>

      <div className="path-section-label">concepts on this path</div>
      <div className="path-steps">
        {nodes.map((node, i) => (
          <button
            key={node.id}
            type="button"
            className={`card path-step path-step--${node.status}${selected === node.id ? ' path-step--selected' : ''}`}
            onClick={() => selectNode(node.id)}
          >
            <div className="path-step-rail" aria-hidden>
              <span className={`path-step-dot path-step-dot--${node.status}`} />
              {i < nodes.length - 1 && <span className="path-step-line" />}
            </div>
            <div className="path-step-body">
              <div className="row path-step-top">
                <span className="path-step-index">{String(i + 1).padStart(2, '0')}</span>
                <span className={`path-step-status path-step-status--${node.status}`}>
                  {node.status === 'locked' ? '🔒 ' : ''}
                  {statusLabel(node.status)}
                  {node.is8020 ? ' · 80/20' : ''}
                </span>
              </div>
              <div className="unit-name">{node.label}</div>
              {node.summary && <div className="card-sub">{node.summary}</div>}
              <div className="card-hint">tap → overview of what you&apos;ll learn</div>
            </div>
          </button>
        ))}
      </div>

      <div className="blueprint-layout" style={{ marginTop: 18 }}>
        <div className="card blueprint-canvas">
          <div className="feed-kicker" style={{ marginBottom: 6 }}>
            dependency graph
          </div>
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
                onClick={() => selectNode(n.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Larger invisible hit target so graph taps register reliably */}
                <circle cx={n.x} cy={n.y} r={22} fill="transparent" />
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

        <aside className="card blueprint-detail" ref={detailRef}>
          {sel ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="tag neon">{sel.is8020 ? '80/20 core' : 'node'}</span>
                <span className={`path-step-status path-step-status--${sel.status}`}>
                  {statusLabel(sel.status)}
                </span>
              </div>
              <h2 className="card-title">{sel.label.replace(' 🔒', '')}</h2>
              {sel.summary && <p className="card-sub">{sel.summary}</p>}

              <div className="feed-kicker" style={{ marginTop: 12 }}>
                what you&apos;ll learn
              </div>
              <p className="path-overview-body">
                {sel.overview ??
                  (sel.status === 'locked'
                    ? 'Locked until prerequisites are clear. Finish the open nodes feeding this one.'
                    : 'Practice this node in Terminal or drill it on Dashboard to lock it in.')}
              </p>

              {sel.learnAbout && sel.learnAbout.length > 0 && (
                <>
                  <div className="feed-kicker" style={{ marginTop: 14 }}>
                    covered on this stop
                  </div>
                  <ul className="path-goals concept-learn-list">
                    {sel.learnAbout.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}

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
              <p className="card-hint" style={{ marginTop: 12 }}>
                Full overview also opens as a sheet on tap (mobile-friendly).
              </p>
            </>
          ) : (
            <>
              <div className="feed-kicker">select a concept</div>
              <p className="card-sub">
                Tap a path step or graph node to see what you&apos;ll learn. Core nodes (ringed) are
                the leverage points.
              </p>
              <ul className="core-list">
                {nodes
                  .filter((n) => n.is8020)
                  .map((n) => (
                    <li key={n.id}>
                      <button type="button" className="text-btn" onClick={() => selectNode(n.id)}>
                        {n.label} · {Math.round(n.retention)}%
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {sel && <ConceptOverview node={sel} onClose={() => setSelected(null)} />}
    </main>
  )
}
