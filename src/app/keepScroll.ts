import { useLayoutEffect, useRef } from 'react'

/**
 * Remembers how far down each panel / chapter was scrolled (this device), so switching
 * subjects and coming back lands exactly where you were.
 */
const KEY = 'xe_scroll'
const MAX = 300
let memory: Map<string, number> | null = null

function load(): Map<string, number> {
  if (memory) return memory
  try {
    memory = new Map(JSON.parse(localStorage.getItem(KEY) || '[]') as [string, number][])
  } catch {
    memory = new Map()
  }
  return memory
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function remember(id: string, top: number) {
  const m = load()
  m.delete(id) // newest last, so the oldest drop off first
  if (top > 0) m.set(id, top)
  while (m.size > MAX) m.delete(m.keys().next().value!)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...m]))
    } catch {
      /* storage full or blocked: memory still works this visit */
    }
  }, 400)
}

/** Ref + onScroll for a scrolling element; restores its position once `ready` (content is in). */
export function useKeptScroll<T extends HTMLElement>(id: string, ready: boolean) {
  const ref = useRef<T>(null)
  /** the element already restored (a folded panel remounts its element when it unfolds) */
  const restored = useRef<T | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!ready || !el || restored.current === el) return
    restored.current = el
    const top = load().get(id)
    if (top) el.scrollTop = top
  })
  const onScroll = (e: React.UIEvent<T>) => {
    if (restored.current === e.currentTarget) remember(id, e.currentTarget.scrollTop)
  }
  return { ref, onScroll }
}
