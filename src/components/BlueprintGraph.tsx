import type { BlueprintEdge, BlueprintNode, NodeStatus } from '../data/types'
import { cleanLabel } from '../data/study'

const RING_R = 22
const FACE_R = 17
const RING_C = 2 * Math.PI * RING_R

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

/** Fallback glyph when a concept has no authored icon */
const initials = (label: string): string =>
  cleanLabel(label)
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/**
 * The skill path itself: each concept is a round icon on the graph, encircled
 * by its retention progress. Tapping a node opens that concept's study page.
 */
export function BlueprintGraph({
  nodes,
  edges,
  onOpen,
}: {
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
  onOpen: (conceptId: string) => void
}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  // Authored samples fit the original 306-unit canvas; a generated path can be
  // deeper, so the canvas grows to whatever the deepest row needs.
  const height = Math.max(306, Math.ceil(nodes.reduce((m, n) => Math.max(m, n.y), 0) + 56))

  return (
    <svg
      className="blueprint-svg"
      viewBox={`0 0 260 ${height}`}
      role="group"
      aria-label="Skill path — select a concept to open its study page"
    >
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
            stroke={e.locked ? 'var(--text-faint)' : 'rgba(42,255,163,0.3)'}
            strokeWidth={e.locked ? 1 : 1.5}
            strokeDasharray={e.locked ? '4 4' : undefined}
          />
        )
      })}

      {nodes.map((n) => {
        const label = cleanLabel(n.label)
        const color = statusColor(n.status)
        const pct = n.status === 'locked' ? 0 : Math.round(n.retention)
        return (
          <g
            key={n.id}
            className={`bp-node bp-node--${n.status}${n.is8020 ? ' core' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${label} — ${statusLabel(n.status)}, ${pct}% retention. Open study page.`}
            onClick={() => onOpen(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(n.id)
              }
            }}
          >
            {/* generous invisible hit target so taps register on touch */}
            <circle cx={n.x} cy={n.y} r={RING_R + 8} fill="transparent" />

            {/* retention ring: unfilled track, then the earned arc */}
            <circle
              cx={n.x}
              cy={n.y}
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={3}
            />
            {pct > 0 && (
              <circle
                className="bp-node-arc"
                cx={n.x}
                cy={n.y}
                r={RING_R}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - pct / 100)}
                transform={`rotate(-90 ${n.x} ${n.y})`}
              />
            )}

            {/* icon face */}
            <circle
              className="bp-node-face"
              cx={n.x}
              cy={n.y}
              r={FACE_R}
              fill="var(--surface-2)"
              stroke={n.is8020 ? 'rgba(42,255,163,0.4)' : 'var(--border)'}
            />
            <text
              className="bp-node-glyph"
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {n.status === 'locked' ? '🔒' : (n.icon ?? initials(n.label))}
            </text>

            {n.is8020 && (
              <>
                {/* dark halo so the badge reads as sitting on top of the ring */}
                <circle
                  cx={n.x + 16}
                  cy={n.y - 16}
                  r={6}
                  fill="var(--neon)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <text
                  className="bp-node-badge"
                  x={n.x + 16}
                  y={n.y - 16}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  ★
                </text>
              </>
            )}

            <text
              className={`bp-node-label bp-node-label--${n.status}`}
              x={n.x}
              y={n.y + RING_R + 13}
              textAnchor="middle"
            >
              {label}
            </text>
            <text
              className="bp-node-pct"
              x={n.x}
              y={n.y + RING_R + 24}
              textAnchor="middle"
              style={{ fill: color }}
            >
              {n.status === 'locked' ? 'locked' : `${pct}%`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
