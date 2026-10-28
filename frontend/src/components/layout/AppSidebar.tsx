import React, { useEffect, useState } from 'react'
import type { MainSection } from './AppHeader'
import { ThemeToggle } from '../../theme/ThemeToggle'

export interface ShelfItem {
  id: string
  label: string
  description?: string
  section: MainSection
  subTab?: string
  icon?: React.ReactNode
}

export interface CategoryShelf {
  id: MainSection
  categoryName: string
  categoryIcon: React.ReactNode
  badge?: string
  items: ShelfItem[]
}

export const CATEGORY_SHELVES: CategoryShelf[] = [
  {
    id: 'nutrition',
    categoryName: 'Food & Nutrition',
    badge: 'Nutrition',
    categoryIcon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    items: [
      { id: 'daily-log', label: 'Daily Food Log', description: 'Macro summary & meal entries', section: 'nutrition', subTab: 'daily-log' },
      { id: 'goals', label: 'Goals & Macro Reports', description: 'Calorie adherence & nutritional analytics', section: 'nutrition', subTab: 'goals' },
      { id: 'meal-planner', label: '7-Day Meal Planner', description: 'Smart recipe scheduling & nutrition targets', section: 'nutrition', subTab: 'meal-planner' },
      { id: 'shopping-list', label: 'Smart Shopping List', description: 'Aggregated grocery checklist & export', section: 'nutrition', subTab: 'shopping-list' },
      { id: 'food-search', label: 'Food Database', description: 'Open Food Facts search & custom builder', section: 'nutrition', subTab: 'food-search' },
    ],
  },
  {
    id: 'workouts',
    categoryName: 'Workouts',
    badge: 'Training',
    categoryIcon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    items: [
      { id: 'planner', label: 'Weekly Routines & Planner', description: '7-day plan, split targets & alternatives', section: 'workouts', subTab: 'planner' },
      { id: 'log', label: 'Workout Log & Runner', description: 'Active session runner & completed history', section: 'workouts', subTab: 'log' },
      { id: 'catalogue', label: 'Exercise Catalogue', description: '200+ movements, muscles & equipment', section: 'workouts', subTab: 'catalogue' },
      { id: 'profile', label: 'Training Profile', description: 'Split schedule, presets & exclusions', section: 'workouts', subTab: 'profile' },
      { id: 'progress', label: 'Performance Analytics', description: '1RM progression & overload recommendations', section: 'workouts', subTab: 'progress' },
    ],
  },
  {
    id: 'body',
    categoryName: 'Body & Measurements',
    badge: 'Home',
    categoryIcon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    items: [
      { id: 'overview', label: 'Primary Overview', description: 'Composition snapshot & hero trendline', section: 'body', subTab: 'overview' },
      { id: 'log', label: 'Log Measurement', description: 'Record weight, body fat & circumferences', section: 'body', subTab: 'log' },
      { id: 'history', label: 'Measurement History', description: 'Chronological records & detail log', section: 'body', subTab: 'history' },
      { id: 'trends', label: 'Measurement Trends', description: 'Long-term graphical trajectory', section: 'body', subTab: 'trends' },
    ],
  },
  {
    id: 'profile',
    categoryName: 'Profile',
    badge: 'Account',
    categoryIcon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    items: [
      { id: 'profile-info', label: 'Personal Details', description: 'Height, sex, age & activity multiplier', section: 'profile', subTab: 'profile-info' },
      { id: 'backup', label: 'Data Backup & Restore', description: 'Complete v2.0 JSON export & safety recovery', section: 'profile', subTab: 'backup' },
    ],
  },
]

interface AppSidebarProps {
  activeSection: MainSection
  onSelectSection: (section: MainSection, subTab?: string) => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const [shelfOpen, setShelfOpen] = useState(false)
  const [selectedShelfId, setSelectedShelfId] = useState<MainSection>(activeSection)

  // Sync selected shelf with active section when active section changes
  useEffect(() => {
    setSelectedShelfId(activeSection)
  }, [activeSection])

