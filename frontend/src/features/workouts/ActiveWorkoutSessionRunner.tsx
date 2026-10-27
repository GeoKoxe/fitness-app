import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  LoggedExercise,
  WorkoutSessionLog,
} from '../../types/workoutLog'
import { ApiError } from '../../services/api'
import { workoutExecutionService } from '../../services/workoutExecutionService'
import {
  calculateElapsedSeconds,
  clearWorkoutDraft,
  formatDuration,
  getDraftKey,
  loadWorkoutDraft,
  saveWorkoutDraft,
  type WorkoutDraftTimerState,
} from './workoutDraftStorage'

interface ActiveWorkoutSessionRunnerProps {
  initialSession: WorkoutSessionLog
  onFinishOrCancel: () => void
  onUnsavedChangesChange?: ((isDirty: boolean) => void) | undefined
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function ActiveWorkoutSessionRunner({
  initialSession,
  onFinishOrCancel,
  onUnsavedChangesChange,
}: ActiveWorkoutSessionRunnerProps) {
  // Load session-scoped draft from localStorage on initial render
  const initialDraft = useRef(loadWorkoutDraft(initialSession.id)).current

  const [session, setSession] = useState<WorkoutSessionLog>(() => {
    if (initialDraft && initialDraft.exercises && initialDraft.exercises.length > 0) {
      return {
        ...initialSession,
        exercises: initialDraft.exercises,
        notes: initialDraft.notes ?? initialSession.notes,
      }
    }
    return initialSession
  })

  const [timerState, setTimerState] = useState<WorkoutDraftTimerState>(() => {
    if (initialDraft && initialDraft.timerState) {
      return initialDraft.timerState
    }
    return {
      isPaused: false,
      accumulatedSeconds: initialSession.duration_seconds || 0,
      intervalStartedAt: Date.now(),
    }
  })

  const [duration, setDuration] = useState<number>(() => {
    if (initialDraft && initialDraft.timerState) {
      return calculateElapsedSeconds(initialDraft.timerState)
    }
    return initialSession.duration_seconds || 0
  })

  const [isDirty, setIsDirty] = useState<boolean>(() => {
    return initialDraft ? Boolean(initialDraft.isDirty) : false
  })

  const [recoveredFromDraft, setRecoveredFromDraft] = useState<boolean>(() => {
    return Boolean(initialDraft && initialDraft.isDirty)
  })

  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => {
    return initialDraft && initialDraft.isDirty ? 'idle' : 'saved'
  })
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [, setLastSavedAt] = useState<Date | null>(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Dialogs
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // Escape key handler for dialogs
  useEffect(() => {
    if (!showCancelConfirm && !showCompleteConfirm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCancelConfirm(false)
        setShowCompleteConfirm(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCancelConfirm, showCompleteConfirm])

  // Refs for race-condition, mutation tracking, and debounce management
  const sessionRef = useRef(session)
  sessionRef.current = session

  const durationRef = useRef(duration)
  durationRef.current = duration

  const timerStateRef = useRef(timerState)
  timerStateRef.current = timerState

  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // Track mutation sequence to prevent older responses from clearing newer unsaved edits
  const mutationSeqRef = useRef<number>(0)

  // Track server version for deterministic optimistic concurrency control (OCC)
  const serverVersionRef = useRef<number>(initialSession.version ?? 1)
  const lastKnownServerUpdatedAtRef = useRef<string | null>(initialSession.updated_at || null)

  const inFlightPromiseRef = useRef<Promise<boolean> | null>(null)
  const queuedSaveRef = useRef<boolean>(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notify parent of dirty state changes
  useEffect(() => {
    onUnsavedChangesChange?.(isDirty)
  }, [isDirty, onUnsavedChangesChange])

  // Synchronously update local draft in localStorage
  const updateDraft = useCallback(
    (
      currentSession: WorkoutSessionLog,
      currentDuration: number,
      currentTimer: WorkoutDraftTimerState,
      dirty: boolean
    ) => {
      saveWorkoutDraft({
        version: 1,
        sessionId: currentSession.id,
        updatedAt: new Date().toISOString(),
        duration: currentDuration,
        timerState: currentTimer,
        notes: currentSession.notes ?? null,
        exercises: currentSession.exercises,
        isDirty: dirty,
      })
    },
    []
  )

  // Core save executor with in-flight protection, mutation sequence checks, and multi-tab conflict detection
  const executeSave = useCallback(
    async (forceOverwrite: boolean = false): Promise<boolean> => {
      // If a save is already in-flight, queue the latest state for subsequent save
      if (inFlightPromiseRef.current) {
        queuedSaveRef.current = true
        return false
      }

      setSaveStatus('saving')
      setSaveErrorMessage(null)
      setConflictError(null)

      const saveSeq = mutationSeqRef.current
      const currentDuration = calculateElapsedSeconds(timerStateRef.current)
      durationRef.current = currentDuration
      setDuration(currentDuration)

      const payload = {
        session_name: sessionRef.current.session_name,
        notes: sessionRef.current.notes ?? undefined,
        duration_seconds: currentDuration,
        exercises: sessionRef.current.exercises,
        client_version: forceOverwrite ? undefined : serverVersionRef.current,
        force_overwrite: forceOverwrite,
        client_updated_at: forceOverwrite ? undefined : (lastKnownServerUpdatedAtRef.current ?? undefined),
      }

      const savePromise = (async (): Promise<boolean> => {
        try {
          const updated = await workoutExecutionService.updateSession(
            sessionRef.current.id,
            payload
          )
          setLastSavedAt(new Date())
          if (updated?.version) {
            serverVersionRef.current = updated.version
          }
          if (updated.updated_at) {
            lastKnownServerUpdatedAtRef.current = updated.updated_at
          }

          // Check if user made newer edits while this save was in flight
          if (mutationSeqRef.current === saveSeq) {
            isDirtyRef.current = false
            setIsDirty(false)
            setSaveStatus('saved')
            updateDraft(sessionRef.current, durationRef.current, timerStateRef.current, false)
          } else {
            // Newer edits exist; retain dirty flag and queue immediate follow-up save
            queuedSaveRef.current = true
          }
          return true
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save progress.'
          const isConflict =
            message.toLowerCase().includes('another window or tab') ||
            message.toLowerCase().includes('conflict') ||
            (err instanceof ApiError && err.status === 409)

          if (isConflict) {
            setConflictError(
              message.includes('expected version')
                ? message
                : 'This workout was modified in another window or tab. Your latest edits are preserved in your local draft.'
            )
          }

          setSaveStatus('error')
          setSaveErrorMessage(message)
          // Keep local draft intact with latest user changes
          updateDraft(sessionRef.current, durationRef.current, timerStateRef.current, true)
          return false
        } finally {
          inFlightPromiseRef.current = null
          // If changes were made while this save was executing, run queued save now
          if (queuedSaveRef.current) {
            queuedSaveRef.current = false
            void executeSave()
          }
        }
      })()

      inFlightPromiseRef.current = savePromise
      return savePromise
    },
    [updateDraft]
  )

  // Debounce autosave helper for keystrokes
  const scheduleDebouncedAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      void executeSave()
    }, 1200)
  }, [executeSave])

