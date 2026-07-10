import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { lessonById } from '../data/lessons'
import { BeatVisual } from './BeatVisual'

export function StoryPlayer() {
  const { state, dispatch } = useApp()
  const [chosen, setChosen] = useState<number | null>(null)
  const player = state.player
  if (!player) return null

  const lesson = lessonById(player.lessonId)
  const totalSteps = lesson.beats.length + 1 // beats + final quick check
  const onCheck = player.beat >= lesson.beats.length
  const beat = onCheck ? null : lesson.beats[player.beat]

  const next = () => {
    if (!onCheck) dispatch({ type: 'setBeat', beat: player.beat + 1 })
  }
  const back = () => {
    if (player.beat > 0) dispatch({ type: 'setBeat', beat: player.beat - 1 })
  }

  const answer = (i: number) => {
    if (chosen !== null) return
    setChosen(i)
    setTimeout(() => {
      dispatch({
        type: 'completeLesson',
        lessonId: lesson.id,
        itemId: player.sourceItemId,
        answer: i,
      })
    }, 1400)
  }

  return (
    <div className="overlay">
      <div className="player">
        <div className="segments">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`segment${i <= player.beat ? ' filled' : ''}`}>
              <span className="segment-fill" />
            </div>
          ))}
        </div>

        <div className="player-head">
          <span className="tag neon">{lesson.tag}</span>
          <button className="player-close" onClick={() => dispatch({ type: 'closePlayer' })}>
            ✕ back to feed
          </button>
        </div>

        {beat ? (
          <>
            <div className="beat" key={player.beat}>
              <BeatVisual kind={beat.visual} />
              <h2 className="beat-headline">{beat.headline}</h2>
              <p className="beat-body">{beat.body}</p>
            </div>
            <button className="tapzone left" aria-label="previous beat" onClick={back} />
            <button className="tapzone right" aria-label="next beat" onClick={next} />
            <div className="player-foot">
              <button
                className="stuck-btn"
                onClick={() => dispatch({ type: 'openTutor', beat: player.beat })}
              >
                ✦ I don't get this
              </button>
              <div className="tap-hint">
                <span>◂ tap left: back</span>
                <span>
                  beat {player.beat + 1}/{lesson.beats.length}
                </span>
                <span>tap right: next ▸</span>
              </div>
            </div>
          </>
        ) : (
          <div className="player-check">
            <div className="check-kicker">quick check · closes the lesson</div>
            <h2 className="beat-headline">{lesson.check.question}</h2>
            {lesson.check.options.map((opt, i) => {
              let cls = 'pill'
              if (chosen !== null) {
                if (i === lesson.check.correctIndex) cls += ' correct'
                else if (i === chosen) cls += ' wrong'
                else cls += ' dim'
              }
              return (
                <button key={opt} className={cls} disabled={chosen !== null} onClick={() => answer(i)}>
                  {opt}
                </button>
              )
            })}
            {chosen !== null && (
              <div className="explain">
                {chosen === lesson.check.correctIndex ? 'Right. ' : 'Not quite — '}
                {lesson.check.explanation}
              </div>
            )}
            <button
              className="stuck-btn"
              onClick={() => dispatch({ type: 'openTutor', beat: player.beat })}
            >
              ✦ I don't get this
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
