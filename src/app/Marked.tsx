import type { ReactNode } from 'react'
import { colorOf, rangesIn, useHighlights } from './highlight.ts'

/** A paragraph's text with this chapter's highlighter marks drawn on it. Tap a mark to edit it. */
export function Marked({ text }: { text: string }) {
  const { items, active, setActive, buckets } = useHighlights()
  const ranges = items.length ? rangesIn(text, items) : []
  if (!ranges.length) return <>{text}</>
  const out: ReactNode[] = []
  let at = 0
  for (const r of ranges) {
    if (r.start > at) out.push(text.slice(at, r.start))
    out.push(
      <mark
        key={`${r.id}-${r.start}`}
        className={`hl ${active === r.id ? 'hl-active' : ''}`}
        style={{ '--hl': colorOf(r.color, buckets) } as React.CSSProperties}
        onClick={(e) => {
          e.stopPropagation()
          setActive(active === r.id ? null : r.id)
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    )
    at = r.end
  }
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}
