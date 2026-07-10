import { depthRings } from '../data/stats'

const RADII = [92, 68, 44]
const STROKE = 13

export function DepthRings() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" aria-label="depth of knowledge rings">
      {/* research frontier — dashed outer boundary */}
      <circle
        cx="110"
        cy="110"
        r={RADII[0] + 22}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="4"
        strokeDasharray="3 8"
      />
      {depthRings.slice(0, 3).map((ring, i) => {
        const r = RADII[i]
        const c = 2 * Math.PI * r
        return (
          <g key={ring.label}>
            <circle cx="110" cy="110" r={r} fill="none" stroke="var(--surface-3)" strokeWidth={STROKE} />
            {ring.pct > 0 && (
              <circle
                cx="110"
                cy="110"
                r={r}
                fill="none"
                stroke={i === 0 ? 'var(--neon)' : i === 1 ? 'var(--cyan)' : 'var(--violet)'}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${(c * ring.pct) / 100} ${c}`}
                transform="rotate(-90 110 110)"
                style={{ filter: 'drop-shadow(0 0 6px rgba(42,255,163,0.35))' }}
              />
            )}
          </g>
        )
      })}
      <circle cx="110" cy="110" r="21" fill="var(--neon)" opacity="0.95" />
      <text
        x="110"
        y="114"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#04140c"
        fontFamily="var(--font-display)"
      >
        core ✓
      </text>
    </svg>
  )
}
