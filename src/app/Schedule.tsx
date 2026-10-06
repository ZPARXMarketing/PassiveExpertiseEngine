import { useEffect, useMemo, useState } from 'react'
import { Strip, useFit } from './fit.tsx'
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
  /** Paths | Schedule switch shown when the left panel is tucked away (narrow windows) */
  subnav?: React.ReactNode
}

/**
 * The study plan as one drill-down, like Explore: Years → Months → Days → Hours → Minutes
 * (the sessions inside that hour, to tick off or open). Opens on this year and month.
 * Re-plans itself whenever you finish something, fall behind, or change when you're free.
 */
export function Schedule(p: Props) {
  const { paths, nodes, done, availability } = p
  const now = new Date()
  const today = dateKey(now)
  const [year, setYear] = useState(today.slice(0, 4))
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState('')
  const [hour, setHour] = useState('')
  // like Explore: columns that don't fit fold into strips, oldest first (tap one to open it)
  const [keep, setKeep] = useState(-1)
  useEffect(() => setKeep(-1), [year, month, day, hour])

  const { sessions, outlook } = p.plan
  const pathOf = (id: string) => paths.find((x) => x.id === id)
  const live = paths.filter((x) => !x.archived && x.steps.length)
  const sum = (list: Session[]) => hours(list.reduce((t, s) => t + s.minutes, 0))
  const noTime = !availability.weekly.length && !availability.overrides.some((o) => o.blocks.length)
  const hasPlan = !!live.length && !noTime

  /** sessions grouped by a key prefix: "2026", "2026-10", "2026-10-06" */
  const within = (prefix: string) => sessions.filter((s) => s.date.startsWith(prefix))
  const years = [...new Set([today.slice(0, 4), ...sessions.map((s) => s.date.slice(0, 4))])].sort()
  const months = [...new Set(within(year).map((s) => s.date.slice(0, 7)))].sort()
  const days = [...new Set(within(month).map((s) => s.date))].sort()
  const daySessions = day ? within(day) : []
  /** the hours a session touches: a 19:45–20:30 session shows under 19:00 and 20:00 */
  const hoursOf = (s: Session) => {
    const out: string[] = []
    for (let h = Math.floor(toMin(s.start) / 60); h * 60 < toMin(s.end); h++) out.push(String(h).padStart(2, '0'))
    return out
  }
  const dayHours = [...new Set(daySessions.flatMap(hoursOf))].sort()
  const hourSessions = hour ? daySessions.filter((s) => hoursOf(s).includes(hour)) : []

  const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long' })
  const dayName = (k: string) =>
    k === today ? 'Today' : new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const hourName = (h: string) => new Date(`2000-01-01T${h}:00:00`).toLocaleTimeString(undefined, { hour: 'numeric' })
  const dots = (list: Session[]) => (
    <span className="month-dots">
      {[...new Set(list.map((s) => s.pathId))].map((id) => (
        <i key={id} style={{ background: pathOf(id)?.color }} />
      ))}
    </span>
  )
  const tile = (key: string, active: boolean, title: string, list: Session[], onClick: () => void, extra?: React.ReactNode) => (
    <li key={key} className="tile-wrap">
      <button className={`tile ${active ? 'active' : ''}`} onClick={onClick}>
        <span className="tile-top">{dots(list)}</span>
        <span className="tile-title">{title}</span>
        <span className="tile-sum">{list.length ? `${list.length} session${list.length === 1 ? '' : 's'} · ${sum(list)}` : 'Nothing planned'}</span>
        {extra}
      </button>
    </li>
  )

  const cols: { kicker: string; picked?: string; body: React.ReactNode; wide?: boolean }[] = []
  if (hasPlan) {
    cols.push({
      kicker: 'Months',
      picked: month.startsWith(year) ? monthName(month) : undefined,
      body: (
        <>
          <header className="column-head">
            <span className="column-kicker">Months</span>
            <h2>{year}</h2>
          </header>
          {months.length ? (
            <ol className="tiles">
              {months.map((m) =>
                tile(
                  m,
                  month === m,
                  monthName(m),
                  within(m),
                  () => {
                    setMonth(m)
                    setDay('')
                    setHour('')
                  },
                  live
                    .filter((x) => timingOf(x, p.meta) === 'date' && x.due?.startsWith(m))
                    .map((x) => (
                      <span key={x.id} className="year-due" style={{ '--pc': x.color } as React.CSSProperties}>
                        <i className="path-dot" /> {x.title} due {fmt(x.due!)}
                      </span>
                    )),
                ),
              )}
            </ol>
          ) : (
            <p className="sheet-note">Nothing planned in {year}.</p>
          )}
        </>
      ),
    })
    if (month.startsWith(year))
      cols.push({
        kicker: monthName(month),
        picked: day ? dayName(day) : undefined,
        body: (
          <>
            <header className="column-head">
              <span className="column-kicker">Days</span>
              <h2>
                {monthName(month)} {year}
              </h2>
            </header>
            {days.length ? (
              <ol className="tiles">
                {days.map((k) =>
                  tile(k, day === k, dayName(k), within(k), () => {
                    setDay(k)
                    setHour('')
                  }),
                )}
              </ol>
            ) : (
              <p className="sheet-note">Nothing planned this month.</p>
            )}
          </>
        ),
      })
    if (day)
      cols.push({
        kicker: dayName(day),
        picked: hour ? hourName(hour) : undefined,
        body: (
          <>
            <header className="column-head">
              <span className="column-kicker">Hours</span>
              <h2>{dayName(day)}</h2>
              <p className="column-desc">
                Free {blocksOn(new Date(`${day}T12:00:00`), availability).map((b) => `${b.start}–${b.end}`).join(', ') || '—'} · {sum(daySessions)} planned
              </p>
            </header>
            <ol className="tiles">
              {dayHours.map((h) => {
                const list = daySessions.filter((s) => hoursOf(s).includes(h))
                return tile(h, hour === h, hourName(h), list, () => setHour(h))
              })}
            </ol>
          </>
        ),
      })
    if (day && hour)
      cols.push({
        kicker: hourName(hour),
        wide: true,
        picked: `${hourSessions.length} session${hourSessions.length === 1 ? '' : 's'}`,
        body: (
          <>
            <header className="column-head">
              <span className="column-kicker">Minutes · {sum(hourSessions)} planned</span>
              <h2>
                {dayName(day)}, {hourName(hour)}
              </h2>
            </header>
            <HourBreakdown hour={hour} sessions={hourSessions} paths={paths} nodes={nodes} done={done} onSave={p.onSave} onOpen={p.onOpen} onToggleDone={p.onToggleDone} />
          </>
        ),
      })
  }
  const { ref: colsRef, folded } = useFit([250, ...cols.map((c) => (c.wide ? 300 : 250))], keep, p.panelWidth)

  return (
    <main className="explore schedule-view">
      {p.subnav}
      <div className={`columns pw-${p.panelWidth}`} ref={colsRef}>
        {folded[0] ? (
          <Strip kicker="Years" picked={year} onOpen={() => setKeep(0)} />
        ) : (
          <section className="column">
            <header className="column-head">
              <span className="column-kicker">Schedule</span>
              <h2>Your study plan</h2>
            </header>
            {hasPlan && (
              <ol className="tiles">
                {years.map((y) =>
                  tile(y, year === y, y, within(y), () => {
                    setYear(y)
                    setMonth(y === today.slice(0, 4) ? today.slice(0, 7) : (within(y)[0]?.date.slice(0, 7) ?? `${y}-01`))
                    setDay('')
                    setHour('')
                  }),
                )}
              </ol>
            )}
            {!live.length && (
              <div className="sched-hint">
                <p className="sheet-note">Schedule a path first: the plan lays its chapters into your free time.</p>
                <button className="btn-neon" onClick={p.onGoPaths}>
                  Go to Paths
                </button>
              </div>
            )}
            {!!live.length && noTime && (
              <div className="sched-hint">
                <p className="sheet-note">Tell it when you can study and your paths get planned into that time.</p>
                <button className="btn-neon" onClick={p.onEditFree}>
                  Set my free time
                </button>
              </div>
            )}
            {!noTime && outlook.some((o) => o.finish || o.unplaced) && (
              <ul className="outlook">
                {outlook.map((o) => {
                  const x = pathOf(o.pathId)
                  if (!x || (!o.finish && !o.unplaced)) return null
                  return (
                    <li key={o.pathId} className={o.late ? 'late' : ''} style={{ '--pc': x.color } as React.CSSProperties}>
                      <i className="path-dot" />
                      <span>
                        <b>{x.title}</b>
                        {o.pressing && ' 🔥'}
                        {o.unplaced
                          ? o.finish
                            ? ` — ${hours(o.unplaced)} still won't fit${x.due ? ` (due ${fmt(x.due)})` : ''}.`
                            : ` — none of it fits your free time yet.`
                          : o.late
                            ? ` — finishes ${fmt(o.finish)}, after it's due ${fmt(x.due!)}.`
                            : ` — ${o.timing === 'none' ? 'no rush, ' : ''}done ${fmt(o.finish)}${o.timing === 'date' && x.due ? ` (due ${fmt(x.due)})` : ''}${o.promoted ? ', moved ahead to make its date' : ''}.`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {!noTime && outlook.some((o) => o.late || o.unplaced) && (
              <FitBox paths={paths} done={done} availability={availability} meta={p.meta} nodes={nodes} settings={p.settings} onSave={p.onSave} onMeta={p.onMeta} />
            )}
          </section>
        )}
        {cols.map((c, i) =>
          folded[i + 1] ? (
            <Strip key={c.kicker + i} kicker={c.kicker} picked={c.picked} onOpen={() => setKeep(i + 1)} />
          ) : (
            <section key={c.kicker + i} className={`column ${c.wide ? 'day-panel' : ''}`}>
              {c.body}
            </section>
          ),
        )}
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
  nodes,
  settings,
  onSave,
  onMeta,
}: {
  paths: Path[]
  done: Set<string>
  availability: Availability
  meta: PathMeta
  nodes: Record<string, TreeNode>
  settings: Settings
  onSave: (p: NewPath) => Promise<Path>
  onMeta: (id: string, fields: { timing?: Timing; pressing?: boolean }) => void
}) {
  const live = paths.filter((x) => !x.archived && x.steps.length)
  const shrink = useMemo(() => shrinkToFit(paths, done, availability, meta), [paths, done, availability, meta])
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
