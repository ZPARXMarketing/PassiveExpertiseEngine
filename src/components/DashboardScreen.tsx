import { useApp } from '../state/AppContext'
import { drillStartPayload } from '../data/drills'
import { formatDuration } from '../data/subjects'

function heatColor(retention: number): string {
  // warm decay ramp: low = danger, high = neon
  if (retention >= 75) return 'var(--neon)'
  if (retention >= 50) return 'var(--cyan)'
  if (retention >= 30) return 'var(--heat-mid)'
  return 'var(--heat-hot)'
}

export function DashboardScreen() {
  const { activeSubject, dispatch } = useApp()

  if (!activeSubject) {
    return (
      <main className="content-pane">
        <p className="page-lead">Select a project first.</p>
      </main>
    )
  }

  const nodes = [...activeSubject.blueprint.nodes].sort((a, b) => a.retention - b.retention)
  const decaying = nodes.filter((n) => n.status !== 'locked' && n.retention < 55)

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">rapid feedback · drilling weaknesses</div>
        <h1 className="feed-title">Dashboard</h1>
        <p className="page-lead">
          Retention heat map for <strong>{activeSubject.title}</strong>. Attack cold nodes with
          micro-drills.
        </p>
      </header>

      <div className="stat-tiles dash-stats">
        <div className="card">
          <div className="stat-num">{formatDuration(activeSubject.metrics.sessionSecondsActive)}</div>
          <div className="stat-label">deep work logged</div>
        </div>
        <div className="card">
          <div className="stat-num">{activeSubject.metrics.tasksCompleted.length}</div>
          <div className="stat-label">tasks completed</div>
        </div>
        <div className="card">
          <div className="stat-num">{activeSubject.srs.length}</div>
          <div className="stat-label">SRS cards</div>
        </div>
        <div className="card">
          <div className="stat-num">{activeSubject.metrics.drillScores.length}</div>
          <div className="stat-label">drills run</div>
        </div>
      </div>

      <div className="dashboard-layout">
        <section className="card">
          <div className="feed-kicker">retention heat map</div>
          <div className="heat-grid">
            {nodes.map((n) => (
              <div key={n.id} className="heat-cell" title={`${n.label}: ${Math.round(n.retention)}%`}>
                <div
                  className="heat-swatch"
                  style={{
                    background: n.status === 'locked' ? 'var(--surface-3)' : heatColor(n.retention),
                    opacity: n.status === 'locked' ? 0.4 : 0.35 + (n.retention / 100) * 0.65,
                  }}
                />
                <div className="heat-label">{n.label.replace(' 🔒', '')}</div>
                <div className="heat-pct">{n.status === 'locked' ? '—' : `${Math.round(n.retention)}%`}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="feed-kicker">decaying nodes</div>
          {decaying.length === 0 ? (
            <p className="card-sub">All active nodes are warm. Keep reviewing.</p>
          ) : (
            <ul className="decay-list">
              {decaying.map((n) => (
                <li key={n.id}>
                  <span style={{ color: heatColor(n.retention) }}>●</span>
                  <span>{n.label}</span>
                  <span className="pct">{Math.round(n.retention)}%</span>
                </li>
              ))}
            </ul>
          )}

          <div className="feed-kicker" style={{ marginTop: 18 }}>
            micro-drills
          </div>
          <div className="drill-list">
            {activeSubject.drills.map((d) => (
              <button
                key={d.id}
                type="button"
                className="pill"
                style={{ width: '100%' }}
                onClick={() => dispatch({ type: 'startDrill', ...drillStartPayload(d) })}
              >
                {d.title}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="reset-btn"
            onClick={() => dispatch({ type: 'resetProgress' })}
          >
            reset this project’s progress
          </button>
        </section>
      </div>
    </main>
  )
}
