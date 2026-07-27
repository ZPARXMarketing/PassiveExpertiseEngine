import { AppProvider, useApp } from './state/AppContext'
import { TabBar } from './components/TabBar'
import { FeedScreen } from './components/FeedScreen'
import { MapScreen } from './components/MapScreen'
import { YouScreen } from './components/YouScreen'
import { StoryPlayer } from './components/StoryPlayer'
import { TutorSheet } from './components/TutorSheet'
import { ConstellationView } from './components/ConstellationView'
import { OnboardingScreen } from './components/OnboardingScreen'
import { Toast } from './components/Toast'

function Shell() {
  const { state } = useApp()

  if (!state.onboarded) {
    return (
      <div className="app-bg">
        <div className="phone">
          <OnboardingScreen />
          <Toast />
        </div>
      </div>
    )
  }

  return (
    <div className="app-bg">
      <div className="phone">
        {state.tab === 'feed' && <FeedScreen />}
        {state.tab === 'map' && <MapScreen />}
        {state.tab === 'you' && <YouScreen />}
        <TabBar />
        {state.constellationUnitId && <ConstellationView unitId={state.constellationUnitId} />}
        {state.player && <StoryPlayer />}
        {state.player && state.tutorFromBeat !== null && <TutorSheet />}
        <Toast />
      </div>
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
