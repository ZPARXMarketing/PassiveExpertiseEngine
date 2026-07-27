import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'

function scoreFeynman(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length
  return text.trim().length >= 80 && hits >= Math.min(3, Math.ceil(keywords.length * 0.35))
}

export function SynthesisScreen() {
  const { state, activeSubject, dispatch } = useApp()
  const [mode, setMode] = useState<'feynman' | 'review'>('feynman')
  const [showRecorder, setShowRecorder] = useState(false)

  const due = useMemo(() => {
    if (!activeSubject) return []
    return [...activeSubject.srs]
      .filter((c) => new Date(c.dueAt).getTime() <= Date.now())
      .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
  }, [activeSubject])

  if (!activeSubject) {
    return (
      <main className="content-pane">
        <p className="page-lead">Select a project first.</p>
      </main>
    )
  }

  const synth =
    activeSubject.synthPrompts.find((p) => p.id === state.activeSynthId) ??
    activeSubject.synthPrompts[0]

  const currentCard = due[state.reviewIndex] ?? due[0]

  const runFeynman = () => {
    if (!synth) return
    const draft = state.feynmanDraft
    const pass = scoreFeynman(draft, synth.rubricKeywords)
    // Bind prompt id first (preserves draft when activeSynthId was null).
    if (state.activeSynthId !== synth.id) {
      dispatch({ type: 'setActiveSynth', id: synth.id })
    }
    dispatch({
      type: 'submitFeynman',
      pass,
      feedback: pass ? synth.passFeedback : synth.failFeedback,
    })
  }

  return (
    <main className="content-pane">
      <header className="page-header">
        <div className="feed-kicker">encoding · active retrieval · feynman test</div>
        <h1 className="feed-title">Synthesis</h1>
        <p className="page-lead">
          Explain it back until the rubric hits. Passes atomize into SRS cards. Daily review keeps
          retention from rotting.
        </p>
      </header>

      <div className="mode-tabs">
        <button
          type="button"
          className={`pill${mode === 'feynman' ? ' primary' : ''}`}
          onClick={() => setMode('feynman')}
        >
          Feynman test
        </button>
        <button
          type="button"
          className={`pill${mode === 'review' ? ' primary' : ''}`}
          onClick={() => setMode('review')}
        >
          Review queue · {due.length}
        </button>
      </div>

      {mode === 'feynman' && synth && (
        <div className="synth-layout">
          <section className="card">
            <div className="task-switcher" style={{ marginBottom: 12 }}>
              {activeSubject.synthPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pill mini${(state.activeSynthId ?? synth.id) === p.id ? ' primary' : ''}`}
                  onClick={() => dispatch({ type: 'setActiveSynth', id: p.id })}
                >
                  {activeSubject.metrics.synthPassed.includes(p.id) ? '✓ ' : ''}
                  {p.conceptId}
                </button>
              ))}
            </div>
            <h2 className="card-title">{synth.prompt}</h2>
            <div className="card-hint">
              Rubric listens for: {synth.rubricKeywords.slice(0, 5).join(', ')}…
            </div>
          </section>
          <section className="card">
            {!showRecorder ? (
              <button
                type="button"
                className="pill"
                style={{ width: '100%', marginBottom: 12 }}
                onClick={() => {
                  setShowRecorder(true)
                  dispatch({
                    type: 'showToast',
                    message: 'Voice capture is a stub — write it instead (live AI later).',
                  })
                }}
              >
                ⌲ Press to record (stub)
              </button>
            ) : null}
            <textarea
              className="workspace-textarea"
              rows={10}
              placeholder="Explain it like they're smart but new…"
              value={state.feynmanDraft}
              onChange={(e) => dispatch({ type: 'setFeynmanDraft', text: e.target.value })}
            />
            <button type="button" className="pill primary" style={{ width: '100%' }} onClick={runFeynman}>
              Grade explanation
            </button>
            {state.feynmanResult && (
              <div className={`explain ${state.feynmanResult === 'pass' ? '' : 'fail'}`}>
                {state.feynmanResult === 'pass' ? synth.passFeedback : synth.failFeedback}
              </div>
            )}
          </section>
        </div>
      )}

      {mode === 'review' && (
        <section className="card review-card">
          {currentCard ? (
            <>
              <div className="feed-kicker">
                card {Math.min(state.reviewIndex + 1, due.length)} / {due.length} due
              </div>
              <button
                type="button"
                className="srs-face"
                onClick={() => dispatch({ type: 'flipCard' })}
              >
                <div className="srs-label">{state.cardFlipped ? 'answer' : 'prompt'}</div>
                <div className="card-title">
                  {state.cardFlipped ? currentCard.back : currentCard.front}
                </div>
                <div className="card-hint">tap to flip</div>
              </button>
              {state.cardFlipped && (
                <div className="srs-grades">
                  <button
                    type="button"
                    className="pill"
                    onClick={() => dispatch({ type: 'reviewCard', grade: 'again' })}
                  >
                    Again
                  </button>
                  <button
                    type="button"
                    className="pill primary"
                    onClick={() => dispatch({ type: 'reviewCard', grade: 'good' })}
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => dispatch({ type: 'reviewCard', grade: 'easy' })}
                  >
                    Easy
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="end-card" style={{ border: 'none', boxShadow: 'none' }}>
              <div className="card-title">Queue clear ✦</div>
              <div className="card-sub">No cards due. Pass a Feynman test or wait for intervals.</div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
