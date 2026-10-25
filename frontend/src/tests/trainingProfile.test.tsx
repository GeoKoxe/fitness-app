import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingProfileView } from '../features/workouts/TrainingProfileView'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import type { Exercise } from '../types/exercise'
import type { TrainingProfile } from '../types/trainingProfile'

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
    instructions: 'Lie on flat bench and press bar upward.',
    alternative_exercise_slugs: 'push_up',
    is_built_in: true,
    user_profile_id: null,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
  {
    id: 2,
    slug: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    movement_category: 'squat',
    primary_muscle: 'quadriceps',
    secondary_muscles: 'glutes,lower_back',
    equipment_required: 'barbell',
    difficulty_level: 'intermediate',
    instructions: 'Squat down with barbell on upper back.',
    alternative_exercise_slugs: null,
    is_built_in: true,
    user_profile_id: null,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
]

const initialMockProfile: TrainingProfile = {
  id: 10,
  user_profile_id: 1,
  experience_level: 'beginner',
  training_goals: ['general_fitness'],
  available_days: ['monday', 'wednesday', 'friday'],
  preferred_duration_minutes: 60,
  available_equipment: ['bodyweight', 'dumbbell'],
  excluded_exercises: [],
  excluded_muscle_groups: [],
  training_considerations: 'Minor left shoulder tightness',
}

vi.mock('../services/exerciseService', () => ({
  exerciseService: {
    getExercises: vi.fn(),
  },
}))

