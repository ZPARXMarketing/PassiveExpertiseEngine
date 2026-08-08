import type { BlueprintNode, Domain, DomainPath, NodeStatus } from '../data/types'
import { conceptRetention } from '../data/rank'
import { cleanLabel } from '../data/study'

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

const initials = (label: string): string =>
  cleanLabel(label)
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/**
 * The roadmap: big readable concept cards in teaching order, one layer at a
 * time. This is the primary view of a path — the dependency graph survives as
 * an optional map for people who want to see the whole shape at once.
 */
export function PathRoadmap({
  domain,
  path,
  onOpen,
  onUnlockLayer,
  unlocking,
}: {
  domain: Domain
  path: DomainPath
  onOpen: (conceptId: string) => void
  onUnlockLayer: (layerIndex: number) => void
  unlocking: boolean
}) {
  const byId = new Map(domain.blueprint.nodes.map((n) => [n.id, n]))

  return (
    <div className="roadmap">
      {path.layers.map((layer, index) => {
        const nodes = layer.conceptIds
          .map((id) => byId.get(id))
          .filter((n): n is BlueprintNode => n !== undefined)

        if (!layer.unlocked) {
          const previous = path.layers[index - 1]
          const ready =
            !previous ||
            previous.conceptIds.every((id) => conceptRetention(domain, id) >= 65)
          return (
            <section key={layer.id} className="card roadmap-layer roadmap-layer--locked">
              <div className="roadmap-layer-head">
                <span className="layer-index">layer {index + 1}</span>
                <h2 className="card-title">{layer.title}</h2>
              </div>
              <p className="card-sub">
                {ready
                  ? 'The layer above is holding. Open this when you want more depth.'
                  : 'Collapsed until the layer above is warm — that is what keeps this screen finishable.'}
              </p>
              <button
                type="button"
                className={`pill${ready ? ' primary' : ''}`}
                disabled={unlocking}
                onClick={() => onUnlockLayer(index)}
              >
                {unlocking ? 'Opening…' : ready ? 'Unlock this layer' : 'Unlock anyway'}
              </button>
            </section>
          )
        }

        return (
          <section key={layer.id} className="roadmap-layer">
            <div className="roadmap-layer-head">
              <span className="layer-index">layer {index + 1}</span>
              <h2 className="card-title">{layer.title}</h2>
            </div>
            <ol className="roadmap-steps">
              {nodes.map((node, i) => {
                const retention = conceptRetention(domain, node.id)
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      className={`card roadmap-step roadmap-step--${node.status}`}
                      onClick={() => onOpen(node.id)}
                    >
                      <span className="roadmap-step-num">{i + 1}</span>
                      <span className={`roadmap-orb${node.is8020 ? ' core' : ''}`} aria-hidden>
                        {node.status === 'locked' ? '🔒' : (node.icon ?? initials(node.label))}
                      </span>
                      <span className="roadmap-step-body">
                        <span className="roadmap-step-title">{cleanLabel(node.label)}</span>
                        <span className="roadmap-step-sub">
                          {node.summary ?? 'Open the study page for the detail.'}
                        </span>
                        <span className="roadmap-step-meta">
                          <span className={`path-step-status path-step-status--${node.status}`}>
                            {statusLabel(node.status)}
                          </span>
                          {node.is8020 && <span className="tag neon">core</span>}
                          <span className="progress-track roadmap-track">
                            <span className="progress-fill" style={{ width: `${retention}%` }} />
                          </span>
                          <span className="unit-pct">{retention}%</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
