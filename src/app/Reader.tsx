import { useEffect, useRef, useState } from 'react'
import { Star } from './Column.tsx'
import type { Lesson, TreeNode } from './types.ts'

interface Props {
  chapter: TreeNode
  course: TreeNode
  lesson?: Lesson
  loading: boolean
  error?: string
  isDone: boolean
  index: number
  total: number
  prev?: TreeNode
  next?: TreeNode
  onGo: (n: TreeNode) => void
  onRetry: () => void
  onToggleDone: () => void
  isSaved: boolean
  onToggleSave: () => void
  onSaveSnippet: (text: string) => void
}

const paras = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/** The final, wide panel: one chapter's generated text. */
export function Reader(p: Props) {
  const { chapter, course, lesson } = p
  const bodyRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState('')
  const [flash, setFlash] = useState(false)

  // Highlight any text in the chapter → "Save highlight" puts it in the Library.
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection()
      const inside = sel && sel.rangeCount && bodyRef.current?.contains(sel.anchorNode)
      setSelection(inside ? sel.toString().trim() : '')
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const saveSelection = () => {
    p.onSaveSnippet(selection)
    document.getSelection()?.removeAllRanges()
    setSelection('')
    setFlash(true)
    setTimeout(() => setFlash(false), 1600)
  }

  return (
    <article className="column reader">
      {selection.length > 2 && (
        <button className="snip-btn" onMouseDown={(e) => e.preventDefault()} onClick={saveSelection}>
          ★ Save highlight
        </button>
      )}
      {flash && <div className="snip-flash">Saved to Library</div>}
      <header className="column-head">
        <span className="column-kicker">
          {course.meta.code || course.title} · Chapter {p.index + 1} of {p.total}
        </span>
        <h2>
          {chapter.title}
          <Star on={p.isSaved} onClick={p.onToggleSave} label="chapter" />
        </h2>
        {chapter.summary && <p className="column-desc">{chapter.summary}</p>}
      </header>

      {p.loading && !lesson && (
        <div className="writing">
          <span className="pulse" /> Writing this chapter…
        </div>
      )}
      {p.error && (
        <div className="error">
          <p>{p.error}</p>
          <button className="btn-ghost" onClick={p.onRetry}>
            Try again
          </button>
        </div>
      )}

      {lesson && (
        <div className="lesson" ref={bodyRef}>
          {paras(lesson.intro).map((t) => (
            <p key={t} className="lead">
              {t}
            </p>
          ))}

          {lesson.sections.map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              {paras(s.body).map((t) => (
                <p key={t}>{t}</p>
              ))}
            </section>
          ))}

          {lesson.example && (
            <section className="example">
              <h3>Worked example{lesson.example.title ? `: ${lesson.example.title}` : ''}</h3>
              {paras(lesson.example.body).map((t) => (
                <p key={t}>{t}</p>
              ))}
            </section>
          )}

          {!!lesson.keyTerms.length && (
            <section>
              <h3>Key terms</h3>
              <dl className="terms">
                {lesson.keyTerms.map((k) => (
                  <div key={k.term}>
                    <dt>{k.term}</dt>
                    <dd>{k.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {!!lesson.recap.length && (
            <section className="recap">
              <h3>Recap</h3>
              <ul>
                {lesson.recap.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {!!lesson.quiz.length && (
            <section>
              <h3>Check yourself</h3>
              {lesson.quiz.map((q) => (
                <QuizCard key={q.q} q={q.q} a={q.a} />
              ))}
            </section>
          )}

          <footer className="reader-foot">
            <button className="btn-ghost" disabled={!p.prev} onClick={() => p.prev && p.onGo(p.prev)}>
              ← Previous
            </button>
            <button className={p.isDone ? 'btn-ghost done' : 'btn-neon'} onClick={p.onToggleDone}>
              {p.isDone ? '✓ Completed' : 'Mark complete'}
            </button>
            <button className="btn-ghost" disabled={!p.next} onClick={() => p.next && p.onGo(p.next)}>
              Next →
            </button>
          </footer>
        </div>
      )}
    </article>
  )
}

function QuizCard({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button className={`quiz ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
      <span className="quiz-q">{q}</span>
      <span className="quiz-a">{open ? a : 'Tap to reveal'}</span>
    </button>
  )
}
