import { useLayoutEffect, useRef, useState } from 'react'
import type { PanelWidth } from './PanelWidth.tsx'

const GAP = 14
const STRIP = 48
/** compact column width (titles only) */
const COMPACT = 200

/**
 * Like Explore: when a row of columns doesn't fit its container, the oldest ones fold into
 * slim strips (the newest never folds), so nothing needs scrolling sideways.
 * `widths` = each column's comfortable width; `keep` = a column tapped open (stays open).
 * `mode` = the top-bar panel switch: Slim folds every older column, Wide folds none,
 * Compact narrows them (titles only) and Auto just fits. Returns which ones to fold.
 */
export function useFit(widths: number[], keep = -1, mode: PanelWidth = 'auto') {
  const ref = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      setAvail(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const folded = widths.map((_, i) => mode === 'strip' && i < widths.length - 1 && i !== keep)
  if (avail > 0 && (mode === 'auto' || mode === 'compact')) {
    const w = mode === 'compact' ? widths.map((x, i) => (i < widths.length - 1 ? COMPACT : x)) : widths
    let total = w.reduce((t, x) => t + x, 0) + GAP * (w.length - 1)
    for (let i = 0; i < widths.length - 1 && total > avail; i++) {
      if (i === keep) continue
      folded[i] = true
      total -= w[i] - STRIP
    }
  }
  return { ref, folded }
}

/** A folded column: what it is and what's picked in it, sideways. Tap to go back to it. */
export function Strip({ kicker, picked, onOpen }: { kicker: string; picked?: string; onOpen: () => void }) {
  return (
    <button className="column strip" onClick={onOpen} aria-label={`Back to ${kicker}${picked ? `: ${picked}` : ''}`}>
      <span className="strip-chev">›</span>
      <span className="strip-text">
        <span className="strip-parent">{kicker}</span>
        {picked && <span className="strip-sel">{picked}</span>}
      </span>
    </button>
  )
}
