import { useEffect, useState } from 'react'
import { clock, useAudio, type Track } from './audio.ts'
import { Marked } from './Marked.tsx'
import { latest, paras, parseCheck, parsePractice, parseSections } from './parse.ts'
import { Chart } from './Chart.tsx'
import { LECTURE_LENGTHS, voiceLabel } from './prompts.ts'
import {
  lectureCounts,
  lectureTitle,
  type ChartSpec,
  type CheckResult,
  type Extra,
  type LectureBody,
  type LectureLength,
  type LessonSection,
  type PracticeProblem,
  type Teacher,
} from './types.ts'

/** What one study tool needs from the chapter it lives in. */
export interface ToolCtx {
  extras: Extra[]
  /** text still streaming for a tool, by key */
  live: (kind: string, key: string) => string
  busy: (kind: string, key: string) => boolean
  error: (kind: string, key: string) => string
  /** keys of one tool currently being generated */
  pending: (kind: string) => string[]
  run: (kind: 'deeper' | 'answer' | 'practice' | 'factcheck' | 'visual', key: string, req: { focus?: string[]; question?: string }) => void
  /** delete one saved extra (a chart) */
  remove: (x: Extra) => void
  /** record a lecture covering these sections (none = whole chapter) */
  lecture: (sections: string[], length: LectureLength) => void
  /** lectures recording right now for this chapter */
  jobs: { id: string; label: string; status: string }[]
  teacher: Teacher
}

const MAX_DEPTH = 3

export function DeeperChip({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button className={`deeper-chip ${open ? 'open' : ''}`} onClick={onClick} aria-expanded={open}>
      {open ? 'Hide ▾' : 'Go deeper ›'}
    </button>
  )
}

/** A sub-lesson under one section; its own sections can go deeper again. */
export function DeeperPanel({
  ctx,
  focus,
  studyTools,
  onClose,
}: {
  ctx: ToolCtx
  focus: string[]
  studyTools: boolean
  onClose: () => void
}) {
  const key = focus.join(' > ')
  const row = latest(ctx.extras, 'deeper', key)
  const saved = row?.body as { sections: LessonSection[] } | undefined
  const busy = ctx.busy('deeper', key)
  const sections = saved?.sections ?? (busy ? parseSections(ctx.live('deeper', key)) : [])
  const err = ctx.error('deeper', key)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (h: string) =>
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(h)) n.delete(h)
      else n.add(h)
      return n
    })

  return (
    <div className="deeper" style={{ ['--depth' as string]: focus.length }}>
      <div className="deeper-head">
        <span className="deeper-kicker">Deeper · {focus[focus.length - 1]}</span>
        {studyTools && row && !busy && (
          <button
            className="deeper-del"
            onClick={() => {
              if (!confirm('Delete this deeper dive (and any deeper dives inside it)?')) return
              for (const x of ctx.extras) if (x.kind === 'deeper' && (x.key === key || x.key.startsWith(`${key} > `))) ctx.remove(x)
              onClose()
            }}
          >
            Delete
          </button>
        )}
      </div>
      {sections.map((s) => (
        <section key={s.heading}>
          <h4>
            {s.heading}
            {studyTools && focus.length < MAX_DEPTH && !busy && (
              <DeeperChip open={open.has(s.heading)} onClick={() => toggle(s.heading)} />
            )}
          </h4>
          {paras(s.body).map((t) => (
            <p key={t}>
              <Marked text={t} />
            </p>
          ))}
          {open.has(s.heading) && (
            <Opener ctx={ctx} focus={[...focus, s.heading]} studyTools={studyTools} onClose={() => toggle(s.heading)} />
          )}
        </section>
      ))}
      {busy && <Writing label="Going deeper…" />}
      {err && <Retry msg={err} onRetry={() => ctx.run('deeper', key, { focus })} />}
    </div>
  )
}

