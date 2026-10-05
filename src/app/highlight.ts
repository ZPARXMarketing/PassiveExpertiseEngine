import { createContext, useContext } from 'react'
import type { Bucket, SavedItem } from './types.ts'

/** The starter buckets; their keys are the original four highlighter colours. */
export const DEFAULT_BUCKETS: Bucket[] = [
  { key: 'yellow', name: 'Yellow', color: '#ffd60a', position: 1, archived: false },
  { key: 'green', name: 'Green', color: '#2affa3', position: 2, archived: false },
  { key: 'blue', name: 'Blue', color: '#4cc9ff', position: 3, archived: false },
  { key: 'pink', name: 'Pink', color: '#ff5caa', position: 4, archived: false },
]

/** A bucket key's colour (falls back to the starter colours, then yellow). */
export function colorOf(key: string | undefined, buckets: Bucket[]): string {
  const k = key ?? 'yellow'
  return (buckets.find((b) => b.key === k) ?? DEFAULT_BUCKETS.find((b) => b.key === k) ?? DEFAULT_BUCKETS[0]).color
}

export interface HighlightApi {
  /** this chapter's highlights */
  items: SavedItem[]
  /** the mark currently tapped (shows recolour / remove) */
  active: string | null
  setActive: (id: string | null) => void
  buckets: Bucket[]
}

export const HighlightCtx = createContext<HighlightApi>({ items: [], active: null, setActive: () => {}, buckets: DEFAULT_BUCKETS })
export const useHighlights = () => useContext(HighlightCtx)

export interface Range {
  start: number
  end: number
  id: string
  color: string
}

/**
 * Where this chapter's highlights fall inside one paragraph. Highlights are stored as the
 * text that was selected (it may span paragraphs), so each line of it is looked up here;
 * overlapping marks keep the earlier one.
 */
export function rangesIn(text: string, items: SavedItem[]): Range[] {
  const found: Range[] = []
  for (const h of items) {
    for (const piece of h.text.split(/\n+/).map((s) => s.trim())) {
      if (piece.length < 3) continue
      const at = text.indexOf(piece)
      if (at >= 0) found.push({ start: at, end: at + piece.length, id: h.id, color: h.color ?? 'yellow' })
    }
  }
  found.sort((a, b) => a.start - b.start)
  const out: Range[] = []
  for (const r of found) if (!out.length || r.start >= out[out.length - 1].end) out.push(r)
  return out
}
