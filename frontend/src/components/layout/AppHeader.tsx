import React, { useState } from 'react'
import { ThemeToggle } from '../../theme/ThemeToggle'

export type MainSection = 'nutrition' | 'workouts' | 'body' | 'profile'

interface AppHeaderProps {
  activeSection: MainSection
  onSelectSection: (section: MainSection, subTab?: string) => void
  showNav?: boolean
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
  showNav = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="sticky top-0 z-40 w-full bg-surface/90 dark:bg-darkSurface/90 backdrop-blur-md border-b border-sand/80 dark:border-darkBorder transition-colors motion-reduce:transition-none">
      <div className="w-full px-2.5 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Branding & Section Title (Matching "Primary Dashboard" in Reference Image) */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center font-bold shadow-md shrink-0"
            aria-hidden="true"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-coral dark:text-darkCoral"
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
          <div className="text-left">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary block leading-tight">
              Primary
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-sm sm:text-lg tracking-tight text-ink dark:text-darkInk">
                FitPulse
              </span>
              <span className="hidden sm:inline text-xs text-sand dark:text-darkBorder">•</span>
              <span className="hidden sm:inline font-bold text-xs sm:text-sm text-midnight dark:text-darkMidnight">
                Dashboard
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar Pill (Matching Search in Reference Image) */}
        <div className="hidden lg:flex items-center flex-1 max-w-sm mx-4">
          <div className="relative w-full">
            <input
              id="global-search"
              name="global-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search metrics, routines, foods..."
              aria-label="Search dashboard"
              className="w-full pl-9 pr-4 py-2 rounded-2xl text-xs bg-canvas/80 dark:bg-darkCanvas/80 border border-sand dark:border-darkBorder text-ink dark:text-darkInk placeholder:text-inkSecondary/60 focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle shadow-xs transition"
            />
            <svg
              className="w-4 h-4 text-inkSecondary absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Primary Navigation & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showNav && (
            <nav
              aria-label="Main Navigation"
              className="flex items-center bg-canvas/80 dark:bg-darkCanvas/80 p-1 rounded-2xl border border-sand/70 dark:border-darkBorder/70"
            >
              <ul className="flex items-center gap-1 list-none m-0 p-0">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSection(item.id)}
                        aria-label={item.ariaLabel}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex items-center justify-center gap-1.5 min-h-[48px] px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle ${
                          isActive
                            ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                            : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk hover:bg-mist/40 dark:hover:bg-darkMist/40'
                        }`}
                      >
                        <span className="w-4 h-4 flex items-center justify-center shrink-0" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="hidden sm:inline">{item.desktopLabel}</span>
                        {isActive && (
                          <span className="sr-only"> (current page)</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}

          {/* Theme Toggle & User Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />

            {/* Profile Avatar Badge (Matching Reference Image Avatar) */}
            <button
              type="button"
              onClick={() => onSelectSection('profile')}
              aria-label="User Account"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center font-bold text-xs shadow-xs border border-white/10 hover:opacity-90 transition cursor-pointer relative shrink-0"
            >
              <span>FP</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 ring-2 ring-surface dark:ring-darkSurface" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