  // Escape key closes shelf drawer
  useEffect(() => {
    if (!shelfOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShelfOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shelfOpen])

  const currentShelf: CategoryShelf = CATEGORY_SHELVES.find((s) => s.id === selectedShelfId) ?? CATEGORY_SHELVES[0]!

  return (
    <>
      {/* Unified Responsive Application Dock (Desktop Vertical Left Dock + Mobile Floating Bottom Dock) */}
      <aside
        aria-label="Application Dock"
        className="fixed bottom-3 left-3 right-3 z-40 md:static md:top-6 md:h-[calc(100vh-3rem)] md:max-h-[860px] md:w-20 md:flex-col md:justify-between py-2 px-3 md:py-6 md:px-3 bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas rounded-3xl shadow-2xl border border-white/10 flex items-center justify-between shrink-0 transition-all motion-reduce:transition-none"
      >
        {/* Top: App Brand Icon / Quick Action (Desktop only) */}
        <div className="hidden md:flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => onSelectSection('body', 'overview')}
            aria-label="FitPulse Home"
            className="w-11 h-11 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition shadow-xs cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <svg
              className="w-6 h-6 text-coral dark:text-darkCoral transition-transform group-hover:scale-110"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </button>
        </div>

        {/* Center: Main Categorized Navigation Dock */}
        <nav
          aria-label="Main Navigation"
          className="flex md:flex-col items-center justify-around md:justify-center gap-1 md:gap-3 w-full"
        >
          {CATEGORY_SHELVES.map((shelf) => {
            const isActive = activeSection === shelf.id
            const isShelfViewing = selectedShelfId === shelf.id && shelfOpen

            return (
              <div key={shelf.id} className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSection(shelf.id)
                    setSelectedShelfId(shelf.id)
                  }}
                  aria-label={shelf.categoryName}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[48px] w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner ring-1 ring-white/30'
                      : isShelfViewing
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center shrink-0">
                    {shelf.categoryIcon}
                  </span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="hidden md:block absolute left-1 w-1 h-3.5 rounded-full bg-coral dark:bg-darkCoral"
                    />
                  )}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="md:hidden absolute bottom-1 w-3.5 h-1 rounded-full bg-coral dark:bg-darkCoral"
                    />
                  )}
                </button>

                {/* Desktop Hover Tooltip */}
                <div className="hidden md:block absolute left-full ml-3 px-2.5 py-1.5 rounded-xl bg-ink text-white dark:bg-darkSurface dark:text-darkInk border border-white/10 text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  {shelf.categoryName}
                  {shelf.badge && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-coral/20 text-coral dark:text-darkCoral">
                      {shelf.badge}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Bottom (Desktop) / End (Mobile): Shelf Drawer Toggle */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShelfOpen((prev) => !prev)}
            aria-label={shelfOpen ? 'Close Categorized Menu' : 'Open Categorized Menu'}
            aria-expanded={shelfOpen}
            className={`min-h-[48px] w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
              shelfOpen
                ? 'bg-coral text-white shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
            }`}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${shelfOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Categorized Shelf Drawer (Desktop Flyout & Mobile Modal Sheet) */}
      {shelfOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shelf-drawer-title"
          className="fixed inset-0 z-50 flex items-end md:items-stretch bg-slate-900/60 backdrop-blur-xs transition-opacity"
        >
          {/* Backdrop dismissal */}
          <div
            className="absolute inset-0"
            onClick={() => setShelfOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Box */}
          <div className="relative z-10 w-full md:w-96 md:ml-28 md:my-6 md:rounded-3xl rounded-t-3xl bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-2xl p-6 flex flex-col max-h-[85vh] md:max-h-[calc(100vh-3rem)] text-left overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-sand/60 dark:border-darkBorder/60">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center font-bold">
                  {currentShelf.categoryIcon}
                </span>
                <div>
                  <h2 id="shelf-drawer-title" className="text-base font-bold text-ink dark:text-darkInk">
                    {currentShelf.categoryName}
                  </h2>
                  <p className="text-xs text-inkSecondary dark:text-darkInkSecondary">
                    Categorized features &amp; shelved views
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShelfOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-xl text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk hover:bg-mist/40 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Category Shelf Switcher Tabs */}
            <div className="grid grid-cols-4 gap-1.5 my-4 p-1 rounded-2xl bg-canvas dark:bg-darkCanvas border border-sand/60 dark:border-darkBorder">
              {CATEGORY_SHELVES.map((shelf) => {
                const isSelected = selectedShelfId === shelf.id
                return (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => setSelectedShelfId(shelf.id)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      isSelected
                        ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                        : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
                    }`}
                  >
                    <span className="w-4 h-4">{shelf.categoryIcon}</span>
                    <span className="text-[10px] truncate max-w-full">
                      {shelf.id === 'body' ? 'Body' : shelf.id === 'workouts' ? 'Workouts' : shelf.id === 'nutrition' ? 'Food' : 'Profile'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Shelved Items List */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary block mb-1">
                Shelved Views in {currentShelf.categoryName}
              </span>
              {currentShelf.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.section, item.subTab)
                    setShelfOpen(false)
                  }}
                  className="w-full text-left p-3.5 rounded-2xl border border-sand/70 dark:border-darkBorder bg-canvas/60 dark:bg-darkCanvas/60 hover:bg-surface dark:hover:bg-darkSurface hover:border-midnight/30 dark:hover:border-darkMidnight/50 transition cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <h3 className="text-xs font-bold text-ink dark:text-darkInk group-hover:text-midnight dark:group-hover:text-darkMidnight">
                      {item.label}
                    </h3>
                    {item.description && (
                      <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="w-6 h-6 rounded-lg bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder text-inkSecondary flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    &rarr;
                  </span>
                </button>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 mt-4 border-t border-sand/60 dark:border-darkBorder flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
                  Theme mode
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShelfOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-midnight text-white hover:bg-midnightHover dark:bg-darkMidnight dark:text-white transition cursor-pointer"
              >
                Close Shelf
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
