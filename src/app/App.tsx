import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generate, loadSettings, record, resolveVoice, saveSettings, type Settings } from './generate.ts'
import { DEFAULT_VOICE, type GenKind, type GenRequest } from './prompts.ts'
import {
  applyFix,
  parseChart,
  latest,
  lessonText,
  parseBranches,
  parseCheck,
  parseCourses,
  parseLesson,
  parsePractice,
  parseSections,
  parseSyllabus,
  type RawItem,
} from './parse.ts'
import { openStore, type NewNode, type Store } from './store.ts'
import {
  CHILD_LEVEL,
  chainIds,
  liveKey,
  type Bucket,
  type CheckResult,
  type Extra,
  type Lesson,
  type LectureBody,
  type LectureLength,
  type Level,
  type Teacher,
  type SavedItem,
  type Syllabus,
  type TreeNode,
} from './types.ts'
import { Column, type Fold } from './Column.tsx'
import { Library } from './Library.tsx'
import { AudioProvider } from './MiniPlayer.tsx'
import { Reader } from './Reader.tsx'
import type { ToolCtx } from './Study.tsx'
import { SettingsSheet } from './SettingsSheet.tsx'
import { Usage } from './Usage.tsx'
import { DEFAULT_BUCKETS } from './highlight.ts'

const GEN_KIND: Partial<Record<Level, GenKind>> = { subject: 'branches', branch: 'courses', course: 'syllabus' }
const SUGGESTIONS = ['Economics', 'Banking', 'Organic Chemistry', 'Music Theory', 'Psychology', 'Philosophy']

const EMPTY_TOOLS: ToolCtx = {
  extras: [],
  live: () => '',
  busy: () => false,
  error: () => '',
  pending: () => [],
  run: () => {},
  lecture: () => {},
  jobs: [],
  remove: () => {},
  teacher: { voice: DEFAULT_VOICE, style: 'professor', speed: 1 },
}

/** At most one UI update per animation frame per stream. */
const pending = new Map<string, () => void>()
function throttle(id: string, fn: () => void) {
  const first = !pending.has(id)
  pending.set(id, fn)
  if (first)
    requestAnimationFrame(() => {
      const f = pending.get(id)
      pending.delete(id)
      f?.()
    })
}

