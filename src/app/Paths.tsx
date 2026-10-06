import { useEffect, useMemo, useRef, useState } from 'react'
import { generate, type Settings } from './generate.ts'
import { parsePathPlan, type PathPlan } from './parse.ts'
import { MAX_ATTACHMENT, type Attachment } from './prompts.ts'
import type { NewPath, Store } from './store.ts'
import { bestMatch, buildPath, inventory, type BuildResult } from './tree.ts'
import { Strip, useFit } from './fit.tsx'
import type { PanelWidth } from './PanelWidth.tsx'
import { chainIds, type Path, type PathStep, type TreeNode } from './types.ts'

export const PATH_COLORS = ['#2affa3', '#4cc9ff', '#a78bff', '#ff5caa', '#ffd60a', '#ff8a3d']
/** all attachments together, as data: URLs (keeps one request well under the size limit) */
const MAX_TOTAL = 5_500_000

interface Props {
  store: Store
  settings: Settings
  paths: Path[]
  nodes: Record<string, TreeNode>
  done: Set<string>
  loadAncestors: (ids: string[]) => Promise<Record<string, TreeNode>>
  onSave: (p: NewPath) => Promise<Path>
  onDelete: (id: string) => void
  onOpen: (nodeId: string) => void
  onToggleDone: (nodeId: string) => void
  /** new nodes were made: refresh the explore tree */
  onBuilt: (r: BuildResult) => void
  /** which path is open (kept by the app so it survives switching views) */
  selected: string
  onSelect: (id: string) => void
  panelWidth: PanelWidth
}

