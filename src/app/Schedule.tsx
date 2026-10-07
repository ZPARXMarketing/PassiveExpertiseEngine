import { useMemo, useRef, useState } from 'react'
import type { PanelWidth } from './PanelWidth.tsx'
import { generate, type Settings } from './generate.ts'
import { parseAvailability, parseFit, type FitChange } from './parse.ts'
import { hours } from './Paths.tsx'
import {
  blocksOn,
  dateKey,
  freeMinutesUntil,
  fromMin,
  MIN_STEP,
  shrinkToFit,
  timingOf,
  toMin,
  weeklyMinutes,
  type PathMeta,
  type PathOutlook,
  type Session,
  type Timing,
} from './schedule.ts'
import type { NewPath } from './store.ts'
import { dueFirst } from './schedule.ts'
import type { Availability, FreeBlock, Path, TreeNode } from './types.ts'

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
  panelWidth: PanelWidth
  /** the plan (worked out once by the app, shared with Paths) */
  plan: { sessions: Session[]; outlook: PathOutlook[] }
  meta: PathMeta
  onMeta: (id: string, fields: { timing?: Timing; pressing?: boolean }) => void
  onSave: (p: NewPath) => Promise<Path>
  onEditFree: () => void
  /** scheduled paths, highest priority first (the Cal list) */
  ordered: Path[]
  onOrder: (ids: string[]) => void
  /** "keep my order anyway" for the current set of problems */
  ack: string
  onAck: (signature: string) => void
  /** the priority list, shown on top when the left panel is tucked away (narrow windows) */
  narrowList?: React.ReactNode
  /** a path picked in the Cal list: show its rundown instead of the full plan */
  focusPath: string
  onFocusPath: (id: string) => void
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -d.getDay())
const parse = (k: string) => new Date(`${k}T12:00:00`)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Cal: every scheduled path together, at three linked zoom levels — the year (one bar per
 * path, due dates, weekly load), the month (each day's time per path) and the week (each
 * session at its time of day, free time shaded). Anything planned after its path's due date
 * is a conflict and shows in red. Picking a month moves the month view, a day moves the
 * week, a session opens its adjust controls. Re-plans on every change.
 */