/** The lesson in the marker format the fix prompt edits. */
function lessonBlocks(l: Lesson): string {
  return [
    `@INTRO\n${l.intro}`,
    ...l.sections.map((s) => `@SECTION ${s.heading}\n${s.body}`),
    l.example ? `@EXAMPLE ${l.example.title}\n${l.example.body}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

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
  const [buckets, setBuckets] = useState<Bucket[]>(DEFAULT_BUCKETS)
  const [showUsage, setShowUsage] = useState(true)
  /** nodes fetched only for the Library or a resume (not part of any open panel) */
  const [extra, setExtra] = useState<Record<string, TreeNode>>({})
  /** tiles streaming in before they are saved */
  const [preview, setPreview] = useState<Record<string, RawItem[] | undefined>>({})
  /** study-tool output per chapter, and text still being streamed per tool */
  const [extras, setExtras] = useState<Record<string, Extra[]>>({})
  const [live, setLive] = useState<Record<string, string>>({})
  const [studyTools, setStudyTools] = useState(false)
  const [teacher, setTeacher] = useState<Teacher>({ voice: DEFAULT_VOICE, style: 'professor', speed: 1 })
  /** every lecture, for the Library (loaded when it opens) */
  const [lectures, setLectures] = useState<Extra[]>([])
  /** lectures being made in the background, by busy key */
  const [jobs, setJobs] = useState<Record<string, { chapterId: string; label: string; status: string }>>({})
  /** chapter whose lecture sheet should open (from the pill) */
  const [openLectures, setOpenLectures] = useState('')
  // "ready" pills clear themselves after a while; failures stay until dismissed
  useEffect(() => {
    const ready = Object.keys(jobs).filter((id) => jobs[id].status === 'ready')
    if (!ready.length) return
    const t = setTimeout(
      () =>
        setJobs((j) => {
          const n = { ...j }
          for (const id of ready) delete n[id]
          return n
        }),
      10000,
    )
    return () => clearTimeout(t)
  }, [jobs])
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
      setStudyTools(!!(await s.pref<boolean>('studyTools').catch(() => false)))
      setBuckets(await s.buckets().catch(() => DEFAULT_BUCKETS))
      const su = await s.pref<boolean>('showUsage').catch(() => null)
      if (su !== null) setShowUsage(su)
      const t = await s.pref<Teacher>('teacher').catch(() => null)
      if (t) setTeacher((cur) => ({ ...cur, ...t }))
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
  }, [path, kids, width])

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

  /** Children of a node: from the store, or generated once (streamed into preview tiles) and saved. */
  const ensureChildren = useCallback(
    (node: TreeNode, trail: string[]) =>
      run(node.id, async () => {
        if (!store) return
        let list = await store.children(node.id)
        let syllabus = node.level === 'course' ? await store.doc<Syllabus>(node.id) : null
        if (!list.length) {
          const kind = GEN_KIND[node.level]!
          const parse = (t: string, complete: boolean): RawItem[] =>
            kind === 'branches' ? parseBranches(t, complete) : kind === 'courses' ? parseCourses(t, complete) : parseSyllabus(t, complete).items
          const { text, model } = await generate({ kind, trail }, settings, (t) =>
            throttle(`kids:${node.id}`, () => setPreview((p) => ({ ...p, [node.id]: parse(t, false) }))),
          )
          const rows: NewNode[] = parse(text, true).map((it, i) => ({
            parent_id: node.id,
            level: CHILD_LEVEL[node.level]!,
            title: it.title.slice(0, 200),
            summary: it.summary.slice(0, 2000),
            meta: node.level === 'branch' ? { code: it.code ?? '', tier: it.tier ?? '' } : {},
            position: i,
          }))
          if (!rows.length) throw new Error('The model returned nothing usable. Try again.')
          list = await store.addNodes(rows)
          if (node.level === 'course') {
            const { description, objectives } = parseSyllabus(text, true)
            syllabus = { description, objectives }
            await store.saveDoc(node.id, syllabus, model)
          }
        }
        setKids((k) => ({ ...k, [node.id]: list }))
        setPreview((p) => ({ ...p, [node.id]: undefined }))
        if (syllabus) setDocs((d) => ({ ...d, [node.id]: syllabus }))
      }),
    [run, store, settings],
  )

  /**
   * A chapter's text: from the store, or written once (streamed onto the page) and saved.
   * After a chapter the learner opened, the next one is written in the background.
   */
  const ensureLesson = useCallback(
    (chapter: TreeNode, trail: string[], siblings: TreeNode[], prefetchNext = false): Promise<void> =>
      run(chapter.id, async () => {
        if (!store) return
        const [stored, ex] = await Promise.all([store.doc<Lesson>(chapter.id), store.extras(chapter.id).catch(() => [])])
        setExtras((e) => ({ ...e, [chapter.id]: ex }))
        let lesson = stored
        if (!siblings.length && chapter.parent_id) siblings = await store.children(chapter.parent_id)
        if (!lesson) {
          const { text, model } = await generate(
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
            (t) => throttle(`lesson:${chapter.id}`, () => setDocs((d) => ({ ...d, [chapter.id]: parseLesson(t) }))),
          )
          lesson = parseLesson(text)
          if (!lesson.sections.length) throw new Error('The chapter came back empty. Try again.')
          await store.saveDoc(chapter.id, lesson, model)
        }
        setDocs((d) => ({ ...d, [chapter.id]: lesson }))
        if (prefetchNext) {
          const next = siblings[siblings.findIndex((s) => s.id === chapter.id) + 1]
          if (next) void ensureLessonRef.current(next, trail, siblings)
        }
      }),
    [run, store, settings],
  )
  const ensureLessonRef = useRef(ensureLesson)
  ensureLessonRef.current = ensureLesson

  /** Study tools: generate once, stream while writing, save under the chapter. */
  const runExtra = useCallback(
    (chapter: TreeNode, kind: 'deeper' | 'answer' | 'practice' | 'factcheck' | 'visual', key: string, extraReq: Partial<GenRequest>) => {
      const id = liveKey(chapter.id, kind, key)
      return run(id, async () => {
        if (!store) return
        const trail = chainIds(chapter.id, known).slice(0, 3).map((x) => known[x]?.title ?? '')
        const { text, model } = await generate(
          {
            kind,
            trail: trail.filter(Boolean).length ? trail.filter(Boolean) : [chapter.title],
            chapter: { title: chapter.title, summary: chapter.summary, index: 0, outline: [] },
            ...extraReq,
          },
          settings,
          (t) => throttle(id, () => setLive((l) => ({ ...l, [id]: t }))),
        )
        let body: unknown
        if (kind === 'visual') {
          const spec = parseChart(text)
          if (!spec) throw new Error("Couldn't draw that one. Try again, or describe the chart you want.")
          body = { ...spec, request: extraReq.question ?? '' }
        } else if (kind === 'deeper') body = { sections: parseSections(text) }
        else if (kind === 'practice') body = { problems: parsePractice(text) }
        else if (kind === 'answer') body = { question: key, text: text.trim() }
        else body = parseCheck(text)
        const row = await store.addExtra(chapter.id, kind === 'factcheck' ? 'check' : kind, key, body, model)
        setExtras((e) => ({ ...e, [chapter.id]: [...(e[chapter.id] ?? []), row] }))
        setLive((l) => ({ ...l, [id]: '' }))
      })
    },
    [run, store, settings, known],
  )

  /** Rewrite only the flagged parts using the fact-check's corrections. */
  const fixChapter = useCallback(
    (chapter: TreeNode, lesson: Lesson, check: CheckResult) =>
      run(liveKey(chapter.id, 'fix', ''), async () => {
        if (!store) return
        const trail = chainIds(chapter.id, known).slice(0, 3).map((x) => known[x]?.title ?? '').filter(Boolean)
        const issues = check.issues
          .map((i, n) => `${n + 1}. Claim: ${i.claim}\n   Problem: ${i.problem}\n   Correction: ${i.correction}`)
          .join('\n')
        const { text, model } = await generate(
          { kind: 'fix', trail: trail.length ? trail : [chapter.title], context: lessonBlocks(lesson), issues },
          settings,
        )
        const fixed = applyFix(lesson, text)
        const a = await store.addExtra(chapter.id, 'fixed', '', fixed, model)
        const b = await store.addExtra(chapter.id, 'check', '', { ...check, verdict: 'fixed', checkedAt: new Date().toISOString() }, model)
        setExtras((e) => ({ ...e, [chapter.id]: [...(e[chapter.id] ?? []), a, b] }))
      }),
    [run, store, settings, known],
  )

  /**
   * Write a spoken script, record it in the teacher's voice, store the MP3. Runs in the
   * background (progress in the floating pill), so reading isn't interrupted.
   */
  const runLecture = useCallback(
    (chapter: TreeNode, lesson: Lesson, sections: string[], length: LectureLength) => {
      const key = String(Date.now())
      const id = liveKey(chapter.id, 'lecture', key)
      const label = sections.join(' + ') || 'Whole chapter'
      const setJob = (status: string) => setJobs((j) => ({ ...j, [id]: { chapterId: chapter.id, label, status } }))
      setJob('Writing script…')
      return run(id, async () => {
        if (!store) return
        try {
          const chain = chainIds(chapter.id, known).map((x) => known[x]).filter(Boolean)
          const trail = chain.slice(0, 3).map((n) => n.title)
          const { text, model } = await generate(
            {
              kind: 'lecture',
              trail: trail.length ? trail : [chapter.title],
              chapter: { title: chapter.title, summary: chapter.summary, index: 0, outline: [] },
              context: lessonText(lesson),
              focus: sections.length ? sections : undefined,
              length,
            },
            settings,
          )
          const script = text.trim()
          const v = await resolveVoice(teacher.voice, teacher.model, settings)
          const audio = await record(script, { voice: v.voice, style: teacher.style, model: v.model }, settings, (d, n) =>
            setJob(`Recording ${d}/${n}…`),
          )
          setJob('Saving…')
          const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
          const ext = audio.type === 'audio/wav' ? 'wav' : 'mp3'
          const audioUrl = await store.uploadAudio(`${chapter.id}/${slug}-${key}.${ext}`, audio)
          const code = chain[2]?.meta.code
          const body: LectureBody = {
            script,
            audioUrl,
            voice: v.voice,
            style: teacher.style,
            sections,
            length,
            fileName: `${[code, chapter.title, sections.length ? label : '', length].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '')}.${ext}`,
          }
          const row = await store.addExtra(chapter.id, 'lecture', key, body, model)
          setExtras((e) => ({ ...e, [chapter.id]: [...(e[chapter.id] ?? []), row] }))
          setLectures((ls) => [...ls, row])
          setJob('ready')
        } catch (err) {
          setJob(`failed: ${err instanceof Error ? err.message : 'Something went wrong.'}`)
          throw err
        }
      })
    },
    [run, store, settings, known, teacher],
  )

  const removeExtra = async (chapter: TreeNode, x: Extra) => {
    if (!store) return
    if (x.kind === 'lecture') {
      setLectures((ls) => ls.filter((y) => y.id !== x.id))
      void store.deleteAudio((x.body as LectureBody).audioUrl).catch(() => {})
    }
    setExtras((e) => ({ ...e, [chapter.id]: (e[chapter.id] ?? []).filter((y) => y.id !== x.id) }))
    await store.removeExtra(x.id).catch(() => setExtras((e) => ({ ...e, [chapter.id]: [...(e[chapter.id] ?? []), x] })))
  }

  const saveTeacher = (t: Teacher) => {
    setTeacher(t)
    void store?.setPref('teacher', t).catch(() => {})
  }

  // The Library lists every lecture; fetch them when it opens.
  useEffect(() => {
    if (tab === 'library' && store) void store.extrasOfKind('lecture').then(setLectures).catch(() => {})
  }, [tab, store])

  const toggleStudyTools = () => {
    const next = !studyTools
    setStudyTools(next)
    void store?.setPref('studyTools', next).catch(() => {})
  }

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
        if (!docs[node.id]) void ensureLesson(node, trail.slice(0, 3), kids[next[2].id] ?? [], true)
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

  /** where you last were inside each subject (subject id → node ids, top down); synced */
  const [trails, setTrails] = useState<Record<string, string[]>>({})
  const trailsLoaded = useRef(false)
  useEffect(() => {
    if (!store || trailsLoaded.current) return
    trailsLoaded.current = true
    void store
      .pref<Record<string, string[]>>('trails')
      .then((t) => t && setTrails((cur) => ({ ...t, ...cur })))
      .catch(() => {})
  }, [store])
  useEffect(() => {
    const sub = path[0]
    if (!sub) return
    const ids = path.map((n) => n.id)
    setTrails((t) => (t[sub.id]?.join() === ids.join() ? t : { ...t, [sub.id]: ids }))
  }, [path])
  // save a moment after the last move rather than on every click
  useEffect(() => {
    if (!store || !trailsLoaded.current || !Object.keys(trails).length) return
    const t = setTimeout(() => void store.setPref('trails', trails).catch(() => {}), 1500)
    return () => clearTimeout(t)
  }, [trails, store])

  /** Open a subject where you left it; tapping the subject you're already in goes to its top. */
  const openSubject = useCallback(
    (s: TreeNode) => {
      const last = trails[s.id]
      if (path[0]?.id === s.id || !last || last.length < 2) return select(s, 0, [])
      setRailOpen(false)
      void openById(last[last.length - 1])
    },
    [trails, path, select, openById],
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

  const saveSnippet = async (node: TreeNode, text: string, color = 'yellow') => {
    if (!store) return
    const row = await store.addSaved({ node_id: node.id, kind: 'snippet', text: text.slice(0, 4000), color })
    setSaved((s) => [...s, row])
  }

  const recolor = async (item: SavedItem, color: string) => {
    if (!store) return
    setSaved((s) => s.map((x) => (x.id === item.id ? { ...x, color } : x)))
    await store.recolorSaved(item.id, color).catch(() => setSaved((s) => s.map((x) => (x.id === item.id ? item : x))))
  }

  const saveBucket = async (b: Bucket) => {
    if (!store) return
    setBuckets((list) => {
      const rest = list.filter((x) => x.key !== b.key)
      return [...rest, b].sort((x, y) => x.position - y.position)
    })
    await store.saveBucket(b).catch(() => {})
  }

  const toggleUsage = (on: boolean) => {
    setShowUsage(on)
    void store?.setPref('showUsage', on).catch(() => {})
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
    if (existing) return openSubject(existing)
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
    const W: Record<Fold, number> = { full: phone ? width - 48 : 300, compact: 210, strip: 48, hidden: -14 }
    const newest = chapter ? Math.min(420, width - 32) : W.full // the reader stretches into whatever is left
    const out: Fold[] = panels.map(() => 'full')
    const total = () => out.reduce((t, f, i) => t + (i === out.length - 1 && !chapter ? newest : W[f]) + 14, chapter ? newest : -14)
    const last = chapter ? out.length : out.length - 1 // the newest panel never folds
    for (let i = 0; i < last && total() > avail; i++) {
      if (phone) {
        out[i] = 'hidden'
        continue
      }
      out[i] = 'compact'
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
  const chapterExtras = chapter ? (extras[chapter.id] ?? []) : []
  /** a fact-check fix is stored as a corrected copy; show it in place of the original */
  const lesson = chapter
    ? ((latest(chapterExtras, 'fixed')?.body as Lesson | undefined) ?? (docs[chapter.id] as Lesson | undefined))
    : undefined
  const tools: ToolCtx | null =
    chapter && lesson
      ? {
          extras: chapterExtras,
          live: (kind, key) => live[liveKey(chapter.id, kind, key)] ?? '',
          busy: (kind, key) => !!busy[liveKey(chapter.id, kind, key)],
          error: (kind, key) => errors[liveKey(chapter.id, kind, key)] ?? '',
          pending: (kind) => {
            const prefix = liveKey(chapter.id, kind, '')
            return Object.keys(busy)
              .filter((k) => busy[k] && k.startsWith(prefix))
              .map((k) => k.slice(prefix.length))
          },
          run: (kind, key, req) => void runExtra(chapter, kind, key, { ...req, context: lessonText(lesson) }),
          lecture: (sections, length) => void runLecture(chapter, lesson, sections, length),
          jobs: Object.entries(jobs)
            .filter(([, j]) => j.chapterId === chapter.id && j.status !== 'ready')
            .map(([id, j]) => ({ id, ...j })),
          remove: (x) => void removeExtra(chapter, x),
          teacher,
        }
      : null

  return (
    <div className={`shell ${railOpen ? 'rail-open' : ''} ${railHidden ? 'rail-hidden' : ''} tab-${tab}`}>
      <AudioProvider store={store} speed={teacher.speed}>
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
          {showUsage && <Usage />}
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
                  onClick={() => openSubject(s)}
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
            lectures={lectures}
            nodes={known}
            docs={docs}
            done={done}
            loadAncestors={loadAncestors}
            onOpen={(id) => void openById(id)}
            onRemove={(x) => void removeSaved(x)}
            buckets={buckets}
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
                      preview={preview[parent.id]}
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
                    lesson={lesson}
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
                    onSaveSnippet={(t, c) => void saveSnippet(chapter, t, c)}
                    highlights={saved.filter((x) => x.kind === 'snippet' && x.node_id === chapter.id)}
                    onRecolor={(x, c) => void recolor(x, c)}
                    buckets={buckets}
                    onRemoveHighlight={(x) => void removeSaved(x)}
                    studyTools={studyTools}
                    onToggleStudyTools={toggleStudyTools}
                    tools={tools ?? EMPTY_TOOLS}
                    fixing={!!busy[liveKey(chapter.id, 'fix', '')]}
                    fixError={errors[liveKey(chapter.id, 'fix', '')] ?? ''}
                    onFix={(check) => lesson && void fixChapter(chapter, lesson, check)}
                    openLectures={openLectures === chapter.id}
                    onLecturesOpened={() => setOpenLectures('')}
                  />
                )}
              </>
            )}
          </div>
        </main>

        <JobPill
          jobs={jobs}
          names={known}
          onOpen={(id, chapterId) => {
            setJobs((j) => {
              const n = { ...j }
              delete n[id]
              return n
            })
            void openById(chapterId)
            setOpenLectures(chapterId)
          }}
          onDismiss={(id) =>
            setJobs((j) => {
              const n = { ...j }
              delete n[id]
              return n
            })
          }
        />

        {showSettings && (
          <SettingsSheet
            settings={settings}
            mode={store?.mode}
            teacher={teacher}
            onTeacher={saveTeacher}
            buckets={buckets}
            onSaveBucket={(b) => void saveBucket(b)}
            showUsage={showUsage}
            onShowUsage={toggleUsage}
            onSave={(s) => {
              setSettings(s)
              saveSettings(s)
              setShowSettings(false)
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AudioProvider>
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

/** Floating status for lectures recording in the background. */
function JobPill({
  jobs,
  names,
  onOpen,
  onDismiss,
}: {
  jobs: Record<string, { chapterId: string; label: string; status: string }>
  names: Record<string, TreeNode>
  onOpen: (id: string, chapterId: string) => void
  onDismiss: (id: string) => void
}) {
  const list = Object.entries(jobs)
  if (!list.length) return null
  return (
    <div className="job-pills" aria-live="polite">
      {list.map(([id, j]) => {
        const ready = j.status === 'ready'
        const failed = j.status.startsWith('failed')
        return (
          <div key={id} className={`job-pill ${ready ? 'ready' : ''} ${failed ? 'failed' : ''}`}>
            <button className="job-main" onClick={() => onOpen(id, j.chapterId)}>
              {!ready && !failed && <span className="pulse" />}
              <span className="job-text">
                <b>{ready ? '🎧 Lecture ready' : failed ? 'Lecture failed' : `🎧 ${j.status}`}</b>
                <small>
                  {names[j.chapterId]?.title ?? ''} · {j.label}
                  {failed ? ` · ${j.status.slice(8)}` : ''}
                </small>
              </span>
            </button>
            {(ready || failed) && (
              <button className="job-x" onClick={() => onDismiss(id)} aria-label="Dismiss">
                ×
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
