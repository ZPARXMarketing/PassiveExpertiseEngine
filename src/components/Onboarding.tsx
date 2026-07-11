import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { MappedCourse } from '../state/AppContext'
import { blueprintFor, presetSubjects, ONE_PAGE_LIMIT } from '../data/blueprints'
import type { CourseBlueprint, ResourceKind } from '../data/blueprints'

type Step = 0 | 1 | 2 | 3

const resourceIcon: Record<ResourceKind, string> = {
  course: '🎓',
  text: '📖',
  video: '▶',
  reference: '🔗',
}

export function Onboarding() {
  const { dispatch } = useApp()
  const [step, setStep] = useState<Step>(0)
  const [subjectInput, setSubjectInput] = useState('')
  const [hours, setHours] = useState(50)
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const mappingHours = Math.max(1, Math.round(hours * 0.1))

  const lockSubject = (raw: string) => {
    const q = raw.trim()
    if (!q) return
    const bp = blueprintFor(q)
    setBlueprint(bp)
    setSelected(new Set(bp.components.filter((c) => c.leverage === 'core').map((c) => c.id)))
    setStep(1)
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const finish = () => {
    if (!blueprint) return
    const course: MappedCourse = {
      id: `course-${blueprint.id}-${Date.now().toString(36)}`,
      blueprintId: blueprint.id,
      subject: blueprint.subject,
      field: blueprint.field,
      oneLiner: blueprint.oneLiner,
      isTemplate: blueprint.isTemplate,
      totalHours: hours,
      mappingHours,
      benchmarks: blueprint.benchmarks,
      resources: blueprint.resources,
      components: blueprint.components,
      selectedIds: [...selected],
      createdAt: Date.now(),
    }
    dispatch({ type: 'saveCourse', course })
  }

  return (
    <div className="overlay">
      <div className="onb">
        <header className="onb-head">
          <div className="onb-steps">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`onb-step${i <= step ? ' on' : ''}`} />
            ))}
          </div>
          <button className="player-close" onClick={() => dispatch({ type: 'closeOnboarding' })}>
            ✕ cancel
          </button>
        </header>

        {step === 0 && (
          <StepDefine
            subjectInput={subjectInput}
            setSubjectInput={setSubjectInput}
            hours={hours}
            setHours={setHours}
            mappingHours={mappingHours}
            onNext={lockSubject}
          />
        )}

        {step === 1 && blueprint && (
          <StepMap
            blueprint={blueprint}
            hours={hours}
            mappingHours={mappingHours}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && blueprint && (
          <StepSelect
            blueprint={blueprint}
            selected={selected}
            toggle={toggle}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && blueprint && (
          <StepCheatSheet
            blueprint={blueprint}
            selected={selected}
            onBack={() => setStep(2)}
            onFinish={finish}
          />
        )}
      </div>
    </div>
  )
}

/* ---------------- Step 0 — Define subject & time budget ---------------- */

