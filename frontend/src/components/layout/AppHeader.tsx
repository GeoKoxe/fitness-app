import React from 'react'
import { ThemeToggle } from '../../theme/ThemeToggle'

export type MainSection = 'nutrition' | 'workouts' | 'body' | 'profile'

interface AppHeaderProps {
  activeSection: MainSection
  onSelectSection: (section: MainSection) => void
}

interface NavItem {
  id: MainSection
  ariaLabel: string
  desktopLabel: string
  mobileLabel: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'nutrition',
    ariaLabel: 'Food & Nutrition',
    desktopLabel: 'Food & Nutrition',
    mobileLabel: 'Nutrition',
    icon: (
      <svg
        className="w-4 h-4 md:w-4 md:h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
        />
      </svg>
    ),
  },
  {
    id: 'workouts',
    ariaLabel: 'Workouts',
    desktopLabel: 'Workouts',
    mobileLabel: 'Workouts',
    icon: (
      <svg
        className="w-4 h-4 md:w-4 md:h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  {
    id: 'body',
    ariaLabel: 'Body & Measurements',
    desktopLabel: 'Body & Measurements',
    mobileLabel: 'Body',
    icon: (
      <svg
        className="w-4 h-4 md:w-4 md:h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    ariaLabel: 'Profile',
    desktopLabel: 'Profile',
    mobileLabel: 'Profile',
    icon: (
      <svg
        className="w-4 h-4 md:w-4 md:h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
]

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-surface/90 dark:bg-darkSurface/90 backdrop-blur-md border-b border-sand dark:border-darkBorder transition-colors motion-reduce:transition-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Application Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-9 h-9 rounded-xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center font-bold shadow-xs shrink-0"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 text-coral dark:text-darkCoral"
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
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg tracking-tight text-ink dark:text-darkInk">
              FitPulse
            </span>
            <span className="hidden lg:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-medium">
              Personal Health &amp; Fitness
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav
          aria-label="Main Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 dark:bg-darkSurface/95 backdrop-blur-md border-t border-sand dark:border-darkBorder pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:bg-canvas/80 md:dark:bg-darkCanvas/80 md:border md:border-sand/60 md:dark:border-darkBorder/60 md:pb-0 md:rounded-2xl transition-colors motion-reduce:transition-none shadow-lg md:shadow-none"
        >
          <ul className="flex items-center justify-around md:justify-start gap-1 p-1 list-none m-0 w-full max-w-md mx-auto md:max-w-none">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id
              return (
                <li key={item.id} className="flex-1 md:flex-initial">
                  <button
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative w-full md:w-auto flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 min-h-[48px] md:min-h-[38px] px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-offset-darkSurface ${
                      isActive
                        ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                        : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk hover:bg-mist/40 dark:hover:bg-darkMist/40'
                    }`}
                  >
                    <span
                      className="w-5 h-5 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">
                      <span className="hidden sm:inline">{item.desktopLabel}</span>
                      <span className="sm:hidden">{item.mobileLabel}</span>
                    </span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="md:hidden w-1 h-1 rounded-full bg-coral dark:bg-darkCoral -mt-0.5"
                      />
                    )}
                    {isActive && (
                      <span className="sr-only"> (current page)</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

