import { useCallback, useEffect, useState } from 'react'
import type {
  WorkoutSessionLog,
  WorkoutSessionLogSummary,
} from '../../types/workoutLog'
import { workoutExecutionService } from '../../services/workoutExecutionService'
import { ActiveWorkoutSessionRunner } from './ActiveWorkoutSessionRunner'

interface WorkoutLogViewProps {
  onUnsavedChangesChange?: ((isDirty: boolean) => void) | undefined
  onNavigateToPlanner?: (() => void) | undefined
}

export function WorkoutLogView({
  onNavigateToPlanner,
  onUnsavedChangesChange,
}: WorkoutLogViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Active in-progress session
  const [activeSession, setActiveSession] = useState<WorkoutSessionLog | null>(null)

  // History state
  const [historyLogs, setHistoryLogs] = useState<WorkoutSessionLogSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<WorkoutSessionLog | null>(null)

  // Starting a new session loading
  const [startingSession, setStartingSession] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [active, history] = await Promise.all([
        workoutExecutionService.getActiveSession(),
        workoutExecutionService.listSessions(),
      ])
      setActiveSession(active)
      setHistoryLogs(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout logs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Start custom session
  const handleStartCustomWorkout = async () => {
    setStartingSession(true)
    setError(null)
    try {
      const newSession = await workoutExecutionService.startSession({
        session_name: 'Custom Strength Session',
      })
      setActiveSession(newSession)
    } catch (err) {
      try {
        const active = await workoutExecutionService.getActiveSession()
        if (active) {
          setActiveSession(active)
          return
        }
      } catch {
        // Fall back to original error
      }
      setError(err instanceof Error ? err.message : 'Failed to start workout.')
    } finally {
      setStartingSession(false)
    }
  }

  // View details of historical log
  const handleViewLogDetail = async (id: number) => {
    try {
      const fullLog = await workoutExecutionService.getSessionById(id)
      setSelectedLogForDetail(fullLog)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log details.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading workout logs...</p>
      </div>
    )
  }

  // If there is an active session, render the active workout runner
  if (activeSession) {
    return (
      <ActiveWorkoutSessionRunner
        initialSession={activeSession}
        onUnsavedChangesChange={onUnsavedChangesChange}
        onFinishOrCancel={() => {
          setActiveSession(null)
          void loadData()
        }}
      />
    )
  }

  const filteredHistory = historyLogs.filter((log) => {
    if (statusFilter === 'all') return true
    return log.status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Workout Log & Session History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
              Review completed training sessions, track execution consistency, or launch a quick session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToPlanner && (
              <button
                type="button"
                onClick={onNavigateToPlanner}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Go to Weekly Planner
              </button>
            )}

            <button
              type="button"
              onClick={handleStartCustomWorkout}
              disabled={startingSession}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{startingSession ? 'Starting...' : 'Start Custom Workout'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'completed', 'cancelled'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                statusFilter === filter
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400">
          {filteredHistory.length} {filteredHistory.length === 1 ? 'workout' : 'workouts'} recorded
        </span>
      </div>

      {/* History Cards */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            No Workouts in Log
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Start a workout from your Weekly Planner or click &quot;Start Custom Workout&quot; to log your sets in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredHistory.map((item) => {
            const isCompleted = item.status === 'completed'
            const durationMins = Math.round(item.duration_seconds / 60)
            const dateStr = item.started_at ? item.started_at.slice(0, 10) : ''

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {dateStr}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                      {item.session_name}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span>⏱ {durationMins} min</span>
                  <span>•</span>
                  <span>{item.total_exercises} Exercises</span>
                  <span>•</span>
                  <span>{item.completed_sets} Sets Finished</span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleViewLogDetail(item.id)}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Historical Detail Modal */}
      {selectedLogForDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400">
                  {selectedLogForDetail.started_at.slice(0, 10)}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedLogForDetail.session_name}
                </h3>
                <span
                  className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    selectedLogForDetail.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {selectedLogForDetail.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {/* List of performed exercises and sets */}
            <div className="space-y-3">
              {selectedLogForDetail.exercises.map((ex) => (
                <div
                  key={ex.id || ex.order_in_session}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {ex.exercise_name}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {ex.primary_muscle}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    {ex.sets.map((set) => (
                      <div
                        key={set.set_number}
                        className={`p-2 rounded-lg text-center ${
                          set.is_completed
                            ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-200/60 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        <span className="text-[10px] block opacity-70">
                          Set {set.set_number}
                        </span>
                        <span className="font-bold text-xs">
                          {set.weight_kg !== null && set.weight_kg !== undefined
                            ? `${set.weight_kg}kg × `
                            : 'BW × '}
                          {set.reps ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
