/**
 * How wide the earlier panels sit: Slim strips, Compact titles, or Wide with summaries.
 * Each button is a tiny picture of that layout (panels + the reading block), so the
 * choice is obvious without reading. Tap the lit one again for Auto (fits the screen).
 */
export type PanelWidth = 'auto' | 'strip' | 'compact' | 'full'

const MODES: { id: Exclude<PanelWidth, 'auto'>; name: string; bars: number; reader: boolean }[] = [
  { id: 'strip', name: 'Slim panels', bars: 2, reader: true },
  { id: 'compact', name: 'Compact panels', bars: 5, reader: true },
  { id: 'full', name: 'Wide panels', bars: 7, reader: false },
]

function Icon({ bars, reader }: { bars: number; reader: boolean }) {
  // three panels of width `bars`, then the reading block fills what's left of 30
  const gap = 1.5
  const xs = [0, 1, 2].map((i) => 1 + i * (bars + gap))
  const end = xs[2] + bars + gap
  return (
    <svg viewBox="0 0 30 18" width="30" height="18" aria-hidden="true">
      {xs.map((x) => (
        <rect key={x} x={x} y="2" width={bars} height="14" rx="1" fill="currentColor" opacity="0.55" />
      ))}
      {reader && <rect x={end} y="2" width={29 - end} height="14" rx="1.5" fill="currentColor" />}
    </svg>
  )
}

export function PanelWidthSwitch({ value, onChange }: { value: PanelWidth; onChange: (v: PanelWidth) => void }) {
  return (
    <div className="pw-switch" role="radiogroup" aria-label="Panel width">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          className={value === m.id ? 'on' : ''}
          onClick={() => onChange(value === m.id ? 'auto' : m.id)}
          title={value === m.id ? `${m.name} (tap again for Auto)` : m.name}
        >
          <Icon bars={m.bars} reader={m.reader} />
        </button>
      ))}
    </div>
  )
}
