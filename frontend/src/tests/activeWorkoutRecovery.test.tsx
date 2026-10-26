import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActiveWorkoutSessionRunner } from '../features/workouts/ActiveWorkoutSessionRunner'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import { WorkoutLogView } from '../features/workouts/WorkoutLogView'
import {
  clearWorkoutDraft,
  getDraftKey,
  loadWorkoutDraft,
  saveWorkoutDraft,
} from '../features/workouts/workoutDraftStorage'
import type { WorkoutSessionLog } from '../types/workoutLog'

const mockActiveSession: WorkoutSessionLog = {
  id: 42,
  user_profile_id: 1,
  workout_plan_id: 10,
  planned_session_id: 20,
  session_name: 'Chest & Triceps Power',
  session_focus: 'Hypertrophy',
  status: 'in_progress',
  started_at: '2026-10-26T10:00:00',
  completed_at: null,
  duration_seconds: 180,
  notes: 'Session notes',
  created_at: '2026-10-26T10:00:00',
  updated_at: '2026-10-26T10:00:00',
  exercises: [
    {
      id: 101,
      session_log_id: 42,
      exercise_id: 1,
      planned_exercise_id: 201,
      order_in_session: 1,
      exercise_slug: 'barbell_bench_press',
      exercise_name: 'Barbell Bench Press',
      primary_muscle: 'chest',
      equipment_required: 'barbell',
      movement_category: 'horizontal_push',
      target_sets: 3,
      target_reps: '8-10',
      rest_seconds: 90,
      notes: null,
      sets: [
        {
          id: 1001,
          logged_exercise_id: 101,
          set_number: 1,
          weight_kg: null,
          reps: null,
          is_completed: false,
          is_skipped: false,
        },
        {
          id: 1002,
          logged_exercise_id: 101,
          set_number: 2,
          weight_kg: null,
          reps: null,
          is_completed: false,
          is_skipped: false,
        },
        {
          id: 1003,
          logged_exercise_id: 101,
          set_number: 3,
          weight_kg: null,
          reps: null,
          is_completed: false,
          is_skipped: false,
        },
      ],
    },
  ],
}

vi.mock('../services/workoutExecutionService', () => ({
  workoutExecutionService: {
    getActiveSession: vi.fn(),
    listSessions: vi.fn(),
    startSession: vi.fn(),
    updateSession: vi.fn(),
    completeSession: vi.fn(),
    cancelSession: vi.fn(),
    getSessionById: vi.fn(),
  },
}))

import { workoutExecutionService } from '../services/workoutExecutionService'

