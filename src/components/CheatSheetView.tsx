import { useApp } from '../state/AppContext'
import type { MappedCourse } from '../state/AppContext'

export function CheatSheetView({ course }: { course: MappedCourse }) {
  const { dispatch } = useApp()
  const picks = course.components.filter((c) => course.selectedIds.includes(c.id))
  const cut = course.components.length - picks.length

  return (
    <div className="overlay">
      <div className="onb">
        <header className="onb-head">
          <button className="const-back" onClick={() => dispatch({ type: 'closeCheatSheet' })}>
            ‹
          </button>
          <span className="const-title">Course overview</span>
          <button
            className="player-close"
            onClick={() => dispatch({ type: 'removeCourse', courseId: course.id })}
          >
            remove
          </button>
        </header>

        <div className="onb-body">
          <div className="onb-kicker">{course.field}</div>
          <h2 className="onb-title">{course.subject}</h2>
          <p className="onb-lede">{course.oneLiner}</p>

          <div className="audit-stats">
            <div className="audit-stat">
              <div className="audit-num">{course.totalHours}h</div>
              <div className="audit-lbl">time budget</div>
            </div>
            <div className="audit-stat">
              <div className="audit-num">{course.mappingHours}h</div>
              <div className="audit-lbl">mapped first (10%)</div>
            </div>
            <div className="audit-stat">
              <div className="audit-num">{picks.length}</div>
              <div className="audit-lbl">vital · {cut} cut</div>
            </div>
          </div>

          <div className="onb-section-label">The one page</div>
          <div className="sheet">
            <div className="sheet-head">
              <span className="sheet-subject">{course.subject}</span>
              <span className="sheet-meta">{picks.length} core mechanics</span>
            </div>
            {picks.map((c, i) => (
              <div key={c.id} className="sheet-line">
                <span className="sheet-num">{i + 1}</span>
                <span className="sheet-body">
                  <span className="sheet-label">{c.label}</span>
                  <span className="sheet-cheat">{c.cheat}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="onb-section-label">Best resources</div>
          {course.resources.map((r) => (
            <div key={r.name} className="res-row">
              <span className="res-name">{r.name}</span>
              <span className="res-note">{r.note}</span>
            </div>
          ))}

          <div className="onb-foot single">
            <button className="pill primary" onClick={() => dispatch({ type: 'closeCheatSheet' })}>
              done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
