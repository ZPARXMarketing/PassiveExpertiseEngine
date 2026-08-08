import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { formatDuration, sampleDomainForTopic } from '../data/domains'
import { generateDomain, DomainUnavailableError, offlineDomain } from '../data/domain'
import { liveStreak, masteryPct, rankFor } from '../data/rank'

export function DomainsHome() {
  const { state, dispatch } = useApp()
  const [topic, setTopic] = useState('')
  const [mapping, setMapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abandon an in-flight mapping if the user navigates away
  useEffect(() => () => abortRef.current?.abort(), [])

  const create = async () => {
    const t = topic.trim()
    if (!t) {
      dispatch({ type: 'showToast', message: 'Type a domain first — e.g. “Quantum mechanics”' })
      return
    }
    if (mapping) return
    setError(null)

    // Authored samples are richer than anything generated — use them as-is.
    const sample = sampleDomainForTopic(t)
    if (sample) {
      dispatch({ type: 'addDomain', domain: sample })
      setTopic('')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setMapping(true)
    try {
      const domain = await generateDomain({ topic: t, settings: state.settings, signal: controller.signal })
      dispatch({
        type: 'addDomain',
        domain,
        message: `Domain mapped: ${domain.title} — ${domain.paths.length} paths`,
      })
      setTopic('')
    } catch (e) {
      if (controller.signal.aborted) return
      // Any topic still gets a domain: fall back to the starter routes and say
      // why the mapped ones are missing.
      setError(
        e instanceof DomainUnavailableError ? e.message : 'Domain mapping failed unexpectedly.',
      )
      dispatch({
        type: 'addDomain',
        domain: offlineDomain(t),
        message: 'Created with the starter routes — AI mapping unavailable',
        navigate: false,
      })
      setTopic('')
    } finally {
      setMapping(false)
    }
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">domain engine · your knowledge characters</div>
        <h1 className="feed-title">What do you want to get good at?</h1>
        <p className="page-lead">
          Type anything — a whole field or a narrow skill. The engine maps it into a few broad paths,
          you pick one or two, and it feeds you the next useful thing every day. Nothing else opens
          until you have earned it.
        </p>
      </header>

      <div className="card new-project">
        <label className="field-label" htmlFor="topic-input">
          New domain
        </label>
        <div className="goal-row">
          <input
            id="topic-input"
            className="goal-input"
            placeholder="e.g. Quantum mechanics"
            value={topic}
            disabled={mapping}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <button type="button" className="pill primary" onClick={() => void create()} disabled={mapping}>
            {mapping ? 'Mapping…' : 'Create'}
          </button>
        </div>
        <div className="card-hint">
          “Finance for small businesses” and “B2B lead generation” open the worked samples; anything
          else is mapped on the spot.
        </div>

        {mapping && (
          <div className="path-designing">
            <div className="feed-kicker">mapping the routes through “{topic.trim()}”</div>
            <span className="skeleton-line w-40" />
            <span className="skeleton-line" />
            <span className="skeleton-line w-70" />
            <div className="card-hint">
              Finding the genuinely different directions through this domain — no curriculum yet,
              that comes after you choose.
            </div>
          </div>
        )}

        {error && (
          <p className="explain fail study-error">
            {error}{' '}
            <button
              type="button"
              className="text-btn"
              onClick={() => dispatch({ type: 'setView', view: 'settings' })}
            >
              Open Settings
            </button>
          </p>
        )}
      </div>

      <div className="subject-grid">
        {state.domains.map((d) => {
          const active = d.id === state.activeDomainId
          const selected = d.paths.filter((p) => p.selected)
          const rank = rankFor(d.progress.xp)
          return (
            <article key={d.id} className={`card subject-card${active ? ' highlight' : ''}`}>
              <div className="subject-card-top">
                <span className="tag neon">{rank.label}</span>
                {d.source === 'generated' && <span className="tag">ai mapped</span>}
                {active && <span className="tag">active</span>}
              </div>
              <h2 className="card-title">{d.title}</h2>
              <p className="card-sub">
                {selected.length > 0
                  ? `on ${selected.map((p) => p.title).join(' + ')}`
                  : `${d.paths.length} paths — none chosen yet`}
              </p>
              <div className="subject-stats">
                <span>{d.progress.xp} XP</span>
                <span>{masteryPct(d)}% mastery</span>
                <span>{liveStreak(d.progress)}d streak</span>
                <span>{formatDuration(d.metrics.sessionSecondsActive)} deep work</span>
              </div>
              <div className="subject-actions">
                <button
                  type="button"
                  className="pill primary"
                  onClick={() => {
                    dispatch({ type: 'setActiveDomain', id: d.id })
                    dispatch({ type: 'setView', view: d.pathsChosen ? 'feed' : 'paths' })
                  }}
                >
                  {d.pathsChosen ? 'Open feed' : 'Choose paths'}
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => {
                    dispatch({ type: 'setActiveDomain', id: d.id })
                    dispatch({ type: 'setView', view: 'paths' })
                  }}
                >
                  Paths
                </button>
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={() => dispatch({ type: 'deleteDomain', id: d.id })}
                >
                  Remove
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
