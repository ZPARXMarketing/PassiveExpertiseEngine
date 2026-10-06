import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LectureControl } from './Study.tsx'
import { chainIds, lectureTitle, type Bucket, type Extra, type LectureBody, type Path, type SavedItem, type Syllabus, type TreeNode } from './types.ts'
import { colorOf } from './highlight.ts'

type Filter = 'all' | 'course' | 'chapter' | 'snippet' | 'lecture'
type Sort = 'catalog' | 'recent' | 'az' | 'bucket'

/** How the Library was left: filter, search, sort, folded groups, scroll. Kept on this device. */
interface View {
  filter: Filter
  query: string
  sort: Sort
  /** 'all' or a bucket key: show only highlights saved to that bucket */
  bucket: string
  closed: string[]
  scroll: number
  /** browse columns: selected subject, branch, course, chapter */
  sel: string[]
}
const VIEW_KEY = 'xe-library-view-v1'
function loadView(): View {
  const base: View = { filter: 'all', query: '', sort: 'catalog', bucket: 'all', closed: [], scroll: 0, sel: [] }
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<View>) }
  } catch {
    return base
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v))
  } catch {
    /* blocked storage: the view lasts for this visit only */
  }
}

interface Props {
  saved: SavedItem[]
  lectures: Extra[]
  nodes: Record<string, TreeNode>
  docs: Record<string, unknown>
  done: Set<string>
  loadAncestors: (ids: string[]) => Promise<Record<string, TreeNode>>
  onOpen: (nodeId: string) => void
  onRemove: (item: SavedItem) => void
  buckets: Bucket[]
  paths: Path[]
  /** add a chapter (or a course's chapters) to a path; 'new' makes one. Resolves to the path's name. */
  onAddToPath: (nodeId: string, pathId: string) => Promise<string>
}

interface ChapterGroup {
  node: TreeNode
  saved?: SavedItem
  snippets: SavedItem[]
  lectures: Extra[]
  latest?: string
}
interface CourseGroup {
  node: TreeNode
  saved?: SavedItem
  chapters: Map<string, ChapterGroup>
  latest: string
}
interface BranchGroup {
  node: TreeNode
  courses: Map<string, CourseGroup>
  latest: string
}
interface SubjectGroup {
  node: TreeNode
  branches: Map<string, BranchGroup>
  count: number
  latest: string
}

type Grouped = { node: TreeNode; latest?: string }
/** Order groups at every level by the chosen sort. */
const sorter = (sort: Sort) => (a: Grouped, b: Grouped) =>
  sort === 'recent'
    ? (b.latest ?? '').localeCompare(a.latest ?? '')
    : sort === 'az'
      ? a.node.title.localeCompare(b.node.title)
      : a.node.position - b.node.position

const SORTS: [Sort, string][] = [
  ['catalog', 'Course order'],
  ['recent', 'Recently saved'],
  ['az', 'A–Z'],
  ['bucket', 'By colour'],
]

/**
 * Everything saved, always filed the same way: subject → branch → course → chapter
 * (catalog order), highlights under the chapter they came from. Nothing to organise by hand.
 */
