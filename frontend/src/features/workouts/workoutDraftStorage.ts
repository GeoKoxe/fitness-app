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
    if (
      parsed &&
      parsed.version === 1 &&
      parsed.sessionId === sessionId &&
      Array.isArray(parsed.exercises) &&
      typeof parsed.duration === 'number' &&
      parsed.timerState &&
      typeof parsed.timerState.isPaused === 'boolean'
    ) {
      return parsed
    }
    // Corrupted or mismatched draft
    clearWorkoutDraft(sessionId)
  } catch {
    clearWorkoutDraft(sessionId)
  }
  return null
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
  if (timerState.isPaused || timerState.intervalStartedAt === null) {
    return Math.max(0, timerState.accumulatedSeconds)
  }
  const runningElapsed = Math.max(0, Math.floor((nowMs - timerState.intervalStartedAt) / 1000))
  return Math.max(0, timerState.accumulatedSeconds + runningElapsed)
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

