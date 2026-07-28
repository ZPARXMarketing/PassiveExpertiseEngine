import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { formatDuration, sampleSubjectForGoal } from '../data/subjects'
import { createStubSubject } from '../data/samples/stub'
import { generatePath, PathUnavailableError } from '../data/path'

export function SubjectsHome() {
  const { state, dispatch } = useApp()
  const [goal, setGoal] = useState('')
  const [designing, setDesigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abandon an in-flight design if the user navigates away
  useEffect(() => () => abortRef.current?.abort(), [])

  const create = async () => {
    const g = goal.trim()
    if (!g) {
      dispatch({ type: 'showToast', message: 'Type a goal first — e.g. “Finance for small businesses”' })
      return
    }
    if (designing) return
    setError(null)

    // Authored samples are richer than anything generated — use them as-is.
    const sample = sampleSubjectForGoal(g)
    if (sample) {
      dispatch({ type: 'addSubject', subject: sample })
      setGoal('')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setDesigning(true)
    try {
      const subject = await generatePath({ goal: g, settings: state.settings, signal: controller.signal })
      dispatch({
        type: 'addSubject',
        subject,
        message: `Path designed: ${subject.title} — ${subject.blueprint.nodes.length} concepts`,
      })
      setGoal('')
    } catch (e) {
      if (controller.signal.aborted) return
      // Any goal still gets a project: fall back to the generic starter path and
      // say why the designed one is missing.
      setError(
        e instanceof PathUnavailableError ? e.message : 'Path generation failed unexpectedly.',
      )
      dispatch({
        type: 'addSubject',
        subject: { ...createStubSubject(g), source: 'stub' },
        message: 'Created with the starter path — AI design unavailable',
        navigate: false,
      })
      setGoal('')
    } finally {
      setDesigning(false)
    }
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">super-learning · projects</div>
        <h1 className="feed-title">What do you want to get good at?</h1>
        <p className="page-lead">
          Each project is its own save: blueprint → timed practice → Feynman synthesis → drills.
          Type any goal and the engine designs the path — the 80/20 concepts in dependency order,
          plus the first task, explain-back prompt and drill.
        </p>
      </header>

      <div className="card new-project">
        <label className="field-label" htmlFor="goal-input">
          New project goal
        </label>
        <div className="goal-row">
          <input
            id="goal-input"
            className="goal-input"
            placeholder="e.g. Negotiating commercial leases"
            value={goal}
            disabled={designing}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <button
            type="button"
            className="pill primary"
            onClick={() => void create()}
            disabled={designing}
          >
            {designing ? 'Designing…' : 'Create'}
          </button>
        </div>
        <div className="card-hint">
          “Finance for small businesses” and “B2B lead generation” open the worked samples;
          anything else is designed on the spot.
        </div>

        {designing && (
          <div className="path-designing">
            <div className="feed-kicker">designing the path for “{goal.trim()}”</div>
            <span className="skeleton-line w-40" />
            <span className="skeleton-line" />
            <span className="skeleton-line w-70" />
            <div className="card-hint">
              Picking the concepts that carry the result, ordering them by dependency, and writing
              your first practice block.
            </div>
          </div>
        )}

        {error && (
          <p className="explain fail study-error">
            {error}{' '}
            <button
              type="button"
              className="text-btn"
              onClick={() => dispatch({ type: 'setView', view: 'settings' })}
            >
              Open Settings
            </button>
          </p>
        )}
      </div>

      <div className="subject-grid">
        {state.subjects.map((s) => {
          const active = s.id === state.activeSubjectId
          const avgRet =
            s.blueprint.nodes.length === 0
              ? 0
              : Math.round(
                  s.blueprint.nodes.reduce((a, n) => a + n.retention, 0) / s.blueprint.nodes.length,
                )
          return (
            <article key={s.id} className={`card subject-card${active ? ' highlight' : ''}`}>
              <div className="subject-card-top">
                <span className="tag neon">{s.blueprint.nodes.filter((n) => n.is8020).length} core</span>
                {s.source === 'generated' && <span className="tag">ai path</span>}
                {active && <span className="tag">active</span>}
              </div>
              <h2 className="card-title">{s.title}</h2>
              <p className="card-sub">goal: {s.goal}</p>
              <div className="subject-stats">
                <span>{s.metrics.tasksCompleted.length} tasks</span>
                <span>{s.srs.length} cards</span>
                <span>~{avgRet}% retention</span>
                <span>{formatDuration(s.metrics.sessionSecondsActive)} deep work</span>
              </div>
              <div className="subject-actions">
                <button
                  type="button"
                  className="pill primary"
                  onClick={() => {
                    dispatch({ type: 'setActiveSubject', id: s.id })
                    dispatch({ type: 'setView', view: 'blueprint' })
                  }}
                >
                  Open blueprint
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => dispatch({ type: 'setActiveSubject', id: s.id })}
                >
                  Make active
                </button>
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={() => dispatch({ type: 'deleteSubject', id: s.id })}
                >
                  Remove
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
