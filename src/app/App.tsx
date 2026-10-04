import { useCallback, useEffect, useRef, useState } from 'react'
import { generate, loadSettings, saveSettings, type Settings } from './generate.ts'
import type { GenKind } from './prompts.ts'
import { openStore, type NewNode, type Store } from './store.ts'
import { CHILD_LEVEL, type Lesson, type Level, type Syllabus, type TreeNode } from './types.ts'
import { Column } from './Column.tsx'
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
  const [topic, setTopic] = useState('')

  const [subjects, setSubjects] = useState<TreeNode[]>([])
  /** selected chain, top down: subject, branch, course, chapter */
  const [path, setPath] = useState<TreeNode[]>([])
  const [kids, setKids] = useState<Record<string, TreeNode[]>>({})
  const [docs, setDocs] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const inflight = useRef(new Set<string>())
  const columnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    openStore().then(async (s) => {
      setStore(s)
      setSubjects(await s.subjects().catch(() => []))
      setDone(await s.completions().catch(() => new Set<string>()))
    })
  }, [])

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
      const trail = next.map((n) => n.title)
      if (node.level === 'chapter') {
        if (!docs[node.id]) void ensureLesson(node, trail.slice(0, 3), kids[next[2].id] ?? [])
      } else if (!kids[node.id]) {
        void ensureChildren(node, trail)
      }
    },
    [path, docs, kids, ensureChildren, ensureLesson],
  )

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
  const chapterSiblings = path[2] ? (kids[path[2].id] ?? []) : []
  const chapterIdx = chapter ? chapterSiblings.findIndex((c) => c.id === chapter.id) : -1

  return (
    <div className={`shell ${railOpen ? 'rail-open' : ''}`}>
      <header className="topbar">
        <button className="icon-btn rail-toggle" onClick={() => setRailOpen((o) => !o)} aria-label="Subjects">
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
              <button className={`rail-item ${path[0]?.id === s.id ? 'active' : ''}`} onClick={() => select(s, 0, [])}>
                {s.title}
              </button>
              <button className="rail-del" onClick={() => void removeSubject(s)} aria-label={`Delete ${s.title}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="rail-scrim" onClick={() => setRailOpen(false)} />

      <main className="columns" ref={columnsRef}>
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
            {path
              .filter((n) => n.level !== 'chapter')
              .map((parent, depth) => (
                <Column
                  key={parent.id}
                  parent={parent}
                  items={kids[parent.id]}
                  syllabus={docs[parent.id] as Syllabus | undefined}
                  loading={!!busy[parent.id]}
                  error={errors[parent.id]}
                  selectedId={path[depth + 1]?.id}
                  done={done}
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
              />
            )}
          </>
        )}
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
