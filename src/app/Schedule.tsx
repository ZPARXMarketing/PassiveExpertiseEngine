import { useMemo, useState } from 'react'
import { generate, type Settings } from './generate.ts'
import { parseAvailability } from './parse.ts'
import { hours } from './Paths.tsx'
import { blocksOn, dateKey, planSchedule, toMin, weeklyMinutes, type Session } from './schedule.ts'
import { chainIds, type Availability, type FreeBlock, type Path, type TreeNode } from './types.ts'

type View = 'week' | 'month' | 'year'
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  settings: Settings
  paths: Path[]
  nodes: Record<string, TreeNode>
  done: Set<string>
  availability: Availability
  onAvailability: (a: Availability) => void
  onOpen: (nodeId: string) => void
  onToggleDone: (nodeId: string) => void
  onGoPaths: () => void
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -d.getDay())

/**
 * The study plan: your paths' chapters laid into your free time. Re-plans itself
 * whenever you finish something, fall behind, or change when you're free.
 */
export function Schedule(p: Props) {
  const { paths, nodes, done, availability } = p
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState(false)
  const today = dateKey(new Date())

  const { sessions, outlook } = useMemo(() => planSchedule(paths, done, availability), [paths, done, availability])
  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>()
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return m
  }, [sessions])
  const pathOf = (id: string) => paths.find((x) => x.id === id)
  const live = paths.filter((x) => !x.archived && x.steps.length)

  const step = (dir: -1 | 1) =>
    setAnchor((a) =>
      view === 'week' ? addDays(a, 7 * dir) : view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getFullYear() + dir, 0, 1),
    )
  const title =
    view === 'week'
      ? `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : view === 'month'
        ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : String(anchor.getFullYear())

  const noTime = !availability.weekly.length && !availability.overrides.some((o) => o.blocks.length)

  return (
    <main className="explore schedule-view">
      <div className="sched-bar">
        <div className="seg sched-views" role="tablist" aria-label="View">
          {(['week', 'month', 'year'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="sched-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
            ‹
          </button>
          <button className="btn-ghost" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next">
            ›
          </button>
          <h2>{title}</h2>
        </div>
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          🕒 When I'm free{availability.weekly.length ? ` · ${hours(weeklyMinutes(availability))}/wk` : ''}
        </button>
      </div>

      <div className="sched-body">
        {!live.length ? (
          <div className="lib-empty">
            <h2>Nothing to schedule yet</h2>
            <p>Make a Path first: the schedule lays its chapters into your free time.</p>
            <button className="btn-neon" onClick={p.onGoPaths}>
              Go to Paths
            </button>
          </div>
        ) : noTime ? (
          <div className="lib-empty">
            <h2>When can you study?</h2>
            <p>Tell it in plain words (or set the blocks by hand) and your paths get planned into that time.</p>
            <button className="btn-neon" onClick={() => setEditing(true)}>
              Set my free time
            </button>
          </div>
        ) : (
          <>
            {outlook.some((o) => o.late || o.finish) && (
              <ul className="outlook">
                {outlook.map((o) => {
                  const x = pathOf(o.pathId)
                  if (!x || (!o.finish && !o.unplaced)) return null
                  return (
                    <li key={o.pathId} className={o.late ? 'late' : ''} style={{ '--pc': x.color } as React.CSSProperties}>
                      <i className="path-dot" />
                      <b>{x.title}</b>
                      {o.unplaced
                        ? ` — ${hours(o.unplaced)} doesn't fit before ${x.due ? 'the due date' : 'the next 6 months'}. Add free time or trim steps.`
                        : o.late
                          ? ` — finishes ${fmt(o.finish)}, after it's due ${fmt(x.due!)}. Add free time or move the date.`
                          : ` — on track, done ${fmt(o.finish)}${x.due ? ` (due ${fmt(x.due)})` : ''}.`}
                    </li>
                  )
                })}
              </ul>
            )}
            {view === 'week' && (
              <div className="week">
                {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)).map((d) => {
                  const key = dateKey(d)
                  const list = byDate.get(key) ?? []
                  const free = blocksOn(d, availability)
                  return (
                    <section key={key} className={`day ${key === today ? 'today' : ''} ${key < today ? 'past' : ''}`}>
                      <header>
                        <b>{DAY[d.getDay()]}</b> {d.getDate()}
                        {!!free.length && <small>{free.map((b) => `${b.start}–${b.end}`).join(', ')}</small>}
                      </header>
                      {!list.length && <p className="day-empty">{key < today ? '' : free.length ? 'Free' : '—'}</p>}
                      {list.map((s, i) => (
                        <SessionCard key={i} s={s} path={pathOf(s.pathId)} nodes={nodes} done={done} onOpen={p.onOpen} onToggleDone={p.onToggleDone} />
                      ))}
                    </section>
                  )
                })}
              </div>
            )}
            {view === 'month' && (
              <div className="month">
                {DAY.map((d) => (
                  <div key={d} className="month-head">
                    {d}
                  </div>
                ))}
                {monthCells(anchor).map((d, i) => {
                  if (!d) return <div key={i} className="month-cell blank" />
                  const key = dateKey(d)
                  const list = byDate.get(key) ?? []
                  return (
                    <button
                      key={key}
                      className={`month-cell ${key === today ? 'today' : ''} ${list.length ? 'has' : ''}`}
                      onClick={() => {
                        setAnchor(d)
                        setView('week')
                      }}
                    >
                      <span className="month-num">{d.getDate()}</span>
                      <span className="month-dots">
                        {[...new Set(list.map((s) => s.pathId))].map((id) => (
                          <i key={id} style={{ background: pathOf(id)?.color }} />
                        ))}
                      </span>
                      {!!list.length && <small>{hours(list.reduce((t, s) => t + s.minutes, 0))}</small>}
                    </button>
                  )
                })}
              </div>
            )}
            {view === 'year' && (
              <div className="year">
                {Array.from({ length: 12 }, (_, m) => new Date(anchor.getFullYear(), m, 1)).map((d) => {
                  const prefix = dateKey(d).slice(0, 7)
                  const list = sessions.filter((s) => s.date.startsWith(prefix))
                  const ends = live.filter((x) => x.due?.startsWith(prefix))
                  return (
                    <button
                      key={prefix}
                      className={`year-cell ${list.length ? 'has' : ''}`}
                      onClick={() => {
                        setAnchor(d)
                        setView('month')
                      }}
                    >
                      <b>{d.toLocaleDateString(undefined, { month: 'long' })}</b>
                      <span>{list.length ? `${list.length} sessions · ${hours(list.reduce((t, s) => t + s.minutes, 0))}` : '—'}</span>
                      {ends.map((x) => (
                        <span key={x.id} className="year-due" style={{ '--pc': x.color } as React.CSSProperties}>
                          <i className="path-dot" /> {x.title} due {fmt(x.due!)}
                        </span>
                      ))}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <AvailabilityEditor
          settings={p.settings}
          value={availability}
          onSave={(a) => {
            p.onAvailability(a)
            setEditing(false)
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </main>
  )
}

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** Dates of the month laid on a Sunday-first grid (nulls pad the first week). */
function monthCells(anchor: Date): (Date | null)[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
  return [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))]
}

function SessionCard({
  s,
  path,
  nodes,
  done,
  onOpen,
  onToggleDone,
}: {
  s: Session
  path?: Path
  nodes: Record<string, TreeNode>
  done: Set<string>
  onOpen: (id: string) => void
  onToggleDone: (id: string) => void
}) {
  const node = nodes[s.nodeId]
  const course = chainIds(s.nodeId, nodes)
    .map((id) => nodes[id])
    .find((n) => n?.level === 'course')
  const isDone = done.has(s.nodeId)
  return (
    <div className={`session ${isDone ? 'done' : ''}`} style={{ '--pc': path?.color } as React.CSSProperties}>
      <div className="session-top">
        <span className="session-time">
          {s.start}–{s.end}
          {s.part && <em> · {s.part}</em>}
        </span>
        <button className={`step-check ${isDone ? 'on' : ''}`} onClick={() => onToggleDone(s.nodeId)} aria-label={isDone ? 'Mark not done' : 'Mark done'}>
          {isDone ? '✓' : ''}
        </button>
      </div>
      <button className="session-main" onClick={() => onOpen(s.nodeId)} title={path?.title}>
        <span className="session-title">{node?.title ?? '…'}</span>
        {course?.meta.code && <span className="session-sub">{course.meta.code}</span>}
      </button>
    </div>
  )
}

/** Say it in words (the AI turns it into blocks) or set blocks by hand. */
function AvailabilityEditor({
  settings,
  value,
  onSave,
  onClose,
}: {
  settings: Settings
  value: Availability
  onSave: (a: Availability) => void
  onClose: () => void
}) {
  const [text, setText] = useState(value.text)
  const [weekly, setWeekly] = useState<FreeBlock[]>(value.weekly)
  const [overrides, setOverrides] = useState(value.overrides)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fromWords = async () => {
    setBusy(true)
    setError('')
    try {
      const now = new Date()
      const { text: out } = await generate(
        { kind: 'availability', trail: ['Schedule'], material: text.slice(0, 4000), today: `${dateKey(now)} (${DAY[now.getDay()]})` },
        settings,
      )
      const a = parseAvailability(out)
      if (!a.weekly.length && !a.overrides.length) throw new Error("Couldn't find any times in that. Try e.g. “weeknights 7–9pm, Saturday 9–12”.")
      setWeekly(a.weekly)
      // keep one-offs that are still ahead; new ones replace same-day ones
      const today = dateKey(now)
      setOverrides([...overrides.filter((o) => o.date >= today && !a.overrides.some((n) => n.date === o.date)), ...a.overrides])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const valid = (b: { start: string; end: string }) => toMin(b.end) > toMin(b.start)

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet avail-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="When I'm free">
        <div className="sheet-top">
          <h2>🕒 When I'm free</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <label className="field">
          <span>Say it in words</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. Weeknights 7–9pm except Wednesdays, Saturday mornings 9–12. Busy all day this Friday."
          />
        </label>
        <button className="btn-neon" disabled={!text.trim() || busy} onClick={() => void fromWords()}>
          {busy ? 'Reading…' : 'Turn into time blocks'}
        </button>
        {error && <div className="error">{error}</div>}

        <h3 className="sheet-sub">Every week</h3>
        {weekly
          .map((b, i) => ({ b, i }))
          .sort((x, y) => x.b.day - y.b.day || x.b.start.localeCompare(y.b.start))
          .map(({ b, i }) => (
            <div key={i} className={`block-row ${valid(b) ? '' : 'bad'}`}>
              <select value={b.day} onChange={(e) => setWeekly(weekly.map((x, k) => (k === i ? { ...x, day: Number(e.target.value) } : x)))}>
                {DAY.map((d, n) => (
                  <option key={d} value={n}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" value={b.start} onChange={(e) => setWeekly(weekly.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)))} />
              <span>to</span>
              <input type="time" value={b.end} onChange={(e) => setWeekly(weekly.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)))} />
              <button className="reveal" onClick={() => setWeekly(weekly.filter((_, k) => k !== i))} aria-label="Remove">
                ×
              </button>
            </div>
          ))}
        <button className="btn-ghost" onClick={() => setWeekly([...weekly, { day: 1, start: '19:00', end: '21:00' }])}>
          + Weekly block
        </button>

        <h3 className="sheet-sub">One-off days</h3>
        {overrides
          .map((o, i) => ({ o, i }))
          .sort((x, y) => x.o.date.localeCompare(y.o.date))
          .map(({ o, i }) => (
            <div key={i} className="block-row">
              <input type="date" value={o.date} onChange={(e) => setOverrides(overrides.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)))} />
              {o.blocks.length ? (
                <span>{o.blocks.map((b) => `${b.start}–${b.end}`).join(', ')}</span>
              ) : (
                <span className="muted">Busy all day</span>
              )}
              <button className="reveal" onClick={() => setOverrides(overrides.filter((_, k) => k !== i))} aria-label="Remove">
                ×
              </button>
            </div>
          ))}
        <button className="btn-ghost" onClick={() => setOverrides([...overrides, { date: dateKey(new Date()), blocks: [] }])}>
          + Busy day
        </button>

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-neon"
            disabled={!weekly.every(valid)}
            onClick={() => onSave({ text, weekly: weekly.filter(valid), overrides: overrides.filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date)) })}
          >
            Save
          </button>
        </div>
        <p className="sheet-note">Google Calendar can replace this later.</p>
      </div>
    </div>
  )
}
