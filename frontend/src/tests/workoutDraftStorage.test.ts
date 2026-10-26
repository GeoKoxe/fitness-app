import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateElapsedSeconds,
  clearWorkoutDraft,
  formatDuration,
  getDraftKey,
  loadWorkoutDraft,
  saveWorkoutDraft,
  type WorkoutDraftTimerState,
  type WorkoutSessionDraft,
} from '../features/workouts/workoutDraftStorage'

describe('workoutDraftStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('formats duration correctly for sub-hour and multi-hour values', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3599)).toBe('59:59')
    expect(formatDuration(3661)).toBe('01:01:01')
  })

  it('calculates elapsed time correctly when paused and running', () => {
    // 1. Paused timer returns accumulatedSeconds
    const pausedTimer: WorkoutDraftTimerState = {
      isPaused: true,
      accumulatedSeconds: 120,
      intervalStartedAt: null,
    }
    expect(calculateElapsedSeconds(pausedTimer, Date.now())).toBe(120)

    // 2. Running timer returns accumulatedSeconds + elapsed in current interval
    const baseTime = 1700000000000
    const runningTimer: WorkoutDraftTimerState = {
      isPaused: false,
      accumulatedSeconds: 60,
      intervalStartedAt: baseTime,
    }
    // 30 seconds later
    expect(calculateElapsedSeconds(runningTimer, baseTime + 30000)).toBe(90)
  })

  it('saves, loads, and clears valid workout drafts', () => {
    const draft: WorkoutSessionDraft = {
      version: 1,
      sessionId: 42,
      updatedAt: '2026-10-26T12:00:00Z',
      duration: 300,
      timerState: {
        isPaused: false,
        accumulatedSeconds: 300,
        intervalStartedAt: Date.now(),
      },
      notes: 'Test draft notes',
      exercises: [],
      isDirty: true,
    }

    saveWorkoutDraft(draft)
    const loaded = loadWorkoutDraft(42)
    expect(loaded).toEqual(draft)

    clearWorkoutDraft(42)
    expect(loadWorkoutDraft(42)).toBeNull()
  })

  it('discards corrupted, invalid, or mismatched session draft gracefully', () => {
    const key = getDraftKey(99)
    // Corrupted JSON
    localStorage.setItem(key, '{ invalid json...')
    expect(loadWorkoutDraft(99)).toBeNull()

    // Wrong version
    localStorage.setItem(
      key,
      JSON.stringify({ version: 999, sessionId: 99, exercises: [] })
    )
    expect(loadWorkoutDraft(99)).toBeNull()

    // Mismatched sessionId in payload
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        sessionId: 100, // mismatch
        exercises: [],
        duration: 0,
        timerState: { isPaused: false, accumulatedSeconds: 0, intervalStartedAt: null },
      })
    )
    expect(loadWorkoutDraft(99)).toBeNull()
  })
})

