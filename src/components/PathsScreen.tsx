import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { BlueprintGraph } from './BlueprintGraph'
import { PathRoadmap } from './PathRoadmap'
import { useLayerBuilder } from './useLayerBuilder'
import type { DomainPath } from '../data/types'

const DEPTH_LABEL: Record<DomainPath['depth'], string> = {
  shallow: 'shallow',
  moderate: 'moderate',
  deep: 'deep',
}

/** Proposal cards, shown before the learner has committed to anything. */
function PathPicker({ loading, error }: { loading: string | null; error: string | null }) {
  const { activeDomain, dispatch } = useApp()

  if (!activeDomain) return null
  const domain = activeDomain
  const selected = domain.paths.filter((p) => p.selected)

  // Committing only records the choice; PathsScreen builds the entry layers,
  // because it survives the switch from picker to roadmap and this component
  // does not.
  const commit = () => {
    if (selected.length === 0) {
      dispatch({ type: 'showToast', message: 'Pick at least one path to start.' })
      return
    }
    dispatch({ type: 'commitPaths' })
  }

  return (
    <>
      <header className="page-header">
        <div className="feed-kicker">domain · {domain.title}</div>
        <h1 className="feed-title">Which way in?</h1>
        <p className="page-lead">
          {domain.blueprint.overview ??
            'These are the genuinely different routes through this domain.'}{' '}
          Pick one or two. Everything you do not pick stays collapsed — you can open it later
          without losing anything.
        </p>
      </header>

      <div className="path-proposals">
        {domain.paths.map((path) => (
          <article
            key={path.id}
            className={`card path-proposal${path.selected ? ' selected' : ''}`}
          >
            <div className="proposal-top">
              <span className="proposal-icon" aria-hidden>
                {path.icon ?? '◈'}
              </span>
              <div className="proposal-depth">
                <span className={`tag depth-${path.depth}`}>{DEPTH_LABEL[path.depth]}</span>
                <span className="card-hint">≈ {path.weeks} weeks</span>
              </div>
            </div>
            <h2 className="card-title">{path.title}</h2>
            <p className="card-sub">{path.pitch}</p>
            <p className="proposal-payoff">
              <span className="feed-kicker">payoff</span>
              {path.payoff}
            </p>
            <button
              type="button"
              className={`pill${path.selected ? ' primary' : ''}`}
              onClick={() => dispatch({ type: 'togglePath', pathId: path.id })}
            >
              {path.selected ? '✓ Selected' : 'Select'}
            </button>
          </article>
        ))}
      </div>

      {error && (
        <p className="explain fail study-error">
          {error}{' '}
          <button type="button" className="text-btn" onClick={() => dispatch({ type: 'setView', view: 'settings' })}>
            Open Settings
          </button>
        </p>
      )}

      <div className="path-commit">
        <span className="card-hint">
          {selected.length === 0
            ? 'Nothing selected yet.'
            : `${selected.length} path${selected.length === 1 ? '' : 's'} selected — only the first layer of each opens now.`}
        </span>
        <button
          type="button"
          className="pill primary"
          disabled={loading !== null}
          onClick={commit}
        >
          {loading ? 'Building your first layer…' : 'Start these paths'}
        </button>
      </div>
    </>
  )
}

