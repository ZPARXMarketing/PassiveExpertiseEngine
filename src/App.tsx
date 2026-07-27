import { AppProvider, useApp } from './state/AppContext'
import { TabBar } from './components/TabBar'
import { FeedScreen } from './components/FeedScreen'
import { MapScreen } from './components/MapScreen'
import { YouScreen } from './components/YouScreen'
import { StoryPlayer } from './components/StoryPlayer'
import { TutorSheet } from './components/TutorSheet'
import { UnitPathView } from './components/UnitPathView'
import { Toast } from './components/Toast'

function Shell() {
  const { state } = useApp()

  return (
    <div className="app-bg">
      <div className="phone">
        {state.tab === 'feed' && <FeedScreen />}
        {state.tab === 'map' && <MapScreen />}
        {state.tab === 'you' && <YouScreen />}
        <TabBar />
        {state.pathUnitId && <UnitPathView unitId={state.pathUnitId} />}
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
