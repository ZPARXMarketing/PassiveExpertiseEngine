import type { RawItem } from './parse.ts'
import type { SavedItem, Syllabus, TreeNode } from './types.ts'

const HEADINGS: Record<string, string> = {
  subject: 'Branches',
  branch: 'Courses',
  course: 'Syllabus',
}

/** full panel → compact (titles only, narrower) → strip (slim vertical bar); hidden on phones (the trail bar replaces it) */
export type Fold = 'full' | 'compact' | 'strip' | 'hidden'

interface Props {
  fold: Fold
  onFold: (f: Fold) => void
  selectedTitle?: string
  parent: TreeNode
  items?: TreeNode[]
  /** tiles still streaming in (not clickable until saved) */
  preview?: RawItem[]
  syllabus?: Syllabus
  loading: boolean
  error?: string
  selectedId?: string
  done: Set<string>
  visited: Map<string, string>
  savedIds: Map<string, SavedItem>
  onToggleSave: (n: TreeNode) => void
  onSelect: (n: TreeNode) => void
  onRetry: () => void
}

/** One panel of buttons: the children of the node selected to its left. */
export function Column(props: Props) {
  const { parent, items, syllabus, loading, error, selectedId, done, visited, savedIds, onToggleSave, onSelect, onRetry } = props
  const isSyllabus = parent.level === 'course'
  const finished = isSyllabus && items ? items.filter((i) => done.has(i.id)).length : 0
  const { fold, onFold } = props

  if (fold === 'hidden') return null

  if (fold === 'strip') {
    return (
      <button className="column strip" data-panel={parent.id} onClick={() => onFold('full')} aria-label={`Expand ${parent.title}`}>
        <span className="strip-chev">›</span>
        <span className="strip-text">
          <span className="strip-parent">{parent.title}</span>
          {props.selectedTitle && <span className="strip-sel">{props.selectedTitle}</span>}
        </span>
      </button>
    )
  }

  return (
    <section className={`column column-${parent.level} ${fold === 'compact' ? 'compact' : ''}`} data-panel={parent.id}>
      <header className="column-head">
        <div className="column-ctrl">
          <span className="column-kicker">{HEADINGS[parent.level]}</span>
          <span className="fold-btns">
            {fold === 'compact' && (
              <button onClick={() => onFold('full')} aria-label="Expand panel">
                ⤢
              </button>
            )}
            <button
              onClick={() => onFold(fold === 'full' ? 'compact' : 'strip')}
              aria-label={fold === 'full' ? 'Shrink panel' : 'Collapse panel'}
            >
              ‹
            </button>
          </span>
        </div>
        <h2>
          {parent.meta.code && <span className="code">{parent.meta.code}</span>}
          {parent.title}
          {isSyllabus && <Star on={savedIds.has(parent.id)} onClick={() => onToggleSave(parent)} label="course" />}
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

      {loading && !items && !props.preview?.length && <Skeleton />}
      {!items && !!props.preview?.length && (
        <ol className="tiles">
          {props.preview.map((n, i) => (
            <li key={i} className="tile-wrap">
              <div className="tile preview">
                <span className="tile-top">
                  {isSyllabus && <span className="tile-num">{i + 1}</span>}
                  {n.code && <span className="code">{n.code}</span>}
                  {n.tier && <span className={`tier tier-${n.tier.toLowerCase()}`}>{n.tier}</span>}
                </span>
                <span className="tile-title">{n.title}</span>
                {n.summary && <span className="tile-sum">{n.summary}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
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
          <li key={n.id} className="tile-wrap">
            <button
              className={`tile ${selectedId === n.id ? 'active' : ''} ${visited.has(n.id) ? 'seen' : ''} ${savable(n) ? 'has-star' : ''}`}
              onClick={() => onSelect(n)}
            >
              <span className="tile-top">
                {isSyllabus && <span className="tile-num">{i + 1}</span>}
                {n.meta.code && <span className="code">{n.meta.code}</span>}
                {n.meta.tier && <span className={`tier tier-${n.meta.tier.toLowerCase()}`}>{n.meta.tier}</span>}
                {done.has(n.id) && <span className="tick">✓</span>}
              </span>
              <span className="tile-title">{n.title}</span>
              {n.summary && <span className="tile-sum">{n.summary}</span>}
            </button>
            {savable(n) && <Star on={savedIds.has(n.id)} onClick={() => onToggleSave(n)} label={n.level} />}
          </li>
        ))}
      </ol>
    </section>
  )
}

const savable = (n: TreeNode) => n.level === 'course' || n.level === 'chapter'

export function Star({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`star ${on ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={on ? `Remove ${label} from Library` : `Save ${label} to Library`}
      aria-pressed={on}
    >
      {on ? '★' : '☆'}
    </button>
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
