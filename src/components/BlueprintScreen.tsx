import { useApp } from '../state/AppContext'
import type { BlueprintNode, NodeStatus } from '../data/types'
import { cleanLabel } from '../data/study'

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

/** Short form that fits under a 92px orb without wrapping */
const shortStatus = (status: NodeStatus): string =>
  status === 'learning' ? 'learning' : status === 'available' ? 'ready' : status

const statusColor = (status: NodeStatus): string => {
  switch (status) {
    case 'mastered':
      return 'var(--neon)'
    case 'learning':
      return 'var(--cyan)'
    case 'available':
      return 'var(--violet)'
    case 'locked':
      return 'var(--text-faint)'
  }
}

/** Fallback glyph when a concept has no authored icon */
const initials = (label: string): string =>
  cleanLabel(label)
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

export function BlueprintScreen() {
  const { activeSubject, dispatch } = useApp()

  if (!activeSubject) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create or select a project on Subjects first.</p>
      </main>
    )
  }

  const { nodes, edges, overview, goals } = activeSubject.blueprint
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const avgRetention = nodes.length
    ? Math.round(nodes.reduce((s, n) => s + n.retention, 0) / nodes.length)
    : 0

  const open = (conceptId: string) => dispatch({ type: 'openConcept', conceptId })

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">metalearning · curriculum aggregator</div>
        <h1 className="feed-title">Blueprint</h1>
        <p className="page-lead">
          Skill path for <strong>{activeSubject.title}</strong>. Tap a concept to open its full
          study page.
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
      <div className="concept-orbs">
        {nodes.map((node) => {
          const label = cleanLabel(node.label)
          const color = statusColor(node.status)
          const pct = node.status === 'locked' ? 0 : Math.round(node.retention)
          return (
            <button
              key={node.id}
              type="button"
              className={`concept-orb concept-orb--${node.status}${node.is8020 ? ' core' : ''}`}
              onClick={() => open(node.id)}
              aria-label={`${label} — ${statusLabel(node.status)}, ${pct}% retention. Open study page.`}
            >
              <span
                className="orb-ring"
                style={{
                  ['--orb-color' as string]: color,
                  ['--orb-pct' as string]: `${pct * 3.6}deg`,
                }}
              >
                <span className="orb-face">
                  <span className="orb-glyph">
                    {node.status === 'locked' ? '🔒' : (node.icon ?? initials(node.label))}
                  </span>
                </span>
                {node.is8020 && (
                  <span className="orb-core-badge" title="80/20 core concept" aria-hidden>
                    ★
                  </span>
                )}
              </span>
              <span className="orb-label">{label}</span>
              <span className="orb-status" style={{ color }}>
                {shortStatus(node.status)}
                {node.status !== 'locked' && ` · ${pct}%`}
              </span>
            </button>
          )
        })}
      </div>

      <details className="card graph-card">
        <summary>
          <span className="feed-kicker" style={{ margin: 0 }}>
            dependency graph
          </span>
          <span className="card-hint">how these concepts feed each other</span>
        </summary>
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
              className={`bp-node${n.is8020 ? ' core' : ''}`}
              onClick={() => open(n.id)}
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
          <span>★ 80/20 core</span>
        </div>
      </details>
    </main>
  )
}
