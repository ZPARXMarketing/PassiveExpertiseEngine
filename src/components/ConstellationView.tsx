import { useApp } from '../state/AppContext'
import { unitById } from '../data/knowledgeMap'
import type { ConceptNode } from '../data/types'

const nodeById = (nodes: ConceptNode[], id: string) => nodes.find((n) => n.id === id)!

/** Optional graph view of a unit’s concept nodes (kept for map-style browsing). */
export function ConstellationView({ unitId }: { unitId: string }) {
  const { state, dispatch } = useApp()
  const unit = unitById(unitId)
  const nodes = (unit.nodes ?? []).filter(
    (n): n is ConceptNode & { x: number; y: number } => n.x != null && n.y != null,
  )
  const edges = unit.edges ?? []

  const bonus = nodes.filter(
    (n) => n.lessonId && state.completedLessons.includes(n.lessonId),
  ).length

  const statusOf = (node: ConceptNode) => {
    if (node.lessonId && state.completedLessons.includes(node.lessonId)) return 'mastered'
    return node.status
  }

  return (
    <div className="overlay">
      <div className="constellation">
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

        <svg className="const-svg" viewBox="0 0 240 320">
          {edges.map((e) => {
            const a = nodeById(nodes, e.from)
            const b = nodeById(nodes, e.to)
            if (a.x == null || a.y == null || b.x == null || b.y == null) return null
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.locked ? 'rgba(255,255,255,0.12)' : 'rgba(76,201,255,0.4)'}
                strokeWidth="1.5"
                strokeDasharray={e.locked ? '4 5' : undefined}
              />
            )
          })}
          {nodes.map((node) => {
            const status = statusOf(node)
            return (
              <g
                key={node.id}
                className="node-tap"
                onClick={() => dispatch({ type: 'openConceptOverview', conceptId: node.id })}
              >
                {status === 'mastered' && (
                  <>
                    <circle cx={node.x} cy={node.y} r="15" fill="var(--neon)" opacity="0.25" />
                    <circle cx={node.x} cy={node.y} r="11" fill="var(--neon)" />
                  </>
                )}
                {status === 'learning' && (
                  <>
                    <circle cx={node.x} cy={node.y} r="15" fill="none" stroke="var(--neon)" strokeWidth="2.5" />
                    <circle cx={node.x} cy={node.y} r="6" fill="var(--neon)">
                      <animate attributeName="r" values="5;7;5" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                {status === 'available' && (
                  <circle cx={node.x} cy={node.y} r="12" fill="var(--surface-2)" stroke="var(--cyan)" strokeWidth="2" />
                )}
                {status === 'locked' && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="12"
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="3 4"
                  />
                )}
                <text
                  x={node.x + (node.labelDx ?? 0)}
                  y={node.y + (node.labelDy ?? 30)}
                  className={status === 'learning' ? 'now' : status === 'locked' ? 'locked' : undefined}
                >
                  {status === 'learning' ? node.label : node.label.replace(' — now', '')}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="const-tip">tap a node → overview of what you&apos;ll learn</div>
        <div className="const-legend">
          <span style={{ color: 'var(--neon)' }}>● mastered</span>
          <span style={{ color: 'var(--cyan)' }}>◍ learning / open</span>
          <span>○ locked</span>
        </div>
      </div>
    </div>
  )
}
