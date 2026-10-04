import type { Syllabus, TreeNode } from './types.ts'

const HEADINGS: Record<string, string> = {
  subject: 'Branches',
  branch: 'Courses',
  course: 'Syllabus',
}

interface Props {
  parent: TreeNode
  items?: TreeNode[]
  syllabus?: Syllabus
  loading: boolean
  error?: string
  selectedId?: string
  done: Set<string>
  onSelect: (n: TreeNode) => void
  onRetry: () => void
}

/** One panel of buttons: the children of the node selected to its left. */
export function Column({ parent, items, syllabus, loading, error, selectedId, done, onSelect, onRetry }: Props) {
  const isSyllabus = parent.level === 'course'
  const finished = isSyllabus && items ? items.filter((i) => done.has(i.id)).length : 0

  return (
    <section className={`column column-${parent.level}`}>
      <header className="column-head">
        <span className="column-kicker">{HEADINGS[parent.level]}</span>
        <h2>
          {parent.meta.code && <span className="code">{parent.meta.code}</span>}
          {parent.title}
        </h2>
        {isSyllabus && syllabus?.description && <p className="column-desc">{syllabus.description}</p>}
        {isSyllabus && !!syllabus?.objectives.length && (
          <details className="objectives">
            <summary>Objectives</summary>
            <ul>
              {syllabus.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </details>
        )}
        {isSyllabus && !!items?.length && (
          <div className="progress" aria-label={`${finished} of ${items.length} chapters done`}>
            <div className="progress-bar" style={{ width: `${(finished / items.length) * 100}%` }} />
          </div>
        )}
      </header>

      {loading && !items && <Skeleton />}
      {error && (
        <div className="error">
          <p>{error}</p>
          <button className="btn-ghost" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      <ol className="tiles">
        {items?.map((n, i) => (
          <li key={n.id}>
            <button className={`tile ${selectedId === n.id ? 'active' : ''}`} onClick={() => onSelect(n)}>
              <span className="tile-top">
                {isSyllabus && <span className="tile-num">{i + 1}</span>}
                {n.meta.code && <span className="code">{n.meta.code}</span>}
                {n.meta.tier && <span className={`tier tier-${n.meta.tier.toLowerCase()}`}>{n.meta.tier}</span>}
                {done.has(n.id) && <span className="tick">✓</span>}
              </span>
              <span className="tile-title">{n.title}</span>
              {n.summary && <span className="tile-sum">{n.summary}</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-label="Generating">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton-tile" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  )
}
