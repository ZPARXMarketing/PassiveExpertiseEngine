import { AppProvider, useApp } from './state/AppContext'
import { TabBar } from './components/TabBar'
import { FeedScreen } from './components/FeedScreen'
import { MapScreen } from './components/MapScreen'
import { YouScreen } from './components/YouScreen'
import { StoryPlayer } from './components/StoryPlayer'
import { TutorSheet } from './components/TutorSheet'
import { ConstellationView } from './components/ConstellationView'
import { Onboarding } from './components/Onboarding'
import { CheatSheetView } from './components/CheatSheetView'
import { Toast } from './components/Toast'

function Shell() {
  const { state } = useApp()
  const cheatCourse = state.cheatSheetCourseId
    ? state.mappedCourses.find((c) => c.id === state.cheatSheetCourseId)
    : null

  return (
    <div className="app-bg">
      <div className="phone">
        {state.tab === 'feed' && <FeedScreen />}
        {state.tab === 'map' && <MapScreen />}
        {state.tab === 'you' && <YouScreen />}
        <TabBar />
        {state.constellationUnitId && <ConstellationView unitId={state.constellationUnitId} />}
        {cheatCourse && <CheatSheetView course={cheatCourse} />}
        {state.onboardingOpen && <Onboarding />}
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
