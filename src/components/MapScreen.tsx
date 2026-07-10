import { useApp } from '../state/AppContext'
import { subject, unitProgress } from '../data/knowledgeMap'

export function MapScreen() {
  const { state, dispatch } = useApp()

  return (
    <main className="screen">
      <header className="feed-header">
        <div className="feed-kicker">your degree map</div>
        <h1 className="feed-title">{subject.name}</h1>
        <div className="card-sub" style={{ marginTop: 4 }}>
          {subject.sourceNote}
        </div>
      </header>

      {subject.units.map((unit) => {
        // completing lessons in the current unit nudges its live progress
        const bonus =
          unit.nodes?.filter(
            (n) => n.lessonId && state.completedLessons.includes(n.lessonId),
          ).length ?? 0
        const pct = unitProgress(unit, bonus)
        const current = !!unit.nodes

        if (unit.locked) {
          return (
            <div key={unit.id} className="card map-unit locked">
              <div className="row">
                <span className="unit-name">
                  {unit.index} · {unit.title} 🔒
                </span>
                <span className="unit-pct dim">—</span>
              </div>
            </div>
          )
        }

        return (
          <button
            key={unit.id}
            className={`card map-unit${current ? ' highlight' : ''}`}
            onClick={() =>
              current
                ? dispatch({ type: 'openConstellation', unitId: unit.id })
                : dispatch({ type: 'showToast', 'message': 'Constellation coming for this unit — unit 2 is live' })
            }
          >
            <div className="row">
              <span className="unit-name">
                {unit.index} · {unit.title}
              </span>
              <span className={`unit-pct${pct < 50 && !current ? ' dim' : ''}`}>{pct}%</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill${pct < 50 && !current ? ' dim' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            {current && unit.paceNote && (
              <div className="pace-note">
                ↳ {unit.paceNote} · <em>tap → zoom into the constellation</em>
              </div>
            )}
          </button>
        )
      })}

      <div className="you-foot">tap a unit to see every concept inside</div>
    </main>
  )
}
