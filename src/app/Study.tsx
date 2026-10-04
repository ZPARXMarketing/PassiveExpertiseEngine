import { useEffect, useState } from 'react'
import { latest, paras, parseCheck, parsePractice, parseSections } from './parse.ts'
import type { CheckResult, Extra, LessonSection, PracticeProblem } from './types.ts'

/** What one study tool needs from the chapter it lives in. */
export interface ToolCtx {
  extras: Extra[]
  /** text still streaming for a tool, by key */
  live: (kind: string, key: string) => string
  busy: (kind: string, key: string) => boolean
  error: (kind: string, key: string) => string
  /** keys of one tool currently being generated */
  pending: (kind: string) => string[]
  run: (kind: 'deeper' | 'answer' | 'practice' | 'factcheck', key: string, req: { focus?: string[]; question?: string }) => void
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
