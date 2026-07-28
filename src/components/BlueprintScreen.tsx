import { useApp } from '../state/AppContext'
import { BlueprintGraph } from './BlueprintGraph'

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
  const avgRetention = nodes.length
    ? Math.round(nodes.reduce((s, n) => s + n.retention, 0) / nodes.length)
    : 0

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
      <section className="card graph-card">
        <BlueprintGraph
          nodes={nodes}
          edges={edges}
          onOpen={(conceptId) => dispatch({ type: 'openConcept', conceptId })}
        />
        <div className="const-legend">
          <span style={{ color: 'var(--neon)' }}>● mastered</span>
          <span style={{ color: 'var(--cyan)' }}>● learning</span>
          <span style={{ color: 'var(--violet)' }}>● available</span>
          <span>★ 80/20 core</span>
          <span>ring = retention</span>
        </div>
      </section>
    </main>
  )
}
