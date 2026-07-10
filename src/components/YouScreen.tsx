import { useApp } from '../state/AppContext'
import { baseStats, depthRings } from '../data/stats'
import { DepthRings } from './DepthRings'

const ringColors = ['var(--neon)', 'var(--cyan)', 'var(--violet)', 'var(--text-faint)']

export function YouScreen() {
  const { state, dispatch } = useApp()
  const conceptsHeld = baseStats.conceptsHeld + state.completedLessons.length

  return (
    <main className="screen">
      <header className="feed-header">
        <div className="feed-kicker">your depth</div>
        <h1 className="feed-title">How deep are you?</h1>
      </header>

      <div className="you-rings">
        <DepthRings />
      </div>

      <div className="ring-legend">
        {depthRings.map((ring, i) => (
          <div className="row" key={ring.label}>
            <span className="ring-dot" style={{ background: ringColors[i], opacity: ring.locked ? 0.35 : 1 }} />
            <span style={{ color: ring.locked ? 'var(--text-faint)' : undefined }}>
              {ring.label}
              {ring.locked ? ' — locked' : ''}
            </span>
            {!ring.locked && <span className="pct">{ring.pct === 100 ? 'complete' : `${ring.pct}%`}</span>}
          </div>
        ))}
      </div>

      <div className="stat-tiles">
        <div className="card">
          <div className="stat-num">{baseStats.retentionPct}%</div>
          <div className="stat-label">30-day retention</div>
        </div>
        <div className="card">
          <div className="stat-num">{conceptsHeld}</div>
          <div className="stat-label">concepts held</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="stat-label">time reclaimed this week</div>
        <div className="card-title" style={{ fontSize: 19 }}>
          {baseStats.timeReclaimed}{' '}
          <span style={{ fontSize: 12.5, color: 'var(--neon)', fontWeight: 500 }}>
            from {baseStats.idleMoments} idle moments
          </span>
        </div>
        <div className="week-bars">
          {baseStats.weekBars.map((h, i) => (
            <div key={i} className={h >= 50 ? 'lit' : ''} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="you-foot">no streaks, no XP — just what you know</div>
      <button className="reset-btn" onClick={() => dispatch({ type: 'resetProgress' })}>
        reset demo progress
      </button>
    </main>
  )
}
