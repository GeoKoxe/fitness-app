import { useState } from 'react'
import { ExerciseCatalogueView } from './ExerciseCatalogueView'
import { TrainingProfileView } from './TrainingProfileView'
import { WorkoutPlannerView } from './WorkoutPlannerView'
import { WorkoutLogView } from './WorkoutLogView'
import { WorkoutAnalyticsView } from './WorkoutAnalyticsView'
import { workoutExecutionService } from '../../services/workoutExecutionService'

type WorkoutSubTab = 'catalogue' | 'profile' | 'planner' | 'log' | 'progress'

export function WorkoutDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<WorkoutSubTab>('catalogue')

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Workouts & Training
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exercise catalogue, workout routines, session execution, and performance tracking.
          </p>
        </div>

        <nav aria-label="Workout navigation" className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalogue')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'catalogue'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Exercise Catalogue</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('profile')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'profile'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Training Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('planner')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'planner'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Routines & Planner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('log')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'log'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Workout Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('progress')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'progress'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span>Progress & Analytics</span>
          </button>
        </nav>
      </div>

      {/* Sub-tab view rendering */}
      {activeSubTab === 'catalogue' && <ExerciseCatalogueView />}

      {activeSubTab === 'profile' && <TrainingProfileView />}

      {activeSubTab === 'planner' && (
        <WorkoutPlannerView onStartWorkoutSession={handleStartPlannedSession} />
      )}

      {activeSubTab === 'log' && (
        <WorkoutLogView onNavigateToPlanner={() => setActiveSubTab('planner')} />
      )}

      {activeSubTab === 'progress' && <WorkoutAnalyticsView />}
    </div>
  )
}

