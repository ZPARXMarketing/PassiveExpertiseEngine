import { useApp } from '../state/AppContext'
import type { FeedItem } from '../data/types'

export function QuickCheckCard({ item }: { item: Extract<FeedItem, { kind: 'quickCheck' }> }) {
  const { state, dispatch } = useApp()
  const answered = state.checkAnswers[item.id]
  const hasAnswered = answered !== undefined

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tag neon">✓ quick check</span>
        <span className="card-hint">{item.tag}</span>
      </div>
      <div className="card-title" style={{ fontSize: 15.5 }}>
        {item.check.question}
      </div>
      <div className="check-row">
        {item.check.options.map((opt, i) => {
          let cls = 'pill'
          if (hasAnswered) {
            if (i === item.check.correctIndex) cls += ' correct'
            else if (i === answered) cls += ' wrong'
            else cls += ' dim'
          }
          return (
            <button
              key={opt}
              className={cls}
              disabled={hasAnswered}
              onClick={() => dispatch({ type: 'answerCheck', itemId: item.id, answer: i })}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {hasAnswered && (
        <div className="explain">
          {answered === item.check.correctIndex ? 'Right. ' : 'Not quite — '}
          {item.check.explanation}
        </div>
      )}
    </div>
  )
}