/** Paths: goal-specific sequences of chapters, drafted by the AI or put together by hand. */
export function Paths(p: Props) {
  const { paths, nodes, done, selected, onSelect } = p
  const live = paths.filter((x) => !x.archived)
  const path = paths.find((x) => x.id === selected)

  // make sure every step's chain (course code, titles) is loaded
  const stepIds = paths.flatMap((x) => x.steps.map((s) => s.node_id))
  const missing = stepIds.filter((id) => !nodes[id] || chainIds(id, nodes).some((c) => !nodes[c])).join(',')
  const load = useRef(p.loadAncestors)
  load.current = p.loadAncestors
  useEffect(() => {
    if (missing) void load.current(missing.split(','))
  }, [missing])
  // the path list folds into a strip when both columns don't fit (tap it to open again)
  const [keep, setKeep] = useState(-1)
  useEffect(() => setKeep(-1), [selected])
  const open = selected === 'new' || !!path
  const { ref: colsRef, folded } = useFit(open ? [300, 340] : [300], keep, p.panelWidth)

  return (
    <main className="explore paths-view">
      <div className={`columns pw-${p.panelWidth}`} ref={colsRef}>
        {folded[0] ? (
          <Strip kicker="Paths" picked={selected === 'new' ? 'New path' : path?.title} onOpen={() => setKeep(0)} />
        ) : (
        <section className="column">
          <header className="column-head">
            <span className="column-kicker">Paths</span>
            <h2>Learn exactly what you need</h2>
          </header>
          <div className="path-new">
            <button className={`btn-neon ${selected === 'new' ? 'on' : ''}`} onClick={() => onSelect('new')}>
              ✦ New path with AI
            </button>
            <button
              className="btn-ghost"
              onClick={async () => {
                const made = await p.onSave(blankPath(live.length))
                onSelect(made.id)
              }}
            >
              + Empty path
            </button>
          </div>
          {!live.length && <p className="sheet-note">No paths yet. Describe a goal and the AI lays out the course for it, or start an empty one and add chapters from the Library.</p>}
          <ol className="tiles">
            {live.map((x) => {
              const total = x.steps.length
              const finished = x.steps.filter((s) => done.has(s.node_id)).length
              return (
                <li key={x.id} className="tile-wrap">
                  <button
                    className={`tile path-tile ${selected === x.id ? 'active' : ''}`}
                    style={{ '--pc': x.color } as React.CSSProperties}
                    onClick={() => onSelect(x.id)}
                  >
                    <span className="tile-top">
                      <span className="path-dot" />
                      {x.due && <span className="tile-num">due {fmtDate(x.due)}</span>}
                    </span>
                    <span className="tile-title">{x.title}</span>
                    <span className="path-progress" aria-label={`${finished} of ${total} done`}>
                      <i style={{ width: total ? `${(finished / total) * 100}%` : 0 }} />
                    </span>
                    <span className="tile-sum">
                      {finished}/{total} chapters · {hours(x.steps.filter((s) => !done.has(s.node_id)).reduce((t, s) => t + s.minutes, 0))} left
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {paths.some((x) => x.archived) && (
            <details className="used">
              <summary>Archived</summary>
              {paths
                .filter((x) => x.archived)
                .map((x) => (
                  <div key={x.id} className="row-line">
                    <span>{x.title}</span>
                    <button className="reveal" onClick={() => void p.onSave({ ...x, archived: false })}>
                      Restore
                    </button>
                  </div>
                ))}
            </details>
          )}
        </section>
        )}

        {selected === 'new' ? (
          <Drafter {...p} onCancel={() => onSelect('')} />
        ) : path ? (
          <PathPanel key={path.id} {...p} path={path} />
        ) : null}
      </div>
    </main>
  )
}

function blankPath(n: number): NewPath {
  return { title: 'New path', goal: '', focus: '', due: null, steps: [], color: PATH_COLORS[n % PATH_COLORS.length], archived: false }
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const hours = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`)

/** One path: its brief, due date and the steps in order. */
function PathPanel(p: Props & { path: Path }) {
  const { path, nodes, done } = p
  const save = (fields: Partial<Path>) => void p.onSave({ ...path, ...fields })
  const move = (i: number, by: -1 | 1) => {
    const steps = [...path.steps]
    const j = i + by
    if (j < 0 || j >= steps.length) return
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    save({ steps })
  }
  const label = (s: PathStep) => {
    const chain = chainIds(s.node_id, nodes).map((id) => nodes[id])
    const course = chain.find((n) => n?.level === 'course')
    return { node: nodes[s.node_id], course }
  }
  return (
    <section className="column path-panel" style={{ '--pc': path.color } as React.CSSProperties}>
      <header className="column-head">
        <span className="column-kicker">Path</span>
        <input
          className="path-title"
          defaultValue={path.title}
          key={path.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== path.title && save({ title: e.target.value.trim().slice(0, 200) })}
          aria-label="Path name"
        />
        {path.goal && <p className="column-desc">🎯 {path.goal}</p>}
        {path.focus && <p className="path-focus">{path.focus}</p>}
        <div className="path-meta">
          <label>
            Due
            <input type="date" value={path.due ?? ''} onChange={(e) => save({ due: e.target.value || null })} />
          </label>
          <span className="path-colors" role="radiogroup" aria-label="Colour">
            {PATH_COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={path.color === c}
                className={path.color === c ? 'on' : ''}
                style={{ background: c }}
                onClick={() => save({ color: c })}
                aria-label={c}
              />
            ))}
          </span>
        </div>
      </header>

      {!path.steps.length && (
        <p className="sheet-note">Empty. In the Library, open a chapter or course and tap <b>+ Path</b> to add it here.</p>
      )}
      <ol className="tiles">
        {path.steps.map((s, i) => {
          const { node, course } = label(s)
          const isDone = done.has(s.node_id)
          return (
            <li key={s.node_id} className="tile-wrap">
              <div className={`tile step-tile ${isDone ? 'done' : ''}`}>
                <span className="tile-top">
                  <span className="tile-num">{i + 1}</span>
                  {course?.meta.code && <span className="code">{course.meta.code}</span>}
                  <span className="step-min">{hours(s.minutes)}</span>
                  <button className={`step-check ${isDone ? 'on' : ''}`} onClick={() => p.onToggleDone(s.node_id)} aria-label={isDone ? 'Mark not done' : 'Mark done'}>
                    {isDone ? '✓' : ''}
                  </button>
                </span>
                <button className="step-open" onClick={() => p.onOpen(s.node_id)}>
                  <span className="tile-title">{node?.title ?? 'Loading…'}</span>
                  {course && <span className="step-course">{course.title}</span>}
                </button>
                {s.note && <span className="tile-sum">{s.note}</span>}
                <span className="step-tools">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === path.steps.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <select
                    value={s.minutes}
                    onChange={(e) => save({ steps: path.steps.map((x, k) => (k === i ? { ...x, minutes: Number(e.target.value) } : x)) })}
                    aria-label="Study time"
                  >
                    {[...new Set([15, 20, 30, 45, 60, 90, 120, 180, s.minutes])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>
                        {hours(m)}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => save({ steps: path.steps.filter((_, k) => k !== i) })} aria-label="Remove step">
                    ×
                  </button>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="path-foot">
        <button className="btn-ghost" onClick={() => save({ archived: true })}>
          Archive
        </button>
        <button
          className="btn-ghost danger-btn"
          onClick={() => confirm(`Delete "${path.title}"? The chapters stay in Explore.`) && p.onDelete(path.id)}
        >
          Delete
        </button>
      </div>
    </section>
  )
}

/** Photos are shrunk to a sensible size; PDFs pass through as they are. */
async function toAttachment(f: File): Promise<Attachment> {
  if (f.type === 'application/pdf') {
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = () => rej(new Error(`Couldn't read ${f.name}.`))
      r.readAsDataURL(f)
    })
    if (data.length > MAX_ATTACHMENT) throw new Error(`${f.name} is too big (about 4 MB max). Paste the text instead.`)
    return { name: f.name, type: f.type, data }
  }
  if (!f.type.startsWith('image/')) throw new Error(`${f.name}: photos and PDFs only.`)
  const img = await createImageBitmap(f)
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return { name: f.name.replace(/\.\w+$/, '.jpg'), type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82) }
}

