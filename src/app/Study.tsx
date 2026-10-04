import { useEffect, useRef, useState } from 'react'
import { latest, paras, parseCheck, parsePractice, parseSections } from './parse.ts'
import { Chart } from './Chart.tsx'
import { STYLES } from './prompts.ts'
import type { ChartSpec, CheckResult, Extra, LectureBody, LessonSection, PracticeProblem, Teacher } from './types.ts'

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
  /** record a lecture for a section ('' = whole chapter) */
  lecture: (section: string) => void
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
export function DeeperPanel({ ctx, focus, studyTools }: { ctx: ToolCtx; focus: string[]; studyTools: boolean }) {
  const key = focus.join(' > ')
  const saved = latest(ctx.extras, 'deeper', key)?.body as { sections: LessonSection[] } | undefined
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
      <div className="deeper-kicker">Deeper · {focus[focus.length - 1]}</div>
      {sections.map((s) => (
        <section key={s.heading}>
          <h4>
            {s.heading}
            {studyTools && focus.length < MAX_DEPTH && !busy && (
              <DeeperChip open={open.has(s.heading)} onClick={() => toggle(s.heading)} />
            )}
          </h4>
          {paras(s.body).map((t) => (
            <p key={t}>{t}</p>
          ))}
          {open.has(s.heading) && <Opener ctx={ctx} focus={[...focus, s.heading]} studyTools={studyTools} />}
        </section>
      ))}
      {busy && <Writing label="Going deeper…" />}
      {err && <Retry msg={err} onRetry={() => ctx.run('deeper', key, { focus })} />}
    </div>
  )
}

/** Opens a deeper panel, generating it the first time. */
export function Opener({ ctx, focus, studyTools }: { ctx: ToolCtx; focus: string[]; studyTools: boolean }) {
  const key = focus.join(' > ')
  const need = !latest(ctx.extras, 'deeper', key) && !ctx.busy('deeper', key) && !ctx.error('deeper', key)
  const { run } = ctx
  useEffect(() => {
    if (need) run('deeper', key, { focus })
    // run once per opened key; `focus` is derived from it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return <DeeperPanel ctx={ctx} focus={focus} studyTools={studyTools} />
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

/** Fact-check button + result. Fixing asks for confirmation first. */
export function FactCheck({
  ctx,
  fixing,
  fixError,
  onFix,
}: {
  ctx: ToolCtx
  fixing: boolean
  fixError: string
  onFix: (check: CheckResult) => void
}) {
  const saved = latest(ctx.extras, 'check')?.body as CheckResult | undefined
  const busy = ctx.busy('factcheck', '')
  const err = ctx.error('factcheck', '')
  const [open, setOpen] = useState(false)
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

  return (
    <>
      <button
        className={`check-btn ${cls}`}
        disabled={busy || fixing}
        onClick={() => (check ? setOpen((o) => !o) : ctx.run('factcheck', '', {}))}
        aria-expanded={check ? open : undefined}
      >
        {(busy || fixing) && <span className="pulse" />}
        {label}
      </button>
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

export function LectureChip({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button className={`lecture-chip ${open ? 'open' : ''}`} onClick={onClick} aria-expanded={open} aria-label="Lecture">
      🎧{open ? ' ▾' : ''}
    </button>
  )
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/**
 * A lecture for one section (or the whole chapter): record it once, then play,
 * change speed, download or read the transcript. Recording is an explicit second tap.
 */
export function LecturePanel({ ctx, section }: { ctx: ToolCtx; section: string }) {
  const lecture = latest(ctx.extras, 'lecture', section)?.body as LectureBody | undefined
  const busy = ctx.busy('lecture', section)
  const script = ctx.live('lecture', section)
  const progress = ctx.live('lecture-rec', section)
  const err = ctx.error('lecture', section)
  const [showScript, setShowScript] = useState(false)
  const voice = `${cap(ctx.teacher.voice)} · ${STYLES[ctx.teacher.style]?.label ?? ''}`

  return (
    <div className="lecture">
      <div className="lecture-kicker">🎧 Lecture · {section || 'Whole chapter'}</div>
      {lecture && !busy && (
        <>
          <Player url={lecture.audioUrl} fileName={lecture.fileName} speed={ctx.teacher.speed} />
          <div className="lecture-row">
            <button className="reveal" onClick={() => setShowScript((v) => !v)} aria-expanded={showScript}>
              {showScript ? 'Hide transcript' : 'Transcript'}
            </button>
            <button
              className="reveal muted-btn"
              onClick={() => confirm(`Record a new version in ${voice}?`) && ctx.lecture(section)}
            >
              Re-record
            </button>
          </div>
          {showScript && <div className="transcript">{paras(lecture.script).map((t) => <p key={t}>{t}</p>)}</div>}
        </>
      )}
      {busy && (
        <>
          <Writing label={progress ? `Recording ${progress}…` : 'Writing the lecture…'} />
          {script && !progress && <div className="transcript live">{paras(script).slice(-2).map((t) => <p key={t}>{t}</p>)}</div>}
        </>
      )}
      {!lecture && !busy && (
        <button className="btn-neon" onClick={() => ctx.lecture(section)}>
          Record lecture <span className="voice-tag">{voice}</span>
        </button>
      )}
      {err && !busy && <div className="error">{err}</div>}
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Player({ url, fileName, speed }: { url: string; fileName: string; speed: number }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [rate, setRate] = useState(speed)
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate
  }, [rate])
  const download = url.startsWith('blob:') ? url : `${url}?download=${encodeURIComponent(fileName)}`
  return (
    <div className="player">
      <audio ref={ref} src={url} controls preload="metadata" onLoadedMetadata={(e) => (e.currentTarget.playbackRate = rate)} />
      <div className="player-row">
        <div className="speeds" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} className={s === rate ? 'on' : ''} onClick={() => setRate(s)}>
              {s}×
            </button>
          ))}
        </div>
        <a className="download" href={download} download={fileName}>
          ⬇ Download
        </a>
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
