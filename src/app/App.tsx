import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generate, loadSettings, saveSettings, type Settings } from './generate.ts'
import type { GenKind } from './prompts.ts'
import { openStore, type NewNode, type Store } from './store.ts'
import { CHILD_LEVEL, chainIds, type Lesson, type Level, type SavedItem, type Syllabus, type TreeNode } from './types.ts'
import { Column, type Fold } from './Column.tsx'
import { Library } from './Library.tsx'
import { Reader } from './Reader.tsx'
import { SettingsSheet } from './SettingsSheet.tsx'

const GEN_KIND: Partial<Record<Level, GenKind>> = { subject: 'branches', branch: 'courses', course: 'syllabus' }
const SUGGESTIONS = ['Economics', 'Banking', 'Organic Chemistry', 'Music Theory', 'Psychology', 'Philosophy']

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

export default function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [railHidden, setRailHidden] = useState(false)
  const width = useWidth()
  /** manual fold per panel (keyed by its parent id); cleared on each new selection */
  const [folds, setFolds] = useState<Record<string, Fold>>({})
  const [topic, setTopic] = useState('')

  const [subjects, setSubjects] = useState<TreeNode[]>([])
  /** selected chain, top down: subject, branch, course, chapter */
  const [path, setPath] = useState<TreeNode[]>([])
  const [kids, setKids] = useState<Record<string, TreeNode[]>>({})
  const [docs, setDocs] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'explore' | 'library'>('explore')
  /** node id → last opened; drives the "explored" colour and resume-where-you-left-off */
  const [visited, setVisited] = useState<Map<string, string>>(new Map())
  const [saved, setSaved] = useState<SavedItem[]>([])
  /** nodes fetched only for the Library or a resume (not part of any open panel) */
  const [extra, setExtra] = useState<Record<string, TreeNode>>({})
  const inflight = useRef(new Set<string>())
  const columnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    openStore().then(async (s) => {
      const [subs, comp, vis, sav] = await Promise.all([
        s.subjects().catch(() => []),
        s.completions().catch(() => new Set<string>()),
        s.visits().catch(() => new Map<string, string>()),
        s.saved().catch(() => []),
      ])
      setStore(s)
      setSubjects(subs)
      setDone(comp)
      setVisited(vis)
      setSaved(sav)
    })
  }, [])

  /** Every node we hold, by id. */
  const known = useMemo(() => {
    const m: Record<string, TreeNode> = { ...extra }
    for (const n of subjects) m[n.id] = n
    for (const list of Object.values(kids)) for (const n of list) m[n.id] = n
    for (const n of path) m[n.id] = n
    return m
  }, [extra, subjects, kids, path])

  /** Fetch whatever ancestors of these ids we don't hold yet (at most 3 hops up). */
  const loadAncestors = useCallback(
    async (ids: string[]) => {
      if (!store) return known
      const have = { ...known }
      let want = ids.filter((id) => !have[id])
      for (let hop = 0; hop < 4; hop++) {
        if (want.length) for (const n of await store.nodesById(want)) have[n.id] = n
        want = [...new Set(ids.flatMap((id) => chainIds(id, have)))].filter((id) => !have[id])
        if (!want.length) break
      }
      setExtra((e) => ({ ...e, ...have }))
      return have
    },
    [store, known],
  )

  // Each new panel slides in from the right; keep the newest one in view.
  useEffect(() => {
    const el = columnsRef.current
    if (el) requestAnimationFrame(() => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }))
  }, [path, kids])

  const run = useCallback(async (id: string, job: () => Promise<void>) => {
    if (inflight.current.has(id)) return
    inflight.current.add(id)
    setBusy((b) => ({ ...b, [id]: true }))
    setErrors((e) => ({ ...e, [id]: '' }))
    try {
      await job()
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Something went wrong.' }))
    } finally {
      inflight.current.delete(id)
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }, [])

  /** Children of a node: from the store, or generated once and saved. */
  const ensureChildren = useCallback(
    (node: TreeNode, trail: string[]) =>
      run(node.id, async () => {
        if (!store) return
        let list = await store.children(node.id)
        let syllabus = node.level === 'course' ? await store.doc<Syllabus>(node.id) : null
        if (!list.length) {
          const data = await generate({ kind: GEN_KIND[node.level]!, trail }, settings)
          const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : []
          const rows: NewNode[] = items
            .map((it, i) => ({
              parent_id: node.id,
              level: CHILD_LEVEL[node.level]!,
              title: str(it.title).slice(0, 200),
              summary: str(it.summary).slice(0, 2000),
              meta: node.level === 'branch' ? { code: str(it.code), tier: str(it.tier) } : {},
              position: i,
            }))
            .filter((r) => r.title)
          if (!rows.length) throw new Error('The model returned nothing usable. Try again.')
          list = await store.addNodes(rows)
          if (node.level === 'course') {
            syllabus = { description: str(data.description), objectives: strList(data.objectives) }
            await store.saveDoc(node.id, syllabus, data.model)
          }
        }
        setKids((k) => ({ ...k, [node.id]: list }))
        if (syllabus) setDocs((d) => ({ ...d, [node.id]: syllabus }))
      }),
    [run, store, settings],
  )

  /** A chapter's text: from the store, or written once and saved. */
  const ensureLesson = useCallback(
    (chapter: TreeNode, trail: string[], siblings: TreeNode[]) =>
      run(chapter.id, async () => {
        if (!store) return
        let lesson = await store.doc<Lesson>(chapter.id)
        if (!lesson) {
          if (!siblings.length && chapter.parent_id) siblings = await store.children(chapter.parent_id)
          const data = await generate(
            {
              kind: 'chapter',
              trail,
              chapter: {
                title: chapter.title,
                summary: chapter.summary,
                index: Math.max(0, siblings.findIndex((s) => s.id === chapter.id)),
                outline: siblings.map((s) => s.title),
              },
            },
            settings,
          )
          const ex = data.example as { title?: unknown; body?: unknown } | null
          lesson = {
            intro: str(data.intro),
            sections: (Array.isArray(data.sections) ? (data.sections as Record<string, unknown>[]) : [])
              .map((s) => ({ heading: str(s.heading), body: str(s.body) }))
              .filter((s) => s.body),
            example: ex && str(ex.body) ? { title: str(ex.title), body: str(ex.body) } : null,
            keyTerms: (Array.isArray(data.keyTerms) ? (data.keyTerms as Record<string, unknown>[]) : [])
              .map((t) => ({ term: str(t.term), definition: str(t.definition) }))
              .filter((t) => t.term),
            recap: strList(data.recap),
            quiz: (Array.isArray(data.quiz) ? (data.quiz as Record<string, unknown>[]) : [])
              .map((q) => ({ q: str(q.q), a: str(q.a) }))
              .filter((q) => q.q),
          }
          if (!lesson.sections.length) throw new Error('The chapter came back empty. Try again.')
          await store.saveDoc(chapter.id, lesson, data.model)
        }
        setDocs((d) => ({ ...d, [chapter.id]: lesson }))
      }),
    [run, store, settings],
  )

  /** Select a node at its depth; everything to its right closes. */
  const select = useCallback(
    (node: TreeNode, depth: number, base: TreeNode[] = path) => {
      const next = [...base.slice(0, depth), node]
      setPath(next)
      setRailOpen(false)
      setTab('explore')
      setFolds({})
      // every click is saved: it colours the trail and lets any device resume here
      const now = new Date().toISOString()
      setVisited((v) => new Map(v).set(node.id, now))
      void store?.visit(node.id).catch(() => {})
      const trail = next.map((n) => n.title)
      if (node.level === 'chapter') {
        if (!docs[node.id]) void ensureLesson(node, trail.slice(0, 3), kids[next[2].id] ?? [])
      } else if (!kids[node.id]) {
        void ensureChildren(node, trail)
      }
    },
    [path, docs, kids, store, ensureChildren, ensureLesson],
  )

  /** Open a whole chain at once (resume, or "Open" from the Library). */
  const openChain = useCallback(
    (chain: TreeNode[]) => {
      if (!chain.length) return
      setPath(chain)
      setTab('explore')
      setFolds({})
      chain.forEach((n, i) => {
        const trail = chain.slice(0, i + 1).map((c) => c.title)
        if (n.level === 'chapter') {
          if (!docs[n.id]) void ensureLesson(n, trail.slice(0, 3), kids[n.parent_id ?? ''] ?? [])
        } else if (!kids[n.id]) {
          void ensureChildren(n, trail)
        }
      })
    },
    [docs, kids, ensureChildren, ensureLesson],
  )

  const openById = useCallback(
    async (id: string) => {
      const have = await loadAncestors([id])
      openChain(chainIds(id, have).map((x) => have[x]).filter(Boolean))
    },
    [loadAncestors, openChain],
  )

  // Resume wherever you (on any device) clicked last.
  const resumed = useRef(false)
  useEffect(() => {
    if (!store || resumed.current) return
    resumed.current = true
    const last = [...visited.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0]
    if (last) void openById(last[0])
  }, [store, visited, openById])

  const savedNode = useMemo(() => {
    const m = new Map<string, SavedItem>()
    for (const x of saved) if (x.kind === 'node') m.set(x.node_id, x)
    return m
  }, [saved])

  const toggleSave = async (node: TreeNode) => {
    if (!store) return
    const existing = savedNode.get(node.id)
    if (existing) {
      setSaved((s) => s.filter((x) => x.id !== existing.id))
      await store.removeSaved(existing.id).catch(() => setSaved((s) => [...s, existing]))
    } else {
      const row = await store.addSaved({ node_id: node.id, kind: 'node', text: '' })
      setSaved((s) => [...s, row])
    }
  }

  const saveSnippet = async (node: TreeNode, text: string) => {
    if (!store) return
    const row = await store.addSaved({ node_id: node.id, kind: 'snippet', text: text.slice(0, 4000) })
    setSaved((s) => [...s, row])
  }

  const removeSaved = async (item: SavedItem) => {
    if (!store) return
    setSaved((s) => s.filter((x) => x.id !== item.id))
    await store.removeSaved(item.id).catch(() => setSaved((s) => [...s, item]))
  }

  const retry = (depth: number) => {
    const node = path[depth]
    if (node) select(node, depth)
  }

  const submitTopic = async (raw: string) => {
    const title = raw.trim().slice(0, 200)
    if (!title || !store) return
    setTopic('')
    const existing = subjects.find((s) => s.title.toLowerCase() === title.toLowerCase())
    if (existing) return select(existing, 0, [])
    try {
      const [made] = await store.addNodes([{ parent_id: null, level: 'subject', title, summary: '', position: 0 }])
      setSubjects((s) => [made, ...s])
      select(made, 0, [])
    } catch (err) {
      setErrors((e) => ({ ...e, topic: err instanceof Error ? err.message : 'Could not save.' }))
    }
  }

  const removeSubject = async (s: TreeNode) => {
    if (!store || !confirm(`Delete "${s.title}" and everything generated under it?`)) return
    await store.deleteSubject(s.id)
    setSubjects((list) => list.filter((x) => x.id !== s.id))
    setSaved(await store.saved().catch(() => []))
    if (path[0]?.id === s.id) setPath([])
  }

  const toggleDone = async (id: string) => {
    if (!store) return
    const isDone = done.has(id)
    await store.setComplete(id, !isDone)
    setDone((d) => {
      const n = new Set(d)
      if (isDone) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const chapter = path[3]
  const panels = path.filter((n) => n.level !== 'chapter')
  /**
   * Older panels fold out of the way so the newest always fits: oldest first,
   * full → compact → strip. Manual folds (`folds`) override this per panel.
   */
  const autoFolds = useMemo(() => {
    const phone = width < 600
    const avail = width - (width > 900 && !railHidden ? 240 : 0) - (phone ? 24 : 32)
    const W: Record<Fold, number> = { full: phone ? width - 48 : 300, compact: 210, strip: 48 }
    const newest = chapter ? Math.min(420, width - 32) : W.full // the reader stretches into whatever is left
    const out: Fold[] = panels.map(() => 'full')
    const total = () => out.reduce((t, f, i) => t + (i === out.length - 1 && !chapter ? newest : W[f]) + 14, chapter ? newest : -14)
    const last = chapter ? out.length : out.length - 1 // the newest panel never folds
    for (let i = 0; i < last && total() > avail; i++) {
      out[i] = phone ? 'strip' : 'compact'
      if (total() > avail) out[i] = 'strip'
    }
    return out
  }, [width, railHidden, chapter, panels])

  const focusPanel = (id: string) => {
    setFolds((m) => ({ ...m, [id]: 'full' }))
    requestAnimationFrame(() =>
      document.querySelector(`[data-panel="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }),
    )
  }
  const chapterSiblings = path[2] ? (kids[path[2].id] ?? []) : []
  const chapterIdx = chapter ? chapterSiblings.findIndex((c) => c.id === chapter.id) : -1

  return (
    <div className={`shell ${railOpen ? 'rail-open' : ''} ${railHidden ? 'rail-hidden' : ''} tab-${tab}`}>
      <header className="topbar">
        <button
          className="icon-btn rail-toggle"
          onClick={() => (width <= 900 ? setRailOpen((o) => !o) : setRailHidden((h) => !h))}
          aria-label="Toggle subjects"
        >
          ☰
        </button>
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">Expertise Engine</span>
        </div>
        <form
          className="topic-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submitTopic(topic)
          }}
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to learn?"
            aria-label="Topic"
            enterKeyHint="go"
          />
          <button className="btn-neon" disabled={!topic.trim() || !store}>
            Learn
          </button>
        </form>
        <nav className="tabs" aria-label="View">
          <button className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>
            Explore
          </button>
          <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
            Library{saved.length > 0 && <span className="count">{saved.length}</span>}
          </button>
        </nav>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
          ⚙
        </button>
      </header>

      <aside className="rail">
        <div className="rail-head">
          <span>Subjects</span>
          {store && <span className={`mode mode-${store.mode}`}>{store.mode === 'cloud' ? 'synced' : 'this device'}</span>}
        </div>
        {subjects.length === 0 && <p className="rail-empty">Type a topic above to start.</p>}
        <ul>
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                className={`rail-item ${path[0]?.id === s.id ? 'active' : ''} ${visited.has(s.id) ? 'seen' : ''}`}
                onClick={() => select(s, 0, [])}
              >
                {s.title}
              </button>
              <button className="rail-del" onClick={() => void removeSubject(s)} aria-label={`Delete ${s.title}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="legend">
          <span>
            <i className="dot seen" /> explored
          </span>
          <span>
            <i className="dot done" /> completed
          </span>
          <span>
            <i className="dot star" /> saved
          </span>
        </div>
      </aside>
      <div className="rail-scrim" onClick={() => setRailOpen(false)} />

      {tab === 'library' && (
        <Library
          saved={saved}
          nodes={known}
          docs={docs}
          done={done}
          loadAncestors={loadAncestors}
          onOpen={(id) => void openById(id)}
          onRemove={(x) => void removeSaved(x)}
        />
      )}

      <main className="explore" hidden={tab !== 'explore'}>
        {path.length > 1 && (
          <nav className="crumbs" aria-label="Trail">
            {path.map((n, i) => (
              <button
                key={n.id}
                className={i === path.length - 1 ? 'here' : ''}
                onClick={() => (n.level === 'chapter' ? undefined : focusPanel(n.id))}
              >
                {n.meta.code || n.title}
              </button>
            ))}
          </nav>
        )}
        <div className="columns" ref={columnsRef}>
          {errors.topic && <p className="error">{errors.topic}</p>}
          {path.length === 0 ? (
            <div className="hero">
              <h1>Pick a subject. Drill down. Learn it like a degree.</h1>
              <p>Subject → branches → courses → syllabus → chapters, each written for you as you go.</p>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => void submitTopic(s)} disabled={!store}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {panels.map((parent, depth) => (
                  <Column
                    key={parent.id}
                    fold={folds[parent.id] ?? autoFolds[depth]}
                    onFold={(f) => setFolds((m) => ({ ...m, [parent.id]: f }))}
                    selectedTitle={path[depth + 1]?.title}
                    parent={parent}
                    items={kids[parent.id]}
                    syllabus={docs[parent.id] as Syllabus | undefined}
                    loading={!!busy[parent.id]}
                    error={errors[parent.id]}
                    selectedId={path[depth + 1]?.id}
                    done={done}
                    visited={visited}
                    savedIds={savedNode}
                    onToggleSave={(n) => void toggleSave(n)}
                    onSelect={(n) => select(n, depth + 1)}
                    onRetry={() => retry(depth)}
                  />
                ))}
              {chapter && (
                <Reader
                  key={chapter.id}
                  chapter={chapter}
                  course={path[2]}
                  lesson={docs[chapter.id] as Lesson | undefined}
                  loading={!!busy[chapter.id]}
                  error={errors[chapter.id]}
                  isDone={done.has(chapter.id)}
                  index={chapterIdx}
                  total={chapterSiblings.length}
                  prev={chapterSiblings[chapterIdx - 1]}
                  next={chapterSiblings[chapterIdx + 1]}
                  onGo={(n) => select(n, 3)}
                  onRetry={() => retry(3)}
                  onToggleDone={() => void toggleDone(chapter.id)}
                  isSaved={savedNode.has(chapter.id)}
                  onToggleSave={() => void toggleSave(chapter)}
                  onSaveSnippet={(t) => void saveSnippet(chapter, t)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsSheet
          settings={settings}
          mode={store?.mode}
          onSave={(s) => {
            setSettings(s)
            saveSettings(s)
            setShowSettings(false)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}
