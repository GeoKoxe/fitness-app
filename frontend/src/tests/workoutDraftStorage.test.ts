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
    expect(formatDuration(-10)).toBe('00:00')
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

  it('handles clock skew safely when nowMs is before intervalStartedAt', () => {
    const futureTime = 1800000000000
    const timer: WorkoutDraftTimerState = {
      isPaused: false,
      accumulatedSeconds: 50,
      intervalStartedAt: futureTime,
    }
    // nowMs is before futureTime -> returns accumulatedSeconds without negative time
    expect(calculateElapsedSeconds(timer, futureTime - 10000)).toBe(50)
  })

  it('calculates repeated pause and resume operations without losing time or double counting', () => {
    let t = 1000000
    let timer: WorkoutDraftTimerState = {
      isPaused: false,
      accumulatedSeconds: 0,
      intervalStartedAt: t,
    }

    // Run for 10 seconds
    t += 10000
    expect(calculateElapsedSeconds(timer, t)).toBe(10)

    // Pause at t
    timer = {
      isPaused: true,
      accumulatedSeconds: calculateElapsedSeconds(timer, t),
      intervalStartedAt: null,
    }
    expect(timer.accumulatedSeconds).toBe(10)

    // Wait 20 seconds while paused
    t += 20000
    expect(calculateElapsedSeconds(timer, t)).toBe(10)

    // Resume at t
    timer = {
      isPaused: false,
      accumulatedSeconds: timer.accumulatedSeconds,
      intervalStartedAt: t,
    }

    // Run for 15 seconds
    t += 15000
    expect(calculateElapsedSeconds(timer, t)).toBe(25)

    // Pause again
    timer = {
      isPaused: true,
      accumulatedSeconds: calculateElapsedSeconds(timer, t),
      intervalStartedAt: null,
    }
    expect(timer.accumulatedSeconds).toBe(25)

    // Wait 60 seconds while paused
    t += 60000
    expect(calculateElapsedSeconds(timer, t)).toBe(25)
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

  it('heals malformed or missing timer fields upon draft recovery', () => {
    const key = getDraftKey(77)
    // Draft with missing timerState and NaN duration
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        sessionId: 77,
        updatedAt: '2026-10-26T12:00:00Z',
        duration: null,
        exercises: [],
        isDirty: true,
      })
    )

    const recovered = loadWorkoutDraft(77)
    expect(recovered).not.toBeNull()
    expect(recovered?.duration).toBe(0)
    expect(recovered?.timerState.isPaused).toBe(false)
    expect(recovered?.timerState.accumulatedSeconds).toBe(0)
    expect(typeof recovered?.timerState.intervalStartedAt).toBe('number')

    // Draft with invalid accumulatedSeconds and null intervalStartedAt while running
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        sessionId: 77,
        updatedAt: '2026-10-26T12:00:00Z',
        duration: 180,
        timerState: {
          isPaused: false,
          accumulatedSeconds: 'invalid',
          intervalStartedAt: null,
        },
        exercises: [],
        isDirty: true,
      })
    )

    const healed = loadWorkoutDraft(77)
    expect(healed).not.toBeNull()
    expect(healed?.timerState.accumulatedSeconds).toBe(180)
    expect(typeof healed?.timerState.intervalStartedAt).toBe('number')
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
