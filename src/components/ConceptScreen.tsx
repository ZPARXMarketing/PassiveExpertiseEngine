import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { BlueprintNode, NodeStatus } from '../data/types'
import { cleanLabel, generateStudy, studyFor, StudyUnavailableError } from '../data/study'
import { drillStartPayload } from '../data/drills'

const statusLabel = (status: NodeStatus): string => {
  switch (status) {
    case 'mastered':
      return 'mastered'
    case 'learning':
      return 'in progress'
    case 'available':
      return 'ready'
    case 'locked':
      return 'locked'
  }
}

const initials = (label: string): string =>
  cleanLabel(label)
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

function CheckItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="check-item">
      <button type="button" className="check-q" onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        <span className="check-toggle">{open ? 'hide' : 'show'}</span>
      </button>
      {open && <p className="check-a">{a}</p>}
    </li>
  )
}

export function ConceptScreen() {
  const { state, activeSubject, dispatch } = useApp()
  const abortRef = useRef<AbortController | null>(null)

  const node: BlueprintNode | null =
    activeSubject?.blueprint.nodes.find((n) => n.id === state.openConceptId) ?? null

  // Cancel an in-flight generation if we leave the page
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [state.openConceptId])

  if (!activeSubject || !node) {
    return (
      <main className="content-pane">
        <p className="page-lead">That concept is no longer on this path.</p>
        <button
          type="button"
          className="pill"
          onClick={() => dispatch({ type: 'setView', view: 'blueprint' })}
        >
          ← Back to blueprint
        </button>
      </main>
    )
  }

  const subject = activeSubject
  const label = cleanLabel(node.label)
  const study = studyFor(subject, node)
  const isGenerated = node.study?.source === 'generated'
  const nodes = subject.blueprint.nodes
  const index = nodes.findIndex((n) => n.id === node.id)
  const prev = index > 0 ? nodes[index - 1] : null
  const next = index >= 0 && index < nodes.length - 1 ? nodes[index + 1] : null

  const task = node.taskId ? subject.tasks.find((t) => t.id === node.taskId) : undefined
  const synth = subject.synthPrompts.find((p) => p.conceptId === node.id)
  const drill = subject.drills.find((d) => d.conceptId === node.id)
  const cards = subject.srs.filter((c) => c.conceptId === node.id)

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    dispatch({ type: 'studyLoading' })
    try {
      const generated = await generateStudy({
        subject,
        node,
        settings: state.settings,
        signal: controller.signal,
      })
      dispatch({ type: 'setStudy', conceptId: node.id, study: generated })
    } catch (err) {
      if (controller.signal.aborted) return
      dispatch({
        type: 'studyFailed',
        message:
          err instanceof StudyUnavailableError
            ? err.message
            : 'Study generation failed. Try again in a moment.',
      })
    }
  }

  const openTask = () => {
    if (!node.taskId) return
    if (node.status === 'locked') {
      dispatch({ type: 'showToast', message: `${label} is locked — finish prerequisites first` })
      return
    }
    dispatch({ type: 'openTask', taskId: node.taskId })
  }

  return (
    <main className="content-pane concept-page">
      <button type="button" className="back-link" onClick={() => dispatch({ type: 'closeConcept' })}>
        ← Blueprint · {subject.title}
      </button>

      <header className="concept-hero">
        <div className={`concept-hero-orb concept-orb--${node.status}${node.is8020 ? ' core' : ''}`}>
          <span className="orb-glyph">
            {node.status === 'locked' ? '🔒' : (node.icon ?? initials(node.label))}
          </span>
        </div>
        <div className="concept-hero-body">
          <div className="concept-hero-tags">
            <span className="tag neon">{node.is8020 ? '80/20 core' : 'concept'}</span>
            <span className={`path-step-status path-step-status--${node.status}`}>
              {statusLabel(node.status)}
            </span>
            <span className="tag">{Math.round(node.retention)}% retention</span>
          </div>
          <h1 className="concept-title">{label}</h1>
          <p className="concept-tagline">{study.tagline}</p>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: `${node.retention}%` }} />
          </div>
        </div>
      </header>

      <section className="card study-why">
        <div className="feed-kicker">why it matters</div>
        <p className="path-overview-body">{study.whyItMatters}</p>
      </section>

      <div className="study-toolbar">
        <span className="study-source">
          {isGenerated
            ? `generated${node.study?.model ? ` · ${node.study.model}` : ''}`
            : 'curriculum notes'}
        </span>
        <button
          type="button"
          className={`pill${isGenerated ? '' : ' primary'}`}
          onClick={generate}
          disabled={state.studyLoading}
        >
          {state.studyLoading
            ? 'Writing study page…'
            : isGenerated
              ? 'Regenerate'
              : 'Generate deep-dive'}
        </button>
      </div>

      {state.studyError && (
        <p className="explain fail study-error">
          {state.studyError}{' '}
          <button
            type="button"
            className="text-btn"
            onClick={() => dispatch({ type: 'setView', view: 'settings' })}
          >
            Open Settings
          </button>
        </p>
      )}

      {state.studyLoading && (
        <div className="card study-skeleton" aria-hidden>
          <span className="skeleton-line w-40" />
          <span className="skeleton-line" />
          <span className="skeleton-line" />
          <span className="skeleton-line w-70" />
        </div>
      )}

      <article className="study-body">
        {study.sections.map((s) => (
          <section key={s.heading} className="card study-section">
            <h2 className="card-title">{s.heading}</h2>
            <p className="path-overview-body">{s.body}</p>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="path-goals">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {study.formulas && study.formulas.length > 0 && (
          <section className="card study-section">
            <h2 className="card-title">Formulas worth memorising</h2>
            <div className="formula-list">
              {study.formulas.map((f) => (
                <div key={f.name} className="formula">
                  <div className="formula-name">{f.name}</div>
                  <code className="formula-expr">{f.expression}</code>
                  {f.note && <div className="card-hint">{f.note}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {study.keyTerms && study.keyTerms.length > 0 && (
          <section className="card study-section">
            <h2 className="card-title">Key terms</h2>
            <dl className="term-list">
              {study.keyTerms.map((t) => (
                <div key={t.term} className="term">
                  <dt>{t.term}</dt>
                  <dd>{t.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {study.mistakes && study.mistakes.length > 0 && (
          <section className="card study-section">
            <h2 className="card-title">Where people get this wrong</h2>
            <ul className="mistake-list">
              {study.mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {study.checkYourself && study.checkYourself.length > 0 && (
          <section className="card study-section">
            <h2 className="card-title">Check yourself</h2>
            <p className="card-hint">Answer out loud before revealing — that is the retrieval.</p>
            <ul className="check-list">
              {study.checkYourself.map((c) => (
                <CheckItem key={c.q} q={c.q} a={c.a} />
              ))}
            </ul>
          </section>
        )}
      </article>

      <section className="card study-actions">
        <div className="feed-kicker">put it to work</div>
        <div className="study-action-row">
          {task && (
            <button
              type="button"
              className={`pill primary${node.status === 'locked' ? ' dim' : ''}`}
              onClick={openTask}
            >
              Practice: {task.title}
            </button>
          )}
          {synth && (
            <button
              type="button"
              className="pill"
              onClick={() => {
                dispatch({ type: 'setActiveSynth', id: synth.id })
                dispatch({ type: 'setView', view: 'synthesis' })
              }}
            >
              Explain it back
            </button>
          )}
          {drill && (
            <button
              type="button"
              className="pill"
              onClick={() => dispatch({ type: 'startDrill', ...drillStartPayload(drill) })}
            >
              Drill: {drill.title}
            </button>
          )}
          {!task && !synth && !drill && (
            <p className="card-sub">
              No practice wired to this concept yet — study it, then drill a neighbouring node on
              Dashboard.
            </p>
          )}
        </div>
        {cards.length > 0 && (
          <p className="card-hint">
            {cards.length} review card{cards.length === 1 ? '' : 's'} in your queue for this concept.
          </p>
        )}
      </section>

      <nav className="concept-pager">
        {prev ? (
          <button
            type="button"
            className="pill"
            onClick={() => dispatch({ type: 'openConcept', conceptId: prev.id })}
          >
            ← {cleanLabel(prev.label)}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            type="button"
            className="pill"
            onClick={() => dispatch({ type: 'openConcept', conceptId: next.id })}
          >
            {cleanLabel(next.label)} →
          </button>
        ) : (
          <span />
        )}
      </nav>
    </main>
  )
}
