import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseCatalogueView } from '../features/workouts/ExerciseCatalogueView'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import type { Exercise } from '../types/exercise'
import App from '../App'

const mockExercises: Exercise[] = [
  {
    id: 1,
    slug: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    movement_category: 'horizontal_push',
    primary_muscle: 'chest',
    secondary_muscles: 'triceps,shoulders',
    equipment_required: 'barbell',
    difficulty_level: 'intermediate',
    instructions: 'Lie on flat bench and press bar upward under control.',
    alternative_exercise_slugs: 'push_up',
    is_built_in: true,
    user_profile_id: null,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
  {
    id: 2,
    slug: 'push_up',
    name: 'Standard Push-Up',
    movement_category: 'horizontal_push',
    primary_muscle: 'chest',
    secondary_muscles: 'triceps,abdominals',
    equipment_required: 'bodyweight',
    difficulty_level: 'beginner',
    instructions: 'Assume plank position and press through palms.',
    alternative_exercise_slugs: 'barbell_bench_press',
    is_built_in: true,
    user_profile_id: null,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
  {
    id: 3,
    slug: 'custom_reverse_lunge',
    name: 'Custom Reverse Lunge',
    movement_category: 'lunge',
    primary_muscle: 'quadriceps',
    secondary_muscles: 'glutes',
    equipment_required: 'dumbbell',
    difficulty_level: 'beginner',
    instructions: 'Step backwards and lower rear knee gently.',
    alternative_exercise_slugs: null,
    is_built_in: false,
    user_profile_id: 1,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
]

vi.mock('../services/exerciseService', () => ({
  exerciseService: {
    getExercises: vi.fn(),
    getExercise: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
  },
}))

vi.mock('../services/profileService', () => ({
  profileService: {
    getProfile: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('../services/measurementService', () => ({
  measurementService: {
    getLatestMeasurement: vi.fn().mockResolvedValue(null),
    listMeasurements: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}))

vi.mock('../services/mealLogService', () => ({
  mealLogService: {
    getDailySummary: vi.fn().mockResolvedValue({
      logged_date: '2026-10-25',
      totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      by_category: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      total_entries: 0,
    }),
  },
}))

import { exerciseService } from '../services/exerciseService'

describe('Exercise Catalogue and Workouts Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exerciseService.getExercises).mockResolvedValue(mockExercises)
  })

  it('renders exercise catalogue with exercises, search bar, and filter counts', async () => {
    render(<ExerciseCatalogueView />)

    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Standard Push-Up')).toBeInTheDocument()
    expect(screen.getByText('Custom Reverse Lunge')).toBeInTheDocument()

    // Check built-in vs custom pills
    expect(screen.getAllByText('Built-in').length).toBe(2)
    expect(screen.getByText('Custom')).toBeInTheDocument()

    // Total exercise badge
    expect(screen.getByText('3 Exercises')).toBeInTheDocument()
  })

  it('opens detail modal with technique cues when clicking an exercise card', async () => {
    render(<ExerciseCatalogueView />)

    const benchCard = await screen.findByText('Barbell Bench Press')
    await act(async () => {
      fireEvent.click(benchCard)
    })

    // Detail modal opens
    expect(screen.getByText('Execution Instructions & Technique Cues')).toBeInTheDocument()
    expect(screen.getAllByText('Lie on flat bench and press bar upward under control.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Push Up')).toBeInTheDocument()

    // Close detail modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Done/i }))
    })

    expect(screen.queryByText('Execution Instructions & Technique Cues')).not.toBeInTheDocument()
  })

  it('opens create exercise modal and submits custom exercise', async () => {
    vi.mocked(exerciseService.createExercise).mockResolvedValue({
      id: 4,
      slug: 'cable_face_pull',
      name: 'Cable Face Pull',
      movement_category: 'horizontal_pull',
      primary_muscle: 'shoulders',
      secondary_muscles: null,
      equipment_required: 'cable',
      difficulty_level: 'beginner',
      instructions: 'Pull rope toward forehead.',
      alternative_exercise_slugs: null,
      is_built_in: false,
      user_profile_id: 1,
      created_at: '2026-10-25T10:00:00',
      updated_at: '2026-10-25T10:00:00',
    })

    render(<ExerciseCatalogueView />)

    const addBtn = await screen.findByRole('button', { name: /Add Custom Exercise/i })
    await act(async () => {
      fireEvent.click(addBtn)
    })

    expect(screen.getByText('Create Custom Exercise')).toBeInTheDocument()

    const nameInput = screen.getByLabelText(/Exercise Name \*/i)
    fireEvent.change(nameInput, { target: { value: 'Cable Face Pull' } })

    const submitBtn = screen.getByRole('button', { name: /Create Exercise/i })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(exerciseService.createExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cable Face Pull',
      })
    )
  })

  it('filters exercises by type (All vs Built-in vs Custom)', async () => {
    render(<ExerciseCatalogueView />)

    await screen.findByText('Barbell Bench Press')

    // Filter to Custom only
    const customFilterBtn = screen.getByRole('button', { name: /Custom \(1\)/i })
    await act(async () => {
      fireEvent.click(customFilterBtn)
    })

    expect(screen.getByText('Custom Reverse Lunge')).toBeInTheDocument()
    expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument()
    expect(screen.queryByText('Standard Push-Up')).not.toBeInTheDocument()

    // Filter to Built-in only
    const builtInFilterBtn = screen.getByRole('button', { name: /Built-in \(2\)/i })
    await act(async () => {
      fireEvent.click(builtInFilterBtn)
    })

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Standard Push-Up')).toBeInTheDocument()
    expect(screen.queryByText('Custom Reverse Lunge')).not.toBeInTheDocument()
  })

  it('navigates to Workouts section from App primary navigation', async () => {
    render(<App />)

    expect(screen.getByText('FitPulse')).toBeInTheDocument()
    const workoutNavBtn = screen.getByRole('button', { name: /Workouts/i })
    expect(workoutNavBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(workoutNavBtn)
    })

    expect(await screen.findByText('Workouts & Training')).toBeInTheDocument()
    expect(screen.getAllByText('Exercise Catalogue').length).toBeGreaterThanOrEqual(1)
  })

  it('renders WorkoutDashboard sub-tabs and coming-soon views for future phases', async () => {
    render(<WorkoutDashboard />)

    expect(screen.getByText('Workouts & Training')).toBeInTheDocument()

    // Click Routines & Planner sub-tab
    const plannerTab = screen.getByRole('button', { name: /Routines & Planner/i })
    await act(async () => {
      fireEvent.click(plannerTab)
    })

    expect(
      screen.getByText(/Loading workout routine|Weekly Routine Planner|No Active Workout Routine/i)
    ).toBeInTheDocument()

    // Click Workout Log sub-tab
    const logTab = screen.getByRole('button', { name: /Workout Log/i })
    await act(async () => {
      fireEvent.click(logTab)
    })

    expect(
      screen.getByText(/Workout Log & Session History|Loading workout logs|No Workouts in Log/i)
    ).toBeInTheDocument()

    // Click Progress sub-tab
    const progressTab = screen.getByRole('button', { name: /Progress & Analytics/i })
    await act(async () => {
      fireEvent.click(progressTab)
    })

    expect(
      screen.getByText(
        /Workout Performance & Analytics|Progress Tracking|Loading workout analytics/i
      )
    ).toBeInTheDocument()
  })
})