export function Schedule(p: Props) {
  const { paths, nodes, done, availability } = p
  const now = new Date()
  const today = dateKey(now)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(today.slice(0, 7))
  const [week, setWeek] = useState(dateKey(startOfWeek(now)))
  const [pick, setPick] = useState<Session | null>(null)
  const [yearOpen, setYearOpen] = useState(false)
  const weekRef = useRef<HTMLDivElement>(null)

  const { sessions, outlook } = p.plan
  const pathOf = (id: string) => paths.find((x) => x.id === id)
  const live = paths.filter((x) => !x.archived && x.steps.length)
  const sum = (list: Session[]) => hours(list.reduce((t, s) => t + s.minutes, 0))
  const noTime = !availability.weekly.length && !availability.overrides.some((o) => o.blocks.length)
  const focus = p.ordered.find((x) => x.id === p.focusPath)
  /** a session planned after its path's due date */
  const lateSession = (s: Session) => {
    const x = pathOf(s.pathId)
    return !!x && timingOf(x, p.meta) === 'date' && !!x.due && s.date > x.due
  }
  const dim = (pathId: string) => (focus && focus.id !== pathId ? 'dim' : '')

  const problems = outlook.filter((o) => o.late || o.unplaced)
  const signature = `${p.ordered.map((x) => x.id).join(',')}|${problems.map((o) => o.pathId).join(',')}`
  const describe = (o: PathOutlook) => {
    const x = pathOf(o.pathId)
    if (!x) return ''
    if (o.unplaced && !o.finish) return `${x.title}: none of it fits your free time yet`
    if (o.unplaced) return `${x.title}: ${hours(o.unplaced)} doesn’t fit`
    const after = sessions.filter((s) => s.pathId === x.id && lateSession(s)).length
    return `${x.title}: finishes ${fmt(o.finish)}, after it’s due ${fmt(x.due!)} (${after} session${after === 1 ? '' : 's'} past the date)`
  }
  const goWeek = (k: string) => {
    setWeek(dateKey(startOfWeek(parse(k))))
    setMonth(k.slice(0, 7))
    setYear(Number(k.slice(0, 4)))
    requestAnimationFrame(() => weekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  /* ---------- year ---------- */
  const y0 = new Date(year, 0, 1).getTime()
  const yLen = new Date(year + 1, 0, 1).getTime() - y0
  const pos = (k: string) => Math.min(100, Math.max(0, ((parse(k).getTime() - y0) / yLen) * 100))
  const inYear = (k: string) => k.startsWith(String(year))
  /** weeks of the year with planned minutes per path, for the load chart */
  const weeks = useMemo(() => {
    const out: { start: string; byPath: Map<string, number>; total: number; free: number }[] = []
    for (let d = startOfWeek(new Date(year, 0, 1)); d.getFullYear() <= year; d = addDays(d, 7)) {
      const start = dateKey(d)
      const days = Array.from({ length: 7 }, (_, i) => addDays(d, i))
      const keys = new Set(days.map(dateKey))
      const byPath = new Map<string, number>()
      let total = 0
      for (const s of sessions)
        if (keys.has(s.date)) {
          byPath.set(s.pathId, (byPath.get(s.pathId) ?? 0) + s.minutes)
          total += s.minutes
        }
      const free = days.reduce((t, day) => t + blocksOn(day, availability).reduce((u, b) => u + Math.max(0, toMin(b.end) - toMin(b.start)), 0), 0)
      out.push({ start, byPath, total, free })
    }
    return out
  }, [sessions, availability, year])
  const maxWeek = Math.max(60, ...weeks.map((w) => Math.max(w.total, w.free)))

  /* ---------- month ---------- */
  const [my, mm] = month.split('-').map(Number)
  const first = new Date(my, mm - 1, 1)
  const cells = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: new Date(my, mm, 0).getDate() }, (_, i) => dateKey(addDays(first, i)))]
  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>()
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return m
  }, [sessions])
  const dueOn = (k: string) => live.filter((x) => timingOf(x, p.meta) === 'date' && x.due === k)

  /* ---------- week ---------- */
  const weekDays = Array.from({ length: 7 }, (_, i) => dateKey(addDays(parse(week), i)))
  const weekSessions = sessions.filter((s) => weekDays.includes(s.date))
  const weekBlocks = weekDays.map((k) => blocksOn(parse(k), availability))
  const span = [...weekBlocks.flat().map((b) => [toMin(b.start), toMin(b.end)]), ...weekSessions.map((s) => [toMin(s.start), toMin(s.end)])]
  const from = span.length ? Math.floor(Math.min(...span.map((x) => x[0])) / 60) * 60 : 18 * 60
  const to = span.length ? Math.ceil(Math.max(...span.map((x) => x[1])) / 60) * 60 : 22 * 60
  const PX = 1.1 // pixels per minute in the week view

  if (!live.length || noTime)
    return (
      <main className="explore schedule-view cal-view">
        {p.narrowList && <div className="narrow-only cal-narrow">{p.narrowList}</div>}
        <div className="lib-empty">
          {!live.length ? (
            <>
              <h2>Nothing scheduled yet</h2>
              <p>Open a path in Paths and tap “Schedule this path”. Its chapters get laid into your free time here.</p>
              <button className="btn-neon" onClick={p.onGoPaths}>
                Go to Paths
              </button>
            </>
          ) : (
            <>
              <h2>When can you study?</h2>
              <p>Tell it when you’re free and your scheduled paths get planned into that time.</p>
              <button className="btn-neon" onClick={p.onEditFree}>
                Set my free time
              </button>
            </>
          )}
        </div>
      </main>
    )

  return (
    <main className="explore schedule-view cal-view">
      {p.narrowList && <div className="narrow-only cal-narrow">{p.narrowList}</div>}
      <div className="cal-stack">
        {problems.length > 0 &&
          (p.ack === signature ? (
            <p className="cal-kept">
              Keeping your order: {problems.map(describe).join(' · ')}.{' '}
              <button className="reveal" onClick={() => p.onAck('')}>
                Review
              </button>
            </p>
          ) : (
            <div className="cal-warn" role="alert">
              <h4>⚠ Conflicts</h4>
              <ul>
                {problems.map((o) => (
                  <li key={o.pathId}>{describe(o)}</li>
                ))}
              </ul>
              <div className="cal-warn-actions">
                <button className="btn-neon" onClick={() => p.onOrder(dueFirst(p.ordered, p.meta))}>
                  Put due dates first
                </button>
                <button className="btn-ghost" onClick={() => p.onAck(signature)}>
                  Keep my order
                </button>
              </div>
              <FitBox paths={paths} done={done} availability={availability} meta={p.meta} order={p.ordered.map((x) => x.id)} nodes={nodes} settings={p.settings} onSave={p.onSave} onMeta={p.onMeta} />
            </div>
          ))}

        {focus && (
          <Rundown
            path={focus}
            sessions={sessions.filter((x) => x.pathId === focus.id)}
            outlook={outlook.find((o) => o.pathId === focus.id)}
            nodes={nodes}
            meta={p.meta}
            selected={pick ? `${pick.date} ${pick.start.slice(0, 2)}` : ''}
            onPick={(s) => {
              goWeek(s.date)
              setPick(s)
            }}
            onClose={() => p.onFocusPath('')}
          />
        )}

        {/* ---------- WEEK ---------- */}
        <section className="cal-card" ref={weekRef as React.RefObject<HTMLElement>}>
          <header className="cal-card-head">
            <div className="cal-card-title static">
              <span className="column-kicker">Week</span>
              <h3>
                {fmt(weekDays[0])} – {fmt(weekDays[6])}
              </h3>
              <span className="muted">
                {sum(weekSessions)} planned of {hours(weekBlocks.flat().reduce((t, b) => t + toMin(b.end) - toMin(b.start), 0))} free
              </span>
            </div>
            <span className="cal-nav">
              <button className="icon-btn" onClick={() => goWeek(dateKey(addDays(parse(week), -7)))} aria-label="Previous week">
                ‹
              </button>
              <button className="btn-ghost" onClick={() => goWeek(today)}>
                Today
              </button>
              <button className="icon-btn" onClick={() => goWeek(dateKey(addDays(parse(week), 7)))} aria-label="Next week">
                ›
              </button>
            </span>
          </header>
          <div className="wgrid">
            <div className="wgrid-axis" style={{ height: (to - from) * PX }}>
              {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => (
                <span key={i} style={{ top: i * 60 * PX }}>
                  {fromMin(from + i * 60)}
                </span>
              ))}
            </div>
            {weekDays.map((k, d) => (
              <div key={k} className={`wday ${k === today ? 'today' : ''}`}>
                <div className="wday-head">
                  {DAY[parse(k).getDay()]} {Number(k.slice(8))}
                  {dueOn(k).map((x) => (
                    <span key={x.id} className="wday-due" style={{ color: x.color }} title={`${x.title} due`}>
                      ◆
                    </span>
                  ))}
                </div>
                <div className="wday-body" style={{ height: (to - from) * PX }}>
                  {weekBlocks[d].map((b, i) => (
                    <i key={i} className="wfree" style={{ top: (toMin(b.start) - from) * PX, height: (toMin(b.end) - toMin(b.start)) * PX }} />
                  ))}
                  {weekSessions
                    .filter((s) => s.date === k)
                    .map((s, i) => {
                      const x = pathOf(s.pathId)
                      return (
                        <button
                          key={i}
                          className={`wsess ${lateSession(s) ? 'clash' : ''} ${done.has(s.nodeId) ? 'done' : ''} ${dim(s.pathId)} ${pick && pick.date === s.date && pick.start === s.start ? 'on' : ''}`}
                          style={{ top: (toMin(s.start) - from) * PX, height: Math.max(16, s.minutes * PX - 2), '--pc': x?.color } as React.CSSProperties}
                          onClick={() => setPick(s)}
                          title={`${nodes[s.nodeId]?.title ?? ''} · ${s.start}–${s.end}`}
                        >
                          <b>{nodes[s.nodeId]?.title ?? '…'}</b>
                          <span>
                            {s.start} · {s.minutes}m
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {pick && (
          <section className="cal-card">
            <header className="cal-card-head">
              <div className="cal-card-title static">
                <span className="column-kicker">Adjust</span>
                <h3>
                  {fmt(pick.date)}, {pick.start.slice(0, 2)}:00 hour
                </h3>
              </div>
              <button className="reveal" onClick={() => setPick(null)}>
                Close
              </button>
            </header>
            <HourBreakdown
              hour={pick.start.slice(0, 2)}
              sessions={(byDate.get(pick.date) ?? []).filter((s) => toMin(s.start) < (Number(pick.start.slice(0, 2)) + 1) * 60 && toMin(s.end) > Number(pick.start.slice(0, 2)) * 60)}
              paths={paths}
              nodes={nodes}
              done={done}
              onSave={p.onSave}
              onOpen={p.onOpen}
              onToggleDone={p.onToggleDone}
            />
          </section>
        )}

        {/* ---------- MONTH ---------- */}
        <section className="cal-card">
          <header className="cal-card-head">
            <div className="cal-card-title static">
              <span className="column-kicker">Month</span>
              <h3>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
              <span className="muted">{sum(sessions.filter((s) => s.date.startsWith(month)))} planned</span>
            </div>
            <span className="cal-nav">
              <button className="icon-btn" onClick={() => setMonth(dateKey(new Date(my, mm - 2, 1)).slice(0, 7))} aria-label="Previous month">
                ‹
              </button>
              <button className="icon-btn" onClick={() => setMonth(dateKey(new Date(my, mm, 1)).slice(0, 7))} aria-label="Next month">
                ›
              </button>
            </span>
          </header>
          <div className="mgrid">
            {DAY.map((d) => (
              <span key={d} className="mgrid-head">
                {d}
              </span>
            ))}
            {cells.map((k, i) => {
              if (!k) return <span key={`b${i}`} />
              const list = byDate.get(k) ?? []
              const dues = dueOn(k)
              const clash = list.some(lateSession)
              const free = blocksOn(parse(k), availability).length > 0
              const per = p.ordered.map((x) => ({ x, m: list.filter((s) => s.pathId === x.id).reduce((t, s) => t + s.minutes, 0) })).filter((y) => y.m)
              return (
                <button
                  key={k}
                  className={`mcell ${k === today ? 'today' : ''} ${weekDays.includes(k) ? 'inweek' : ''} ${clash ? 'clash' : ''} ${free ? '' : 'busy'} ${k < today ? 'past' : ''}`}
                  onClick={() => goWeek(k)}
                >
                  <span className="mcell-num">{Number(k.slice(8))}</span>
                  {per.map(({ x, m }) => (
                    <span key={x.id} className={`mcell-bar ${dim(x.id)}`} style={{ background: x.color, width: `${Math.min(100, (m / 120) * 100)}%` }} title={`${x.title}: ${hours(m)}`} />
                  ))}
                  {dues.map((x) => (
                    <span key={x.id} className="mcell-due" style={{ color: x.color }} title={`${x.title} due`}>
                      ◆ due
                    </span>
                  ))}
                  {list.length > 0 && <span className="mcell-sum">{sum(list)}</span>}
                </button>
              )
            })}
          </div>
        </section>

        {/* ---------- YEAR ---------- */}
        <section className={`cal-card ${yearOpen ? 'open' : ''}`}>
          <header className="cal-card-head">
            <button className="cal-card-title" onClick={() => setYearOpen((o) => !o)} aria-expanded={yearOpen}>
              <span className="column-kicker">Year</span>
              <h3>{year}</h3>
              <span className="muted">{yearOpen ? 'Hide the weekly load ▴' : 'Show the full year ▾'}</span>
            </button>
            <span className="cal-nav">
              <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Previous year">
                ‹
              </button>
              <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Next year">
                ›
              </button>
            </span>
          </header>
          <div className="gantt">
            <div className="gantt-months">
              <span />
              <div>
                {MONTHS.map((m, i) => {
                  const k = `${year}-${String(i + 1).padStart(2, '0')}`
                  return (
                    <button key={m} className={month === k ? 'on' : ''} onClick={() => setMonth(k)}>
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
            {p.ordered.map((x) => {
              const mine = sessions.filter((s) => s.pathId === x.id)
              const o = outlook.find((y) => y.pathId === x.id)
              const firstS = mine[0]?.date
              const lastS = mine[mine.length - 1]?.date
              const dated = timingOf(x, p.meta) === 'date' && x.due
              const lateFrom = dated && lastS && lastS > x.due! ? x.due! : ''
              return (
                <div key={x.id} className={`gantt-row ${dim(x.id)}`} style={{ '--pc': x.color } as React.CSSProperties}>
                  <button className="gantt-label" onClick={() => p.onFocusPath(focus?.id === x.id ? '' : x.id)} title={x.title}>
                    <i className="path-dot" /> {x.title}
                  </button>
                  <div className="gantt-track">
                    {MONTHS.map((_, i) => (
                      <i key={i} className="gantt-grid" style={{ left: `${(i / 12) * 100}%` }} />
                    ))}
                    {inYear(today) && <i className="gantt-today" style={{ left: `${pos(today)}%` }} />}
                    {firstS && lastS && (firstS <= `${year}-12-31` && lastS >= `${year}-01-01`) && (
                      <div
                        className="gantt-bar"
                        style={{ left: `${pos(firstS < `${year}-01-01` ? `${year}-01-01` : firstS)}%`, width: `${Math.max(0.8, pos(lastS) - pos(firstS < `${year}-01-01` ? `${year}-01-01` : firstS))}%` }}
                        title={`${fmt(firstS)} → ${fmt(lastS)}`}
                      />
                    )}
                    {lateFrom && inYear(lateFrom) && (
                      <div className="gantt-late" style={{ left: `${pos(lateFrom)}%`, width: `${Math.max(0.8, pos(lastS!) - pos(lateFrom))}%` }} title="Past its due date" />
                    )}
                    {dated && inYear(x.due!) && <i className={`gantt-due ${o?.late ? 'late' : ''}`} style={{ left: `${pos(x.due!)}%` }} title={`Due ${fmt(x.due!)}`} />}
                  </div>
                </div>
              )
            })}
          </div>
          {yearOpen && (
            <div className="load">
              <div className="load-legend">
                Hours per week, stacked by path · <span className="load-free-key" /> free time
              </div>
              <div className="load-bars">
                {weeks.map((w) => (
                  <button
                    key={w.start}
                    className={`load-week ${weekDays[0] === w.start ? 'on' : ''}`}
                    onClick={() => goWeek(w.start)}
                    title={`Week of ${fmt(w.start)}: ${hours(w.total)} of ${hours(w.free)} free`}
                  >
                    <i className="load-free" style={{ height: `${(w.free / maxWeek) * 100}%` }} />
                    <span className="load-stack" style={{ height: `${(w.total / maxWeek) * 100}%` }}>
                      {p.ordered
                        .filter((x) => w.byPath.get(x.id))
                        .map((x) => (
                          <i key={x.id} className={dim(x.id)} style={{ flex: w.byPath.get(x.id), background: x.color }} />
                        ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** Say it in words (the AI turns it into blocks) or set blocks by hand. */
export function AvailabilityEditor({
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

/**
 * When the plan doesn't fit: shorten every chapter evenly (instant), or let the AI propose
 * smarter changes for you to approve (shorten, drop, change a path's timing).
 */
function FitBox({
  paths,
  done,
  availability,
  meta,
  order,
  nodes,
  settings,
  onSave,
  onMeta,
}: {
  paths: Path[]
  done: Set<string>
  availability: Availability
  meta: PathMeta
  order: string[]
  nodes: Record<string, TreeNode>
  settings: Settings
  onSave: (p: NewPath) => Promise<Path>
  onMeta: (id: string, fields: { timing?: Timing; pressing?: boolean }) => void
}) {
  const live = paths.filter((x) => !x.archived && x.steps.length)
  const shrink = useMemo(() => shrinkToFit(paths, done, availability, meta, order), [paths, done, availability, meta, order])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<{ summary: string; changes: FitChange[] } | null>(null)
  const title = (id: string) => nodes[id]?.title ?? 'a chapter'

  const applyShrink = async () => {
    if (!shrink) return
    for (const x of live) if (shrink.steps[x.id]) await onSave({ ...x, steps: shrink.steps[x.id] })
  }

  const askAI = async () => {
    setBusy(true)
    setError('')
    setProposal(null)
    try {
      const today = dateKey(new Date())
      const lines = [`Today: ${today}. Free time: ${hours(weeklyMinutes(availability))} a week.`, '']
      live.forEach((x, i) => {
        const timing = timingOf(x, meta)
        const left = x.steps.filter((s) => !done.has(s.node_id)).reduce((t, s) => t + s.minutes, 0)
        const room = timing === 'date' && x.due ? `, free time before then: ${hours(freeMinutesUntil(availability, x.due))}` : ''
        lines.push(
          `Path ${i + 1}: "${x.title}"${x.goal ? ` (goal: ${x.goal})` : ''} — ${timing === 'date' ? `due ${x.due}` : timing === 'asap' ? 'ASAP' : 'no rush'}${meta[x.id]?.pressing ? ', marked pressing' : ''}; still to do: ${hours(left)}${room}`,
        )
        x.steps.forEach((s, k) => {
          if (!done.has(s.node_id)) lines.push(`  ${i + 1}.${k + 1} ${title(s.node_id)} — ${s.minutes} min${s.note ? ` — ${s.note}` : ''}`)
        })
      })
      const { text } = await generate({ kind: 'fit', trail: ['Schedule'], material: lines.join('\n').slice(0, 24000) }, settings)
      const out = parseFit(text)
      if (!out.changes.length) throw new Error('No changes came back. Try again, or add free time.')
      setProposal(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const applyAI = async () => {
    if (!proposal) return
    for (const [i, x] of live.entries()) {
      const mine = proposal.changes.filter((c) => c.path === i + 1)
      if (!mine.length) continue
      const drop = new Set(mine.filter((c) => c.kind === 'drop').map((c) => (c as { step: number }).step))
      const steps = x.steps
        .map((s, k) => {
          const m = mine.find((c) => c.kind === 'min' && c.step === k + 1) as { minutes: number } | undefined
          return m ? { ...s, minutes: m.minutes } : s
        })
        .filter((_, k) => !drop.has(k + 1))
      const t = mine.find((c) => c.kind === 'timing') as { timing: Timing; due: string } | undefined
      await onSave({ ...x, steps, ...(t ? { due: t.timing === 'date' ? t.due : null } : {}) })
      if (t) onMeta(x.id, { timing: t.timing })
    }
    setProposal(null)
  }

  const describe = (c: FitChange) => {
    const x = live[c.path - 1]
    if (!x) return ''
    if (c.kind === 'timing') return `${x.title}: ${c.timing === 'date' ? `due ${c.due}` : c.timing === 'asap' ? 'ASAP' : 'no rush'}`
    const s = x.steps[c.step - 1]
    if (!s) return ''
    return c.kind === 'min' ? `${title(s.node_id)}: ${s.minutes} → ${c.minutes} min` : `Drop ${title(s.node_id)} (${x.title})`
  }

  return (
    <div className="fit-box">
      <h4>Make it fit</h4>
      {shrink && shrink.factor < 1 ? (
        <p>
          Shorten every chapter by about {Math.round((1 - shrink.factor) * 100)}% (none under 15 min) and it all fits.{' '}
          <button className="btn-ghost" onClick={() => void applyShrink()}>
            Shorten evenly
          </button>
        </p>
      ) : !shrink ? (
        <p className="muted">Even at 15 min a chapter it won’t fit. Add free time, or let the AI choose what to drop.</p>
      ) : null}
      <button className="btn-neon" disabled={busy} onClick={() => void askAI()}>
        {busy ? 'Thinking…' : '✦ Make it fit with AI'}
      </button>
      {error && <div className="error">{error}</div>}
      {proposal && (
        <div className="fit-proposal">
          {proposal.summary && <p>{proposal.summary}</p>}
          <ul>
            {proposal.changes.map((c, i) => {
              const d = describe(c)
              return d ? (
                <li key={i}>
                  <b>{d}</b>
                  {c.why && <span className="muted"> — {c.why}</span>}
                </li>
              ) : null
            })}
          </ul>
          <div className="row-line">
            <button className="btn-neon" onClick={() => void applyAI()}>
              Apply
            </button>
            <button className="btn-ghost" onClick={() => setProposal(null)}>
              No thanks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One hour, minute by minute: a timeline of what's planned (in each path's colour) and the
 * free gaps, then a row per chapter to adjust it: shorter / longer, earlier / later in its
 * path, done, or open to read. Any change re-plans everything at once.
 */
function HourBreakdown({
  hour,
  sessions,
  paths,
  nodes,
  done,
  onSave,
  onOpen,
  onToggleDone,
}: {
  hour: string
  sessions: Session[]
  paths: Path[]
  nodes: Record<string, TreeNode>
  done: Set<string>
  onSave: (p: NewPath) => Promise<Path>
  onOpen: (id: string) => void
  onToggleDone: (id: string) => void
}) {
  const h0 = Number(hour) * 60
  const PX = 6 // pixels per minute
  // the part of each session inside this hour
  const parts = sessions.map((s) => ({ s, from: Math.max(toMin(s.start), h0) - h0, to: Math.min(toMin(s.end), h0 + 60) - h0 }))
  const gaps: { from: number; to: number }[] = []
  let at = 0
  for (const x of [...parts].sort((a, b) => a.from - b.from)) {
    if (x.from > at) gaps.push({ from: at, to: x.from })
    at = Math.max(at, x.to)
  }
  if (at < 60) gaps.push({ from: at, to: 60 })
  const label = (m: number) => fromMin(h0 + m)

  const stepOf = (s: Session) => {
    const path = paths.find((x) => x.id === s.pathId)
    const i = path ? path.steps.findIndex((x) => x.node_id === s.nodeId) : -1
    return { path, i }
  }
  const setMinutes = (s: Session, by: number) => {
    const { path, i } = stepOf(s)
    if (!path || i < 0) return
    const minutes = Math.max(MIN_STEP, Math.min(600, path.steps[i].minutes + by))
    void onSave({ ...path, steps: path.steps.map((x, k) => (k === i ? { ...x, minutes } : x)) })
  }
  const move = (s: Session, by: -1 | 1) => {
    const { path, i } = stepOf(s)
    if (!path || i < 0) return
    const j = i + by
    if (j < 0 || j >= path.steps.length) return
    const steps = [...path.steps]
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    void onSave({ ...path, steps })
  }

  return (
    <div className="hour-breakdown">
      <div className="hour-timeline" style={{ height: 60 * PX }}>
        {[0, 15, 30, 45].map((m) => (
          <span key={m} className="hour-tick" style={{ top: m * PX }}>
            {label(m)}
          </span>
        ))}
        {gaps.map((g) => (
          <div key={`g${g.from}`} className="hour-gap" style={{ top: g.from * PX, height: (g.to - g.from) * PX }}>
            {g.to - g.from >= 8 && <span>free · {g.to - g.from} min</span>}
          </div>
        ))}
        {parts.map(({ s, from, to }, i) => {
          const path = paths.find((x) => x.id === s.pathId)
          return (
            <div
              key={i}
              className={`hour-block ${done.has(s.nodeId) ? 'done' : ''}`}
              style={{ top: from * PX, height: Math.max(18, (to - from) * PX - 2), '--pc': path?.color } as React.CSSProperties}
            >
              <b>{nodes[s.nodeId]?.title ?? '…'}</b>
              <span>
                {s.start}–{s.end}
                {s.minutes !== to - from ? ` · ${to - from} of ${s.minutes} min this hour` : ` · ${s.minutes} min`}
                {s.part ? ` · part ${s.part}` : ''}
              </span>
            </div>
          )
        })}
      </div>

      <ul className="hour-adjust">
        {sessions.map((s, i) => {
          const { path, i: k } = stepOf(s)
          const step = path?.steps[k]
          const isDone = done.has(s.nodeId)
          return (
            <li key={i} style={{ '--pc': path?.color } as React.CSSProperties}>
              <div className="adj-head">
                <i className="path-dot" />
                <b>{nodes[s.nodeId]?.title ?? '…'}</b>
                <span className="muted">{path?.title}</span>
              </div>
              <div className="adj-row">
                <span className="adj-label">Study time</span>
                <button onClick={() => setMinutes(s, -5)} disabled={!step || step.minutes <= MIN_STEP} aria-label="5 minutes shorter">
                  −5
                </button>
                <span className="adj-val">{step ? hours(step.minutes) : '—'}</span>
                <button onClick={() => setMinutes(s, 5)} aria-label="5 minutes longer">
                  +5
                </button>
              </div>
              <div className="adj-row">
                <span className="adj-label">In its path</span>
                <button onClick={() => move(s, -1)} disabled={k <= 0}>
                  Earlier
                </button>
                <button onClick={() => move(s, 1)} disabled={!path || k >= path.steps.length - 1}>
                  Later
                </button>
              </div>
              <div className="adj-row">
                <button className={`step-check ${isDone ? 'on' : ''}`} onClick={() => onToggleDone(s.nodeId)} aria-label={isDone ? 'Mark not done' : 'Mark done'}>
                  {isDone ? '✓' : ''}
                </button>
                <span className="adj-label">{isDone ? 'Done' : 'Mark done'}</span>
                <span className="grow" />
                <button className="adj-open" onClick={() => onOpen(s.nodeId)}>
                  Open chapter ›
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Cal's left panel: the scheduled paths, highest priority first. Unlock and drag to change
 * the order (it re-plans at once); each shows whether it's on track, late or doesn't fit.
 */
export function CalList({
  ordered,
  outlook,
  onOrder,
  onOpenPath,
  selected,
}: {
  ordered: Path[]
  outlook: PathOutlook[]
  onOrder: (ids: string[]) => void
  onOpenPath: (id: string) => void
  selected?: string
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [dragId, setDragId] = useState('')
  const [ids, setIds] = useState<string[] | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const shown = ids ? ids.map((id) => ordered.find((x) => x.id === id)!).filter(Boolean) : ordered
  const start = (id: string, e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(id)
    setIds(ordered.map((x) => x.id))
  }
  const moveTo = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragId || !ids) return
    let to = 0
    for (const id of ids) {
      if (id === dragId) continue
      const r = rows.current.get(id)?.getBoundingClientRect()
      if (r && e.clientY > r.top + r.height / 2) to++
    }
    const from = ids.indexOf(dragId)
    if (to === from) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    setIds(next)
  }
  const end = () => {
    if (ids) onOrder(ids)
    setDragId('')
    setIds(null)
  }
  return (
    <div className="cal-rail">
      <div className="rail-sort cal-lock">
        <span>Priority, top first</span>
        <button onClick={() => setUnlocked((u) => !u)} aria-label={unlocked ? 'Lock the order' : 'Unlock to reorder'}>
          {unlocked ? '🔓 Done' : '🔒 Reorder'}
        </button>
      </div>
      {!ordered.length && <p className="rail-empty">Nothing scheduled. Schedule a path in Paths.</p>}
      <ol className="cal-list">
        {shown.map((x, i) => {
          const o = outlook.find((y) => y.pathId === x.id)
          const state = !o ? '' : o.covered ? 'covered' : o.unplaced && !o.finish ? 'nofit' : o.unplaced || o.late ? 'late' : o.finish ? 'ok' : 'done'
          return (
            <li
              key={x.id}
              className={`cal-row ${dragId === x.id ? 'dragging' : ''} ${selected === x.id ? 'on' : ''}`}
              style={{ '--pc': x.color } as React.CSSProperties}
              ref={(el) => {
                if (el) rows.current.set(x.id, el)
                else rows.current.delete(x.id)
              }}
            >
              <span className="cal-rank">{i + 1}</span>
              <button className="cal-main" onClick={() => onOpenPath(x.id)}>
                <span className="cal-title">{x.title}</span>
                <span className={`cal-state ${state}`}>
                  {state === 'ok'
                    ? `✓ done ${fmt(o!.finish)}`
                    : state === 'late'
                      ? o!.unplaced
                        ? `⚠ ${hours(o!.unplaced)} won’t fit`
                        : `⚠ late: ${fmt(o!.finish)}`
                      : state === 'nofit'
                        ? '✗ doesn’t fit'
                        : state === 'covered'
                          ? 'Covered by a path above'
                          : state === 'done'
                            ? 'All done'
                            : ''}
                  {x.due && ` · due ${fmt(x.due)}`}
                </span>
              </button>
              {unlocked && (
                <span className="rail-grip" onPointerDown={(e) => start(x.id, e)} onPointerMove={moveTo} onPointerUp={end} onPointerCancel={end} aria-label={`Drag ${x.title}`}>
                  ≡
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * One scheduled path, at a glance: how much is planned, when it starts and finishes against
 * its due date, then every session by day. Tap a session to open that hour and adjust it.
 */
function Rundown({
  path,
  sessions,
  outlook,
  nodes,
  meta,
  selected,
  onPick,
  onClose,
}: {
  path: Path
  sessions: Session[]
  outlook?: PathOutlook
  nodes: Record<string, TreeNode>
  meta: PathMeta
  selected: string
  onPick: (s: Session) => void
  onClose: () => void
}) {
  const byDay = new Map<string, Session[]>()
  for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s])
  const total = sessions.reduce((t, s) => t + s.minutes, 0)
  const timing = timingOf(path, meta)
  return (
    <section className="column rundown" style={{ '--pc': path.color } as React.CSSProperties}>
      <header className="column-head">
        <div className="column-ctrl">
          <span className="column-kicker">Rundown</span>
          <button className="reveal" onClick={onClose}>
            × full plan
          </button>
        </div>
        <h2>{path.title}</h2>
        <div className="rundown-stats">
          <span>
            <b>{hours(total)}</b> planned
          </span>
          <span>
            <b>{sessions.length}</b> session{sessions.length === 1 ? '' : 's'}
          </span>
          <span>
            <b>{byDay.size}</b> day{byDay.size === 1 ? '' : 's'}
          </span>
        </div>
        <p className={`path-outlook ${outlook?.late ? 'late' : ''}`}>
          {!sessions.length
            ? outlook?.covered
              ? 'Its chapters are already in a path above, so nothing extra is planned.'
              : 'Nothing planned yet: add free time, or move it up the list.'
            : `${fmt(sessions[0].date)} → ${fmt(sessions[sessions.length - 1].date)}`}
          {timing === 'date' && path.due ? ` · due ${fmt(path.due)}${outlook?.late ? ' (late)' : ''}` : timing === 'asap' ? ' · ASAP' : ' · no rush'}
          {outlook?.unplaced ? ` · ${hours(outlook.unplaced)} doesn’t fit` : ''}
        </p>
      </header>
      {[...byDay].map(([d, list]) => (
        <div key={d} className="rundown-day">
          <div className="rundown-date">
            {fmt(d)} <span className="muted">{hours(list.reduce((t, s) => t + s.minutes, 0))}</span>
          </div>
          {list.map((s, i) => (
            <button key={i} className={`rundown-item ${selected === `${s.date} ${s.start.slice(0, 2)}` ? 'on' : ''}`} onClick={() => onPick(s)}>
              <span className="rundown-time">
                {s.start}–{s.end}
              </span>
              <span className="rundown-title">{nodes[s.nodeId]?.title ?? '…'}</span>
              <span className="rundown-min">
                {s.minutes} min{s.part ? ` · ${s.part}` : ''}
              </span>
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}
