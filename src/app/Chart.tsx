import type { ChartSpec } from './types.ts'

/** Series colours, in order. CSS variables so the theme drives them. */
const COLORS = ['var(--neon)', 'var(--cyan)', 'var(--violet)', 'var(--amber)', 'var(--danger)', '#7dd3fc', '#f0abfc', '#bef264']

const W = 560
const H = 340
const PAD = { l: 64, r: 16, t: 16, b: 60 }

const fmt = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${+(n / 1e3).toFixed(1)}k`
  return `${+n.toFixed(a < 10 ? 2 : 0)}`
}

/** ~5 round tick values covering [lo, hi]. */
function ticks(lo: number, hi: number, n = 5): number[] {
  if (lo === hi) return [lo]
  const step0 = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

export function Chart({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="chart">
      {spec.title && <figcaption className="chart-title">{spec.title}</figcaption>}
      {spec.type === 'pie' ? <Pie spec={spec} /> : spec.type === 'flow' ? <Flow spec={spec} /> : <XY spec={spec} />}
      <Legend spec={spec} />
      {spec.caption && <p className="chart-caption">{spec.caption}</p>}
      <p className="chart-note">
        {spec.illustrative ? 'Illustrative numbers' : spec.source ? `Data: ${spec.source}` : 'Real data (source not given)'}
      </p>
    </figure>
  )
}

function Legend({ spec }: { spec: ChartSpec }) {
  const names =
    spec.type === 'bar' ? spec.bars.map((b) => b.name) : spec.type === 'line' || spec.type === 'scatter' ? spec.series.map((s) => s.name) : []
  if (names.filter(Boolean).length < 2) return null
  return (
    <div className="chart-legend">
      {names.map((n, i) => (
        <span key={i}>
          <i style={{ background: COLORS[i % COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  )
}

function Axes({ yt, y, yLabel, xLabel }: { yt: number[]; y: (v: number) => number; yLabel: string; xLabel: string }) {
  return (
    <g className="axes">
      {yt.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {fmt(v)}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} className="axis" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="axis" />
      {xLabel && (
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 10} textAnchor="middle" className="label">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={14} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" className="label" transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}>
          {yLabel}
        </text>
      )}
    </g>
  )
}

function XY({ spec }: { spec: ChartSpec }) {
  const isBar = spec.type === 'bar'
  const vals = isBar ? spec.bars.flatMap((b) => b.values).filter(Number.isFinite) : spec.series.flatMap((s) => s.points.map((p) => p[1]))
  const yt = ticks(Math.min(0, ...vals), Math.max(...vals))
  const [y0, y1] = [yt[0], yt[yt.length - 1]]
  const y = (v: number) => H - PAD.b - ((v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b)
  const plotW = W - PAD.l - PAD.r

  if (isBar) {
    const n = spec.categories.length
    const groupW = plotW / n
    const bw = Math.min(48, (groupW * 0.75) / spec.bars.length)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.title}>
        <Axes yt={yt} y={y} yLabel={spec.yLabel} xLabel={spec.xLabel} />
        {spec.categories.map((c, i) => {
          const gx = PAD.l + groupW * i + (groupW - bw * spec.bars.length) / 2
          return (
            <g key={i}>
              {spec.bars.map((b, j) =>
                Number.isFinite(b.values[i]) ? (
                  <rect
                    key={j}
                    x={gx + j * bw}
                    y={Math.min(y(b.values[i]), y(0))}
                    width={bw - 3}
                    height={Math.abs(y(0) - y(b.values[i]))}
                    rx={3}
                    fill={COLORS[j % COLORS.length]}
                  >
                    <title>{`${c}${b.name ? ` · ${b.name}` : ''}: ${b.values[i]}`}</title>
                  </rect>
                ) : null,
              )}
              <text x={PAD.l + groupW * (i + 0.5)} y={H - PAD.b + 20} textAnchor="middle" className="tick-x">
                {n > 6 ? c.slice(0, 8) : c.slice(0, 16)}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const xs = spec.series.flatMap((s) => s.points.map((p) => p[0]))
  const xt = ticks(Math.min(...xs), Math.max(...xs), 6)
  const [x0, x1] = [Math.min(xt[0], ...xs), Math.max(xt[xt.length - 1], ...xs)]
  const x = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * plotW
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.title}>
      <Axes yt={yt} y={y} yLabel={spec.yLabel} xLabel={spec.xLabel} />
      {xt.map((v) => (
        <text key={v} x={x(v)} y={H - PAD.b + 20} textAnchor="middle" className="tick-x">
          {fmt(v)}
        </text>
      ))}
      {spec.series.map((s, i) => {
        const pts = spec.type === 'line' ? [...s.points].sort((a, b) => a[0] - b[0]) : s.points
        const color = COLORS[i % COLORS.length]
        return (
          <g key={i}>
            {spec.type === 'line' && (
              <polyline points={pts.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
            )}
            {pts.map((p, k) => (
              <circle key={k} cx={x(p[0])} cy={y(p[1])} r={spec.type === 'line' ? (pts.length > 20 ? 0 : 3) : 4.5} fill={color}>
                <title>{`${s.name ? `${s.name}: ` : ''}(${p[0]}, ${p[1]})`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function Pie({ spec }: { spec: ChartSpec }) {
  const total = spec.slices.reduce((t, s) => t + s.value, 0)
  const cx = 150
  const cy = H / 2
  const r = 120
  let a = -Math.PI / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.title}>
      {spec.slices.map((s, i) => {
        const da = (s.value / total) * Math.PI * 2
        const [a0, a1] = [a, (a += da)]
        const large = da > Math.PI ? 1 : 0
        const p = (t: number) => `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`
        const d = spec.slices.length === 1 ? '' : `M${cx},${cy} L${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)} Z`
        return (
          <g key={i}>
            <path d={d} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2}>
              <title>{`${s.label}: ${s.value}`}</title>
            </path>
            <rect x={300} y={50 + i * 36} width={14} height={14} rx={3} fill={COLORS[i % COLORS.length]} />
            <text x={322} y={63 + i * 36} className="pie-label">
              {s.label} · {Math.round((s.value / total) * 100)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Left-to-right layered diagram: each node sits one column right of its deepest parent. */
function Flow({ spec }: { spec: ChartSpec }) {
  const ids = new Set(spec.nodes.map((n) => n.id))
  const edges = spec.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
  const level: Record<string, number> = Object.fromEntries(spec.nodes.map((n) => [n.id, 0]))
  for (let pass = 0; pass < spec.nodes.length; pass++)
    for (const e of edges) if (level[e.to] < level[e.from] + 1 && level[e.from] + 1 < spec.nodes.length) level[e.to] = level[e.from] + 1
  const cols: string[][] = []
  for (const n of spec.nodes) (cols[level[n.id]] ??= []).push(n.id)
  const ncol = cols.length
  const bw = Math.min(150, (W - 40) / ncol - 24)
  const bh = 60
  const pos: Record<string, { x: number; y: number }> = {}
  const rows = Math.max(...cols.map((c) => c.length))
  const h = Math.max(160, rows * (bh + 28) + 24)
  cols.forEach((c, i) =>
    c.forEach((id, j) => {
      pos[id] = { x: 20 + i * ((W - 40) / ncol) + ((W - 40) / ncol - bw) / 2, y: (h - c.length * (bh + 28)) / 2 + j * (bh + 28) + 14 }
    }),
  )
  const label = (id: string) => spec.nodes.find((n) => n.id === id)?.label || id
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={spec.title}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--cyan)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos[e.from]
        const b = pos[e.to]
        const back = b.x <= a.x
        const [x1, y1] = [a.x + (back ? bw / 2 : bw), a.y + (back ? bh : bh / 2)]
        const [x2, y2] = [b.x + (back ? bw / 2 : 0), b.y + (back ? bh : bh / 2)]
        const mx = (x1 + x2) / 2
        const d = back ? `M${x1},${y1} C${x1},${y1 + 50} ${x2},${y2 + 50} ${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--cyan)" strokeWidth={1.6} markerEnd="url(#arrow)" opacity={0.85} />
            {e.label && (
              <text x={mx} y={(y1 + y2) / 2 - 6 + (back ? 40 : 0)} textAnchor="middle" className="edge-label">
                {e.label}
              </text>
            )}
          </g>
        )
      })}
      {spec.nodes.map((n) => (
        <foreignObject key={n.id} x={pos[n.id].x} y={pos[n.id].y} width={bw} height={bh}>
          <div className="flow-node">{label(n.id)}</div>
        </foreignObject>
      ))}
    </svg>
  )
}
