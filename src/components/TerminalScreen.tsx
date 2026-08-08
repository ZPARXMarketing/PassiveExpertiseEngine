import { useApp } from '../state/AppContext'
import { computePnl, evaluatePnlTask } from '../data/pnl'
import type { PnlTag } from '../data/types'
import { formatDuration } from '../data/domains'

const TAGS: { id: PnlTag; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'cogs', label: 'COGS' },
  { id: 'opex', label: 'OpEx' },
]

export function TerminalScreen() {
  const { state, activeDomain, dispatch } = useApp()

  if (!activeDomain) {
    return (
      <main className="content-pane">
        <p className="page-lead">Select a domain first.</p>
      </main>
    )
  }

  const task =
    activeDomain.tasks.find((t) => t.id === state.openTaskId) ??
    activeDomain.tasks.find((t) => !activeDomain.metrics.tasksCompleted.includes(t.id)) ??
    activeDomain.tasks[0]

  if (!task) {
    return (
      <main className="content-pane">
        <header className="page-header">
          <div className="feed-kicker">direct practice · execution terminal</div>
          <h1 className="feed-title">Terminal</h1>
          <p className="page-lead">No practice blocks on this domain yet.</p>
        </header>
      </main>
    )
  }

  const open = () => {
    if (state.openTaskId !== task.id) dispatch({ type: 'openTask', taskId: task.id })
    else dispatch({ type: 'startSession' })
  }

  const submitText = () => {
    const ok = state.taskDraft.trim().length >= 100
    dispatch({
      type: 'submitTask',
      pass: ok,
      message: ok
        ? `Session logged · ${formatDuration(state.sessionActiveSec)} active. ${task.evalNote.split('.')[0]}.`
        : 'Write at least ~100 characters — treat it like a real work block.',
    })
  }

  const submitPnl = () => {
    const result = evaluatePnlTask(task, state.pnlTags)
    dispatch({ type: 'submitTask', pass: result.pass, message: result.message })
  }

  const totals = task.dataset ? computePnl(task.dataset, state.pnlTags) : null
  const done = activeDomain.metrics.tasksCompleted.includes(task.id)

  return (
    <main className="content-pane">
      <header className="page-header terminal-header">
        <div>
          <button type="button" className="back-link" onClick={() => dispatch({ type: 'closeTask' })}>
            ← Feed
          </button>
          <div className="feed-kicker">deep work · execution terminal</div>
          <h1 className="feed-title">Terminal</h1>
        </div>
        <div className={`session-timer${state.sessionIdle ? ' idle' : ''}${state.sessionRunning ? ' live' : ''}`}>
          <div className="timer-label">{state.sessionIdle ? 'idle' : state.sessionRunning ? 'active' : 'ready'}</div>
          <div className="timer-value">{formatDuration(state.sessionActiveSec)}</div>
          <div className="timer-sub">idle {formatDuration(state.sessionIdleSec)}</div>
        </div>
      </header>

      <div className="task-switcher">
        {activeDomain.tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pill${state.openTaskId === t.id || (!state.openTaskId && t.id === task.id) ? ' primary' : ''}`}
            onClick={() => dispatch({ type: 'openTask', taskId: t.id })}
          >
            {activeDomain.metrics.tasksCompleted.includes(t.id) ? '✓ ' : ''}
            {t.title}
          </button>
        ))}
      </div>

      <div className="terminal-layout">
        <section className="card terminal-prompt">
          <span className="tag neon">{task.kind}</span>
          <h2 className="card-title">{task.title}</h2>
          <p className="beat-body" style={{ textAlign: 'left', maxWidth: 'none' }}>
            {task.prompt}
          </p>
          {done && <div className="lesson-done-check">✓ completed this session path</div>}
          {!state.sessionRunning && (
            <button type="button" className="pill primary" onClick={open}>
              Start timed session
            </button>
          )}
        </section>

        <section className="card terminal-workspace">
          <div className="workspace-kicker">workspace · distraction-free</div>

          {task.kind === 'csv-pnl' && task.dataset && (
            <>
              <div className="pnl-table">
                {task.dataset.map((row) => (
                  <div key={row.id} className="pnl-row">
                    <div className="pnl-desc">
                      <div>{row.description}</div>
                      <div className="pnl-amt">${row.amount.toLocaleString()}</div>
                    </div>
                    <div className="pnl-tags">
                      {TAGS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`pill mini${state.pnlTags[row.id] === t.id ? ' primary' : ''}`}
                          onClick={() => dispatch({ type: 'setPnlTag', rowId: row.id, tag: t.id })}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {totals && (
                <div className="pnl-totals">
                  <div>
                    <span className="stat-label">Gross margin</span>
                    <div className="stat-num" style={{ fontSize: 22 }}>
                      {totals.grossMarginPct ?? '—'}%
                    </div>
                  </div>
                  <div>
                    <span className="stat-label">Net margin</span>
                    <div className="stat-num" style={{ fontSize: 22 }}>
                      {totals.netMarginPct ?? '—'}%
                    </div>
                  </div>
                  <div>
                    <span className="stat-label">Revenue / COGS / OpEx</span>
                    <div className="card-sub">
                      ${totals.revenue.toLocaleString()} · ${totals.cogs.toLocaleString()} · $
                      {totals.opex.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              <button type="button" className="pill primary" style={{ width: '100%' }} onClick={submitPnl}>
                Evaluate P&L
              </button>
            </>
          )}

          {(task.kind === 'text' || task.kind === 'editor') && (
            <>
              <textarea
                className="workspace-textarea"
                value={state.taskDraft}
                onChange={(e) => dispatch({ type: 'setTaskDraft', text: e.target.value })}
                placeholder="Write here…"
                rows={14}
              />
              <button type="button" className="pill primary" style={{ width: '100%' }} onClick={submitText}>
                Submit practice block
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