/** Opens a deeper panel, generating it the first time. */
export function Opener({
  ctx,
  focus,
  studyTools,
  onClose,
}: {
  ctx: ToolCtx
  focus: string[]
  studyTools: boolean
  onClose: () => void
}) {
  const key = focus.join(' > ')
  const need = !latest(ctx.extras, 'deeper', key) && !ctx.busy('deeper', key) && !ctx.error('deeper', key)
  const { run } = ctx
  useEffect(() => {
    if (need) run('deeper', key, { focus })
    // run once per opened key; `focus` is derived from it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return <DeeperPanel ctx={ctx} focus={focus} studyTools={studyTools} onClose={onClose} />
}

export function AskBox({ ctx }: { ctx: ToolCtx }) {
  const [q, setQ] = useState('')
  const answers = ctx.extras.filter((x) => x.kind === 'answer')
  const pending = ctx.pending('answer')
  return (
    <section className="tool">
      <h3>Ask a question</h3>
      {answers.map((a) => {
        const body = a.body as { question: string; text: string }
        return (
          <div key={a.id} className="qa">
            <div className="qa-q">{body.question}</div>
            {paras(body.text).map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        )
      })}
      {pending.map((k) => (
        <div key={k} className="qa">
          <div className="qa-q">{k}</div>
          {paras(ctx.live('answer', k)).map((t) => (
            <p key={t}>{t}</p>
          ))}
          <Writing label="Answering…" />
        </div>
      ))}
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          const question = q.trim().slice(0, 1000)
          if (!question) return
          ctx.run('answer', question, { question })
          setQ('')
        }}
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Anything unclear? Ask about this chapter…"
          rows={2}
          enterKeyHint="send"
        />
        <button className="btn-neon" disabled={!q.trim()}>
          Ask
        </button>
      </form>
    </section>
  )
}

export function Practice({ ctx }: { ctx: ToolCtx }) {
  const sets = ctx.extras.filter((x) => x.kind === 'practice')
  const key = `set-${sets.length + 1}`
  const busy = ctx.busy('practice', key)
  const problems: PracticeProblem[] = [
    ...sets.flatMap((s) => (s.body as { problems: PracticeProblem[] }).problems),
    ...(busy ? parsePractice(ctx.live('practice', key)) : []),
  ]
  const err = ctx.error('practice', key)
  return (
    <section className="tool">
      <h3>Practice problems</h3>
      {problems.map((p, i) => (
        <Problem key={i} n={i + 1} p={p} />
      ))}
      {busy && <Writing label="Writing problems…" />}
      {err && <Retry msg={err} onRetry={() => ctx.run('practice', key, {})} />}
      {!busy && (
        <button className="btn-ghost" onClick={() => ctx.run('practice', key, {})}>
          {sets.length ? '+ More problems' : 'Give me practice problems'}
        </button>
      )}
    </section>
  )
}

function Problem({ n, p }: { n: number; p: PracticeProblem }) {
  const [show, setShow] = useState(false)
  return (
    <div className="problem">
      <div className="problem-n">Problem {n}</div>
      {paras(p.problem).map((t) => (
        <p key={t}>{t}</p>
      ))}
      {p.solution && (
        <button className="reveal" onClick={() => setShow((s) => !s)} aria-expanded={show}>
          {show ? 'Hide solution' : 'Show solution'}
        </button>
      )}
      {show && (
        <div className="solution">
          {paras(p.solution).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Fact-check, in two parts: the button (lives in the sticky toolbar) and the result panel
 * (stays in the page). Fixing asks for confirmation first.
 */
export function FactCheck({
  ctx,
  fixing,
  fixError,
  onFix,
  part,
  open,
  setOpen,
}: {
  ctx: ToolCtx
  fixing: boolean
  fixError: string
  onFix: (check: CheckResult) => void
  part: 'button' | 'panel'
  open: boolean
  setOpen: (fn: (o: boolean) => boolean) => void
}) {
  const saved = latest(ctx.extras, 'check')?.body as CheckResult | undefined
  const busy = ctx.busy('factcheck', '')
  const err = ctx.error('factcheck', '')
  const check = busy ? undefined : saved

  const n = check?.issues.length ?? 0
  const [label, cls] = busy
    ? ['Checking sources…', '']
    : fixing
      ? ['Fixing…', '']
      : check?.verdict === 'ok'
        ? ['✓ Verified', 'ok']
        : check?.verdict === 'fixed'
          ? ['✓ Corrected', 'ok']
          : check?.verdict === 'issues'
            ? [`⚠ ${n} issue${n === 1 ? '' : 's'}`, 'warn']
            : ['Fact-check', '']

  if (part === 'button')
    return (
      <button
        className={`check-btn ${cls}`}
        disabled={busy || fixing}
        onClick={() => (check ? setOpen((o) => !o) : ctx.run('factcheck', '', {}))}
        aria-expanded={check ? open : undefined}
      >
        {(busy || fixing) && <span className="pulse" />}
        {label}
      </button>
    )

  return (
    <>
      {err && <Retry msg={err} onRetry={() => ctx.run('factcheck', '', {})} />}
      {fixError && <div className="error">{fixError}</div>}
      {busy && ctx.live('factcheck', '') && (
        <div className="check-panel">
          <p className="muted">{parseCheck(ctx.live('factcheck', '')).issues.length} possible issues so far…</p>
        </div>
      )}
      {check && open && (
        <div className={`check-panel ${cls}`}>
          <p className="muted">
            {check.verdict === 'ok' && 'No errors found against web sources.'}
            {check.verdict === 'fixed' && 'Flagged errors were corrected in the text.'}
            {check.verdict === 'issues' && 'Checked against web sources. These look wrong:'} · {new Date(check.checkedAt).toLocaleDateString()}
          </p>
          {check.issues.map((i, n) => (
            <div key={n} className="issue">
              <div className="issue-claim">“{i.claim}”</div>
              {i.problem && <div className="issue-problem">{i.problem}</div>}
              {i.correction && <div className="issue-fix">→ {i.correction}</div>}
            </div>
          ))}
          {!!check.sources.length && (
            <div className="sources">
              Sources:
              {check.sources.slice(0, 8).map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  {host(u)}
                </a>
              ))}
            </div>
          )}
          <div className="check-actions">
            {check.verdict === 'issues' && (
              <button
                className="btn-neon"
                disabled={fixing}
                onClick={() => {
                  if (confirm(`Rewrite the ${check.issues.length} flagged part(s) of this chapter with the corrections?`)) onFix(check)
                }}
              >
                Fix these
              </button>
            )}
            <button className="btn-ghost" onClick={() => ctx.run('factcheck', '', {})}>
              Check again
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

export function Writing({ label }: { label: string }) {
  return (
    <div className="writing">
      <span className="pulse" /> {label}
    </div>
  )
}

function Retry({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="error">
      <p>{msg}</p>
      <button className="btn-ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

/** Shows how many lectures already cover a section; tap to open the lecture sheet there. */
export function LectureBadge({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button className={`lecture-chip ${count ? 'has' : ''}`} onClick={onClick} aria-label={`Lectures (${count})`}>
      🎧{count ? ` ${count}` : ''}
    </button>
  )
}

/**
 * Everything lectures for one chapter: pick sections (or the whole chapter) and a length,
 * record in the background, and manage every version made so far.
 */
export function LectureSheet({
  ctx,
  headings,
  chapterTitle,
  preselect,
  onClose,
}: {
  ctx: ToolCtx
  headings: string[]
  chapterTitle: string
  preselect: string[]
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect))
  const [whole, setWhole] = useState(preselect.length === 0)
  const [length, setLength] = useState<LectureLength>('medium')
  const [started, setStarted] = useState(false)
  const counts = lectureCounts(ctx.extras)
  const mine = ctx.extras.filter((x) => x.kind === 'lecture').reverse()
  const voice = voiceLabel(ctx.teacher.voice)
  const canRecord = whole || picked.size > 0

  const toggle = (h: string) => {
    setWhole(false)
    setPicked((o) => {
      const n = new Set(o)
      if (n.has(h)) n.delete(h)
      else n.add(h)
      return n
    })
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet lecture-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Lectures">
        <div className="sheet-top">
          <h2>🎧 Lectures</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <h3 className="sheet-sub">New lecture</h3>
        <div className="pick-list">
          <label className={`pick ${whole ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={whole}
              onChange={() => {
                setWhole((w) => !w)
                setPicked(new Set())
              }}
            />
            <span>Whole chapter</span>
            {!!counts.get('') && <span className="pick-count">🎧 {counts.get('')}</span>}
          </label>
          {headings.map((h) => (
            <label key={h} className={`pick ${picked.has(h) ? 'on' : ''}`}>
              <input type="checkbox" checked={picked.has(h)} onChange={() => toggle(h)} />
              <span>{h}</span>
              {!!counts.get(h) && <span className="pick-count">🎧 {counts.get(h)}</span>}
            </label>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Length">
          {(Object.keys(LECTURE_LENGTHS) as LectureLength[]).map((k) => (
            <button key={k} role="radio" aria-checked={length === k} className={length === k ? 'on' : ''} onClick={() => setLength(k)}>
              {LECTURE_LENGTHS[k].label}
              <small>~{LECTURE_LENGTHS[k].minutes} min</small>
            </button>
          ))}
        </div>
        <button
          className="btn-neon record-btn"
          disabled={!canRecord}
          onClick={() => {
            ctx.lecture(whole ? [] : headings.filter((h) => picked.has(h)), length)
            setStarted(true)
            setPicked(new Set())
            setWhole(false)
          }}
        >
          Record lecture <span className="voice-tag">{voice}</span>
        </button>
        {started && <p className="sheet-note">Recording in the background — close this and keep reading. A pill in the corner shows progress.</p>}

        {!!ctx.jobs.length && (
          <>
            <h3 className="sheet-sub">Recording now</h3>
            {ctx.jobs.map((j) => (
              <div key={j.id} className="lect-item">
                <div className="lect-title">{j.label}</div>
                <Writing label={j.status.startsWith('failed') ? j.status : j.status} />
              </div>
            ))}
          </>
        )}

        <h3 className="sheet-sub">Your lectures ({mine.length})</h3>
        {!mine.length && <p className="sheet-note">None yet for this chapter.</p>}
        {mine.map((x) => (
          <LectureItem
            key={x.id}
            x={x}
            subtitle={chapterTitle}
            onDelete={() => confirm('Delete this lecture and its audio?') && ctx.remove(x)}
          />
        ))}
      </div>
    </div>
  )
}

function LectureItem({ x, subtitle, onDelete }: { x: Extra; subtitle: string; onDelete: () => void }) {
  const b = x.body as LectureBody
  const [script, setScript] = useState(false)
  return (
    <div className="lect-item">
      <div className="lect-title">{lectureTitle(b)}</div>
      <div className="lect-meta">
        {b.length ? `${LECTURE_LENGTHS[b.length].label} · ` : ''}
        {voiceLabel(b.voice)} · {new Date(x.created_at).toLocaleDateString()}
      </div>
      <LectureControl id={x.id} url={b.audioUrl} title={lectureTitle(b)} subtitle={subtitle} fileName={b.fileName} />
      <div className="lecture-row">
        <button className="reveal" onClick={() => setScript((v) => !v)} aria-expanded={script}>
          {script ? 'Hide transcript' : 'Transcript'}
        </button>
        <button className="reveal danger-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
      {script && (
        <div className="transcript">
          {paras(b.script).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      )}
    </div>
  )
}


/**
 * Play / resume control for one lecture. Audio runs in the app-wide player, so it keeps
 * going after this is closed; shows listened / resume state (synced).
 */
export function LectureControl({ id, url, title, subtitle, fileName }: Track) {
  const audio = useAudio()
  const p = audio.progress(id)
  const isCurrent = audio.current?.id === id
  const pos = isCurrent ? audio.position : (p?.pos ?? 0)
  const dur = isCurrent ? audio.duration : (p?.dur ?? 0)
  const pct = p?.done && !isCurrent ? 100 : dur ? Math.min(100, (pos / dur) * 100) : 0
  const download = url.startsWith('blob:') ? url : `${url}?download=${encodeURIComponent(fileName)}`
  const label = isCurrent && audio.playing ? '❚❚ Pause' : pos > 5 && !p?.done ? `▶ Resume ${clock(pos)}` : p?.done ? '▶ Play again' : '▶ Play'
  return (
    <div className="lect-control">
      <div className="lect-row">
        <button
          className={`lect-play ${isCurrent && audio.playing ? 'on' : ''}`}
          onClick={() => (isCurrent ? audio.toggle() : audio.play({ id, url, title, subtitle, fileName }))}
        >
          {label}
        </button>
        <span className={`lect-status ${p?.done ? 'done' : ''}`}>
          {p?.done ? '✓ Listened' : dur ? `${clock(pos)} / ${clock(dur)}` : 'New'}
        </span>
        <a className="download" href={download} download={fileName}>
          ⬇
        </a>
      </div>
      <div className="lect-bar" aria-hidden="true">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function VisualChip({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button className={`lecture-chip ${open ? 'open' : ''}`} onClick={onClick} aria-expanded={open} aria-label="Add a chart">
      📊{open ? ' ▾' : ''}
    </button>
  )
}

/** Charts saved in a section: part of the chapter from now on, shown whether tools are on or not. */
export function SectionVisuals({ ctx, section, editable }: { ctx: ToolCtx; section: string; editable: boolean }) {
  const list = ctx.extras.filter((x) => x.kind === 'visual' && x.key === section)
  return (
    <>
      {list.map((x) => (
        <div key={x.id} className="visual">
          <Chart spec={x.body as ChartSpec} />
          {editable && (
            <button className="visual-x" onClick={() => confirm('Remove this chart from the chapter?') && ctx.remove(x)} aria-label="Remove chart">
              ×
            </button>
          )}
        </div>
      ))}
    </>
  )
}

/** Ask for a chart: let the AI pick, or describe one. Explicit "Draw" tap. */
export function VisualPanel({ ctx, section }: { ctx: ToolCtx; section: string }) {
  const [ask, setAsk] = useState('')
  const busy = ctx.busy('visual', section)
  const err = ctx.error('visual', section)
  const draw = () => ctx.run('visual', section, { focus: [section], question: ask.trim().slice(0, 300) || undefined })
  return (
    <div className="lecture visual-panel">
      <div className="lecture-kicker">📊 Add a chart · {section}</div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) draw()
        }}
      >
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Optional: describe it (e.g. demand curve with a price ceiling)" />
        <button className="btn-neon" disabled={busy}>
          {busy ? 'Drawing…' : ask.trim() ? 'Draw it' : 'Suggest one'}
        </button>
      </form>
      {err && !busy && <div className="error">{err}</div>}
    </div>
  )
}
