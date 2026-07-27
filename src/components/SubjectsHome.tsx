import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { formatDuration } from '../data/subjects'

export function SubjectsHome() {
  const { state, dispatch } = useApp()
  const [goal, setGoal] = useState('')

  const create = () => {
    const g = goal.trim()
    if (!g) {
      dispatch({ type: 'showToast', message: 'Type a goal first — e.g. “Finance for small businesses”' })
      return
    }
    dispatch({ type: 'createSubject', goal: g })
    setGoal('')
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">super-learning · projects</div>
        <h1 className="feed-title">What do you want to get good at?</h1>
        <p className="page-lead">
          Each project is its own save: blueprint → timed practice → Feynman synthesis → drills.
          Type any goal; known domains get a full sample curriculum.
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
            placeholder="e.g. Finance for small businesses"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button type="button" className="pill primary" onClick={create}>
            Create
          </button>
        </div>
        <div className="card-hint">
          Try “Finance for small businesses” or “B2B lead generation” for the worked samples.
        </div>
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
