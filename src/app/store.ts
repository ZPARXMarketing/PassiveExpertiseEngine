/**
 * Persistence. Supabase (PostgREST over fetch, publishable key) when the xe_ tables
 * exist; otherwise this device's localStorage, so the app works before the
 * migration in supabase/migrations is applied.
 */

import type { Extra, ExtraKind, Level, NodeMeta, SavedItem, TreeNode } from './types.ts'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dfhjesjzceyhzbtojkcw.supabase.co'
// Publishable key: designed to ship in the browser; RLS on the xe_ tables does the gating.
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_WM7N5CYAcW2owXhSc-Q7IQ_5Tv-fTsL'

export interface NewNode {
  parent_id: string | null
  level: Level
  title: string
  summary: string
  meta?: NodeMeta
  position: number
}

export interface Store {
  mode: 'cloud' | 'device'
  subjects(): Promise<TreeNode[]>
  children(parentId: string): Promise<TreeNode[]>
  addNodes(nodes: NewNode[]): Promise<TreeNode[]>
  deleteSubject(id: string): Promise<void>
  /** generated body hung off a node: a course's syllabus header, a chapter's text */
  doc<T>(nodeId: string): Promise<T | null>
  saveDoc(nodeId: string, body: unknown, model: string): Promise<void>
  completions(): Promise<Set<string>>
  setComplete(nodeId: string, done: boolean): Promise<void>
  nodesById(ids: string[]): Promise<TreeNode[]>
  /** node id → last opened (ISO) */
  visits(): Promise<Map<string, string>>
  visit(nodeId: string): Promise<void>
  saved(): Promise<SavedItem[]>
  addSaved(item: Pick<SavedItem, 'node_id' | 'kind' | 'text'>): Promise<SavedItem>
  removeSaved(id: string): Promise<void>
  extras(nodeId: string): Promise<Extra[]>
  addExtra(nodeId: string, kind: ExtraKind, key: string, body: unknown, model: string): Promise<Extra>
  /** every extra of one kind, across all chapters (Library) */
  extrasOfKind(kind: ExtraKind): Promise<Extra[]>
  removeExtra(id: string): Promise<void>
  /** store an MP3, return a URL any device can play */
  uploadAudio(path: string, audio: Blob): Promise<string>
  deleteAudio(url: string): Promise<void>
  pref<T>(key: string): Promise<T | null>
  setPref(key: string, value: unknown): Promise<void>
}

/* ---------------- Supabase ---------------- */

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

