import { useEffect, useState } from 'react'
import { AppProvider, useApp, type AppView } from './state/AppContext'
import { DomainsHome } from './components/DomainsHome'
import { FeedScreen } from './components/FeedScreen'
import { PathsScreen } from './components/PathsScreen'
import { ConceptScreen } from './components/ConceptScreen'
import { TerminalScreen } from './components/TerminalScreen'
import { RetrievalScreen } from './components/RetrievalScreen'
import { ProgressScreen } from './components/ProgressScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { DrillOverlay } from './components/DrillOverlay'
import { Toast } from './components/Toast'
import { liveStreak, rankFor } from './data/rank'

const NAV: { id: AppView; label: string; stage: string }[] = [
  { id: 'feed', label: 'Feed', stage: 'today' },
  { id: 'paths', label: 'Paths', stage: 'roadmap' },
  { id: 'progress', label: 'Progress', stage: 'identity' },
  { id: 'domains', label: 'Domains', stage: 'library' },
]

/** Views that live under a nav entry rather than having one of their own. */
const NESTED: Partial<Record<AppView, AppView>> = {
  concept: 'paths',
  terminal: 'feed',
  retrieval: 'feed',
}

function NavItems({ compact }: { compact?: boolean }) {
  const { state, dispatch } = useApp()
  return (
    <>
      {NAV.map((item) => {
        const active = state.view === item.id || NESTED[state.view] === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'setView', view: item.id })}
          >
            <span className="nav-label">{item.label}</span>
            {!compact && <span className="nav-stage">{item.stage}</span>}
          </button>
        )
      })}
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

function DomainSwitcher({ placement }: { placement: 'rail' | 'header' }) {
  const { state, activeDomain, dispatch } = useApp()
  if (state.domains.length === 0) return null
  return (
    <label className={`subject-switcher ${placement}`}>
      <span className="switcher-label">Active domain</span>
      <select
        value={state.activeDomainId ?? ''}
        onChange={(e) => dispatch({ type: 'setActiveDomain', id: e.target.value })}
      >
        {state.domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </select>
      {activeDomain && (
        <span className="switcher-meta">
          {rankFor(activeDomain.progress.xp).label} · {liveStreak(activeDomain.progress)}d streak
        </span>
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
              <div className="brand-name">Domain Engine</div>
              <div className="brand-sub">level a knowledge character</div>
            </div>
          </div>
          <DomainSwitcher placement="rail" />
          <nav className="rail-nav">
            <NavItems />
          </nav>
          <div className="rail-foot">
            <SettingsButton />
            <span>Feed → dose → frontier → rank</span>
          </div>
        </aside>
      )}

      <div className="shell-main">
        {isPhone && state.view !== 'domains' && (
          <div className="mobile-switcher">
            <DomainSwitcher placement="header" />
          </div>
        )}
        {state.view === 'domains' && <DomainsHome />}
        {state.view === 'feed' && <FeedScreen />}
        {state.view === 'paths' && <PathsScreen />}
        {state.view === 'concept' && <ConceptScreen />}
        {state.view === 'terminal' && <TerminalScreen />}
        {state.view === 'retrieval' && <RetrievalScreen />}
        {state.view === 'progress' && <ProgressScreen />}
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
