import { useEffect, useRef, useState } from 'react'
import { Star } from './Column.tsx'
import { paras } from './parse.ts'
import {
  AskBox,
  DeeperChip,
  FactCheck,
  LectureBadge,
  LectureSheet,
  Opener,
  Practice,
  SectionVisuals,
  VisualChip,
  VisualPanel,
  Writing,
  type ToolCtx,
} from './Study.tsx'
import { HighlightCtx } from './highlight.ts'
import { Marked } from './Marked.tsx'
import { lectureCounts, type Bucket, type CheckResult, type Lesson, type SavedItem, type TreeNode } from './types.ts'

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
  onSaveSnippet: (text: string, color: string) => void
  /** this chapter's highlighter marks */
  highlights: SavedItem[]
  /** highlighter buckets, in order (archived ones excluded from the bar) */
  buckets: Bucket[]
  onRecolor: (item: SavedItem, color: string) => void
  onRemoveHighlight: (item: SavedItem) => void
  studyTools: boolean
  onToggleStudyTools: () => void
  tools: ToolCtx
  fixing: boolean
  fixError: string
  onFix: (check: CheckResult) => void
  /** open the lecture sheet (from the background-job pill) */
  openLectures: boolean
  onLecturesOpened: () => void
}

/** The final, wide panel: one chapter's text, streamed in as it is written. */
export function Reader(p: Props) {
  const { chapter, course, lesson, studyTools, tools } = p
  const bodyRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState('')
  const [flash, setFlash] = useState(false)
  const [deeper, setDeeper] = useState<Set<string>>(new Set())
  const [visuals, setVisuals] = useState<Set<string>>(new Set())
  const [checkOpen, setCheckOpen] = useState(false)
  const toggleVisual = (k: string) =>
    setVisuals((o) => {
      const n = new Set(o)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  /** lecture sheet: null = closed, otherwise the sections to preselect */
  const [sheet, setSheet] = useState<string[] | null>(null)
  const counts = lectureCounts(tools.extras)
  const lectureTotal = tools.extras.filter((x) => x.kind === 'lecture').length
  const { openLectures, onLecturesOpened } = p
  useEffect(() => {
    if (openLectures) {
      setSheet([])
      onLecturesOpened()
    }
  }, [openLectures, onLecturesOpened])
  const writing = p.loading && !!lesson

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

  const saveSelection = (color: string) => {
    p.onSaveSnippet(selection, color)
    document.getSelection()?.removeAllRanges()
    setSelection('')
    setFlash(true)
    setTimeout(() => setFlash(false), 1600)
  }
  const [activeMark, setActiveMark] = useState<string | null>(null)
  const active = p.highlights.find((h) => h.id === activeMark)
  const hl = { items: p.highlights, active: activeMark, setActive: setActiveMark, buckets: p.buckets }
  const live = p.buckets.filter((b) => !b.archived)

  const toggleDeeper = (h: string) =>
    setDeeper((o) => {
      const n = new Set(o)
      if (n.has(h)) n.delete(h)
      else n.add(h)
      return n
    })

  return (
    <HighlightCtx.Provider value={hl}>
      <article className="column reader" onClick={() => activeMark && setActiveMark(null)}>
        {selection.length > 2 && (
          <div className="hl-bar" onMouseDown={(e) => e.preventDefault()} role="toolbar" aria-label="Highlight">
            <span>Save to</span>
            {live.map((b) => (
              <button
                key={b.key}
                className="hl-bucket"
                style={{ '--hl': b.color } as React.CSSProperties}
                onClick={() => saveSelection(b.key)}
                aria-label={`Save to ${b.name}`}
              >
                <i />
                {b.name}
              </button>
            ))}
          </div>
        )}
        {active && !selection && (
          <div className="hl-bar" role="toolbar" aria-label="Edit highlight" onClick={(e) => e.stopPropagation()}>
            {live.map((b) => (
              <button
                key={b.key}
                className={`hl-bucket ${(active.color ?? 'yellow') === b.key ? 'on' : ''}`}
                style={{ '--hl': b.color } as React.CSSProperties}
                onClick={() => p.onRecolor(active, b.key)}
                aria-label={`Move to ${b.name}`}
                aria-pressed={(active.color ?? 'yellow') === b.key}
              >
                <i />
                {b.name}
              </button>
            ))}
            <button
              className="hl-remove"
              onClick={() => {
                p.onRemoveHighlight(active)
                setActiveMark(null)
              }}
            >
              Remove
            </button>
          </div>
        )}
        {flash && <div className="snip-flash">Highlighted · in your Library</div>}
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
        {/* sticks to the top of the reader while you scroll the chapter */}
        {lesson && !p.loading && (
          <>
            <div className="reader-tools">
              <label className={`switch ${studyTools ? 'on' : ''}`}>
                <input type="checkbox" checked={studyTools} onChange={p.onToggleStudyTools} />
                <span className="switch-track">
                  <span className="switch-knob" />
                </span>
                Study tools
              </label>
              {studyTools && (
                <button className={`check-btn ${tools.jobs.length ? 'on' : ''}`} onClick={() => setSheet([])}>
                  {tools.jobs.length ? <span className="pulse" /> : null}🎧 Lectures{lectureTotal ? ` (${lectureTotal})` : ''}
                </button>
              )}
              <FactCheck
                ctx={tools}
                fixing={p.fixing}
                fixError={p.fixError}
                onFix={p.onFix}
                part="button"
                open={checkOpen}
                setOpen={setCheckOpen}
              />
            </div>
            <FactCheck
              ctx={tools}
              fixing={p.fixing}
              fixError={p.fixError}
              onFix={p.onFix}
              part="panel"
              open={checkOpen}
              setOpen={setCheckOpen}
            />
          </>
        )}
        {sheet && lesson && (
          <LectureSheet
            ctx={tools}
            headings={lesson.sections.map((s) => s.heading)}
            chapterTitle={chapter.title}
            preselect={sheet}
            onClose={() => setSheet(null)}
          />
        )}

        {p.loading && !lesson && <Writing label="Writing this chapter…" />}
        {p.error && (
          <div className="error">
            <p>{p.error}</p>
            <button className="btn-ghost" onClick={p.onRetry}>
              Try again
            </button>
          </div>
        )}

        {lesson && (
          <div className={`lesson ${writing ? 'is-writing' : ''}`} ref={bodyRef}>
            {paras(lesson.intro).map((t) => (
              <p key={t} className="lead">
                <Marked text={t} />
              </p>
            ))}

            {lesson.sections.map((s) => (
              <section key={s.heading}>
                <h3>
                  {s.heading}
                  {studyTools && !writing && (
                    <span className="chips-inline">
                      <DeeperChip open={deeper.has(s.heading)} onClick={() => toggleDeeper(s.heading)} />
                      <LectureBadge count={counts.get(s.heading) ?? 0} onClick={() => setSheet([s.heading])} />
                      <VisualChip open={visuals.has(s.heading)} onClick={() => toggleVisual(s.heading)} />
                    </span>
                  )}
                </h3>
                {studyTools && visuals.has(s.heading) && <VisualPanel ctx={tools} section={s.heading} />}
                {paras(s.body).map((t) => (
                  <p key={t}>
                    <Marked text={t} />
                  </p>
                ))}
                <SectionVisuals ctx={tools} section={s.heading} editable={studyTools} />
                {deeper.has(s.heading) && (
                  <Opener ctx={tools} focus={[s.heading]} studyTools={studyTools} onClose={() => toggleDeeper(s.heading)} />
                )}
              </section>
            ))}

            {lesson.example && (
              <section className="example">
                <h3>Worked example{lesson.example.title ? `: ${lesson.example.title}` : ''}</h3>
                {paras(lesson.example.body).map((t) => (
                  <p key={t}>
                    <Marked text={t} />
                  </p>
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

            {writing && <Writing label="Writing…" />}

            {studyTools && !writing && (
              <>
                <AskBox ctx={tools} />
                <Practice ctx={tools} />
              </>
            )}

            {!writing && (
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
            )}
          </div>
        )}
      </article>
    </HighlightCtx.Provider>
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
