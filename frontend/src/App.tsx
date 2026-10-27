import { useState } from 'react'
import {
  AppFooter,
  AppHeader,
  type MainSection,
  SkipLink,
} from './components/layout'
import { NutritionDashboard } from './features/nutrition/NutritionDashboard'
import { ProfileDashboard } from './features/profile/ProfileDashboard'
import { WorkoutDashboard } from './features/workouts/WorkoutDashboard'
import { ThemeProvider } from './theme/ThemeContext'

export function AppContent() {
  const [activeSection, setActiveSection] = useState<MainSection>('nutrition')

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary transition-colors motion-reduce:transition-none">
      <SkipLink />
      <AppHeader
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-8 focus:outline-none"
      >
        {activeSection === 'profile' && (
          <ProfileDashboard
            key="profile"
            activeSection="profile"
            initialEditingProfile={true}
          />
        )}
        {activeSection === 'body' && (
          <ProfileDashboard
            key="body"
            activeSection="body"
            initialTab="overview"
            initialEditingProfile={false}
          />
        )}
        {activeSection === 'nutrition' && <NutritionDashboard />}
        {activeSection === 'workouts' && <WorkoutDashboard />}
      </main>

      <AppFooter />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
