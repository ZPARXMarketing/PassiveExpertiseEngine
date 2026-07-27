import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { buildSteps, subjectCatalog, type SubjectOption } from '../data/subjects'

type Phase = 'welcome' | 'pick' | 'building' | 'ready'

export function OnboardingScreen() {
  const { dispatch } = useApp()
  const [phase, setPhase] = useState<Phase>('welcome')
  const [picked, setPicked] = useState<SubjectOption | null>(null)
  const [buildStep, setBuildStep] = useState(0)

  useEffect(() => {
    if (phase !== 'building' || !picked) return
    if (buildStep >= buildSteps.length) {
      const t = setTimeout(() => setPhase('ready'), 420)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setBuildStep((s) => s + 1), 780)
    return () => clearTimeout(t)
  }, [phase, buildStep, picked])

  const choose = (s: SubjectOption) => {
    if (!s.available) {
      dispatch({
        type: 'showToast',
        message: `${s.name} is next — Finance for Small Businesses is live in this prototype`,
      })
      return
    }
    setPicked(s)
    setBuildStep(0)
    setPhase('building')
  }

  const finish = () => {
    if (!picked) return
    dispatch({ type: 'completeOnboarding', subjectId: picked.id })
  }

  return (
    <main className="screen onboarding">
      {phase === 'welcome' && (
        <div className="onb-panel" key="welcome">
          <div className="onb-mark" aria-hidden="true">
            <span className="onb-ring" />
            <span className="onb-core" />
          </div>
          <div className="feed-kicker">passive expertise engine</div>
          <h1 className="feed-title onb-title">
            University-grade knowledge.
            <br />
            <span>Absorbed in idle moments.</span>
          </h1>
          <p className="onb-lead">
            Pick a subject. The engine maps the whole field, breaks it into 60–90 second lessons,
            and delivers them when you&apos;re already on your phone — with spaced repetition woven
            in so it sticks.
          </p>
          <button className="pill primary onb-cta" onClick={() => setPhase('pick')}>
            Choose a subject
          </button>
          <p className="onb-footnote">No streaks. No XP. Just what you know.</p>
        </div>
      )}

      {phase === 'pick' && (
        <div className="onb-panel" key="pick">
          <div className="feed-kicker">step 1 of 2</div>
          <h1 className="feed-title">What do you want to know deeply?</h1>
          <p className="onb-lead">The engine builds a full syllabus graph from one pick.</p>
          <div className="onb-subjects">
            {subjectCatalog.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`card onb-subject accent-${s.accent}${s.available ? '' : ' soon'}`}
                onClick={() => choose(s)}
              >
                <div className="onb-subject-top">
                  <span className="card-title">{s.name}</span>
                  {s.available ? (
                    <span className="tag neon">live</span>
                  ) : (
                    <span className="tag">soon</span>
                  )}
                </div>
                <div className="card-sub">{s.blurb}</div>
                <div className="card-hint">
                  {s.sourceNote} · {s.concepts} concepts
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'building' && picked && (
        <div className="onb-panel onb-build" key="building">
          <div className="feed-kicker">building your map</div>
          <h1 className="feed-title">{picked.name}</h1>
          <div className="onb-build-visual" aria-hidden="true">
            <div className="onb-nodes">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className={`onb-node${i < buildStep + 1 ? ' lit' : ''}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          </div>
          <ul className="onb-steps">
            {buildSteps.map((step, i) => (
              <li
                key={step}
                className={
                  i < buildStep ? 'done' : i === buildStep ? 'active' : 'pending'
                }
              >
                <span className="onb-step-mark">
                  {i < buildStep ? '✓' : i === buildStep ? '◌' : '·'}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'ready' && picked && (
        <div className="onb-panel" key="ready">
          <div className="feed-kicker">ready</div>
          <h1 className="feed-title onb-title">
            Your degree map is live.
            <br />
            <span>First thread is waiting.</span>
          </h1>
          <div className="card onb-ready-card">
            <div className="card-title">{picked.name}</div>
            <div className="card-sub">{picked.sourceNote}</div>
            <div className="card-hint">
              {picked.concepts} concepts · unit-by-unit constellation · spaced refreshes in the
              stream
            </div>
          </div>
          <button className="pill primary onb-cta" onClick={finish}>
            Open today&apos;s thread
          </button>
        </div>
      )}
    </main>
  )
}
