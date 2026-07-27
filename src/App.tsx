import { useEffect, useState } from 'react'
import { AppProvider, useApp, type AppView } from './state/AppContext'
import { SubjectsHome } from './components/SubjectsHome'
import { BlueprintScreen } from './components/BlueprintScreen'
import { TerminalScreen } from './components/TerminalScreen'
import { SynthesisScreen } from './components/SynthesisScreen'
import { DashboardScreen } from './components/DashboardScreen'
import { DrillOverlay } from './components/DrillOverlay'
import { Toast } from './components/Toast'

const NAV: { id: AppView; label: string; stage: string }[] = [
  { id: 'subjects', label: 'Subjects', stage: 'projects' },
  { id: 'blueprint', label: 'Blueprint', stage: 'metalearning' },
  { id: 'terminal', label: 'Terminal', stage: 'practice' },
  { id: 'synthesis', label: 'Synthesis', stage: 'retrieval' },
  { id: 'dashboard', label: 'Dashboard', stage: 'feedback' },
]

function NavItems({ compact }: { compact?: boolean }) {
  const { state, dispatch } = useApp()
  return (
    <>
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item${state.view === item.id ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'setView', view: item.id })}
        >
          <span className="nav-label">{item.label}</span>
          {!compact && <span className="nav-stage">{item.stage}</span>}
        </button>
      ))}
    </>
  )
}

function SubjectSwitcher({ placement }: { placement: 'rail' | 'header' }) {
  const { state, activeSubject, dispatch } = useApp()
  if (state.subjects.length === 0) return null
  return (
    <label className={`subject-switcher ${placement}`}>
      <span className="switcher-label">Active project</span>
      <select
        value={state.activeSubjectId ?? ''}
        onChange={(e) => dispatch({ type: 'setActiveSubject', id: e.target.value })}
      >
        {state.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {placement === 'header' && activeSubject && (
        <span className="switcher-meta">{activeSubject.blueprint.nodes.filter((n) => n.is8020).length} core nodes</span>
      )}
    </label>
  )
}

function useIsPhone() {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 859px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 859px)')
    const onChange = () => setPhone(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

function Shell() {
  const { state } = useApp()
  const isPhone = useIsPhone()

  return (
    <div className="app-shell">
      {!isPhone && (
        <aside className="side-rail" aria-label="Main navigation">
          <div className="rail-brand">
            <div className="brand-mark" aria-hidden="true" />
            <div>
              <div className="brand-name">Expertise Engine</div>
              <div className="brand-sub">super-learning pipeline</div>
            </div>
          </div>
          <SubjectSwitcher placement="rail" />
          <nav className="rail-nav">
            <NavItems />
          </nav>
          <div className="rail-foot">Metalearning → Practice → Drill → Retrieve</div>
        </aside>
      )}

      <div className="shell-main">
        {isPhone && state.view !== 'subjects' && (
          <div className="mobile-switcher">
            <SubjectSwitcher placement="header" />
          </div>
        )}
        {state.view === 'subjects' && <SubjectsHome />}
        {state.view === 'blueprint' && <BlueprintScreen />}
        {state.view === 'terminal' && <TerminalScreen />}
        {state.view === 'synthesis' && <SynthesisScreen />}
        {state.view === 'dashboard' && <DashboardScreen />}
      </div>

      {isPhone && (
        <nav className="bottom-bar" aria-label="Main navigation">
          <NavItems compact />
        </nav>
      )}

      {state.drill && <DrillOverlay />}
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
