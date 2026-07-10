import { useApp } from '../state/AppContext'
import type { Tab } from '../state/AppContext'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'feed',
    label: 'Feed',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="7" rx="2" />
        <rect x="4" y="15" width="16" height="5" rx="2" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="6" cy="6" r="2.4" />
        <circle cx="17" cy="9" r="2.4" />
        <circle cx="10" cy="18" r="2.4" />
        <path d="M8 7.2 14.8 8.4M15.8 11.1 11.2 16M7 8.2l2.2 7.6" />
      </svg>
    ),
  },
  {
    id: 'you',
    label: 'You',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
  },
]

export function TabBar() {
  const { state, dispatch } = useApp()
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab${state.tab === t.id ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'setTab', tab: t.id })}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}