const cloud: Store = {
  mode: 'cloud',
  subjects: () => rest<TreeNode[]>('xe_nodes?level=eq.subject&order=created_at.desc'),
  children: (id) => rest<TreeNode[]>(`xe_nodes?parent_id=eq.${id}&order=position.asc`),
  addNodes: (nodes) =>
    rest<TreeNode[]>('xe_nodes', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(nodes.map((n) => ({ ...n, meta: n.meta ?? {} }))),
    }),
  deleteSubject: async (id) => {
    await rest(`xe_nodes?id=eq.${id}&level=eq.subject`, { method: 'DELETE' })
  },
  doc: async <T,>(id: string) => {
    const rows = await rest<{ body: T }[]>(`xe_lessons?node_id=eq.${id}&select=body`)
    return rows[0]?.body ?? null
  },
  saveDoc: async (id, body, model) => {
    await rest('xe_lessons', {
      method: 'POST',
      headers: { prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ node_id: id, body, model }),
    })
  },
  completions: async () => {
    const rows = await rest<{ node_id: string }[]>('xe_completions?select=node_id')
    return new Set(rows.map((r) => r.node_id))
  },
  setComplete: async (id, done) => {
    if (done) {
      await rest('xe_completions', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ node_id: id }),
      })
    } else {
      await rest(`xe_completions?node_id=eq.${id}`, { method: 'DELETE' })
    }
  },
  nodesById: (ids) => (ids.length ? rest<TreeNode[]>(`xe_nodes?id=in.(${ids.join(',')})`) : Promise.resolve([])),
  visits: async () => {
    const rows = await rest<{ node_id: string; visited_at: string }[]>('xe_visits?select=node_id,visited_at')
    return new Map(rows.map((r) => [r.node_id, r.visited_at]))
  },
  visit: async (id) => {
    await rest('xe_visits', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ node_id: id, visited_at: new Date().toISOString() }),
    })
  },
  saved: () => rest<SavedItem[]>('xe_saved?order=created_at.asc'),
  addSaved: async (item) => {
    const [row] = await rest<SavedItem[]>('xe_saved', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(item),
    })
    return row
  },
  removeSaved: async (id) => {
    await rest(`xe_saved?id=eq.${id}`, { method: 'DELETE' })
  },
  extras: (id) => rest<Extra[]>(`xe_extras?node_id=eq.${id}&order=created_at.asc`),
  addExtra: async (node_id, kind, key, body, model) => {
    const [row] = await rest<Extra[]>('xe_extras', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ node_id, kind, key: key.slice(0, 1000), body, model }),
    })
    return row
  },
  extrasOfKind: (kind) => rest<Extra[]>(`xe_extras?kind=eq.${kind}&order=created_at.asc`),
  removeExtra: async (id) => {
    await rest(`xe_extras?id=eq.${id}`, { method: 'DELETE' })
  },
  uploadAudio: async (path, audio) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/xe-lectures/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'audio/mpeg' },
      body: audio,
    })
    if (!res.ok) throw new Error(`Could not save the audio (${res.status}).`)
    return `${SUPABASE_URL}/storage/v1/object/public/xe-lectures/${path}`
  },
  deleteAudio: async (url) => {
    const path = url.split('/public/xe-lectures/')[1]
    if (!path) return
    await fetch(`${SUPABASE_URL}/storage/v1/object/xe-lectures/${path}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    })
  },
  pref: async <T,>(key: string) => {
    const rows = await rest<{ value: T }[]>(`xe_prefs?key=eq.${encodeURIComponent(key)}&select=value`)
    return rows[0]?.value ?? null
  },
  setPref: async (key, value) => {
    await rest('xe_prefs', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    })
  },
}

/* ---------------- this device ---------------- */

const LOCAL_KEY = 'xe-store-v1'

interface LocalData {
  nodes: TreeNode[]
  lessons: Record<string, unknown>
  done: string[]
  visits?: Record<string, string>
  saved?: SavedItem[]
  extras?: Extra[]
  prefs?: Record<string, unknown>
}

function load(): LocalData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return JSON.parse(raw) as LocalData
  } catch {
    /* empty or blocked storage: start fresh */
  }
  return { nodes: [], lessons: {}, done: [] }
}

function save(d: LocalData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d))
  } catch {
    /* quota or blocked: keep working in memory */
  }
}

function makeDevice(): Store {
  const d = load()
  const visits = (d.visits ??= {})
  const saved = () => (d.saved ??= [])
  return {
    mode: 'device',
    subjects: async () =>
      d.nodes.filter((n) => n.level === 'subject').sort((a, b) => b.created_at.localeCompare(a.created_at)),
    children: async (id) => d.nodes.filter((n) => n.parent_id === id).sort((a, b) => a.position - b.position),
    addNodes: async (nodes) => {
      const made = nodes.map((n) => ({
        ...n,
        meta: n.meta ?? {},
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      }))
      d.nodes.push(...made)
      save(d)
      return made
    },
    deleteSubject: async (id) => {
      const gone = new Set([id])
      // nodes are appended parent-first, so one forward pass catches every descendant
      for (const n of d.nodes) if (n.parent_id && gone.has(n.parent_id)) gone.add(n.id)
      d.nodes = d.nodes.filter((n) => !gone.has(n.id))
      for (const k of gone) delete d.lessons[k]
      d.done = d.done.filter((k) => !gone.has(k))
      for (const k of gone) delete visits[k]
      d.saved = saved().filter((x) => !gone.has(x.node_id))
      d.extras = (d.extras ?? []).filter((x) => !gone.has(x.node_id))
      save(d)
    },
    doc: async <T,>(id: string) => (d.lessons[id] as T) ?? null,
    saveDoc: async (id, body) => {
      d.lessons[id] = body
      save(d)
    },
    completions: async () => new Set(d.done),
    setComplete: async (id, done) => {
      d.done = d.done.filter((k) => k !== id)
      if (done) d.done.push(id)
      save(d)
    },
    nodesById: async (ids) => d.nodes.filter((n) => ids.includes(n.id)),
    visits: async () => new Map(Object.entries(visits)),
    visit: async (id) => {
      visits[id] = new Date().toISOString()
      save(d)
    },
    saved: async () => [...saved()],
    addSaved: async (item) => {
      const row = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      saved().push(row)
      save(d)
      return row
    },
    removeSaved: async (id) => {
      d.saved = saved().filter((x) => x.id !== id)
      save(d)
    },
    extras: async (id) => (d.extras ?? []).filter((x) => x.node_id === id),
    addExtra: async (node_id, kind, key, body) => {
      const row: Extra = { id: crypto.randomUUID(), node_id, kind, key, body, created_at: new Date().toISOString() }
      ;(d.extras ??= []).push(row)
      save(d)
      return row
    },
    extrasOfKind: async (kind) => (d.extras ?? []).filter((x) => x.kind === kind),
    removeExtra: async (id) => {
      d.extras = (d.extras ?? []).filter((x) => x.id !== id)
      save(d)
    },
    // this-device mode can't keep audio files; the lecture plays for this visit only
    uploadAudio: async (_path, audio) => URL.createObjectURL(audio),
    deleteAudio: async (url) => URL.revokeObjectURL(url),
    pref: async <T,>(key: string) => ((d.prefs ?? {})[key] as T) ?? null,
    setPref: async (key, value) => {
      ;(d.prefs ??= {})[key] = value
      save(d)
    },
  }
}

/** Cloud if the xe_ tables answer, otherwise this device. */
export async function openStore(): Promise<Store> {
  try {
    await rest('xe_nodes?select=id&limit=1')
    return cloud
  } catch {
    return makeDevice()
  }
}
