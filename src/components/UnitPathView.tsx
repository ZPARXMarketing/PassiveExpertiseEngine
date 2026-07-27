import { useApp } from '../state/AppContext'
import { unitById, unitProgress } from '../data/knowledgeMap'
import type { ConceptNode, NodeStatus } from '../data/types'
import { ConceptOverview } from './ConceptOverview'

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

const statusOf = (node: ConceptNode, completedLessons: string[]): NodeStatus => {
  if (node.lessonId && completedLessons.includes(node.lessonId)) return 'mastered'
  return node.status
}

export function UnitPathView({ unitId }: { unitId: string }) {
  const { state, dispatch } = useApp()
  const unit = unitById(unitId)
  const nodes = unit.nodes ?? []

  const bonus = nodes.filter(
    (n) => n.lessonId && state.completedLessons.includes(n.lessonId),
  ).length
  const pct = unitProgress(unit, bonus)

  return (
    <div className="overlay">
      <div className="path-view">
        <div className="const-head">
          <button className="const-back" onClick={() => dispatch({ type: 'closePath' })}>
            ‹
          </button>
          <span className="const-title">
            {unit.index} · {unit.title}
          </span>
          <span className="const-count">
            {unit.masteredConcepts + bonus}/{unit.totalConcepts}
          </span>
        </div>

        <div className="path-scroll">
          <section className="path-overview card">
            <div className="feed-kicker">path overview</div>
            <p className="path-overview-body">{unit.overview}</p>
            {unit.pathGoals && unit.pathGoals.length > 0 && (
              <ul className="path-goals">
                {unit.pathGoals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
            <div className="path-overview-meta">
              <div className="progress-track" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="unit-pct">{pct}%</span>
            </div>
            {unit.paceNote && <div className="pace-note">↳ {unit.paceNote}</div>}
          </section>

          <div className="path-section-label">concepts on this path</div>

          {nodes.length === 0 ? (
            <div className="card end-card">
              <div className="card-sub">Concept map for this unit is still being composed.</div>
            </div>
          ) : (
            <div className="path-steps">
              {nodes.map((node, i) => {
                const status = statusOf(node, state.completedLessons)
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`card path-step path-step--${status}`}
                    onClick={() => dispatch({ type: 'openConceptOverview', conceptId: node.id })}
                  >
                    <div className="path-step-rail" aria-hidden>
                      <span className={`path-step-dot path-step-dot--${status}`} />
                      {i < nodes.length - 1 && <span className="path-step-line" />}
                    </div>
                    <div className="path-step-body">
                      <div className="row">
                        <span className="path-step-index">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className={`path-step-status path-step-status--${status}`}>
                          {status === 'locked' ? '🔒 ' : ''}
                          {statusLabel(status)}
                        </span>
                      </div>
                      <div className="unit-name">{node.title}</div>
                      <div className="card-sub">{node.summary}</div>
                      <div className="card-hint">tap → overview of what you&apos;ll learn</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="you-foot">same idea as the degree map — drill one level deeper</div>
        </div>
      </div>

      {state.pathConceptId && (
        <ConceptOverview unitId={unitId} conceptId={state.pathConceptId} />
      )}
    </div>
  )
}
