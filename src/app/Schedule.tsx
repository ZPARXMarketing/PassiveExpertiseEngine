import { useEffect, useMemo, useRef, useState } from 'react'
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

  const focus = paths.find((x) => x.id === p.focusPath && !x.archived)
  const cols: { kicker: string; picked?: string; body: React.ReactNode; wide?: boolean }[] = []
  if (hasPlan && !focus) {
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
  }
  if (hasPlan && !focus) {
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
  }
  if (hasPlan) {
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

  const problems = outlook.filter((o) => o.late || o.unplaced)
  const signature = `${p.ordered.map((x) => x.id).join(',')}|${problems.map((o) => o.pathId).join(',')}`
  const describe = (o: PathOutlook) => {
    const x = pathOf(o.pathId)
    if (!x) return ''
    if (o.unplaced && !o.finish) return `${x.title}: none of it fits your free time yet`
    if (o.unplaced) return `${x.title}: ${hours(o.unplaced)} doesn’t fit`
    return `${x.title}: finishes ${fmt(o.finish)}, after it’s due ${fmt(x.due!)}`
  }

  return (
    <main className="explore schedule-view">
      {p.narrowList && <div className="narrow-only cal-narrow">{p.narrowList}</div>}
      {!live.length ? (
        <div className="lib-empty">
          <h2>Nothing scheduled yet</h2>
          <p>Schedule a path first: open one in Paths and tap “Schedule this path”. Its chapters get laid into your free time here.</p>
          <button className="btn-neon" onClick={p.onGoPaths}>
            Go to Paths
          </button>
        </div>
      ) : noTime ? (
        <div className="lib-empty">
          <h2>When can you study?</h2>
          <p>Tell it when you’re free and your scheduled paths get planned into that time.</p>
          <button className="btn-neon" onClick={p.onEditFree}>
            Set my free time
          </button>
        </div>
      ) : (
        problems.length > 0 &&
        (p.ack === signature ? (
          <p className="cal-kept">
            Keeping your order: {problems.map(describe).join(' · ')}.{' '}
            <button className="reveal" onClick={() => p.onAck('')}>
              Review
            </button>
          </p>
        ) : (
          <div className="cal-warn" role="alert">
            <h4>⚠ This order doesn’t fit</h4>
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
        ))
      )}
      <div className={`columns pw-${p.panelWidth}`} ref={colsRef}>
        {hasPlan && focus ? (
          folded[0] ? (
            <Strip kicker="Rundown" picked={focus.title} onOpen={() => setKeep(0)} />
          ) : (
            <Rundown
              path={focus}
              sessions={sessions.filter((x) => x.pathId === focus.id)}
              outlook={outlook.find((o) => o.pathId === focus.id)}
              nodes={nodes}
              meta={p.meta}
              selected={`${day} ${hour}`}
              onPick={(sess) => {
                setYear(sess.date.slice(0, 4))
                setMonth(sess.date.slice(0, 7))
                setDay(sess.date)
                setHour(sess.start.slice(0, 2))
              }}
              onClose={() => {
                p.onFocusPath('')
                setDay('')
                setHour('')
              }}
            />
          )
        ) : hasPlan &&
          (folded[0] ? (
            <Strip kicker="Years" picked={year} onOpen={() => setKeep(0)} />
          ) : (
            <section className="column">
              <header className="column-head">
                <span className="column-kicker">Years</span>
                <h2>Your plan</h2>
              </header>
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
            </section>
          ))}
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
