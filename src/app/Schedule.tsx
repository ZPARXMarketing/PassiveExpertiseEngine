import { useEffect, useMemo, useRef, useState } from 'react'
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
 * The study plan, opening out in columns like Explore: Week / Month / Year → the days with
 * study planned → that day's sessions (Year goes month → day → sessions). Re-plans itself
 * whenever you finish something, fall behind, or change when you're free.
 */
export function Schedule(p: Props) {
  const { paths, nodes, done, availability } = p
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [editing, setEditing] = useState(false)
  const today = dateKey(new Date())
  // like Explore: the newest column slides into view
  const colsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = colsRef.current
    if (el) requestAnimationFrame(() => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }))
  }, [view, month, day])

  const { sessions, outlook } = useMemo(() => planSchedule(paths, done, availability), [paths, done, availability])
  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>()
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return m
  }, [sessions])
  const pathOf = (id: string) => paths.find((x) => x.id === id)
  const live = paths.filter((x) => !x.archived && x.steps.length)
  const sum = (list: Session[]) => hours(list.reduce((t, s) => t + s.minutes, 0))
  const noTime = !availability.weekly.length && !availability.overrides.some((o) => o.blocks.length)

  /** the dates the middle column lists */
  const range = (from: Date, n: number) => Array.from({ length: n }, (_, i) => dateKey(addDays(from, i)))
  const weekDays = range(startOfWeek(anchor), 7)
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const monthDays = range(monthStart, new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate())
  const yearMonths = Array.from({ length: 12 }, (_, m) => dateKey(new Date(anchor.getFullYear(), m, 1)).slice(0, 7))
  const daysOfMonth = (prefix: string) => {
    const [y, m] = prefix.split('-').map(Number)
    return range(new Date(y, m - 1, 1), new Date(y, m, 0).getDate())
  }
  const listed = (keys: string[]) => keys.filter((k) => byDate.has(k))

  const chooseView = (v: View) => {
    setView(v)
    setAnchor(new Date())
    setMonth('')
    setDay('')
  }
  const shift = (dir: -1 | 1) => {
    setDay('')
    setMonth('')
    setAnchor((a) =>
      view === 'week' ? addDays(a, 7 * dir) : view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getFullYear() + dir, 0, 1),
    )
  }
  const periodTitle =
    view === 'week'
      ? `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : view === 'month'
        ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : String(anchor.getFullYear())

  const dayTiles = (keys: string[], depth: number) => {
    const shown = listed(keys)
    return shown.length ? (
      <ol className="tiles">
        {shown.map((k) => {
          const list = byDate.get(k)!
          const d = new Date(`${k}T12:00:00`)
          return (
            <li key={k} className="tile-wrap">
              <button className={`tile ${day === k ? 'active' : ''} ${k === today ? 'today-tile' : ''}`} onClick={() => setDay(k)}>
                <span className="tile-top">
                  <span className="tile-num">{k === today ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="month-dots">
                    {[...new Set(list.map((s) => s.pathId))].map((id) => (
                      <i key={id} style={{ background: pathOf(id)?.color }} />
                    ))}
                  </span>
                </span>
                <span className="tile-title">{d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span className="tile-sum">
                  {list.length} session{list.length === 1 ? '' : 's'} · {sum(list)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    ) : (
      <p className="sheet-note">{depth ? 'Nothing planned that month.' : `Nothing planned ${view === 'week' ? 'this week' : 'this month'}.`}</p>
    )
  }

  const dayList = day ? (byDate.get(day) ?? []) : []
  const dayDate = day ? new Date(`${day}T12:00:00`) : null

  return (
    <main className="explore schedule-view">
      <div className="columns" ref={colsRef}>
        <section className="column">
          <header className="column-head">
            <span className="column-kicker">Schedule</span>
            <h2>Your study plan</h2>
          </header>
          <ol className="tiles">
            {(['week', 'month', 'year'] as View[]).map((v) => {
              const keys = v === 'week' ? range(startOfWeek(new Date()), 7) : v === 'month' ? range(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 31) : null
              const list = keys ? keys.flatMap((k) => byDate.get(k) ?? []) : sessions.filter((x) => x.date.startsWith(String(new Date().getFullYear())))
              return (
                <li key={v} className="tile-wrap">
                  <button className={`tile ${view === v ? 'active' : ''}`} onClick={() => chooseView(v)}>
                    <span className="tile-title">{v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'Year'}</span>
                    <span className="tile-sum">
                      {list.length ? `${list.length} sessions · ${sum(list)} ${v === 'week' ? 'this week' : v === 'month' ? 'this month' : 'this year'}` : 'Nothing planned yet'}
                    </span>
                  </button>
                </li>
              )
            })}
            <li className="tile-wrap">
              <button className="tile" onClick={() => setEditing(true)}>
                <span className="tile-title">🕒 When I'm free</span>
                <span className="tile-sum">{noTime ? 'Not set yet' : `${hours(weeklyMinutes(availability))} a week`}</span>
              </button>
            </li>
          </ol>
          {!live.length && (
            <div className="sched-hint">
              <p className="sheet-note">Make a Path first: the schedule lays its chapters into your free time.</p>
              <button className="btn-neon" onClick={p.onGoPaths}>
                Go to Paths
              </button>
            </div>
          )}
          {!!live.length && noTime && (
            <div className="sched-hint">
              <p className="sheet-note">Tell it when you can study and your paths get planned into that time.</p>
              <button className="btn-neon" onClick={() => setEditing(true)}>
                Set my free time
              </button>
            </div>
          )}
          {outlook.some((o) => o.finish || o.unplaced) && (
            <ul className="outlook">
              {outlook.map((o) => {
                const x = pathOf(o.pathId)
                if (!x || (!o.finish && !o.unplaced)) return null
                return (
                  <li key={o.pathId} className={o.late ? 'late' : ''} style={{ '--pc': x.color } as React.CSSProperties}>
                    <i className="path-dot" />
                    <span>
                      <b>{x.title}</b>
                      {o.unplaced
                        ? ` — ${hours(o.unplaced)} doesn't fit before ${x.due ? 'the due date' : 'the next 6 months'}. Add free time or trim steps.`
                        : o.late
                          ? ` — finishes ${fmt(o.finish)}, after it's due ${fmt(x.due!)}. Add free time or move the date.`
                          : ` — on track, done ${fmt(o.finish)}${x.due ? ` (due ${fmt(x.due)})` : ''}.`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {!!live.length && !noTime && (
          <section className="column">
            <header className="column-head">
              <span className="column-kicker">{view === 'week' ? 'Days' : view === 'month' ? 'Days' : 'Months'}</span>
              <div className="sched-nav">
                <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous">
                  ‹
                </button>
                <h2>{periodTitle}</h2>
                <button className="icon-btn" onClick={() => shift(1)} aria-label="Next">
                  ›
                </button>
              </div>
            </header>
            {view === 'week' && dayTiles(weekDays, 0)}
            {view === 'month' && dayTiles(monthDays, 0)}
            {view === 'year' && (
              <ol className="tiles">
                {yearMonths.map((m) => {
                  const list = sessions.filter((x) => x.date.startsWith(m))
                  const dues = live.filter((x) => x.due?.startsWith(m))
                  if (!list.length && !dues.length) return null
                  return (
                    <li key={m} className="tile-wrap">
                      <button
                        className={`tile ${month === m ? 'active' : ''}`}
                        onClick={() => {
                          setMonth(m)
                          setDay('')
                        }}
                      >
                        <span className="tile-title">{new Date(`${m}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long' })}</span>
                        <span className="tile-sum">{list.length ? `${list.length} sessions · ${sum(list)}` : 'Nothing planned'}</span>
                        {dues.map((x) => (
                          <span key={x.id} className="year-due" style={{ '--pc': x.color } as React.CSSProperties}>
                            <i className="path-dot" /> {x.title} due {fmt(x.due!)}
                          </span>
                        ))}
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )}

        {view === 'year' && month && (
          <section className="column">
            <header className="column-head">
              <span className="column-kicker">Days</span>
              <h2>{new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            </header>
            {dayTiles(daysOfMonth(month), 1)}
          </section>
        )}

        {day && dayDate && (
          <section className="column day-panel">
            <header className="column-head">
              <span className="column-kicker">{day === today ? 'Today' : dayDate.toLocaleDateString(undefined, { weekday: 'long' })}</span>
              <h2>{dayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <p className="column-desc">
                Free {blocksOn(dayDate, availability).map((b) => `${b.start}–${b.end}`).join(', ') || '—'} · {sum(dayList)} planned
              </p>
            </header>
            <div className="day-sessions">
              {dayList.map((s, i) => (
                <SessionCard key={i} s={s} path={pathOf(s.pathId)} nodes={nodes} done={done} onOpen={p.onOpen} onToggleDone={p.onToggleDone} />
              ))}
            </div>
          </section>
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
        <span className="session-sub">
          {course?.meta.code ? `${course.meta.code} · ` : ''}
          {path?.title}
        </span>
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
