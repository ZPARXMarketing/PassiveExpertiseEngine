import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { gradeAttempt, gradeKeyPoints } from '../data/retrieval'
import { gradeFeynman, GradeUnavailableError, keywordFallbackGrade } from '../data/grade'
import { cleanLabel } from '../data/study'
import type { RetrievalItem } from '../data/types'

const KIND_LABEL: Record<RetrievalItem['kind'], string> = {
  mcq: 'judgement',
  discrimination: 'tell them apart',
  application: 'apply it',
  'short-answer': 'short answer',
  reconstruction: 'rebuild the order',
  recall: 'recall',
  'teach-back': 'teach back',
}

/** Deterministic shuffle so a reconstruction item does not reshuffle on re-render. */
function shuffled<T>(items: T[], seed: string): T[] {
  const out = items.map((value, index) => ({ value, index }))
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return out
    .map((entry) => ({ ...entry, key: (hash + entry.index * 2654435761) % 100000 }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value)
}

/* --------------------------------------------------------------- one item --- */

function ItemCard({ item }: { item: RetrievalItem }) {
  const { state, dispatch } = useApp()
  const session = state.retrieval!
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [order, setOrder] = useState<number[]>([])

  // A new item is a clean slate — otherwise the previous answer leaks forward.
  useEffect(() => {
    setText('')
    setPicked(null)
    setOrder([])
  }, [item.id])

  const steps = useMemo(
    () => (item.steps ? shuffled(item.steps.map((s, i) => ({ s, i })), item.id) : []),
    [item.steps, item.id],
  )

  const submitChoice = (index: number) => {
    if (session.revealed) return
    setPicked(index)
    const result = gradeAttempt(item, index)
    dispatch({ type: 'gradeItem', grade: result.grade, feedback: result.feedback, correct: result.correct })
  }

  const submitText = () => {
    if (session.revealed) return
    const result = gradeKeyPoints(text, item.keyPoints ?? [])
    dispatch({ type: 'gradeItem', grade: result.grade, feedback: result.feedback, correct: result.correct })
  }

  const submitOrder = () => {
    if (session.revealed) return
    const result = gradeAttempt(item, order.join(','))
    dispatch({ type: 'gradeItem', grade: result.grade, feedback: result.feedback, correct: result.correct })
  }

  /** Classic recall: reveal, then say honestly whether it was there. */
  const gradeRecall = (grade: 1 | 3 | 4) => {
    dispatch({
      type: 'gradeItem',
      grade,
      feedback: grade === 1 ? 'Marked for another pass soon.' : 'Logged.',
      correct: grade > 1,
    })
  }

  const isChoice = item.kind === 'mcq' || item.kind === 'discrimination'

  return (
    <section className="card retrieval-card">
      <div className="feed-kicker">{KIND_LABEL[item.kind]}</div>
      <h2 className="card-title retrieval-prompt">{item.prompt}</h2>

      {isChoice && (
        <div className="retrieval-options">
          {(item.options ?? []).map((option, i) => {
            let cls = 'pill option'
            if (session.revealed) {
              if (i === item.correctIndex) cls += ' correct'
              else if (i === picked) cls += ' wrong'
              else cls += ' dim'
            }
            return (
              <button
                key={option}
                type="button"
                className={cls}
                disabled={session.revealed}
                onClick={() => submitChoice(i)}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {(item.kind === 'application' || item.kind === 'short-answer') && (
        <>
          <textarea
            className="workspace-textarea short"
            rows={4}
            placeholder="One or two sentences — this is a short answer, not an essay."
            value={text}
            disabled={session.revealed}
            onChange={(e) => setText(e.target.value)}
          />
          {!session.revealed && (
            <button type="button" className="pill primary" style={{ width: '100%' }} onClick={submitText}>
              Check it
            </button>
          )}
        </>
      )}

      {item.kind === 'reconstruction' && (
        <>
          <ol className="reconstruction-list">
            {steps.map((entry) => {
              const position = order.indexOf(entry.i)
              return (
                <li key={entry.s}>
                  <button
                    type="button"
                    className={`pill option${position >= 0 ? ' primary' : ''}`}
                    disabled={session.revealed}
                    onClick={() =>
                      setOrder((prev) =>
                        prev.includes(entry.i) ? prev.filter((v) => v !== entry.i) : [...prev, entry.i],
                      )
                    }
                  >
                    {position >= 0 && <span className="step-order">{position + 1}</span>}
                    {entry.s}
                  </button>
                </li>
              )
            })}
          </ol>
          {!session.revealed && (
            <button
              type="button"
              className="pill primary"
              style={{ width: '100%' }}
              disabled={order.length !== steps.length}
              onClick={submitOrder}
            >
              Check the order
            </button>
          )}
        </>
      )}

      {item.kind === 'recall' && !session.revealed && (
        <div className="recall-grades">
          <p className="card-hint">Answer out loud first — then grade yourself honestly.</p>
          <div className="srs-grades">
            <button type="button" className="pill" onClick={() => gradeRecall(1)}>
              Blank
            </button>
            <button type="button" className="pill primary" onClick={() => gradeRecall(3)}>
              Had it
            </button>
            <button type="button" className="pill" onClick={() => gradeRecall(4)}>
              Instant
            </button>
          </div>
        </div>
      )}

      {session.revealed && (
        <div className={`explain${session.lastCorrect ? '' : ' fail'}`}>
          <strong>{session.lastCorrect ? 'Landed.' : 'Missed.'}</strong> {session.feedback}
          {item.answer && (
            <p className="retrieval-answer">
              <span className="feed-kicker">answer</span>
              {item.answer}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------- teach back --- */

function TeachBack() {
  const { state, activeDomain, dispatch } = useApp()
  const [grading, setGrading] = useState(false)
  const [freeform, setFreeform] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const prompt = activeDomain?.synthPrompts.find((p) => p.id === state.activeSynthId)
  if (!activeDomain || !prompt) {
    return (
      <main className="content-pane">
        <p className="page-lead">That teach-back is no longer on this domain.</p>
        <button type="button" className="pill" onClick={() => dispatch({ type: 'setView', view: 'feed' })}>
          ← Back to feed
        </button>
      </main>
    )
  }

  const node = activeDomain.blueprint.nodes.find((n) => n.id === prompt.conceptId)
  const scaffold = prompt.scaffold ?? []
  const structured = scaffold.length > 0 && !freeform
  const answer = structured
    ? scaffold.map((q, i) => `${q}\n${state.teachBackDraft[i] ?? ''}`).join('\n\n')
    : (state.teachBackDraft[0] ?? '')

  const submit = async () => {
    if (grading) return
    setGrading(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await gradeFeynman({
        conceptLabel: node ? cleanLabel(node.label) : prompt.conceptId,
        prompt,
        explanation: answer,
        settings: state.settings,
        goal: activeDomain.topic,
        signal: controller.signal,
      })
      dispatch({ type: 'submitTeachBack', pass: result.pass, feedback: result.feedback })
    } catch (err) {
      if (controller.signal.aborted) return
      // No key or the grader is unreachable: fall back to the local rubric so a
      // teach-back is never a dead end, and say which grader ran.
      const local = keywordFallbackGrade(answer, prompt)
      dispatch({
        type: 'submitTeachBack',
        pass: local.pass,
        feedback:
          err instanceof GradeUnavailableError
            ? `${local.feedback} (graded locally — ${err.message})`
            : local.feedback,
      })
    } finally {
      setGrading(false)
    }
  }

  const ready = structured
    ? scaffold.every((_, i) => (state.teachBackDraft[i] ?? '').trim().length > 3)
    : answer.trim().length > 40

  return (
    <main className="content-pane">
      <button type="button" className="back-link" onClick={() => dispatch({ type: 'setView', view: 'feed' })}>
        ← Feed
      </button>

      <header className="page-header">
        <div className="feed-kicker">teach it back · {node ? cleanLabel(node.label) : prompt.conceptId}</div>
        <h1 className="feed-title">{prompt.prompt}</h1>
        <p className="page-lead">
          {structured
            ? 'One line each. You are proving you can produce the idea, not writing an essay about it.'
            : 'Free writing — the advanced mode. Say the mechanism, the decision it changes, and one example.'}
        </p>
      </header>

      <section className="card teachback-card">
        {structured ? (
          scaffold.map((question, i) => (
            <label key={question} className="scaffold-field">
              <span className="scaffold-q">{question}</span>
              <textarea
                className="workspace-textarea short"
                rows={2}
                placeholder="One line"
                value={state.teachBackDraft[i] ?? ''}
                onChange={(e) => dispatch({ type: 'setTeachBackDraft', index: i, text: e.target.value })}
              />
            </label>
          ))
        ) : (
          <textarea
            className="workspace-textarea"
            rows={10}
            placeholder="Explain it like they're smart but new…"
            value={state.teachBackDraft[0] ?? ''}
            onChange={(e) => dispatch({ type: 'setTeachBackDraft', index: 0, text: e.target.value })}
          />
        )}

        <div className="teachback-actions">
          {scaffold.length > 0 && (
            <button type="button" className="text-btn" onClick={() => setFreeform((v) => !v)}>
              {structured ? 'Switch to free writing' : 'Back to short answers'}
            </button>
          )}
          <button
            type="button"
            className="pill primary"
            disabled={!ready || grading}
            onClick={() => void submit()}
          >
            {grading ? 'Grading…' : 'Submit'}
          </button>
        </div>

        {state.teachBackResult && (
          <div className={`explain${state.teachBackResult === 'pass' ? '' : ' fail'}`}>
            {state.teachBackResult === 'pass' ? prompt.passFeedback : prompt.failFeedback}
          </div>
        )}
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ shell --- */

export function RetrievalScreen() {
  const { state, activeDomain, dispatch } = useApp()

  if (!state.retrieval) return <TeachBack />

  const session = state.retrieval
  const item = activeDomain?.items.find((i) => i.id === session.itemIds[session.index])

  if (!activeDomain || !item) {
    return (
      <main className="content-pane">
        <p className="page-lead">That dose is no longer available.</p>
        <button type="button" className="pill" onClick={() => dispatch({ type: 'endRetrieval' })}>
          ← Back to feed
        </button>
      </main>
    )
  }

  const total = session.itemIds.length
  const node = activeDomain.blueprint.nodes.find((n) => n.id === item.conceptId)

  return (
    <main className="content-pane retrieval-pane">
      <button type="button" className="back-link" onClick={() => dispatch({ type: 'endRetrieval' })}>
        ← Feed
      </button>

      <header className="page-header">
        <div className="feed-kicker">
          retrieval · {node ? cleanLabel(node.label) : item.conceptId}
        </div>
        <h1 className="feed-title">
          {session.index + 1} / {total}
        </h1>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
      </header>

      <ItemCard item={item} />

      {session.revealed && (
        <button
          type="button"
          className="pill primary next-item"
          onClick={() => dispatch({ type: 'nextItem' })}
        >
          {session.index + 1 >= total ? 'Finish dose' : 'Next'}
        </button>
      )}
    </main>
  )
}