vi.mock('../services/trainingProfileService', () => ({
  trainingProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

import { exerciseService } from '../services/exerciseService'
import { trainingProfileService } from '../services/trainingProfileService'

describe('Training Profile and Equipment Configuration (Phase 7.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exerciseService.getExercises).mockResolvedValue(mockExercises)
    vi.mocked(trainingProfileService.getProfile).mockResolvedValue({
      ...initialMockProfile,
    })
    vi.mocked(trainingProfileService.updateProfile).mockImplementation(
      async (data) => ({
        id: 10,
        user_profile_id: 1,
        experience_level: data.experience_level ?? 'beginner',
        training_goals: data.training_goals ?? ['general_fitness'],
        available_days: data.available_days ?? ['monday', 'wednesday', 'friday'],
        preferred_duration_minutes: data.preferred_duration_minutes ?? 60,
        available_equipment: data.available_equipment ?? ['bodyweight', 'dumbbell'],
        excluded_exercises: data.excluded_exercises ?? [],
        excluded_muscle_groups: data.excluded_muscle_groups ?? [],
        training_considerations: data.training_considerations ?? null,
      })
    )
  })

  it('navigates to Training Profile tab within WorkoutDashboard and renders form', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    // Initially on Exercise Catalogue
    expect(
      screen.getByRole('button', { name: /exercise catalogue/i })
    ).toBeInTheDocument()

    // Click Training Profile tab
    const profileTabBtn = screen.getByRole('button', {
      name: /training profile/i,
    })
    await act(async () => {
      fireEvent.click(profileTabBtn)
    })

    // Profile header and sections rendered
    expect(
      screen.getByText('Training Profile & Equipment')
    ).toBeInTheDocument()
    expect(screen.getByText('1. Experience Level')).toBeInTheDocument()
    expect(screen.getByText('2. Primary Training Goals')).toBeInTheDocument()
    expect(screen.getByText('3. Available Workout Days')).toBeInTheDocument()
    expect(screen.getByText('4. Preferred Session Duration')).toBeInTheDocument()
    expect(screen.getByText('5. Available Equipment')).toBeInTheDocument()
    expect(screen.getByText('6. Excluded Muscle Groups')).toBeInTheDocument()
    expect(screen.getByText('7. Excluded Specific Exercises')).toBeInTheDocument()
    expect(
      screen.getByText('8. Training Considerations & Physical Limitations')
    ).toBeInTheDocument()
  })

  it('loads and displays initial saved training profile values', async () => {
    await act(async () => {
      render(<TrainingProfileView />)
    })

    expect(screen.getByText('Beginner')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('Minor left shoulder tightness')
    ).toBeInTheDocument()
    expect(screen.getByText('3 days / wk')).toBeInTheDocument()
  })

  it('updates experience level, goals, weekdays, duration, and saves successfully', async () => {
    await act(async () => {
      render(<TrainingProfileView />)
    })

    // 1. Select Intermediate
    const intermediateBtn = screen.getByRole('button', {
      name: /intermediate/i,
    })
    await act(async () => {
      fireEvent.click(intermediateBtn)
    })

    // 2. Add Strength goal
    const strengthBtn = screen.getByRole('button', { name: 'Strength' })
    await act(async () => {
      fireEvent.click(strengthBtn)
    })

    // 3. Quick preset 4-Day Upper/Lower
    const preset4DayBtn = screen.getByRole('button', {
      name: /4-day upper\/lower/i,
    })
    await act(async () => {
      fireEvent.click(preset4DayBtn)
    })
    expect(screen.getByText('4 days / wk')).toBeInTheDocument()

    // 4. Quick preset 45m duration
    const preset45mBtn = screen.getByRole('button', { name: '45m' })
    await act(async () => {
      fireEvent.click(preset45mBtn)
    })

    // 5. Select Standard Gym equipment
    const standardGymBtn = screen.getByRole('button', { name: 'Standard Gym' })
    await act(async () => {
      fireEvent.click(standardGymBtn)
    })

    // 6. Submit save configuration (use first save button)
    const saveBtns = screen.getAllByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveBtns[0])
    })

    // Assert updateProfile was called with expected arguments
    expect(trainingProfileService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        experience_level: 'intermediate',
        training_goals: expect.arrayContaining(['general_fitness', 'strength']),
        available_days: ['monday', 'tuesday', 'thursday', 'friday'],
        preferred_duration_minutes: 45,
        available_equipment: expect.arrayContaining(['barbell', 'dumbbell', 'bench']),
      })
    )

    // Check success notification
    expect(
      await screen.findByText(/saved successfully/i)
    ).toBeInTheDocument()
  })

  it('allows adding and removing excluded exercises and muscle groups', async () => {
    await act(async () => {
      render(<TrainingProfileView />)
    })

    // Exclude muscle group (e.g. Chest)
    const chestBtn = screen.getByRole('button', { name: 'Chest' })
    await act(async () => {
      fireEvent.click(chestBtn)
    })
    expect(screen.getByText('✕ Chest')).toBeInTheDocument()
    expect(screen.getByText('1 Excluded')).toBeInTheDocument()

    // Search and exclude exercise
    const searchInput = screen.getByPlaceholderText(
      /search exercise to exclude/i
    )
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'bench' } })
    })

    // Click candidate exercise from dropdown
    const benchPressCandidate = await screen.findByRole('button', {
      name: /barbell bench press/i,
    })
    await act(async () => {
      fireEvent.click(benchPressCandidate)
    })

    // Excluded exercise pill displayed
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()

    // Remove exercise exclusion
    const removeBtn = screen.getByRole('button', {
      name: /remove barbell bench press from exclusions/i,
    })
    await act(async () => {
      fireEvent.click(removeBtn)
    })
    expect(
      screen.queryByRole('button', {
        name: /remove barbell bench press from exclusions/i,
      })
    ).not.toBeInTheDocument()
  })

  it('preserves user changes when backend save fails', async () => {
    vi.mocked(trainingProfileService.updateProfile).mockRejectedValueOnce(
      new Error('Database network timeout')
    )

    await act(async () => {
      render(<TrainingProfileView />)
    })

    // Type new notes in considerations
    const notesArea = screen.getByPlaceholderText(/mild right rotator cuff/i)
    await act(async () => {
      fireEvent.change(notesArea, {
        target: { value: 'Torn meniscus rehab in progress' },
      })
    })

    // Attempt save
    const saveBtn = screen.getByRole('button', { name: /save configuration/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    // Error banner shown
    expect(
      await screen.findByText('Database network timeout')
    ).toBeInTheDocument()

    // Input preserved!
    expect(
      screen.getByDisplayValue('Torn meniscus rehab in progress')
    ).toBeInTheDocument()
  })

  it('resets form back to last loaded state when Reset button is clicked', async () => {
    await act(async () => {
      render(<TrainingProfileView />)
    })

    // Change experience level to advanced
    const advancedBtn = screen.getByRole('button', { name: /advanced/i })
    await act(async () => {
      fireEvent.click(advancedBtn)
    })

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: 'Reset Changes' })
    await act(async () => {
      fireEvent.click(resetBtn)
    })

    // Message shown
    expect(
      screen.getByText(/profile reset to last saved state/i)
    ).toBeInTheDocument()
  })
})