/** Roadmaps for the chosen paths, with the graph available as a power-user map. */
function PathRoadmaps({
  loading,
  error,
  onUnlock,
}: {
  loading: string | null
  error: string | null
  onUnlock: (path: DomainPath, layerIndex: number) => void
}) {
  const { activeDomain, dispatch } = useApp()
  const [showMap, setShowMap] = useState(false)
  const [activePathId, setActivePathId] = useState<string | null>(null)

  const selected = activeDomain?.paths.filter((p) => p.selected) ?? []
  const selectedKey = selected.map((p) => p.id).join(',')

  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    if (ids.length > 0 && !ids.includes(activePathId ?? '')) setActivePathId(ids[0])
  }, [selectedKey, activePathId])

  if (!activeDomain) return null
  const domain = activeDomain
  const path = selected.find((p) => p.id === activePathId) ?? selected[0]
  if (!path) return null

  // The map only shows concepts on the paths the learner actually chose.
  const visibleIds = new Set(
    selected.flatMap((p) => p.layers.filter((l) => l.unlocked).flatMap((l) => l.conceptIds)),
  )
  const mapNodes = domain.blueprint.nodes.filter((n) => visibleIds.has(n.id))
  const mapEdges = domain.blueprint.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))

  return (
    <>
      <header className="page-header">
        <div className="feed-kicker">domain · {domain.title}</div>
        <h1 className="feed-title">Your paths</h1>
        <p className="page-lead">
          Big steps in order. Only the layer you are on is open — depth appears when you have earned
          it, or when you ask for it.
        </p>
      </header>

      <div className="path-tabs">
        {selected.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pill${p.id === path.id ? ' primary' : ''}`}
            onClick={() => setActivePathId(p.id)}
          >
            {p.icon ?? '◈'} {p.title}
          </button>
        ))}
        <button type="button" className="pill mini" onClick={() => dispatch({ type: 'setView', view: 'domains' })}>
          + other domains
        </button>
      </div>

      {error && <p className="explain fail study-error">{error}</p>}

      <PathRoadmap
        domain={domain}
        path={path}
        unlocking={loading !== null}
        onOpen={(conceptId) => dispatch({ type: 'openConcept', conceptId })}
        onUnlockLayer={(layerIndex) => {
          const layer = path.layers[layerIndex]
          // A layer whose concepts already exist just needs revealing; one that
          // was never built needs a generation pass first.
          if (layer?.conceptIds.length) {
            dispatch({ type: 'revealLayer', pathId: path.id, layerIndex })
          } else {
            onUnlock(path, layerIndex)
          }
        }}
      />

      <section className="card map-toggle-card">
        <button type="button" className="text-btn" onClick={() => setShowMap((v) => !v)}>
          {showMap ? 'Hide the dependency map' : 'Show the dependency map'}
        </button>
        {showMap && (
          <>
            <BlueprintGraph
              nodes={mapNodes}
              edges={mapEdges}
              onOpen={(conceptId) => dispatch({ type: 'openConcept', conceptId })}
            />
            <div className="const-legend">
              <span style={{ color: 'var(--neon)' }}>● mastered</span>
              <span style={{ color: 'var(--cyan)' }}>● learning</span>
              <span style={{ color: 'var(--violet)' }}>● available</span>
              <span>★ 80/20 core</span>
              <span>ring = retention</span>
            </div>
          </>
        )}
      </section>
    </>
  )
}

export function PathsScreen() {
  const { activeDomain, dispatch } = useApp()
  const { build, loading, error } = useLayerBuilder()

  // Any selected path missing its entry layer gets one, one at a time. Running
  // it here rather than in the picker keeps the build alive across the switch
  // to the roadmap, and self-heals a path whose first attempt was interrupted.
  const pending = activeDomain?.paths.find((p) => p.selected && p.layers[0]?.conceptIds.length === 0)
  const buildingEntry = useRef(false)
  useEffect(() => {
    if (!activeDomain?.pathsChosen || loading) return
    if (pending) {
      buildingEntry.current = true
      void build(pending, 0)
      return
    }
    // Every chosen path now has an entry layer: the daily loop starts on the Feed.
    if (buildingEntry.current) {
      buildingEntry.current = false
      dispatch({ type: 'setView', view: 'feed' })
    }
  }, [activeDomain?.pathsChosen, pending, loading, build, dispatch])

  if (!activeDomain) {
    return (
      <main className="content-pane">
        <p className="page-lead">Create a domain first.</p>
        <button type="button" className="pill primary" onClick={() => dispatch({ type: 'setView', view: 'domains' })}>
          New domain
        </button>
      </main>
    )
  }

  const chosen = activeDomain.pathsChosen && activeDomain.paths.some((p) => p.selected)

  return (
    <main className="content-pane">
      {chosen ? (
        <PathRoadmaps loading={loading} error={error} onUnlock={build} />
      ) : (
        <PathPicker loading={loading} error={error} />
      )}
    </main>
  )
}
