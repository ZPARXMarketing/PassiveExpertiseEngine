import { useEffect, useState } from 'react'
import { AppProvider, useApp, type AppView } from './state/AppContext'
import { SubjectsHome } from './components/SubjectsHome'
import { BlueprintScreen } from './components/BlueprintScreen'
import { ConceptScreen } from './components/ConceptScreen'
import { TerminalScreen } from './components/TerminalScreen'
import { SynthesisScreen } from './components/SynthesisScreen'
import { DashboardScreen } from './components/DashboardScreen'
import { SettingsScreen } from './components/SettingsScreen'
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
          // A concept study page lives under Blueprint, so keep that entry lit
          className={`nav-item${state.view === item.id || (item.id === 'blueprint' && state.view === 'concept') ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'setView', view: item.id })}
        >
          <span className="nav-label">{item.label}</span>
          {!compact && <span className="nav-stage">{item.stage}</span>}
        </button>
      ))}
    </>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.8-1L14.9 3H9.1l-.4 2.5a7.6 7.6 0 0 0-1.8 1l-2.3-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1c.55.42 1.16.76 1.8 1l.4 2.6h5.8l.4-2.6c.64-.24 1.25-.58 1.8-1l2.3 1 2-3.4-2-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SettingsButton({ compact }: { compact?: boolean }) {
  const { state, dispatch } = useApp()
  return (
    <button
      type="button"
      className={`settings-btn${compact ? ' compact' : ''}${state.view === 'settings' ? ' active' : ''}`}
      onClick={() => dispatch({ type: 'setView', view: 'settings' })}
      aria-label="Settings"
      title="Settings"
    >
      <GearIcon />
      {!compact && <span>Settings</span>}
    </button>
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
          <div className="rail-foot">
            <SettingsButton />
            <span>Metalearning → Practice → Drill → Retrieve</span>
          </div>
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
        {state.view === 'concept' && <ConceptScreen />}
        {state.view === 'terminal' && <TerminalScreen />}
        {state.view === 'synthesis' && <SynthesisScreen />}
        {state.view === 'dashboard' && <DashboardScreen />}
        {state.view === 'settings' && <SettingsScreen />}
      </div>

      {isPhone && (
        <nav className="bottom-bar" aria-label="Main navigation">
          <SettingsButton compact />
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
