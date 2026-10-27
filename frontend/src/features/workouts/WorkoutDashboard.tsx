import { useEffect, useState } from 'react'
import { ExerciseCatalogueView } from './ExerciseCatalogueView'
import { TrainingProfileView } from './TrainingProfileView'
import { WorkoutPlannerView } from './WorkoutPlannerView'
import { WorkoutLogView } from './WorkoutLogView'
import { WorkoutAnalyticsView } from './WorkoutAnalyticsView'
import { workoutExecutionService } from '../../services/workoutExecutionService'

type WorkoutSubTab = 'catalogue' | 'profile' | 'planner' | 'log' | 'progress'

export function WorkoutDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<WorkoutSubTab>('catalogue')
  const [hasUnsavedWorkoutChanges, setHasUnsavedWorkoutChanges] = useState(false)
  const [pendingSubTab, setPendingSubTab] = useState<WorkoutSubTab | null>(null)
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false)

  // Escape key handler for modal
  useEffect(() => {
    if (!showNavigationConfirm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNavigationConfirm(false)
        setPendingSubTab(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showNavigationConfirm])

  const handleStartPlannedSession = async (plannedSessionId: number) => {
    try {
      await workoutExecutionService.startSession({
        planned_session_id: plannedSessionId,
      })
      setActiveSubTab('log')
    } catch {
      setActiveSubTab('log')
    }
  }

  const handleSubTabClick = (targetTab: WorkoutSubTab) => {
    if (targetTab === activeSubTab) return

    // If active workout runner has unsaved changes and user is on the log tab
    if (activeSubTab === 'log' && hasUnsavedWorkoutChanges) {
      setPendingSubTab(targetTab)
      setShowNavigationConfirm(true)
      return
    }

    setActiveSubTab(targetTab)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header Card */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-inkSecondary">
              Training & Performance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Workouts & Training
          </h1>
          <p className="text-xs sm:text-sm text-inkSecondary mt-1 max-w-xl">
            Exercise catalogue, individualized workout routines, live session execution, and performance tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-surfaceMuted border border-edge text-xs font-semibold text-inkSecondary flex items-center gap-2">
            <span className="text-brand font-bold">Overload</span>
            <span className="text-inkMuted">•</span>
            <span>RPE & Sets</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-edge pb-2">
        <nav
          aria-label="Workout navigation"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            aria-current={activeSubTab === 'catalogue' ? 'page' : undefined}
            onClick={() => handleSubTabClick('catalogue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
              activeSubTab === 'catalogue'
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Exercise Catalogue</span>
          </button>

          <button
            type="button"
            aria-current={activeSubTab === 'profile' ? 'page' : undefined}
            onClick={() => handleSubTabClick('profile')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
              activeSubTab === 'profile'
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Training Profile</span>
          </button>

          <button
            type="button"
            aria-current={activeSubTab === 'planner' ? 'page' : undefined}
            onClick={() => handleSubTabClick('planner')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
              activeSubTab === 'planner'
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Routines & Planner</span>
          </button>

          <button
            type="button"
            aria-current={activeSubTab === 'log' ? 'page' : undefined}
            onClick={() => handleSubTabClick('log')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
              activeSubTab === 'log'
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Workout Log</span>
          </button>

          <button
            type="button"
            aria-current={activeSubTab === 'progress' ? 'page' : undefined}
            onClick={() => handleSubTabClick('progress')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
              activeSubTab === 'progress'
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span>Progress & Analytics</span>
          </button>
        </nav>
      </div>

      {/* Sub-tab view rendering */}
      <div>
        {activeSubTab === 'catalogue' && <ExerciseCatalogueView />}

        {activeSubTab === 'profile' && <TrainingProfileView />}

        {activeSubTab === 'planner' && (
          <WorkoutPlannerView onStartWorkoutSession={handleStartPlannedSession} />
        )}

        {activeSubTab === 'log' && (
          <WorkoutLogView
            onNavigateToPlanner={() => handleSubTabClick('planner')}
            onUnsavedChangesChange={setHasUnsavedWorkoutChanges}
          />
        )}

        {activeSubTab === 'progress' && <WorkoutAnalyticsView />}
      </div>

      {/* Unsaved Workout Changes Modal */}
      {showNavigationConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-workout-changes-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-surface border border-edge rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <h3 id="unsaved-workout-changes-title" className="text-base font-bold text-ink">
              Unsaved Workout Changes
            </h3>
            <p className="text-xs text-inkSecondary leading-relaxed">
              You have unsaved workout changes. Leaving the workout runner tab may delay saving or require restoring from your local draft. Are you sure you want to navigate away?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNavigationConfirm(false)
                  setPendingSubTab(null)
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised hover:text-ink transition cursor-pointer"
              >
                Stay on Workout
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingSubTab) {
                    setActiveSubTab(pendingSubTab)
                  }
                  setShowNavigationConfirm(false)
                  setPendingSubTab(null)
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-status-warning-fg hover:opacity-90 text-white shadow-xs cursor-pointer transition"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