type Mark = 'have' | 'chapter' | 'course' | 'branch' | 'subject'
const MARKS: Record<Mark, string> = {
  have: 'In your library',
  chapter: 'New chapter',
  course: 'New course',
  branch: 'New branch',
  subject: 'New subject',
}

/** Describe the goal (+ paste / attach the assignment) → a drafted plan → build it. */
function Drafter(p: Props & { onCancel: () => void }) {
  const [goal, setGoal] = useState('')
  const [material, setMaterial] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [due, setDue] = useState('')
  const [live, setLive] = useState('')
  const [plan, setPlan] = useState<PathPlan | null>(null)
  const [busy, setBusy] = useState<'' | 'draft' | 'build'>('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [tree, setTree] = useState<TreeNode[] | null>(null)

  useEffect(() => {
    p.store.allNodes().then(setTree).catch(() => setTree([]))
  }, [p.store])

  const shown = plan ?? (busy === 'draft' ? parsePathPlan(live, false) : null)

  /** what already exists for each planned step */
  const marks = useMemo(() => {
    if (!shown || !tree) return []
    const kids = new Map<string | null, TreeNode[]>()
    for (const n of tree) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n])
    return shown.steps.map((st): Mark => {
      const s = bestMatch((kids.get(null) ?? []).filter((n) => n.level === 'subject'), st.subject)
      if (!s) return 'subject'
      const b = bestMatch(kids.get(s.id) ?? [], st.branch)
      if (!b) return 'branch'
      const c = bestMatch(kids.get(b.id) ?? [], st.course, st.code)
      if (!c) return 'course'
      return bestMatch(kids.get(c.id) ?? [], st.chapter) ? 'have' : 'chapter'
    })
  }, [shown, tree])

  const draft = async () => {
    if (!goal.trim() || !tree) return
    setBusy('draft')
    setError('')
    setPlan(null)
    setLive('')
    try {
      const { text } = await generate(
        {
          kind: 'path',
          trail: [goal.trim().slice(0, 200)],
          goal: goal.trim().slice(0, 2000),
          material: material.trim().slice(0, 24000) || undefined,
          inventory: inventory(tree),
          attachments: files.length ? files : undefined,
        },
        p.settings,
        setLive,
      )
      const out = parsePathPlan(text, true)
      if (!out.steps.length) throw new Error('The plan came back empty. Try again, or add more detail.')
      setPlan(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  const build = async () => {
    if (!plan) return
    setBusy('build')
    setError('')
    try {
      const r = await buildPath(p.store, p.settings, plan, setStatus)
      const made = await p.onSave({
        title: plan.title || goal.trim().slice(0, 80),
        goal: goal.trim(),
        focus: plan.focus,
        due: due || null,
        steps: r.steps,
        color: PATH_COLORS[p.paths.length % PATH_COLORS.length],
        archived: false,
      })
      p.onBuilt(r)
      p.onSelect(made.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
      setStatus('')
    }
  }

  const total = files.reduce((t, f) => t + f.data.length, 0)

  return (
    <section className="column path-drafter">
      <header className="column-head">
        <span className="column-kicker">New path</span>
        <h2>What do you need to crush?</h2>
      </header>
      <label className="field">
        <span>Goal</span>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. Ace my corporate finance case study on valuing a company with DCF"
        />
      </label>
      <label className="field">
        <span>
          Paste the assignment <small>(optional: prompt, rubric, syllabus, notes)</small>
        </span>
        <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={4} />
      </label>
      <div className="field">
        <span>
          Attach photos or PDFs <small>(optional)</small>
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={async (e) => {
            const picked = [...(e.target.files ?? [])]
            e.target.value = ''
            try {
              const add = await Promise.all(picked.map(toAttachment))
              const next = [...files, ...add].slice(0, 4)
              if (next.reduce((t, f) => t + f.data.length, 0) > MAX_TOTAL) throw new Error('Those files are too big together. Attach fewer, or paste the text.')
              setFiles(next)
              setError('')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not attach that.')
            }
          }}
        />
        {!!files.length && (
          <ul className="attach-list">
            {files.map((f, i) => (
              <li key={i}>
                {f.type === 'application/pdf' ? '📄' : '🖼'} {f.name}
                <button className="reveal" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`}>
                  ×
                </button>
              </li>
            ))}
            <li className="muted">{total < 1_370_000 ? `${Math.max(1, Math.round(total / 1370))} KB` : `${(total / 1_370_000).toFixed(1)} MB`}</li>
          </ul>
        )}
      </div>
      <label className="field inline">
        <span>Due date</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="path-new">
        <button className="btn-neon" disabled={!goal.trim() || !!busy || !tree} onClick={() => void draft()}>
          {busy === 'draft' ? 'Drafting…' : plan ? 'Draft again' : 'Draft the path'}
        </button>
        <button className="btn-ghost" onClick={p.onCancel} disabled={busy === 'build'}>
          Cancel
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {shown && (
        <div className="plan-preview">
          {shown.title && <h3>{shown.title}</h3>}
          {shown.focus && <p className="path-focus">{shown.focus}</p>}
          <ol className="plan-steps">
            {shown.steps.map((st, i) => (
              <li key={i}>
                <div className="plan-where">
                  {st.subject} › {st.branch} › {st.code ? `${st.code} ` : ''}
                  {st.course}
                </div>
                <div className="plan-ch">
                  {st.chapter} <span className="step-min">{hours(st.minutes)}</span>
                </div>
                {st.note && <div className="tile-sum">{st.note}</div>}
                {marks[i] && <span className={`plan-mark ${marks[i]}`}>{MARKS[marks[i]]}</span>}
              </li>
            ))}
          </ol>
          {plan && (
            <>
              <p className="sheet-note">
                Creating it reuses everything marked “In your library”. Anything new is laid out like a real catalog (the
                full course list or syllabus around it), so the rest of that course is there for later too.
              </p>
              <button className="btn-neon" disabled={!!busy} onClick={() => void build()}>
                {busy === 'build' ? status || 'Creating…' : `Create path · ${plan.steps.length} chapters · ${hours(plan.steps.reduce((t, s) => t + s.minutes, 0))}`}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
