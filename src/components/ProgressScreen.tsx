import { useApp } from '../state/AppContext'
import { drillStartPayload } from '../data/drills'
import { formatDuration } from '../data/domains'
import {
  chosenSubgraphIds,
  conceptRetention,
  frontierConceptIds,
  frontierPct,
  liveStreak,
  masteryPct,
  nextRank,
  rankFor,
  rankProgress,
  RANKS,
} from '../data/rank'
import { currentWeek, frontierWarmth, paceBlurb, paceFor, recentAccuracy } from '../data/scheduler'
import { cleanLabel } from '../data/study'

function heatColor(retention: number): string {
  if (retention >= 75) return 'var(--neon)'
  if (retention >= 50) return 'var(--cyan)'
  if (retention >= 30) return 'var(--heat-mid)'
  return 'var(--heat-hot)'
}

/**
 * The identity screen: what you have become in this domain, and what the
 * scheduler is doing about it. The retention heat map lives here too — it is
 * diagnostic, not a to-do list, because the Feed already owns "what next".
 */
export function ProgressScreen() {
  const { activeDomain, dispatch } = useApp()

  if (!activeDomain) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create a domain first.</p>
      </main>
    )
  }

  const domain = activeDomain
  const rank = rankFor(domain.progress.xp)
  const upcoming = nextRank(domain.progress.xp)
  const frontier = frontierConceptIds(domain)
  const subgraph = chosenSubgraphIds(domain)
  const pace = paceFor(domain)
  const accuracy = recentAccuracy(domain)
  const week = currentWeek(domain.plan)

  const nodes = domain.blueprint.nodes
    .filter((n) => frontier.includes(n.id))
    .map((n) => ({ node: n, retention: conceptRetention(domain, n.id) }))
    .sort((a, b) => a.retention - b.retention)

  const decaying = nodes.filter((n) => n.retention < 55)

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">identity · {domain.title}</div>
        <h1 className="feed-title">Progress</h1>
        <p className="page-lead">{paceBlurb(pace)}</p>
      </header>

      <section className="card rank-card">
        <div className="rank-head">
          <div>
            <div className="feed-kicker">domain rank</div>
            <div className="rank-title">{rank.label}</div>
            <div className="card-sub">{rank.blurb}</div>
          </div>
          <div className="rank-xp">
            <div className="stat-num">{domain.progress.xp}</div>
            <div className="stat-label">XP</div>
          </div>
        </div>
        <div className="rank-track">
          <div className="rank-fill" style={{ width: `${Math.round(rankProgress(domain.progress.xp) * 100)}%` }} />
        </div>
        <div className="rank-ladder">
          {RANKS.map((r) => (
            <span key={r.id} className={`rank-step${r.minXp <= domain.progress.xp ? ' reached' : ''}`}>
              {r.label}
            </span>
          ))}
        </div>
        {upcoming && (
          <p className="card-hint">
            {upcoming.minXp - domain.progress.xp} XP to {upcoming.label}.
          </p>
        )}
      </section>

      <div className="stat-tiles dash-stats">
        <div className="card">
          <div className="stat-num">{masteryPct(domain)}%</div>
          <div className="stat-label">mastery of your subgraph</div>
        </div>
        <div className="card">
          <div className="stat-num">
            {frontier.length}/{subgraph.length}
          </div>
          <div className="stat-label">frontier unlocked ({frontierPct(domain)}%)</div>
        </div>
        <div className="card">
          <div className="stat-num">{liveStreak(domain.progress)}</div>
          <div className="stat-label">day streak (best {domain.progress.bestStreakDays})</div>
        </div>
        <div className="card">
          <div className="stat-num">{formatDuration(domain.metrics.sessionSecondsActive)}</div>
          <div className="stat-label">deep work logged</div>
        </div>
      </div>

      <div className="dashboard-layout">
        <section className="card">
          <div className="feed-kicker">retention heat map</div>
          <p className="card-hint">
            Live recall probability per concept, from your actual retrieval history — not a counter
            that only moves when you tap something.
          </p>
          <div className="heat-grid">
            {nodes.map(({ node, retention }) => (
              <div key={node.id} className="heat-cell" title={`${cleanLabel(node.label)}: ${retention}%`}>
                <div
                  className="heat-swatch"
                  style={{
                    background: heatColor(retention),
                    opacity: 0.35 + (retention / 100) * 0.65,
                  }}
                />
                <div className="heat-label">{cleanLabel(node.label)}</div>
                <div className="heat-pct">{retention}%</div>
              </div>
            ))}
            {nodes.length === 0 && <p className="card-sub">Unlock a path layer to populate this.</p>}
          </div>
        </section>

        <section className="card">
          <div className="feed-kicker">scheduler</div>
          <ul className="decay-list">
            <li>
              <span>pace</span>
              <span className="pct">{pace}</span>
            </li>
            <li>
              <span>frontier warmth</span>
              <span className="pct">{frontierWarmth(domain)}%</span>
            </li>
            <li>
              <span>recent accuracy</span>
              <span className="pct">
                {accuracy === null ? 'not enough data' : `${Math.round(accuracy * 100)}%`}
              </span>
            </li>
            {week && (
              <li>
                <span>{week.label}</span>
                <span className="pct">{week.intent}</span>
              </li>
            )}
          </ul>
          <button
            type="button"
            className="pill"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => dispatch({ type: 'rebuildPlan' })}
          >
            Rebuild the plan
          </button>

          <div className="feed-kicker" style={{ marginTop: 18 }}>
            decaying concepts
          </div>
          {decaying.length === 0 ? (
            <p className="card-sub">Everything on your frontier is warm.</p>
          ) : (
            <ul className="decay-list">
              {decaying.map(({ node, retention }) => (
                <li key={node.id}>
                  <span style={{ color: heatColor(retention) }}>●</span>
                  <span>{cleanLabel(node.label)}</span>
                  <span className="pct">{retention}%</span>
                </li>
              ))}
            </ul>
          )}

          <div className="feed-kicker" style={{ marginTop: 18 }}>
            micro-drills
          </div>
          <div className="drill-list">
            {domain.drills.map((d) => (
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
            {domain.drills.length === 0 && <p className="card-sub">No drills on this domain yet.</p>}
          </div>

          <button type="button" className="reset-btn" onClick={() => dispatch({ type: 'resetProgress' })}>
            reset this domain’s progress
          </button>
        </section>
      </div>
    </main>
  )
}
