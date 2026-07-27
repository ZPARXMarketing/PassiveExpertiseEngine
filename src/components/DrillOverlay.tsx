import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { checkCalcAnswer, nextCalcQuestion } from '../data/drills'
import type { McqSpec, RapidCalcSpec } from '../data/types'

export function DrillOverlay() {
  const { state, activeSubject, dispatch } = useApp()
  const [input, setInput] = useState('')
  const [mcqChosen, setMcqChosen] = useState<number | null>(null)

  const drillMeta = activeSubject?.drills.find((d) => d.id === state.drill?.drillId)

  useEffect(() => {
    if (!state.drill) return
    const t = setInterval(() => {
      if (state.drill && Date.now() > state.drill.endsAt) {
        dispatch({ type: 'endDrill' })
        dispatch({ type: 'showToast', message: 'Time’s up on this drill' })
      }
    }, 400)
    return () => clearInterval(t)
  }, [state.drill, dispatch])

  if (!state.drill || !drillMeta) return null

  const remaining = Math.max(0, Math.ceil((state.drill.endsAt - Date.now()) / 1000))

  const submitCalc = () => {
    const given = parseFloat(input)
    const ok =
      !Number.isNaN(given) &&
      state.drill!.currentAnswer !== undefined &&
      checkCalcAnswer(given, {
        prompt: state.drill!.currentPrompt ?? '',
        answer: state.drill!.currentAnswer,
        tolerance: state.drill!.currentTolerance ?? 0.2,
      })
    const spec = drillMeta.spec as RapidCalcSpec
    const next = nextCalcQuestion(spec.formula)
    setInput('')
    dispatch({
      type: 'answerDrill',
      correct: ok,
      nextPrompt: next.prompt,
      nextAnswer: next.answer,
      nextTolerance: next.tolerance,
    })
  }

  const submitMcq = (i: number) => {
    if (mcqChosen !== null) return
    setMcqChosen(i)
    const spec = drillMeta.spec as McqSpec
    const ok = i === spec.correctIndex
    setTimeout(() => {
      dispatch({ type: 'answerDrill', correct: ok })
      setMcqChosen(null)
    }, 700)
  }

  return (
    <div className="drill-backdrop" role="dialog" aria-modal="true">
      <div className="card drill-sheet">
        <div className="drill-head">
          <div>
            <div className="feed-kicker">micro-drill</div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {drillMeta.title}
            </div>
          </div>
          <div className="drill-meta">
            <span>
              {state.drill.correct}/{state.drill.total}
            </span>
            <span className="timer-value" style={{ fontSize: 18 }}>
              {remaining}s
            </span>
            <button type="button" className="text-btn" onClick={() => dispatch({ type: 'endDrill' })}>
              ✕
            </button>
          </div>
        </div>

        {drillMeta.kind === 'rapid-calc' && (
          <>
            <p className="beat-body" style={{ textAlign: 'left', maxWidth: 'none' }}>
              {state.drill.currentPrompt}
            </p>
            <div className="goal-row">
              <input
                className="goal-input"
                inputMode="decimal"
                placeholder="Answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitCalc()}
                autoFocus
              />
              <button type="button" className="pill primary" onClick={submitCalc}>
                Submit
              </button>
            </div>
          </>
        )}

        {drillMeta.kind === 'mcq' && (
          <>
            <p className="card-title" style={{ fontSize: 18 }}>
              {(drillMeta.spec as McqSpec).question}
            </p>
            {(drillMeta.spec as McqSpec).options.map((opt, i) => {
              let cls = 'pill'
              if (mcqChosen !== null) {
                if (i === (drillMeta.spec as McqSpec).correctIndex) cls += ' correct'
                else if (i === mcqChosen) cls += ' wrong'
                else cls += ' dim'
              }
              return (
                <button
                  key={opt}
                  type="button"
                  className={cls}
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={mcqChosen !== null}
                  onClick={() => submitMcq(i)}
                >
                  {opt}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
