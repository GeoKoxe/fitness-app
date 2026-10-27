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

  // Escape key handling for detail modal
  useEffect(() => {
    if (!selectedLogForDetail) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLogForDetail(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLogForDetail])

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
      <div className="bg-surface border border-edge rounded-2xl p-12 text-center space-y-4">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-inkSecondary">Loading workout logs...</p>
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
    <div className="space-y-6 text-left">
      {/* Top Header */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Workout Log & Session History
            </h2>
            <p className="text-xs text-inkSecondary mt-1 max-w-xl leading-relaxed">
              Review completed training sessions, track execution consistency, or launch a quick session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToPlanner && (
              <button
                type="button"
                onClick={onNavigateToPlanner}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Go to Weekly Planner
              </button>
            )}

            <button
              type="button"
              onClick={handleStartCustomWorkout}
              disabled={startingSession}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{startingSession ? 'Starting...' : 'Start Custom Workout'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border rounded-xl text-xs text-status-danger-fg">
            {error}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-edge pb-3">
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'completed', 'cancelled'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-1.5 rounded-xl capitalize font-semibold transition cursor-pointer border ${
                statusFilter === filter
                  ? 'bg-brand text-white border-brand shadow-xs'
                  : 'bg-surface border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <span className="text-xs text-inkSecondary">
          {filteredHistory.length} {filteredHistory.length === 1 ? 'workout' : 'workouts'} recorded
        </span>
      </div>

      {/* History Cards */}
      {filteredHistory.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-surfaceMuted border border-edge text-inkSecondary flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-bold text-ink text-sm">
            No Workouts in Log
          </h3>
          <p className="text-xs text-inkSecondary max-w-sm mx-auto leading-relaxed">
            Start a workout from your Weekly Planner or click &quot;Start Custom Workout&quot; to log your sets in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredHistory.map((item) => {
            const isCompleted = item.status === 'completed'
            const durationMins = Math.round(item.duration_seconds / 60)
            const dateStr = item.started_at ? item.started_at.slice(0, 10) : ''

            return (
              <div
                key={item.id}
                className="bg-surface border border-edge rounded-2xl p-5 shadow-xs hover:border-brand/40 transition space-y-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-inkSecondary block">
                      {dateStr}
                    </span>
                    <h3 className="font-bold text-sm text-ink mt-0.5">
                      {item.session_name}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${
                      isCompleted
                        ? 'bg-status-success-bg text-status-success-fg border-status-success-border'
                        : 'bg-status-danger-bg text-status-danger-fg border-status-danger-border'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-inkSecondary pt-1">
                  <span>⏱ {durationMins} min</span>
                  <span>•</span>
                  <span>{item.total_exercises} Exercises</span>
                  <span>•</span>
                  <span>{item.completed_sets} Sets Finished</span>
                </div>

                <div className="pt-2.5 border-t border-edge flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleViewLogDetail(item.id)}
                    className="text-xs font-semibold text-brand hover:underline cursor-pointer"
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
          aria-labelledby="workout-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-surface border border-edge rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-left">
            <div className="flex items-start justify-between border-b border-edge pb-3">
              <div>
                <span className="text-[10px] font-mono text-inkSecondary">
                  {selectedLogForDetail.started_at.slice(0, 10)}
                </span>
                <h3 id="workout-detail-title" className="text-base font-bold text-ink">
                  {selectedLogForDetail.session_name}
                </h3>
                <span
                  className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${
                    selectedLogForDetail.status === 'completed'
                      ? 'bg-status-success-bg text-status-success-fg border-status-success-border'
                      : 'bg-status-danger-bg text-status-danger-fg border-status-danger-border'
                  }`}
                >
                  {selectedLogForDetail.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                aria-label="Close dialog"
                className="p-1 rounded-lg text-inkSecondary hover:text-ink hover:bg-surfaceMuted transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List of performed exercises and sets */}
            <div className="space-y-3">
              {selectedLogForDetail.exercises.map((ex) => (
                <div
                  key={ex.id || ex.order_in_session}
                  className="p-3.5 rounded-xl border border-edge bg-surfaceMuted space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">
                      {ex.exercise_name}
                    </span>
                    <span className="text-[10px] text-inkSecondary capitalize">
                      {ex.primary_muscle}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    {ex.sets.map((set) => (
                      <div
                        key={set.set_number}
                        className={`p-2 rounded-lg text-center border ${
                          set.is_completed
                            ? 'bg-status-success-bg text-status-success-fg border-status-success-border'
                            : 'bg-surface text-inkSecondary border-edge'
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-surfaceMuted border border-edge text-ink hover:bg-surfaceRaised transition cursor-pointer"
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
