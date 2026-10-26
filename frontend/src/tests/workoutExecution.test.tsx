import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import { WorkoutLogView } from '../features/workouts/WorkoutLogView'
import type {
  WorkoutSessionLog,
  WorkoutSessionLogSummary,
} from '../types/workoutLog'

const mockActiveSession: WorkoutSessionLog = {
  id: 1,
  user_profile_id: 1,
  workout_plan_id: 10,
  planned_session_id: 20,
  session_name: 'Upper Body A',
  session_focus: 'Horizontal Push & Pull',
  status: 'in_progress',
  started_at: '2026-10-25T10:00:00',
  completed_at: null,
  duration_seconds: 300,
  notes: 'Testing notes',
  created_at: '2026-10-25T10:00:00',
  updated_at: '2026-10-25T10:00:00',
  exercises: [
    {
      id: 101,
      session_log_id: 1,
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

const mockHistorySummaries: WorkoutSessionLogSummary[] = [
  {
    id: 1,
    user_profile_id: 1,
    workout_plan_id: 10,
    planned_session_id: 20,
    session_name: 'Upper Body A',
    session_focus: 'Horizontal Push & Pull',
    status: 'completed',
    started_at: '2026-10-24T09:00:00',
    completed_at: '2026-10-24T09:45:00',
    duration_seconds: 2700,
    total_exercises: 5,
    completed_sets: 15,
    created_at: '2026-10-24T09:00:00',
  },
  {
    id: 2,
    user_profile_id: 1,
    workout_plan_id: null,
    planned_session_id: null,
    session_name: 'Custom Strength Session',
    session_focus: 'General Training',
    status: 'cancelled',
    started_at: '2026-10-23T14:00:00',
    completed_at: '2026-10-23T14:10:00',
    duration_seconds: 600,
    total_exercises: 2,
    completed_sets: 2,
    created_at: '2026-10-23T14:00:00',
  },
]

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

describe('Workout Execution & Session Logging (Phase 7.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValue(null)
    vi.mocked(workoutExecutionService.listSessions).mockResolvedValue(mockHistorySummaries)
    vi.mocked(workoutExecutionService.getSessionById).mockImplementation(async (id) => {
      if (id === 1) {
        return {
          ...mockActiveSession,
          id: 1,
          status: 'completed',
          exercises: [
            {
              ...mockActiveSession.exercises[0],
              sets: [
                {
                  id: 1001,
                  logged_exercise_id: 101,
                  set_number: 1,
                  weight_kg: 80.0,
                  reps: 10,
                  is_completed: true,
                  is_skipped: false,
                },
              ],
            },
          ],
        }
      }
      return { ...mockActiveSession, id, status: 'cancelled' }
    })
  })

  it('navigates to Workout Log tab and displays history when no active workout', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const logTabBtn = screen.getByRole('button', { name: /workout log/i })
    await act(async () => {
      fireEvent.click(logTabBtn)
    })

    // Header and history cards rendered
    expect(
      screen.getByText('Workout Log & Session History')
    ).toBeInTheDocument()
    expect(screen.getByText('Upper Body A')).toBeInTheDocument()
    expect(screen.getByText('Custom Strength Session')).toBeInTheDocument()
    expect(screen.getAllByText('completed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('cancelled').length).toBeGreaterThan(0)
  })

  it('renders ActiveWorkoutSessionRunner when an active session is in progress', async () => {
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValueOnce(mockActiveSession)

    await act(async () => {
      render(<WorkoutLogView />)
    })

    expect(screen.getByText('Active Workout Session')).toBeInTheDocument()
    expect(screen.getByText('Upper Body A')).toBeInTheDocument()
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
    expect(screen.getByText(/sets completed/i)).toHaveTextContent('0 of 3 sets completed')
  })

  it('allows entering weight and reps, marking sets completed or skipped', async () => {
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValueOnce(mockActiveSession)

    await act(async () => {
      render(<WorkoutLogView />)
    })

    // 1. Enter weight for set 1
    const weightInputs = screen.getAllByPlaceholderText('kg')
    await act(async () => {
      fireEvent.change(weightInputs[0], { target: { value: '75.5' } })
    })

    // 2. Enter reps for set 1
    const repsInputs = screen.getAllByPlaceholderText('Reps')
    await act(async () => {
      fireEvent.change(repsInputs[0], { target: { value: '10' } })
    })

    // 3. Click Complete on set 1
    const completeBtns = screen.getAllByRole('button', { name: /mark set 1 as complete/i })
    await act(async () => {
      fireEvent.click(completeBtns[0])
    })

    // Progress bar updates
    expect(screen.getByText(/sets completed/i)).toHaveTextContent('1 of 3 sets completed')

    // 4. Click Skip on set 2
    const skipBtns = screen.getAllByRole('button', { name: /skip set 2/i })
    await act(async () => {
      fireEvent.click(skipBtns[0])
    })

    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument()
  })

  it('saves partial workout progress to backend without completing', async () => {
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValueOnce(mockActiveSession)
    vi.mocked(workoutExecutionService.updateSession).mockResolvedValueOnce({
      ...mockActiveSession,
      duration_seconds: 350,
    })

    await act(async () => {
      render(<WorkoutLogView />)
    })

    const saveBtn = screen.getByRole('button', { name: /save progress/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(workoutExecutionService.updateSession).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        session_name: 'Upper Body A',
      })
    )
    expect(await screen.findByText(/workout progress saved/i)).toBeInTheDocument()
  })

  it('completes workout after confirmation modal', async () => {
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValueOnce(mockActiveSession)
    vi.mocked(workoutExecutionService.updateSession).mockResolvedValueOnce(mockActiveSession)
    vi.mocked(workoutExecutionService.completeSession).mockResolvedValueOnce({
      ...mockActiveSession,
      status: 'completed',
    })

    await act(async () => {
      render(<WorkoutLogView />)
    })

    // Click Complete Workout button
    const completeWorkoutBtn = screen.getByRole('button', {
      name: 'Complete Workout',
    })
    await act(async () => {
      fireEvent.click(completeWorkoutBtn)
    })

    // Confirmation modal opens
    expect(
      screen.getByText('Finish and Complete Workout?')
    ).toBeInTheDocument()

    // Confirm finish
    const finishConfirmBtn = screen.getByRole('button', {
      name: 'Finish Workout',
    })
    await act(async () => {
      fireEvent.click(finishConfirmBtn)
    })

    expect(workoutExecutionService.completeSession).toHaveBeenCalledWith(1, expect.objectContaining({ client_version: expect.any(Number) }))
  })

  it('cancels workout after confirmation modal without marking completed', async () => {
    vi.mocked(workoutExecutionService.getActiveSession).mockResolvedValueOnce(mockActiveSession)
    vi.mocked(workoutExecutionService.cancelSession).mockResolvedValueOnce({
      ...mockActiveSession,
      status: 'cancelled',
    })

    await act(async () => {
      render(<WorkoutLogView />)
    })

    // Click Cancel button
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    // Confirmation modal opens
    expect(
      screen.getByText('Cancel Active Workout?')
    ).toBeInTheDocument()

    // Confirm cancel
    const confirmCancelBtn = screen.getByRole('button', {
      name: 'Confirm Cancel',
    })
    await act(async () => {
      fireEvent.click(confirmCancelBtn)
    })

    expect(workoutExecutionService.cancelSession).toHaveBeenCalledWith(1, expect.objectContaining({ client_version: expect.any(Number) }))
  })

  it('filters history by status and opens log detail modal', async () => {
    await act(async () => {
      render(<WorkoutLogView />)
    })

    // Filter by completed
    const completedFilterBtn = screen.getByRole('button', { name: 'completed' })
    await act(async () => {
      fireEvent.click(completedFilterBtn)
    })

    expect(screen.getByText('Upper Body A')).toBeInTheDocument()
    expect(screen.queryByText('Custom Strength Session')).not.toBeInTheDocument()

    // Click View Details on Upper Body A
    const viewDetailBtn = screen.getByRole('button', { name: /view details/i })
    await act(async () => {
      fireEvent.click(viewDetailBtn)
    })

    expect(workoutExecutionService.getSessionById).toHaveBeenCalledWith(1)
    expect(await screen.findByText(/80kg × 10/i)).toBeInTheDocument()
  })
})