export function Library({ saved, lectures, nodes, docs, done, loadAncestors, onOpen, onRemove, buckets, paths, onAddToPath }: Props) {
  const initial = useMemo(loadView, [])
  const [filter, setFilter] = useState<Filter>(initial.filter)
  const [query, setQuery] = useState(initial.query)
  const [sort, setSort] = useState<Sort>(initial.sort)
  const [bucket, setBucket] = useState(initial.bucket)
  const [closed, setClosed] = useState<Set<string>>(new Set(initial.closed))
  const [sel, setSel] = useState<string[]>(initial.sel)
  const scrollRef = useRef<HTMLElement>(null)
  const scrollPos = useRef(initial.scroll)
  const byPos = sorter(sort)

  // remember the view (and where you'd scrolled to) every time it changes or you leave
  useEffect(
    () => saveView({ filter, query, sort, bucket, closed: [...closed], scroll: scrollPos.current, sel }),
    [filter, query, sort, bucket, closed, sel],
  )
  useEffect(
    () => () => saveView({ ...loadView(), scroll: scrollPos.current }),
    [],
  )
  const toggle = (id: string) =>
    setClosed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Make sure every saved item's ancestors are loaded so it can be filed.
  const missing = [...saved, ...lectures].filter((x) => chainIds(x.node_id, nodes).some((id) => !nodes[id]) || !nodes[x.node_id])
  const missingKey = missing.map((x) => x.node_id).join(',')
  const load = useRef(loadAncestors)
  load.current = loadAncestors
  useEffect(() => {
    if (missingKey) void load.current(missingKey.split(','))
  }, [missingKey])

  const counts = useMemo(() => {
    const c = { all: saved.length + lectures.length, course: 0, chapter: 0, snippet: 0, lecture: lectures.length }
    for (const x of saved) {
      if (x.kind === 'snippet') c.snippet++
      else if (nodes[x.node_id]?.level === 'course') c.course++
      else c.chapter++
    }
    return c
  }, [saved, lectures, nodes])

  const tree = useMemo(() => {
    const q = query.trim().toLowerCase()
    const subjects = new Map<string, SubjectGroup>()
    const entries: (SavedItem | Extra)[] = [...saved, ...lectures]
    for (const item of entries) {
      const node = nodes[item.node_id]
      if (!node) continue
      const type: Filter =
        item.kind === 'lecture' ? 'lecture' : item.kind === 'snippet' ? 'snippet' : node.level === 'course' ? 'course' : 'chapter'
      if (filter !== 'all' && filter !== type) continue
      if (bucket !== 'all' && (item.kind !== 'snippet' || ((item as SavedItem).color ?? 'yellow') !== bucket)) continue
      const chain = chainIds(item.node_id, nodes).map((id) => nodes[id])
      const [subject, branch, course, chapter] = chain
      if (!subject || !branch || !course) continue
      if (q) {
        const extraText = 'text' in item ? item.text : lectureTitle(item.body as LectureBody)
        const hay = [...chain.map((n) => n?.title ?? ''), course.meta.code ?? '', extraText].join(' ').toLowerCase()
        if (!hay.includes(q)) continue
      }

      const at = item.created_at
      let s = subjects.get(subject.id)
      if (!s) subjects.set(subject.id, (s = { node: subject, branches: new Map(), count: 0, latest: '' }))
      s.count++
      let b = s.branches.get(branch.id)
      if (!b) s.branches.set(branch.id, (b = { node: branch, courses: new Map(), latest: '' }))
      let c = b.courses.get(course.id)
      if (!c) b.courses.set(course.id, (c = { node: course, chapters: new Map(), latest: '' }))
      for (const g of [s, b, c]) if (at > g.latest) g.latest = at
      if (!chapter) {
        if ('text' in item) c.saved = item
        continue
      }
      let ch = c.chapters.get(chapter.id)
      if (!ch) c.chapters.set(chapter.id, (ch = { node: chapter, snippets: [], lectures: [], latest: '' }))
      if (at > (ch.latest ?? '')) ch.latest = at
      if (item.kind === 'lecture') ch.lectures.push(item as Extra)
      else if (item.kind === 'snippet') ch.snippets.push(item as SavedItem)
      else ch.saved = item as SavedItem
    }
    const list = [...subjects.values()]
    return sort === 'recent' ? list.sort((a, b) => b.latest.localeCompare(a.latest)) : list.sort((a, b) => a.node.title.localeCompare(b.node.title))
  }, [saved, lectures, nodes, filter, query, sort, bucket])

  /** highlights per bucket key (for the colour chips) */
  const perBucket = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of saved) if (x.kind === 'snippet') m.set(x.color ?? 'yellow', (m.get(x.color ?? 'yellow') ?? 0) + 1)
    return m
  }, [saved])
  /** buckets that are live or still hold highlights, in order */
  const shownBuckets = buckets.filter((b) => !b.archived || perBucket.get(b.key))

  /** Group by bucket: every highlight under its bucket, newest first, with where it came from. */
  const byBucket = useMemo(() => {
    if (sort !== 'bucket') return []
    const q = query.trim().toLowerCase()
    return shownBuckets
      .filter((b) => bucket === 'all' || b.key === bucket)
      .map((b) => {
        const items = saved
          .filter((x) => x.kind === 'snippet' && (x.color ?? 'yellow') === b.key)
          .filter((x) => {
            if (!q) return true
            const chain = chainIds(x.node_id, nodes).map((id) => nodes[id]?.title ?? '')
            return [x.text, ...chain].join(' ').toLowerCase().includes(q)
          })
          .sort((a, c) => c.created_at.localeCompare(a.created_at))
        return { bucket: b, items }
      })
      .filter((g) => g.items.length)
    // shownBuckets is derived from buckets + perBucket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, query, bucket, saved, nodes, buckets, perBucket])

  // put the scroll back where it was once the groups have rendered
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (restored.current || !tree.length || !scrollRef.current) return
    restored.current = true
    scrollRef.current.scrollTop = scrollPos.current
  }, [tree])

  const allIds = byBucket.map((g) => `bucket:${g.bucket.key}`)

  const FILTERS: [Filter, string][] = [
    ['all', 'All'],
    ['course', 'Courses'],
    ['chapter', 'Chapters'],
    ['snippet', 'Highlights'],
    ['lecture', 'Lectures'],
  ]

  return (
    <section className={`library ${sort === 'bucket' ? '' : 'browse'}`} ref={scrollRef} onScroll={(e) => (scrollPos.current = e.currentTarget.scrollTop)}>
      <div className="lib-bar">
        <input
          className="lib-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library"
          aria-label="Search library"
        />
        <div className="lib-filters" role="tablist">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? 'on' : ''}
              onClick={() => setFilter(key)}
            >
              {label} <span className="count">{counts[key]}</span>
            </button>
          ))}
        </div>
        {shownBuckets.length > 0 && perBucket.size > 0 && (
          <div className="lib-buckets" role="group" aria-label="Filter by bucket">
            <button className={bucket === 'all' ? 'on' : ''} onClick={() => setBucket('all')}>
              All colours
            </button>
            {shownBuckets.map((b) => (
              <button
                key={b.key}
                className={bucket === b.key ? 'on' : ''}
                style={{ '--hl': b.color } as React.CSSProperties}
                onClick={() => setBucket(bucket === b.key ? 'all' : b.key)}
              >
                <i />
                {b.name} <span className="count">{perBucket.get(b.key) ?? 0}</span>
              </button>
            ))}
          </div>
        )}
        <div className="lib-tools">
          <label className="lib-sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {sort === 'bucket' && (
            <>
          <button className="btn-ghost lib-fold" onClick={() => setClosed(new Set())} disabled={!closed.size}>
            Open all
          </button>
          <button className="btn-ghost lib-fold" onClick={() => setClosed(new Set(allIds))} disabled={closed.size >= allIds.length}>
            Close all
          </button>
            </>
          )}
        </div>
      </div>

      {saved.length + lectures.length === 0 ? (
        <div className="lib-empty">
          <h2>Nothing saved yet</h2>
          <p>
            Tap ☆ on any course or chapter, or highlight text in a chapter and tap <b>★ Save highlight</b>. It lands
            here, filed by subject, branch and course.
          </p>
        </div>
      ) : sort === 'bucket' ? (
        byBucket.length === 0 ? (
          <p className="lib-empty">No highlights{bucket !== 'all' || query ? ' match' : ' yet'}.</p>
        ) : (
          byBucket.map(({ bucket: b, items }) => (
            <details key={b.key} className="lib-subject lib-bucket" open={!closed.has(`bucket:${b.key}`)}>
              <summary
                style={{ '--hl': b.color } as React.CSSProperties}
                onClick={(e) => {
                  e.preventDefault()
                  toggle(`bucket:${b.key}`)
                }}
              >
                <span>
                  <i className="lib-bucket-dot" />
                  {b.name}
                </span>
                <span className="count">{items.length}</span>
              </summary>
              {items.map((sn) => {
                const chain = chainIds(sn.node_id, nodes).map((id) => nodes[id])
                const course = chain[2]
                const chapter = chain[3]
                return (
                  <blockquote key={sn.id} className="lib-snip" style={{ '--hl': b.color } as React.CSSProperties}>
                    <p>{sn.text}</p>
                    {chapter && (
                      <button className="lib-from" onClick={() => onOpen(chapter.id)}>
                        {course?.meta.code ? `${course.meta.code} · ` : ''}
                        {course?.title} › Ch {chapter.position + 1} {chapter.title}
                      </button>
                    )}
                    <button className="lib-x" onClick={() => onRemove(sn)} aria-label="Remove highlight">
                      ×
                    </button>
                  </blockquote>
                )
              })}
            </details>
          ))
        )
      ) : tree.length === 0 ? (
        <p className="lib-empty">{missing.length ? 'Loading…' : 'No matches.'}</p>
      ) : (
        <Browse
          tree={tree}
          sel={sel}
          setSel={setSel}
          byPos={byPos}
          docs={docs}
          done={done}
          buckets={buckets}
          paths={paths}
          onOpen={onOpen}
          onRemove={onRemove}
          onAddToPath={onAddToPath}
        />
      )}
    </section>
  )
}