function StepDefine({
  subjectInput,
  setSubjectInput,
  hours,
  setHours,
  mappingHours,
  onNext,
}: {
  subjectInput: string
  setSubjectInput: (v: string) => void
  hours: number
  setHours: (v: number) => void
  mappingHours: number
  onNext: (v: string) => void
}) {
  return (
    <div className="onb-body">
      <div className="onb-kicker">the 80/20 audit · step 1 of 3</div>
      <h2 className="onb-title">What do you want to master?</h2>
      <p className="onb-lede">
        We'll map the field before you study a thing — so you learn the vital few, not everything.
      </p>

      <input
        className="onb-input"
        placeholder="e.g. Quantum Physics, Machine Learning…"
        value={subjectInput}
        onChange={(e) => setSubjectInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onNext(subjectInput)}
        autoFocus
      />
      <div className="onb-chips">
        {presetSubjects.map((s) => (
          <button
            key={s}
            className={`chip${subjectInput.trim().toLowerCase() === s.toLowerCase() ? ' on' : ''}`}
            onClick={() => setSubjectInput(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="onb-field">
        <label className="onb-label">How much time can you give it, total?</label>
        <div className="hours-row">
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="hours-range"
          />
          <span className="hours-val">{hours}h</span>
        </div>
        <div className="ten-pct">
          <span className="ten-pct-num">{mappingHours}h</span>
          <span>
            the first <strong>10%</strong> goes to mapping the terrain — not studying it
            <em> (Young's rule)</em>
          </span>
        </div>
      </div>

      <div className="onb-foot">
        <span />
        <button className="pill primary" disabled={!subjectInput.trim()} onClick={() => onNext(subjectInput)}>
          Map the field ▸
        </button>
      </div>
    </div>
  )
}

/* ---------------- Step 1 — The 10% map ---------------- */

function StepMap({
  blueprint,
  hours,
  mappingHours,
  onBack,
  onNext,
}: {
  blueprint: CourseBlueprint
  hours: number
  mappingHours: number
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="onb-body">
      <div className="onb-kicker">strategic compression · the 10% map</div>
      <h2 className="onb-title">{blueprint.subject}</h2>
      <p className="onb-lede">{blueprint.oneLiner}</p>
      {blueprint.isTemplate && (
        <div className="onb-note">
          No pre-built map for this yet — here's a working template. The engine refines it as it
          scans real syllabi.
        </div>
      )}

      <div className="map-budget">
        Your first <strong>{mappingHours}h</strong> of {hours}h: surveying the landscape, benchmarks
        and best resources — so the other {hours - mappingHours}h are aimed.
      </div>

      <div className="onb-section-label">What mastery looks like</div>
      {blueprint.benchmarks.map((b) => (
        <div key={b.label} className="mini-card">
          <div className="mini-title">{b.label}</div>
          <div className="mini-detail">{b.detail}</div>
        </div>
      ))}

      <div className="onb-section-label">Best resources, ranked</div>
      {blueprint.resources.map((r) => (
        <div key={r.name} className="res-row">
          <span className="res-icon">{resourceIcon[r.kind]}</span>
          <span className="res-name">{r.name}</span>
          <span className="res-note">{r.note}</span>
        </div>
      ))}

      <div className="onb-foot">
        <button className="pill ghost" onClick={onBack}>
          ◂ back
        </button>
        <button className="pill primary" onClick={onNext}>
          I've mapped the terrain ▸
        </button>
      </div>
    </div>
  )
}

/* ---------------- Step 2 — Select the vital 20% ---------------- */

function StepSelect({
  blueprint,
  selected,
  toggle,
  onBack,
  onNext,
}: {
  blueprint: CourseBlueprint
  selected: Set<string>
  toggle: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const total = blueprint.components.length
  const n = selected.size
  const pct = Math.round((n / total) * 100)
  const overloaded = n > ONE_PAGE_LIMIT

  return (
    <div className="onb-body">
      <div className="onb-kicker">the 20% selection · Ferriss</div>
      <h2 className="onb-title">Keep only the vital few</h2>
      <p className="onb-lede">
        Which components yield 80% of real-world results? We've pre-picked the recommended core —
        cut anything that isn't essential.
      </p>

      <div className="select-meter">
        <div className="select-count">
          <strong className={overloaded ? 'warn' : undefined}>{n}</strong> of {total} · {pct}%
        </div>
        <div className="split-bar">
          <div className="split-fill" style={{ width: `${pct}%` }} />
          <div className="split-mark" style={{ left: '20%' }} title="the vital 20%" />
        </div>
        <div className="select-hint">
          {overloaded ? 'more than the vital few — this won\'t fit one page' : 'aim near the 20% line'}
        </div>
      </div>

      <div className="comp-list">
        {blueprint.components.map((c) => {
          const on = selected.has(c.id)
          return (
            <button key={c.id} className={`comp${on ? ' on' : ''}`} onClick={() => toggle(c.id)}>
              <span className={`comp-check${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>
              <span className="comp-main">
                <span className="comp-label">
                  {c.label}
                  {c.leverage === 'core' && <span className="comp-badge">core</span>}
                </span>
                <span className="comp-why">{c.why}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="onb-foot">
        <button className="pill ghost" onClick={onBack}>
          ◂ back
        </button>
        <button className="pill primary" disabled={n === 0} onClick={onNext}>
          Compress to one page ▸
        </button>
      </div>
    </div>
  )
}

/* ---------------- Step 3 — The one-page cheat sheet ---------------- */

function StepCheatSheet({
  blueprint,
  selected,
  onBack,
  onFinish,
}: {
  blueprint: CourseBlueprint
  selected: Set<string>
  onBack: () => void
  onFinish: () => void
}) {
  const picks = useMemo(
    () => blueprint.components.filter((c) => selected.has(c.id)),
    [blueprint, selected],
  )
  const overflow = Math.max(0, picks.length - ONE_PAGE_LIMIT)
  const fits = overflow === 0

  return (
    <div className="onb-body">
      <div className="onb-kicker">the one-page metric · Ferriss</div>
      <h2 className="onb-title">{blueprint.subject} — the one page</h2>
      <p className="onb-lede">
        If the core mechanics can't fit on a single glanceable page, it isn't simplified enough.
      </p>

      <div className={`sheet${fits ? '' : ' over'}`}>
        <div className="sheet-head">
          <span className="sheet-subject">{blueprint.subject}</span>
          <span className="sheet-meta">{picks.length} core mechanics</span>
        </div>
        {picks.map((c, i) => (
          <div key={c.id} className={`sheet-line${i >= ONE_PAGE_LIMIT ? ' overflow' : ''}`}>
            <span className="sheet-num">{i + 1}</span>
            <span className="sheet-body">
              <span className="sheet-label">{c.label}</span>
              <span className="sheet-cheat">{c.cheat}</span>
            </span>
          </div>
        ))}
      </div>

      {!fits && (
        <div className="sheet-warn">
          ✂ {overflow} too many for one page — cut {overflow} to keep it glanceable.
        </div>
      )}

      <div className="onb-foot">
        <button className="pill ghost" onClick={onBack}>
          ◂ trim
        </button>
        <button className="pill primary" disabled={!fits} onClick={onFinish}>
          Start learning passively ▸
        </button>
      </div>
    </div>
  )
}
