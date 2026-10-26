import type { LoggedExercise } from '../../types/workoutLog'

export const DRAFT_STORAGE_PREFIX = 'fitpulse_workout_draft_v1_'

export interface WorkoutDraftTimerState {
  isPaused: boolean
  accumulatedSeconds: number
  intervalStartedAt: number | null // Epoch ms timestamp
}

export interface WorkoutSessionDraft {
  version: 1
  sessionId: number
  updatedAt: string // ISO string
  duration: number
  timerState: WorkoutDraftTimerState
  notes: string | null
  exercises: LoggedExercise[]
  isDirty: boolean
}

export function getDraftKey(sessionId: number): string {
  return `${DRAFT_STORAGE_PREFIX}${sessionId}`
}

export function loadWorkoutDraft(sessionId: number): WorkoutSessionDraft | null {
  try {
    const key = getDraftKey(sessionId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkoutSessionDraft

    // Verify draft ownership and version
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.sessionId !== sessionId ||
      !Array.isArray(parsed.exercises)
    ) {
      clearWorkoutDraft(sessionId)
      return null
    }

    // Sanitize duration
    const safeDuration =
      typeof parsed.duration === 'number' && Number.isFinite(parsed.duration) && parsed.duration >= 0
        ? Math.floor(parsed.duration)
        : 0

    // Sanitize and align timerState
    let safeTimerState: WorkoutDraftTimerState
    if (parsed.timerState && typeof parsed.timerState === 'object') {
      const isPaused = Boolean(parsed.timerState.isPaused)
      const accumulatedSeconds =
        typeof parsed.timerState.accumulatedSeconds === 'number' &&
        Number.isFinite(parsed.timerState.accumulatedSeconds) &&
        parsed.timerState.accumulatedSeconds >= 0
          ? Math.floor(parsed.timerState.accumulatedSeconds)
          : safeDuration

      let intervalStartedAt: number | null = null
      if (!isPaused) {
        if (
          typeof parsed.timerState.intervalStartedAt === 'number' &&
          Number.isFinite(parsed.timerState.intervalStartedAt)
        ) {
          // If future timestamp (clock skew), clamp to now
          intervalStartedAt = Math.min(Date.now(), parsed.timerState.intervalStartedAt)
        } else {
          // Fallback to now if missing on running timer
          intervalStartedAt = Date.now()
        }
      }

      safeTimerState = {
        isPaused,
        accumulatedSeconds,
        intervalStartedAt,
      }
    } else {
      safeTimerState = {
        isPaused: false,
        accumulatedSeconds: safeDuration,
        intervalStartedAt: Date.now(),
      }
    }

    return {
      version: 1,
      sessionId,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      duration: safeDuration,
      timerState: safeTimerState,
      notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      exercises: parsed.exercises,
      isDirty: Boolean(parsed.isDirty),
    }
  } catch {
    clearWorkoutDraft(sessionId)
    return null
  }
}

export function saveWorkoutDraft(draft: WorkoutSessionDraft): void {
  try {
    const key = getDraftKey(draft.sessionId)
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (err) {
    console.warn('Failed to save workout draft to localStorage:', err)
  }
}

export function clearWorkoutDraft(sessionId: number): void {
  try {
    const key = getDraftKey(sessionId)
    localStorage.removeItem(key)
  } catch {
    // Ignore storage cleanup errors
  }
}

export function calculateElapsedSeconds(
  timerState: WorkoutDraftTimerState,
  nowMs: number = Date.now()
): number {
  const accumulated =
    typeof timerState.accumulatedSeconds === 'number' &&
    Number.isFinite(timerState.accumulatedSeconds) &&
    timerState.accumulatedSeconds >= 0
      ? Math.floor(timerState.accumulatedSeconds)
      : 0

  if (timerState.isPaused || timerState.intervalStartedAt === null) {
    return accumulated
  }

  // Guard against clock skew where nowMs is before intervalStartedAt
  if (nowMs < timerState.intervalStartedAt) {
    return accumulated
  }

  const runningElapsed = Math.floor((nowMs - timerState.intervalStartedAt) / 1000)
  return accumulated + Math.max(0, runningElapsed)
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
