import { useEffect, useState } from 'react'
import type {
  LoggedExercise,
  WorkoutSessionLog,
} from '../../types/workoutLog'
import { workoutExecutionService } from '../../services/workoutExecutionService'

interface ActiveWorkoutSessionRunnerProps {
  initialSession: WorkoutSessionLog
  onFinishOrCancel: () => void
}

export function ActiveWorkoutSessionRunner({
  initialSession,
  onFinishOrCancel,
}: ActiveWorkoutSessionRunnerProps) {
  const [session, setSession] = useState<WorkoutSessionLog>(initialSession)
  const [duration, setDuration] = useState<number>(initialSession.duration_seconds || 0)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true)

  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Dialogs
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // Live workout timer
  useEffect(() => {
    if (!isTimerRunning) return
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isTimerRunning])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate completion statistics
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.is_completed && !s.is_skipped).length,
    0
  )
  const skippedSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.is_skipped).length,
    0
  )
  const pendingSets = totalSets - completedSets - skippedSets
  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0

  // Mutate set field locally
  const handleUpdateSet = (
    exOrder: number,
    setNumber: number,
    field: 'weight_kg' | 'reps' | 'is_completed' | 'is_skipped' | 'notes',
    value: unknown
  ) => {
    setError(null)
    setSession((prev) => {
      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.order_in_session !== exOrder) return ex

        const updatedSets = ex.sets.map((s) => {
          if (s.set_number !== setNumber) return s

          if (field === 'is_completed') {
            const completed = Boolean(value)
            return {
              ...s,
              is_completed: completed,
              is_skipped: completed ? false : s.is_skipped,
            }
          }

          if (field === 'is_skipped') {
            const skipped = Boolean(value)
            return {
              ...s,
              is_skipped: skipped,
              is_completed: skipped ? false : s.is_completed,
            }
          }

          return { ...s, [field]: value }
        })

        return { ...ex, sets: updatedSets }
      })

      return { ...prev, exercises: updatedExercises }
    })
  }

  // Add set to exercise
  const handleAddSet = (exOrder: number) => {
    setSession((prev) => {
      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.order_in_session !== exOrder) return ex
        const nextSetNum = ex.sets.length + 1
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              set_number: nextSetNum,
              weight_kg: ex.sets[ex.sets.length - 1]?.weight_kg ?? null,
              reps: null,
              is_completed: false,
              is_skipped: false,
            },
          ],
        }
      })
      return { ...prev, exercises: updatedExercises }
    })
  }

  // Update exercise notes
  const handleExerciseNotesChange = (exOrder: number, notes: string) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.order_in_session === exOrder ? { ...ex, notes } : ex
      ),
    }))
  }

  // Save partial progress
  const handleSaveProgress = async (silent: boolean = false) => {
    setError(null)
    setSaving(true)
    try {
      const updated = await workoutExecutionService.updateSession(session.id, {
        session_name: session.session_name,
        notes: session.notes ?? undefined,
        duration_seconds: duration,
        exercises: session.exercises,
      })
      setSession(updated)
      if (!silent) {
        setToastMessage('Workout progress saved!')
        setTimeout(() => setToastMessage(null), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save progress.')
    } finally {
      setSaving(false)
    }
  }

  // Complete session
  const handleCompleteWorkout = async () => {
    setActionLoading(true)
    setError(null)
    try {
      // Save current state first
      await workoutExecutionService.updateSession(session.id, {
        duration_seconds: duration,
        exercises: session.exercises,
      })
      await workoutExecutionService.completeSession(session.id)
      onFinishOrCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete workout.')
      setActionLoading(false)
      setShowCompleteConfirm(false)
    }
  }

  // Cancel session
  const handleCancelWorkout = async () => {
    setActionLoading(true)
    setError(null)
    try {
      await workoutExecutionService.cancelSession(session.id)
      onFinishOrCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel workout.')
      setActionLoading(false)
      setShowCancelConfirm(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Sticky / Top Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Active Workout Session
              </span>
              {session.session_focus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                  {session.session_focus}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {session.session_name}
            </h2>
          </div>

          {/* Timer and Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatTimer(duration)}
              </span>
              <button
                type="button"
                onClick={() => setIsTimerRunning((r) => !r)}
                className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 transition"
              >
                {isTimerRunning ? 'Pause' : 'Resume'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSaveProgress(false)}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>

            <button
              type="button"
              onClick={() => setShowCompleteConfirm(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
            >
              Complete Workout
            </button>

            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Progress: <strong className="text-slate-800 dark:text-slate-200">{completedSets}</strong> of {totalSets} sets completed ({progressPercent}%)
            </span>
            {skippedSets > 0 && <span>{skippedSets} skipped</span>}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {toastMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Exercises Set Inputs */}
      <div className="space-y-4">
        {session.exercises.map((ex: LoggedExercise) => (
          <div
            key={ex.order_in_session}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4"
          >
            {/* Exercise Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                  {ex.order_in_session}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {ex.exercise_name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 capitalize mt-0.5">
                    <span>{ex.primary_muscle}</span>
                    <span>•</span>
                    <span>{ex.equipment_required}</span>
                    {ex.target_sets && ex.target_reps && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Target: {ex.target_sets} sets × {ex.target_reps} reps
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddSet(ex.order_in_session)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 self-end sm:self-center"
              >
                + Add Set
              </button>
            </div>

            {/* Set by Set Table */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                <span className="col-span-2 sm:col-span-1">Set</span>
                <span className="col-span-4 sm:col-span-3">Weight (kg)</span>
                <span className="col-span-3 sm:col-span-3">Reps</span>
                <span className="col-span-3 sm:col-span-5 text-right sm:text-left">Status</span>
              </div>

              {ex.sets.map((set) => {
                const isBodyweight = ex.equipment_required === 'bodyweight'
                return (
                  <div
                    key={set.set_number}
                    className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition ${
                      set.is_completed
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40'
                        : set.is_skipped
                        ? 'bg-slate-100/70 dark:bg-slate-800/40 opacity-60'
                        : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="col-span-2 sm:col-span-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                      #{set.set_number}
                    </span>

                    {/* Weight Input */}
                    <div className="col-span-4 sm:col-span-3">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder={isBodyweight ? 'BW' : 'kg'}
                        aria-label={`Set ${set.set_number} weight in kg`}
                        value={set.weight_kg ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseFloat(e.target.value)
                          handleUpdateSet(ex.order_in_session, set.set_number, 'weight_kg', val)
                        }}
                        className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Reps Input */}
                    <div className="col-span-3 sm:col-span-3">
                      <input
                        type="number"
                        min="0"
                        placeholder="Reps"
                        aria-label={`Set ${set.set_number} reps`}
                        value={set.reps ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                          handleUpdateSet(ex.order_in_session, set.set_number, 'reps', val)
                        }}
                        className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Complete & Skip Toggles */}
                    <div className="col-span-3 sm:col-span-5 flex items-center justify-end sm:justify-start gap-1.5">
                      <button
                        type="button"
                        aria-label={`Mark set ${set.set_number} as ${set.is_completed ? 'incomplete' : 'complete'}`}
                        onClick={() => {
                          handleUpdateSet(
                            ex.order_in_session,
                            set.set_number,
                            'is_completed',
                            !set.is_completed
                          )
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                          set.is_completed
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {set.is_completed ? '✓ Done' : 'Complete'}
                      </button>

                      <button
                        type="button"
                        aria-label={`Skip set ${set.set_number}`}
                        onClick={() => {
                          handleUpdateSet(
                            ex.order_in_session,
                            set.set_number,
                            'is_skipped',
                            !set.is_skipped
                          )
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                          set.is_skipped
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Exercise Notes */}
            <input
              type="text"
              placeholder="Notes on this movement (tempo, pain-free ROM, RPE...)"
              value={ex.notes || ''}
              onChange={(e) => handleExerciseNotesChange(ex.order_in_session, e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* Confirmation Modal: Cancel Workout */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Cancel Active Workout?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to cancel? Cancelled workouts are archived in history as cancelled and do not count toward completed sessions.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Working Out
              </button>
              <button
                type="button"
                onClick={handleCancelWorkout}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Complete Workout */}
      {showCompleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Finish and Complete Workout?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Summary: <strong className="text-emerald-600">{completedSets}</strong> of {totalSets} sets marked completed.
              {pendingSets > 0 && ` You have ${pendingSets} pending sets remaining.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Continue Workout
              </button>
              <button
                type="button"
                onClick={handleCompleteWorkout}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
              >
                {actionLoading ? 'Saving...' : 'Finish Workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