  // Immediate save for boundaries (set completed/skipped, set added, explicit button)
  const triggerImmediateSave = useCallback(
    async (forceOverwrite: boolean = false) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      return executeSave(forceOverwrite)
    },
    [executeSave]
  )

  // Live timer tick
  useEffect(() => {
    if (timerState.isPaused) return

    const timer = setInterval(() => {
      const current = calculateElapsedSeconds(timerStateRef.current)
      setDuration(current)
      durationRef.current = current
    }, 1000)

    return () => clearInterval(timer)
  }, [timerState.isPaused])

  // Cross-tab storage listener to detect changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getDraftKey(initialSession.id) && e.newValue) {
        try {
          const incoming = JSON.parse(e.newValue)
          if (incoming && incoming.sessionId === initialSession.id && incoming.isDirty) {
            // Another tab edited this workout draft
            setConflictError(
              'Draft activity detected from another window or tab. Please ensure you are not editing simultaneously.'
            )
          }
        } catch {
          // Ignore parse errors from external events
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [initialSession.id])

  // Pause / Resume toggle
  const handleToggleTimer = () => {
    if (timerState.isPaused) {
      // Resume
      const newTimer: WorkoutDraftTimerState = {
        isPaused: false,
        accumulatedSeconds: timerState.accumulatedSeconds,
        intervalStartedAt: Date.now(),
      }
      setTimerState(newTimer)
      timerStateRef.current = newTimer
      updateDraft(sessionRef.current, durationRef.current, newTimer, isDirtyRef.current)
    } else {
      // Pause
      const currentElapsed = calculateElapsedSeconds(timerStateRef.current)
      const newTimer: WorkoutDraftTimerState = {
        isPaused: true,
        accumulatedSeconds: currentElapsed,
        intervalStartedAt: null,
      }
      setTimerState(newTimer)
      timerStateRef.current = newTimer
      setDuration(currentElapsed)
      durationRef.current = currentElapsed
      updateDraft(sessionRef.current, currentElapsed, newTimer, isDirtyRef.current)
      // Persist duration to backend on pause
      void triggerImmediateSave()
    }
  }

  // Warning on window close / page reload if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty || saveStatus === 'saving' || saveStatus === 'error') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty, saveStatus])

  // Clean up autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  // Completion statistics
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

  // Update set field
  const handleUpdateSet = (
    exOrder: number,
    setNumber: number,
    field: 'weight_kg' | 'reps' | 'is_completed' | 'is_skipped' | 'notes',
    value: unknown
  ) => {
    setSaveErrorMessage(null)
    setConflictError(null)
    const isBoundaryAction = field === 'is_completed' || field === 'is_skipped'

    mutationSeqRef.current += 1

    const updatedExercises = sessionRef.current.exercises.map((ex) => {
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

    const newSession = { ...sessionRef.current, exercises: updatedExercises }
    sessionRef.current = newSession
    setSession(newSession)

    isDirtyRef.current = true
    setIsDirty(true)
    updateDraft(newSession, durationRef.current, timerStateRef.current, true)

    if (isBoundaryAction) {
      void triggerImmediateSave()
    } else {
      scheduleDebouncedAutosave()
    }
  }

  // Add set to exercise
  const handleAddSet = (exOrder: number) => {
    mutationSeqRef.current += 1

    const updatedExercises = sessionRef.current.exercises.map((ex) => {
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

    const newSession = { ...sessionRef.current, exercises: updatedExercises }
    sessionRef.current = newSession
    setSession(newSession)

    isDirtyRef.current = true
    setIsDirty(true)
    updateDraft(newSession, durationRef.current, timerStateRef.current, true)
    void triggerImmediateSave()
  }

  // Update exercise notes
  const handleExerciseNotesChange = (exOrder: number, notes: string) => {
    mutationSeqRef.current += 1

    const updatedExercises = sessionRef.current.exercises.map((ex) =>
      ex.order_in_session === exOrder ? { ...ex, notes } : ex
    )
    const newSession = { ...sessionRef.current, exercises: updatedExercises }
    sessionRef.current = newSession
    setSession(newSession)

    isDirtyRef.current = true
    setIsDirty(true)
    updateDraft(newSession, durationRef.current, timerStateRef.current, true)
    scheduleDebouncedAutosave()
  }

  // Explicit Save Progress button click
  const handleSaveProgress = async (silent: boolean = false) => {
    const success = await triggerImmediateSave()
    if (success && !silent) {
      setToastMessage('Workout progress saved!')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  // Conflict resolution: reload server state
  const handleReloadServerState = async () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes in this tab. Reloading server state will discard your local edits. Continue?'
      )
      if (!confirmed) {
        return
      }
    }
    try {
      setActionLoading(true)
      const fresh = await workoutExecutionService.getSessionById(session.id)
      sessionRef.current = fresh
      setSession(fresh)
      serverVersionRef.current = fresh.version ?? 1
      lastKnownServerUpdatedAtRef.current = fresh.updated_at
      setConflictError(null)
      setSaveErrorMessage(null)
      setIsDirty(false)
      isDirtyRef.current = false
      updateDraft(fresh, durationRef.current, timerStateRef.current, false)
      setSaveStatus('saved')
    } catch (err) {
      setSaveErrorMessage(err instanceof Error ? err.message : 'Failed to reload server state.')
    } finally {
      setActionLoading(false)
    }
  }

  // Conflict resolution: force overwrite with current local draft
  const handleForceOverwrite = async () => {
    await triggerImmediateSave(true)
  }

  // Complete session: sync final duration & exercises, then complete, then clean draft
  const handleCompleteWorkout = async () => {
    if (actionLoading) return
    setActionLoading(true)
    setSaveErrorMessage(null)
    setConflictError(null)

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    try {
      // If a save was in flight, wait for it
      if (inFlightPromiseRef.current) {
        await inFlightPromiseRef.current
      }

      // Final state and duration sync to backend
      const finalDuration = calculateElapsedSeconds(timerStateRef.current)
      durationRef.current = finalDuration

      const updatedComplete = await workoutExecutionService.updateSession(session.id, {
        session_name: sessionRef.current.session_name,
        notes: sessionRef.current.notes ?? undefined,
        duration_seconds: finalDuration,
        exercises: sessionRef.current.exercises,
        client_version: serverVersionRef.current,
      })
      if (updatedComplete?.version) {
        serverVersionRef.current = updatedComplete.version
      }

      // Complete session
      await workoutExecutionService.completeSession(session.id, {
        client_version: serverVersionRef.current,
      })

      // Clean up local draft only after successful completion
      clearWorkoutDraft(session.id)
      onUnsavedChangesChange?.(false)
      onFinishOrCancel()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete workout.'
      const isConflict =
        message.toLowerCase().includes('another window or tab') ||
        message.toLowerCase().includes('conflict') ||
        (err instanceof ApiError && err.status === 409)

      if (isConflict) {
        setConflictError(
          message.includes('expected version')
            ? message
            : 'This workout was modified in another window or tab. Please reload server state or force overwrite before completing.'
        )
      }
      setSaveErrorMessage(message)
      setActionLoading(false)
      setShowCompleteConfirm(false)
    }
  }

  // Cancel session: sync final duration, then cancel, then clean draft
  const handleCancelWorkout = async () => {
    if (actionLoading) return
    setActionLoading(true)
    setSaveErrorMessage(null)
    setConflictError(null)

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    try {
      // If a save was in flight, wait for it
      if (inFlightPromiseRef.current) {
        await inFlightPromiseRef.current
      }

      // Final duration sync to backend before cancellation
      const finalDuration = calculateElapsedSeconds(timerStateRef.current)
      durationRef.current = finalDuration

      const updatedCancel = await workoutExecutionService.updateSession(session.id, {
        session_name: sessionRef.current.session_name,
        notes: sessionRef.current.notes ?? undefined,
        duration_seconds: finalDuration,
        exercises: sessionRef.current.exercises,
        client_version: serverVersionRef.current,
      })
      if (updatedCancel?.version) {
        serverVersionRef.current = updatedCancel.version
      }

      // Cancel session
      await workoutExecutionService.cancelSession(session.id, {
        client_version: serverVersionRef.current,
      })

      // Clean up local draft only after successful cancellation
      clearWorkoutDraft(session.id)
      onUnsavedChangesChange?.(false)
      onFinishOrCancel()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel workout.'
      const isConflict =
        message.toLowerCase().includes('another window or tab') ||
        message.toLowerCase().includes('conflict') ||
        (err instanceof ApiError && err.status === 409)

      if (isConflict) {
        setConflictError(
          message.includes('expected version')
            ? message
            : 'This workout was modified in another window or tab. Please reload server state or force overwrite before cancelling.'
        )
      }
      setSaveErrorMessage(message)
      setActionLoading(false)
      setShowCancelConfirm(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header Sticky / Top Bar */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                Active Workout Session
              </span>
              {session.session_focus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                  {session.session_focus}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-ink mt-1">
              {session.session_name}
            </h2>
          </div>

          {/* Timer and Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surfaceMuted border border-edge">
              <span
                data-testid="workout-timer-display"
                className="text-lg font-mono font-bold text-ink"
              >
                {formatDuration(duration)}
              </span>
              <button
                type="button"
                onClick={handleToggleTimer}
                aria-label={timerState.isPaused ? 'Resume workout timer' : 'Pause workout timer'}
                className="text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-edge text-ink shadow-2xs hover:bg-surfaceRaised transition cursor-pointer"
              >
                {timerState.isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>

            {/* Autosave Status Indicator */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surfaceHover/50 border border-edge text-xs font-medium"
              data-testid="save-status-container"
            >
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Saving...</span>
                </span>
              )}

              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>All changes saved</span>
                </span>
              )}

              {saveStatus === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-danger">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Save failed</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void triggerImmediateSave()}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-dangerSubtle hover:opacity-80 text-danger border border-dangerBorder transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {saveStatus === 'idle' && (
                <span className="text-inkMuted text-xs">
                  {isDirty ? 'Unsaved changes' : 'Ready'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleSaveProgress(false)}
              disabled={saveStatus === 'saving'}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surface hover:bg-surfaceMuted transition disabled:opacity-50 cursor-pointer"
            >
              Save Progress
            </button>

            <button
              type="button"
              onClick={() => setShowCompleteConfirm(true)}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              Complete Workout
            </button>

            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              disabled={actionLoading}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-danger hover:bg-dangerSubtle transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-inkSecondary">
            <span>
              Progress: <strong className="text-ink">{completedSets}</strong> of {totalSets} sets completed ({progressPercent}%)
            </span>
            {skippedSets > 0 && <span>{skippedSets} skipped</span>}
          </div>
          <div className="w-full bg-surfaceMuted rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-brand h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Local Draft Recovery Notification Banner */}
        {recoveredFromDraft && (
          <div
            role="status"
            className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Recovered unsaved workout progress from local draft.</span>
            </div>
            <button
              type="button"
              onClick={() => setRecoveredFromDraft(false)}
              className="text-xs font-semibold hover:underline text-blue-800 dark:text-blue-200 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Multi-Tab Conflict Notification Banner */}
        {conflictError && (
          <div
            role="alert"
            className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-2"
          >
            <div className="flex items-center gap-2 font-bold">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Multi-Tab Conflict Detected</span>
            </div>
            <p className="leading-relaxed">{conflictError}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleReloadServerState()}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              >
                Reload Server State
              </button>
              <button
                type="button"
                onClick={() => void handleForceOverwrite()}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-100 cursor-pointer"
              >
                Force Overwrite With My Edits
              </button>
            </div>
          </div>
        )}

        {/* Error and Toast Messages */}
        {saveErrorMessage && !conflictError && (
          <div className="mt-4 p-3 rounded-xl bg-dangerSubtle border border-dangerBorder text-xs text-danger">
            {saveErrorMessage}
          </div>
        )}
        {toastMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Exercises Set Inputs */}
      <div className="space-y-4">
        {session.exercises.map((ex: LoggedExercise) => (
          <div
            key={ex.order_in_session}
            className="bg-surface border border-edge rounded-2xl p-5 sm:p-6 shadow-card space-y-4"
          >
            {/* Exercise Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge pb-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0">
                  {ex.order_in_session}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-ink">
                    {ex.exercise_name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-inkSecondary capitalize mt-0.5">
                    <span>{ex.primary_muscle}</span>
                    <span>•</span>
                    <span>{ex.equipment_required}</span>
                    {ex.target_sets && ex.target_reps && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-brand">
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
                className="text-xs font-semibold text-brand hover:underline self-end sm:self-center cursor-pointer"
              >
                + Add Set
              </button>
            </div>

            {/* Set by Set Table */}
            <div className="space-y-2 overflow-x-auto">
              <div className="min-w-[340px] space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-inkMuted px-2">
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
                          ? 'bg-brand/10 border border-brand/30'
                          : set.is_skipped
                          ? 'bg-surfaceMuted opacity-60'
                          : 'bg-surfaceHover/40 border border-edge'
                      }`}
                    >
                      <span className="col-span-2 sm:col-span-1 text-xs font-bold text-ink">
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
                          className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-edge text-ink focus:outline-hidden focus:ring-1 focus:ring-brand"
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
                          className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-edge text-ink focus:outline-hidden focus:ring-1 focus:ring-brand"
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
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                            set.is_completed
                              ? 'bg-brand text-white shadow-2xs'
                              : 'bg-surface border border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted'
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
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                            set.is_skipped
                              ? 'bg-surfaceMuted text-inkMuted line-through'
                              : 'text-inkMuted hover:text-ink'
                          }`}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Exercise Notes */}
            <input
              type="text"
              placeholder="Notes on this movement (tempo, pain-free ROM, RPE...)"
              value={ex.notes || ''}
              onChange={(e) => handleExerciseNotesChange(ex.order_in_session, e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-surfaceMuted/50 border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden"
            />
          </div>
        ))}
      </div>

      {/* Confirmation Modal: Cancel Workout */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-workout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-surface border border-edge rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <h3 id="cancel-workout-modal-title" className="text-base font-bold text-danger">
              Cancel Active Workout?
            </h3>
            <p className="text-xs text-inkSecondary leading-relaxed">
              Are you sure you want to cancel? Cancelled workouts are archived in history as cancelled and do not count toward completed sessions.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Keep Working Out
              </button>
              <button
                type="button"
                onClick={handleCancelWorkout}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-dangerSubtle border border-dangerBorder text-danger hover:opacity-90 shadow-xs cursor-pointer transition disabled:opacity-50"
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
          aria-labelledby="complete-workout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-surface border border-edge rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <h3 id="complete-workout-modal-title" className="text-base font-bold text-ink">
              Finish and Complete Workout?
            </h3>
            <p className="text-xs text-inkSecondary leading-relaxed">
              Summary: <strong className="text-brand font-bold">{completedSets}</strong> of {totalSets} sets marked completed.
              {pendingSets > 0 && ` You have ${pendingSets} pending sets remaining.`}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Continue Workout
              </button>
              <button
                type="button"
                onClick={handleCompleteWorkout}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition cursor-pointer disabled:opacity-50"
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
