import { createContext, useContext } from 'react'
import type { SavedItem } from './types.ts'

export const COLORS = ['yellow', 'green', 'blue', 'pink'] as const
export type HighlightColor = (typeof COLORS)[number]

export interface HighlightApi {
  /** this chapter's highlights */
  items: SavedItem[]
  /** the mark currently tapped (shows recolour / remove) */
  active: string | null
  setActive: (id: string | null) => void
}

export const HighlightCtx = createContext<HighlightApi>({ items: [], active: null, setActive: () => {} })
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
