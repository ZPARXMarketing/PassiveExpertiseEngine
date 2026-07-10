import type { Visual } from '../data/types'

const NEON = 'var(--neon)'
const CYAN = 'var(--cyan)'
const VIOLET = 'var(--violet)'
const FAINT = 'rgba(255,255,255,0.14)'

function Wave() {
  return (
    <>
      <path
        d="M10 85 Q 32 30, 55 85 T 100 85 T 145 85 T 190 85"
        fill="none"
        stroke={NEON}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10 100 Q 40 70, 70 100 T 130 100 T 190 100"
        fill="none"
        stroke={CYAN}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M10 120 H 190" stroke={FAINT} strokeWidth="1.5" strokeDasharray="3 6" />
    </>
  )
}

function Orbit() {
  return (
    <>
      <ellipse cx="100" cy="100" rx="80" ry="30" fill="none" stroke={FAINT} strokeWidth="1.5" />
      <ellipse
        cx="100"
        cy="100"
        rx="80"
        ry="30"
        fill="none"
        stroke={CYAN}
        strokeWidth="1.5"
        opacity="0.6"
        transform="rotate(60 100 100)"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="80"
        ry="30"
        fill="none"
        stroke={VIOLET}
        strokeWidth="1.5"
        opacity="0.6"
        transform="rotate(-60 100 100)"
      />
      <circle cx="100" cy="100" r="12" fill={NEON} />
      <circle cx="171" cy="82" r="5" fill={CYAN} />
    </>
  )
}

function Slit() {
  return (
    <>
      <rect x="60" y="30" width="8" height="50" rx="2" fill={FAINT} />
      <rect x="60" y="92" width="8" height="16" rx="2" fill={FAINT} />
      <rect x="60" y="120" width="8" height="50" rx="2" fill={FAINT} />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx="64"
          cy="100"
          r={18 + i * 22}
          fill="none"
          stroke={i % 2 ? CYAN : NEON}
          strokeWidth="1.5"
          opacity={0.75 - i * 0.13}
          clipPath="url(#half)"
        />
      ))}
      <clipPath id="half">
        <rect x="64" y="0" width="140" height="200" />
      </clipPath>
      {[38, 66, 94, 122, 150].map((y, i) => (
        <rect key={y} x="176" y={y} width="7" height="14" rx="2" fill={NEON} opacity={i === 2 ? 1 : 0.45} />
      ))}
    </>
  )
}

function Dice() {
  return (
    <>
      <rect x="45" y="45" width="110" height="110" rx="20" fill="none" stroke={NEON} strokeWidth="2.5" />
      <circle cx="78" cy="78" r="9" fill={NEON} />
      <circle cx="122" cy="122" r="9" fill={NEON} />
      <circle cx="122" cy="78" r="9" fill={CYAN} opacity="0.5" />
      <circle cx="78" cy="122" r="9" fill={CYAN} opacity="0.5" />
      <circle cx="100" cy="100" r="9" fill={VIOLET} opacity="0.7" />
    </>
  )
}

function Camera() {
  return (
    <>
      <circle cx="100" cy="100" r="62" fill="none" stroke={FAINT} strokeWidth="2" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path
          key={a}
          d="M100 44 A 56 56 0 0 1 148 72 L 100 100 Z"
          fill={a % 120 ? 'rgba(76,201,255,0.18)' : 'rgba(42,255,163,0.22)'}
          stroke={a % 120 ? CYAN : NEON}
          strokeWidth="1"
          transform={`rotate(${a} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="16" fill="var(--bg)" stroke={NEON} strokeWidth="2" />
    </>
  )
}

function Rings() {
  return (
    <>
      <circle cx="100" cy="100" r="72" fill="none" stroke={FAINT} strokeWidth="8" strokeDasharray="3 7" />
      <circle
        cx="100"
        cy="100"
        r="52"
        fill="none"
        stroke={CYAN}
        strokeWidth="8"
        strokeDasharray="200 127"
        strokeLinecap="round"
        opacity="0.6"
        transform="rotate(-90 100 100)"
      />
      <circle
        cx="100"
        cy="100"
        r="32"
        fill="none"
        stroke={NEON}
        strokeWidth="8"
        strokeDasharray="150 51"
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />
      <circle cx="100" cy="100" r="12" fill={NEON} />
    </>
  )
}

const visuals: Record<Visual, () => React.ReactNode> = {
  wave: Wave,
  orbit: Orbit,
  slit: Slit,
  dice: Dice,
  camera: Camera,
  rings: Rings,
}

export function BeatVisual({ kind }: { kind: Visual }) {
  const V = visuals[kind]
  return (
    <svg className="beat-visual" viewBox="0 0 200 200" aria-hidden="true">
      <V />
    </svg>
  )
}
