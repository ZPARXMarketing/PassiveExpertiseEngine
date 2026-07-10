import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { lessonById } from '../data/lessons'
import { tutorScriptFor } from '../data/tutor'
import type { TutorTurn } from '../data/types'

export function TutorSheet() {
  const { state, dispatch } = useApp()
  const player = state.player
  const lesson = player ? lessonById(player.lessonId) : null
  const script = tutorScriptFor(lesson?.conceptId ?? '*')

  const [turns, setTurns] = useState<TutorTurn[]>(script.opening)
  const [used, setUsed] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  if (!player || !lesson) return null

  const remaining = script.branches.filter((b) => !used.includes(b.id))

  const pick = (branchId: string) => {
    const branch = script.branches.find((b) => b.id === branchId)
    if (!branch) return
    setUsed((u) => [...u, branchId])
    // user bubble lands immediately; tutor replies follow with a beat of delay
    setTurns((t) => [...t, branch.turns[0]])
    branch.turns.slice(1).forEach((turn, i) => {
      setTimeout(() => setTurns((t) => [...t, turn]), 450 * (i + 1))
    })
  }

  return (
    <div className="tutor-backdrop" onClick={() => dispatch({ type: 'closeTutor' })}>
      <div className="tutor-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-head">
          <span className="tutor-name">◆ Tutor</span>
          <span className="tag neon">{lesson.tag}</span>
        </div>
        <div className="tutor-context">
          summoned from beat {Math.min(player.beat + 1, lesson.beats.length)} — "I don't get this"
        </div>
        <div className="tutor-scroll" ref={scrollRef}>
          {turns.map((turn, i) => (
            <div key={i} className={`bubble ${turn.from}`}>
              {turn.text}
            </div>
          ))}
        </div>
        <div className="tutor-pills">
          {remaining.slice(0, 2).map((b) => (
            <button key={b.id} className="pill" onClick={() => pick(b.id)}>
              {b.label}
            </button>
          ))}
          <button className="pill primary" onClick={() => dispatch({ type: 'closeTutor' })}>
            got it — resume lesson ▸
          </button>
        </div>
      </div>
    </div>
  )
}
