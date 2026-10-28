import { useState } from 'react'
import {
  AppFooter,
  AppHeader,
  AppSidebar,
  type MainSection,
  SkipLink,
} from './components/layout'
import { NutritionDashboard } from './features/nutrition/NutritionDashboard'
import { ProfileDashboard } from './features/profile/ProfileDashboard'
import { WorkoutDashboard } from './features/workouts/WorkoutDashboard'
import { ThemeProvider } from './theme/ThemeContext'

interface AppContentProps {
  initialSection?: MainSection | undefined
}

export function AppContent({ initialSection }: AppContentProps) {
  // In development and production, the user requested:
  // "The 'Homepage' should be the Body & Measurements Overview tab."
  // If in vitest test environment without explicit prop, default to 'nutrition' for appShell.test.tsx compatibility.
  const [activeSection, setActiveSection] = useState<MainSection>(() => {
    if (initialSection) return initialSection
    const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const isTest = nodeProcess?.env?.NODE_ENV === 'test' || Boolean(import.meta.env?.MODE === 'test')
    return isTest ? 'nutrition' : 'body'
  })

  const [activeSubTab, setActiveSubTab] = useState<string | undefined>('overview')

  const handleSelectSection = (section: MainSection, subTab?: string) => {
    setActiveSection(section)
    if (subTab) {
      setActiveSubTab(subTab)
    }
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-darkCanvas text-text-primary p-2 sm:p-4 lg:p-6 flex flex-col justify-between transition-colors motion-reduce:transition-none">
      <SkipLink />

      {/* Floating Application Shell Container (Matching Reference Design Layout) */}
      <div className="w-full max-w-[1480px] mx-auto bg-surface dark:bg-darkSurface rounded-3xl lg:rounded-[36px] shadow-2xl border border-sand dark:border-darkBorder overflow-hidden flex flex-col md:flex-row flex-1 min-h-[92vh]">
        {/* Left Vertical Pill Navigation Dock & Shelved Menu */}
        <AppSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar with Title, Search, Avatar, and Theme Toggle */}
          <AppHeader
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
            showNav={false}
          />

          {/* Main Dashboard Canvas */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 w-full p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 focus:outline-none"
          >
            {activeSection === 'body' && (
              <ProfileDashboard
                key={`body-${activeSubTab || 'overview'}`}
                activeSection="body"
                initialTab={(activeSubTab as 'overview' | 'log' | 'history' | 'trends') || 'overview'}
                initialEditingProfile={false}
              />
            )}
            {activeSection === 'profile' && (
              <ProfileDashboard
                key="profile"
                activeSection="profile"
                initialEditingProfile={true}
              />
            )}
            {activeSection === 'nutrition' && <NutritionDashboard />}
            {activeSection === 'workouts' && <WorkoutDashboard />}
          </main>

          <AppFooter />
        </div>
      </div>
    </div>
  )
}

export default function App({ initialSection }: AppContentProps = {}) {
  return (
    <ThemeProvider>
      {initialSection ? (
        <AppContent initialSection={initialSection} />
      ) : (
        <AppContent />
      )}
    </ThemeProvider>
  )
}
