import { useEffect, useMemo, useRef, useState } from 'react'
import { Player } from './Study.tsx'
import { chainIds, type Extra, type LectureBody, type SavedItem, type Syllabus, type TreeNode } from './types.ts'

type Filter = 'all' | 'course' | 'chapter' | 'snippet' | 'lecture'

interface Props {
  saved: SavedItem[]
  lectures: Extra[]
  speed: number
  nodes: Record<string, TreeNode>
  docs: Record<string, unknown>
  done: Set<string>
  loadAncestors: (ids: string[]) => Promise<Record<string, TreeNode>>
  onOpen: (nodeId: string) => void
  onRemove: (item: SavedItem) => void
}

interface ChapterGroup {
  node: TreeNode
  saved?: SavedItem
  snippets: SavedItem[]
  lectures: Extra[]
}
interface CourseGroup {
  node: TreeNode
  saved?: SavedItem
  chapters: Map<string, ChapterGroup>
}
interface BranchGroup {
  node: TreeNode
  courses: Map<string, CourseGroup>
}
interface SubjectGroup {
  node: TreeNode
  branches: Map<string, BranchGroup>
  count: number
}

const byPos = (a: { node: TreeNode }, b: { node: TreeNode }) => a.node.position - b.node.position

/**
 * Everything saved, always filed the same way: subject → branch → course → chapter
 * (catalog order), highlights under the chapter they came from. Nothing to organise by hand.
 */
export function Library({ saved, lectures, speed, nodes, docs, done, loadAncestors, onOpen, onRemove }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

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
      const chain = chainIds(item.node_id, nodes).map((id) => nodes[id])
      const [subject, branch, course, chapter] = chain
      if (!subject || !branch || !course) continue
      if (q) {
        const extraText = 'text' in item ? item.text : (item.body as LectureBody).section
        const hay = [...chain.map((n) => n?.title ?? ''), course.meta.code ?? '', extraText].join(' ').toLowerCase()
        if (!hay.includes(q)) continue
      }

      let s = subjects.get(subject.id)
      if (!s) subjects.set(subject.id, (s = { node: subject, branches: new Map(), count: 0 }))
      s.count++
      let b = s.branches.get(branch.id)
      if (!b) s.branches.set(branch.id, (b = { node: branch, courses: new Map() }))
      let c = b.courses.get(course.id)
      if (!c) b.courses.set(course.id, (c = { node: course, chapters: new Map() }))
      if (!chapter) {
        if ('text' in item) c.saved = item
        continue
      }
      let ch = c.chapters.get(chapter.id)
      if (!ch) c.chapters.set(chapter.id, (ch = { node: chapter, snippets: [], lectures: [] }))
      if (item.kind === 'lecture') ch.lectures.push(item as Extra)
      else if (item.kind === 'snippet') ch.snippets.push(item as SavedItem)
      else ch.saved = item as SavedItem
    }
    return [...subjects.values()].sort((a, b) => a.node.title.localeCompare(b.node.title))
  }, [saved, lectures, nodes, filter, query])

  const FILTERS: [Filter, string][] = [
    ['all', 'All'],
    ['course', 'Courses'],
    ['chapter', 'Chapters'],
    ['snippet', 'Highlights'],
    ['lecture', 'Lectures'],
  ]

  return (
    <section className="library">
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
      </div>

      {saved.length + lectures.length === 0 ? (
        <div className="lib-empty">
          <h2>Nothing saved yet</h2>
          <p>
            Tap ☆ on any course or chapter, or highlight text in a chapter and tap <b>★ Save highlight</b>. It lands
            here, filed by subject, branch and course.
          </p>
        </div>
      ) : tree.length === 0 ? (
        <p className="lib-empty">{missing.length ? 'Loading…' : 'No matches.'}</p>
      ) : (
        tree.map((s) => (
          <details key={s.node.id} className="lib-subject" open>
            <summary>
              <span>{s.node.title}</span>
              <span className="count">{s.count}</span>
            </summary>
            {[...s.branches.values()].sort(byPos).map((b) => (
              <div key={b.node.id} className="lib-branch">
                <div className="lib-branch-title">{b.node.title}</div>
                {[...b.courses.values()].sort(byPos).map((c) => {
                  const syl = docs[c.node.id] as Syllabus | undefined
                  return (
                    <article key={c.node.id} className="lib-course">
                      <header>
                        <button className="lib-open" onClick={() => onOpen(c.node.id)}>
                          {c.node.meta.code && <span className="code">{c.node.meta.code}</span>}
                          <span className="lib-course-title">{c.node.title}</span>
                        </button>
                        {c.saved && (
                          <button className="lib-x" onClick={() => onRemove(c.saved!)} aria-label="Remove course">
                            ★
                          </button>
                        )}
                      </header>
                      {c.saved && (syl?.description || c.node.summary) && (
                        <p className="lib-desc">{syl?.description || c.node.summary}</p>
                      )}
                      {[...c.chapters.values()].sort(byPos).map((ch) => (
                        <div key={ch.node.id} className="lib-chapter">
                          <div className="lib-row">
                            <button className="lib-open" onClick={() => onOpen(ch.node.id)}>
                              <span className="tile-num">Ch {ch.node.position + 1}</span>
                              <span>{ch.node.title}</span>
                              {done.has(ch.node.id) && <span className="tick">✓</span>}
                            </button>
                            {ch.saved && (
                              <button className="lib-x" onClick={() => onRemove(ch.saved!)} aria-label="Remove chapter">
                                ★
                              </button>
                            )}
                          </div>
                          {ch.lectures.map((l) => {
                            const b = l.body as LectureBody
                            return (
                              <div key={l.id} className="lib-lecture">
                                <div className="lib-lecture-title">🎧 {b.section || 'Whole chapter'}</div>
                                <Player url={b.audioUrl} fileName={b.fileName} speed={speed} />
                              </div>
                            )
                          })}
                          {ch.snippets
                            .sort((a, b) => a.created_at.localeCompare(b.created_at))
                            .map((sn) => (
                              <blockquote key={sn.id} className="lib-snip">
                                <p>{sn.text}</p>
                                <button className="lib-x" onClick={() => onRemove(sn)} aria-label="Remove highlight">
                                  ×
                                </button>
                              </blockquote>
                            ))}
                        </div>
                      ))}
                    </article>
                  )
                })}
              </div>
            ))}
          </details>
        ))
      )}
    </section>
  )
}