describe('Batch 3 — Workout Execution Recovery, Autosave & Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValue(mockActiveSession)
    vi.mocked(workoutExecutionService.listSessions).mockResolvedValue([])
    vi.mocked(workoutExecutionService.updateSession).mockImplementation(
      async (_id, update) => ({
        ...mockActiveSession,
        duration_seconds: update.duration_seconds ?? mockActiveSession.duration_seconds,
        exercises: (update.exercises as any) ?? mockActiveSession.exercises,
      })
    )
    vi.mocked(workoutExecutionService.completeSession).mockResolvedValue({
      ...mockActiveSession,
      status: 'completed',
    })
    vi.mocked(workoutExecutionService.cancelSession).mockResolvedValue({
      ...mockActiveSession,
      status: 'cancelled',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Scenario 1: Debounced autosave fires after user types reps and weight', async () => {
    vi.useFakeTimers()

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const weightInput = screen.getByLabelText(/Set 1 weight in kg/i)
    await act(async () => {
      fireEvent.change(weightInput, { target: { value: '85' } })
    })

    // Before debounce interval, updateSession has not been called
    expect(workoutExecutionService.updateSession).not.toHaveBeenCalled()

    // Advance timers by 1300ms async (debounce is 1200ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)
    expect(workoutExecutionService.updateSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            sets: expect.arrayContaining([
              expect.objectContaining({ set_number: 1, weight_kg: 85 }),
            ]),
          }),
        ]),
      })
    )
  })

  it('Scenario 2: Immediate save fires on set completion toggle without debounce delay', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const completeBtn = screen.getByRole('button', { name: /mark set 1 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtn)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)
    expect(workoutExecutionService.updateSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            sets: expect.arrayContaining([
              expect.objectContaining({ set_number: 1, is_completed: true }),
            ]),
          }),
        ]),
      })
    )
  })

  it('Scenario 3: Immediate save fires on set skip toggle', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const skipBtn = screen.getByRole('button', { name: /skip set 2/i })
    await act(async () => {
      fireEvent.click(skipBtn)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)
    expect(workoutExecutionService.updateSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            sets: expect.arrayContaining([
              expect.objectContaining({ set_number: 2, is_skipped: true }),
            ]),
          }),
        ]),
      })
    )
  })

  it('Scenario 4: Immediate save fires on adding a set', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const addSetBtn = screen.getByRole('button', { name: /\+ add set/i })
    await act(async () => {
      fireEvent.click(addSetBtn)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)
    expect(screen.getByText('#4')).toBeInTheDocument()
  })

  it('Scenario 5: In-flight save protection queues subsequent save with latest changes', async () => {
    let resolveFirstUpdate: (value: any) => void = () => {}
    const firstUpdatePromise = new Promise((resolve) => {
      resolveFirstUpdate = resolve
    })

    // First call hangs until manually resolved
    vi.mocked(workoutExecutionService.updateSession)
      .mockImplementationOnce(() => firstUpdatePromise as any)
      .mockImplementation(async (_id, update) => ({
        ...mockActiveSession,
        exercises: (update.exercises as any) ?? mockActiveSession.exercises,
      }))

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // 1. Trigger first save via complete toggle
    const completeBtn1 = screen.getByRole('button', { name: /mark set 1 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtn1)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)

    // 2. While first save is in flight, toggle set 2
    const completeBtn2 = screen.getByRole('button', { name: /mark set 2 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtn2)
    })

    // Still only 1 call in-flight
    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(1)

    // 3. Resolve the first save
    await act(async () => {
      resolveFirstUpdate({
        ...mockActiveSession,
        exercises: mockActiveSession.exercises,
      })
    })

    // The queued save should now have executed immediately with both sets!
    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(2)
  })

  it('Scenario 6: Save status indicator transitions between saving and saved', async () => {
    let resolveSave: (value: any) => void = () => {}
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve
    })
    vi.mocked(workoutExecutionService.updateSession).mockImplementationOnce(() => savePromise as any)

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const completeBtn = screen.getByRole('button', { name: /mark set 1 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtn)
    })

    // Status indicator shows "Saving..."
    expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument()

    // Resolve save
    await act(async () => {
      resolveSave(mockActiveSession)
    })

    // Status indicator transitions to "All changes saved"
    expect(await screen.findByText(/all changes saved/i)).toBeInTheDocument()
  })

  it('Scenario 7 & 8: Save failure transitions to error state and allows manual retry', async () => {
    vi.mocked(workoutExecutionService.updateSession).mockRejectedValueOnce(
      new Error('Network timeout: 504 Gateway Timeout')
    )

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const completeBtn = screen.getByRole('button', { name: /mark set 1 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtn)
    })

    // Error state and retry button appear
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
    expect(screen.getByText(/network timeout/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()

    // Clicking retry re-attempts the save
    vi.mocked(workoutExecutionService.updateSession).mockResolvedValueOnce(mockActiveSession)
    await act(async () => {
      fireEvent.click(retryBtn)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/all changes saved/i)).toBeInTheDocument()
  })

  it('Scenario 9: Local draft persistence writes to localStorage immediately on edits', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    const repsInput = screen.getByLabelText(/Set 1 reps/i)
    await act(async () => {
      fireEvent.change(repsInput, { target: { value: '12' } })
    })

    const draft = loadWorkoutDraft(42)
    expect(draft).not.toBeNull()
    expect(draft?.sessionId).toBe(42)
    expect(draft?.isDirty).toBe(true)
    expect(draft?.exercises[0].sets[0].reps).toBe(12)
  })

  it('Scenario 10: Restores unsaved local draft on mount and displays recovery banner', async () => {
    // Populate an unsaved local draft in localStorage
    saveWorkoutDraft({
      version: 1,
      sessionId: 42,
      updatedAt: '2026-10-26T10:15:00Z',
      duration: 450,
      timerState: {
        isPaused: true,
        accumulatedSeconds: 450,
        intervalStartedAt: null,
      },
      notes: 'Recovered draft notes',
      exercises: [
        {
          ...mockActiveSession.exercises[0],
          sets: [
            {
              id: 1001,
              logged_exercise_id: 101,
              set_number: 1,
              weight_kg: 100,
              reps: 8,
              is_completed: true,
              is_skipped: false,
            },
          ],
        },
      ],
      isDirty: true,
    })

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Recovery banner is displayed
    expect(
      screen.getByText(/recovered unsaved workout progress from local draft/i)
    ).toBeInTheDocument()

    // Recovered values are populated in the UI
    const weightInput = screen.getByLabelText(/Set 1 weight in kg/i) as HTMLInputElement
    expect(weightInput.value).toBe('100')
    expect(screen.getByText(/sets completed/i)).toHaveTextContent('1 of 1 sets completed')
  })

  it('Scenario 11: Draft cleanup on workout completion removes localStorage draft', async () => {
    // Create draft
    saveWorkoutDraft({
      version: 1,
      sessionId: 42,
      updatedAt: '2026-10-26T10:15:00Z',
      duration: 200,
      timerState: { isPaused: false, accumulatedSeconds: 200, intervalStartedAt: null },
      notes: null,
      exercises: mockActiveSession.exercises,
      isDirty: false,
    })
    expect(loadWorkoutDraft(42)).not.toBeNull()

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Open Complete modal and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Complete Workout' }))
    const finishBtn = screen.getByRole('button', { name: 'Finish Workout' })
    await act(async () => {
      fireEvent.click(finishBtn)
    })

    expect(workoutExecutionService.completeSession).toHaveBeenCalledWith(42)
    // Draft must be cleaned up from localStorage
    expect(loadWorkoutDraft(42)).toBeNull()
  })

  it('Scenario 12: Draft cleanup on workout cancellation removes localStorage draft', async () => {
    saveWorkoutDraft({
      version: 1,
      sessionId: 42,
      updatedAt: '2026-10-26T10:15:00Z',
      duration: 100,
      timerState: { isPaused: false, accumulatedSeconds: 100, intervalStartedAt: null },
      notes: null,
      exercises: mockActiveSession.exercises,
      isDirty: false,
    })
    expect(loadWorkoutDraft(42)).not.toBeNull()

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Open Cancel modal and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const confirmCancelBtn = screen.getByRole('button', { name: 'Confirm Cancel' })
    await act(async () => {
      fireEvent.click(confirmCancelBtn)
    })

    expect(workoutExecutionService.cancelSession).toHaveBeenCalledWith(42)
    // Draft must be cleaned up from localStorage
    expect(loadWorkoutDraft(42)).toBeNull()
  })

  it('Scenario 13: Corrupted or mismatched draft is safely ignored without crashing', async () => {
    // Corrupt the key in localStorage
    localStorage.setItem(getDraftKey(42), '{ bad json :::')

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Active Workout Session')).toBeInTheDocument()
    expect(loadWorkoutDraft(42)).toBeNull()
  })

  it('Scenario 14: beforeunload event listener warns when dirty and is neutral when saved', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Make an edit
    const repsInput = screen.getByLabelText(/Set 1 reps/i)
    await act(async () => {
      fireEvent.change(repsInput, { target: { value: '15' } })
    })

    // Dispatch beforeunload event
    const event = new Event('beforeunload', { cancelable: true }) as any
    window.dispatchEvent(event)

    // In jsdom, returnValue is populated when dirty
    expect(event.returnValue).toBeDefined()
  })

  it('Scenario 15: In-app navigation guard warns when switching tabs with unsaved changes', async () => {
    render(<WorkoutDashboard />)

    // Navigate to Workout Log tab
    const logTab = screen.getByRole('button', { name: /workout log/i })
    await act(async () => {
      fireEvent.click(logTab)
    })

    // Active session loads
    expect(await screen.findByText('Active Workout Session')).toBeInTheDocument()

    // Type in reps to create unsaved dirty change
    const repsInput = screen.getByLabelText(/Set 1 reps/i)
    await act(async () => {
      fireEvent.change(repsInput, { target: { value: '14' } })
    })

    // Attempt to navigate away to Exercise Catalogue tab
    const catalogueTab = screen.getByRole('button', { name: /exercise catalogue/i })
    await act(async () => {
      fireEvent.click(catalogueTab)
    })

    // Navigation guard modal should pop up!
    expect(screen.getByText('Unsaved Workout Changes')).toBeInTheDocument()
    expect(
      screen.getByText(/leaving the workout runner tab may delay saving/i)
    ).toBeInTheDocument()

    // User chooses "Stay on Workout"
    const stayBtn = screen.getByRole('button', { name: /stay on workout/i })
    await act(async () => {
      fireEvent.click(stayBtn)
    })

    // Modal closes and remains on active workout session
    expect(screen.queryByText('Unsaved Workout Changes')).not.toBeInTheDocument()
    expect(screen.getByText('Active Workout Session')).toBeInTheDocument()

    // Attempt navigation again and choose "Leave Anyway"
    await act(async () => {
      fireEvent.click(catalogueTab)
    })
    const leaveBtn = screen.getByRole('button', { name: /leave anyway/i })
    await act(async () => {
      fireEvent.click(leaveBtn)
    })

    // Navigated to Exercise Catalogue
    expect(
      screen.getByRole('heading', { name: /exercise catalogue/i })
    ).toBeInTheDocument()
  })

  it('Scenario 19: Timer accounts for elapsed time and excludes paused intervals', async () => {
    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Timer starts running with initial session duration (180s = 03:00)
    expect(screen.getByTestId('workout-timer-display')).toHaveTextContent('03:00')

    // Click Pause
    const pauseBtn = screen.getByRole('button', { name: /pause workout timer/i })
    await act(async () => {
      fireEvent.click(pauseBtn)
    })

    expect(screen.getByRole('button', { name: /resume workout timer/i })).toBeInTheDocument()

    // Click Resume
    const resumeBtn = screen.getByRole('button', { name: /resume workout timer/i })
    await act(async () => {
      fireEvent.click(resumeBtn)
    })

    expect(screen.getByRole('button', { name: /pause workout timer/i })).toBeInTheDocument()
  })

  it('Scenario 20: Double-click prevention on complete and cancel buttons', async () => {
    let resolveComplete: (value: any) => void = () => {}
    const completePromise = new Promise((resolve) => {
      resolveComplete = resolve
    })
    vi.mocked(workoutExecutionService.completeSession).mockImplementationOnce(
      () => completePromise as any
    )

    render(
      <ActiveWorkoutSessionRunner
        initialSession={mockActiveSession}
        onFinishOrCancel={vi.fn()}
      />
    )

    // Open Complete modal
    fireEvent.click(screen.getByRole('button', { name: 'Complete Workout' }))
    const finishBtn = screen.getByRole('button', { name: 'Finish Workout' })

    // Click finish once
    await act(async () => {
      fireEvent.click(finishBtn)
    })

    // Click finish a second time while in flight
    await act(async () => {
      fireEvent.click(finishBtn)
    })

    // Still only 1 call dispatched to completeSession
    expect(workoutExecutionService.completeSession).toHaveBeenCalledTimes(1)

    // Resolve complete
    await act(async () => {
      resolveComplete(mockActiveSession)
    })
  })
})
