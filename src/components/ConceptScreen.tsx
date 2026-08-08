import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { BlueprintNode, NodeStatus } from '../data/types'
import { cleanLabel, generateStudy, studyFor, StudyUnavailableError } from '../data/study'
import { drillStartPayload } from '../data/drills'
import { missingItems } from '../data/retrieval'
import { conceptRetention } from '../data/rank'

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
  const { state, activeDomain, dispatch } = useApp()
  const abortRef = useRef<AbortController | null>(null)

  const node: BlueprintNode | null =
    activeDomain?.blueprint.nodes.find((n) => n.id === state.openConceptId) ?? null

  // Opening a concept is what gives it retrieval items: they are derived from
  // whatever study content exists, so the Feed has something to schedule.
  useEffect(() => {
    if (!activeDomain || !node) return
    const seeds = missingItems(activeDomain, node)
    if (seeds.length > 0) dispatch({ type: 'addItems', seeds })
  }, [activeDomain, node, dispatch])

  // Cancel an in-flight generation if we leave the page
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [state.openConceptId])

  if (!activeDomain || !node) {
    return (
      <main className="content-pane">
        <p className="page-lead">That concept is no longer on this path.</p>
        <button
          type="button"
          className="pill"
          onClick={() => dispatch({ type: 'setView', view: 'paths' })}
        >
          ← Back to paths
        </button>
      </main>
    )
  }

  const domain = activeDomain
  const label = cleanLabel(node.label)
  const study = studyFor(domain, node)
  const isGenerated = node.study?.source === 'generated'
  const retention = conceptRetention(domain, node.id)
  // Paging follows the layer the concept sits in, not the whole domain — the
  // point of layers is that you never wander into depth you have not opened.
  const layer = domain.paths
    .find((p) => p.id === node.pathId)
    ?.layers.find((l) => l.conceptIds.includes(node.id))
  const siblings = (layer?.conceptIds ?? domain.blueprint.nodes.map((n) => n.id))
    .map((id) => domain.blueprint.nodes.find((n) => n.id === id))
    .filter((n): n is BlueprintNode => n !== undefined)
  const index = siblings.findIndex((n) => n.id === node.id)
  const prev = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  const task = node.taskId ? domain.tasks.find((t) => t.id === node.taskId) : undefined
  const synth = domain.synthPrompts.find((p) => p.conceptId === node.id)
  const drill = domain.drills.find((d) => d.conceptId === node.id)
  const items = domain.items.filter((i) => i.conceptId === node.id)

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    dispatch({ type: 'studyLoading' })
    try {
      const generated = await generateStudy({
        domain,
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
      <button type="button" className="back-link" onClick={() => dispatch({ type: 'setView', view: 'paths' })}>
        ← {layer?.title ?? 'Paths'} · {domain.title}
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
            <span className="tag">{retention}% recall</span>
          </div>
          <h1 className="concept-title">{label}</h1>
          <p className="concept-tagline">{study.tagline}</p>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: `${retention}%` }} />
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
                dispatch({ type: 'setView', view: 'retrieval' })
              }}
            >
              Teach it back
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              className="pill"
              onClick={() =>
                dispatch({
                  type: 'startRetrieval',
                  cardId: `concept-${node.id}`,
                  itemIds: items.slice(0, 5).map((i) => i.id),
                  conceptId: node.id,
                })
              }
            >
              Retrieve now
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
          {!task && !synth && !drill && items.length === 0 && (
            <p className="card-sub">
              No practice wired to this concept yet — generate the deep-dive above and retrieval
              items are derived from it.
            </p>
          )}
        </div>
        {items.length > 0 && (
          <p className="card-hint">
            {items.length} retrieval item{items.length === 1 ? '' : 's'} on this concept feeding your
            schedule.
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