/** The library as columns, like Explore: subject → branch → course → chapter → what you saved there. */
function Browse({
  tree,
  sel,
  setSel,
  byPos,
  docs,
  done,
  buckets,
  paths,
  onOpen,
  onRemove,
  onAddToPath,
}: {
  tree: SubjectGroup[]
  sel: string[]
  setSel: (s: string[]) => void
  byPos: (a: Grouped, b: Grouped) => number
  docs: Record<string, unknown>
  done: Set<string>
  buckets: Bucket[]
  paths: Path[]
  onOpen: (id: string) => void
  onRemove: (item: SavedItem) => void
  onAddToPath: (nodeId: string, pathId: string) => Promise<string>
}) {
  // follow the saved selection as far as it still exists; a level with one choice opens itself
  const subject = tree.find((x) => x.node.id === sel[0]) ?? (tree.length === 1 ? tree[0] : undefined)
  const branches = subject ? [...subject.branches.values()].sort(byPos) : []
  const branch = branches.find((x) => x.node.id === sel[1]) ?? (branches.length === 1 ? branches[0] : undefined)
  const courses = branch ? [...branch.courses.values()].sort(byPos) : []
  const course = courses.find((x) => x.node.id === sel[2]) ?? (courses.length === 1 ? courses[0] : undefined)
  const chapters = course ? [...course.chapters.values()].sort(byPos) : []
  const chapter = chapters.find((x) => x.node.id === sel[3])
  const pick = (depth: number, id: string) => setSel([...[subject, branch, course].slice(0, depth).map((g) => g?.node.id ?? ''), id])

  const colsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = colsRef.current
    if (el) requestAnimationFrame(() => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }))
  }, [sel])

  const count = (n: number) => <span className="count">{n}</span>
  const branchCount = (b: BranchGroup) => [...b.courses.values()].reduce((t, c) => t + courseCount(c), 0)
  const courseCount = (c: CourseGroup) =>
    (c.saved ? 1 : 0) + [...c.chapters.values()].reduce((t, ch) => t + (ch.saved ? 1 : 0) + ch.snippets.length + ch.lectures.length, 0)
  const chapterCount = (ch: ChapterGroup) => (ch.saved ? 1 : 0) + ch.snippets.length + ch.lectures.length

  return (
    <div className="lib-cols" ref={colsRef}>
      <section className="column">
        <header className="column-head">
          <span className="column-kicker">Subjects</span>
        </header>
        <ol className="tiles">
          {tree.map((g) => (
            <li key={g.node.id} className="tile-wrap">
              <button className={`tile ${subject === g ? 'active' : ''}`} onClick={() => pick(0, g.node.id)}>
                <span className="tile-title lib-tile-row">
                  {g.node.title} {count(g.count)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {subject && (
        <section className="column">
          <header className="column-head">
            <span className="column-kicker">Branches</span>
            <h2>{subject.node.title}</h2>
          </header>
          <ol className="tiles">
            {branches.map((g) => (
              <li key={g.node.id} className="tile-wrap">
                <button className={`tile ${branch === g ? 'active' : ''}`} onClick={() => pick(1, g.node.id)}>
                  <span className="tile-title lib-tile-row">
                    {g.node.title} {count(branchCount(g))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {branch && (
        <section className="column">
          <header className="column-head">
            <span className="column-kicker">Courses</span>
            <h2>{branch.node.title}</h2>
          </header>
          <ol className="tiles">
            {courses.map((g) => (
              <li key={g.node.id} className="tile-wrap">
                <button className={`tile ${course === g ? 'active' : ''}`} onClick={() => pick(2, g.node.id)}>
                  <span className="tile-top">
                    {g.node.meta.code && <span className="code">{g.node.meta.code}</span>}
                    {g.saved && <span className="lib-star">★</span>}
                  </span>
                  <span className="tile-title lib-tile-row">
                    {g.node.title} {count(courseCount(g))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {course && (
        <section className="column">
          <header className="column-head">
            <span className="column-kicker">{course.node.meta.code || 'Course'}</span>
            <h2>{course.node.title}</h2>
            {course.saved && ((docs[course.node.id] as Syllabus | undefined)?.description || course.node.summary) && (
              <p className="column-desc">{(docs[course.node.id] as Syllabus | undefined)?.description || course.node.summary}</p>
            )}
            <div className="lib-actions">
              <button className="btn-ghost" onClick={() => onOpen(course.node.id)}>
                Open course
              </button>
              <AddToPath nodeId={course.node.id} paths={paths} onAdd={onAddToPath} label="+ Path (whole course)" />
              {course.saved && (
                <button className="btn-ghost" onClick={() => onRemove(course.saved!)}>
                  ★ Unsave
                </button>
              )}
            </div>
          </header>
          <ol className="tiles">
            {chapters.map((g) => (
              <li key={g.node.id} className="tile-wrap">
                <button className={`tile ${chapter === g ? 'active' : ''}`} onClick={() => pick(3, g.node.id)}>
                  <span className="tile-top">
                    <span className="tile-num">Ch {g.node.position + 1}</span>
                    {g.saved && <span className="lib-star">★</span>}
                    {done.has(g.node.id) && <span className="tick">✓</span>}
                  </span>
                  <span className="tile-title lib-tile-row">
                    {g.node.title} {count(chapterCount(g))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {chapter && (
        <section className="column lib-items">
          <header className="column-head">
            <span className="column-kicker">Chapter {chapter.node.position + 1}</span>
            <h2>{chapter.node.title}</h2>
            <div className="lib-actions">
              <button className="btn-neon" onClick={() => onOpen(chapter.node.id)}>
                Open chapter
              </button>
              <AddToPath nodeId={chapter.node.id} paths={paths} onAdd={onAddToPath} label="+ Path" />
              {chapter.saved && (
                <button className="btn-ghost" onClick={() => onRemove(chapter.saved!)}>
                  ★ Unsave
                </button>
              )}
            </div>
          </header>
          {chapter.lectures.map((l) => {
            const b = l.body as LectureBody
            return (
              <div key={l.id} className="lib-lecture">
                <div className="lib-lecture-title">🎧 {lectureTitle(b)}</div>
                <LectureControl id={l.id} url={b.audioUrl} title={lectureTitle(b)} subtitle={chapter.node.title} fileName={b.fileName} />
              </div>
            )
          })}
          {[...chapter.snippets]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((sn) => (
              <blockquote key={sn.id} className="lib-snip" style={{ '--hl': colorOf(sn.color, buckets) } as React.CSSProperties}>
                <p>{sn.text}</p>
                <button className="lib-x" onClick={() => onRemove(sn)} aria-label="Remove highlight">
                  ×
                </button>
              </blockquote>
            ))}
          {!chapter.snippets.length && !chapter.lectures.length && <p className="sheet-note">Saved as a whole chapter.</p>}
        </section>
      )}
    </div>
  )
}

/** "+ Path": a native picker (easy on iPad) of your paths, or a new one. */
export function AddToPath({
  nodeId,
  paths,
  onAdd,
  label,
}: {
  nodeId: string
  paths: Path[]
  onAdd: (nodeId: string, pathId: string) => Promise<string>
  label: string
}) {
  const [note, setNote] = useState('')
  return (
    <label className="add-path btn-ghost">
      {note || label}
      <select
        value=""
        onChange={async (e) => {
          const id = e.target.value
          if (!id) return
          try {
            setNote(`Added to ${await onAdd(nodeId, id)} ✓`)
          } catch (err) {
            setNote(err instanceof Error ? err.message : 'Could not add it.')
          }
          setTimeout(() => setNote(''), 2500)
        }}
        aria-label="Add to a path"
      >
        <option value="">Add to…</option>
        {paths
          .filter((p) => !p.archived)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        <option value="new">+ New path</option>
      </select>
    </label>
  )
}
