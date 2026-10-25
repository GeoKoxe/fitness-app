import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import type { Exercise } from '../types/exercise'
import type { SavedTrainingProfile, TrainingProfile } from '../types/trainingProfile'

const mockExercises: Exercise[] = [
  {
    id: 1,
    slug: 'push_up',
    name: 'Push-Up',
    movement_category: 'horizontal_push',
    primary_muscle: 'chest',
    secondary_muscles: 'triceps',
    equipment_required: 'bodyweight',
    difficulty_level: 'beginner',
    instructions: 'Standard push-up.',
    alternative_exercise_slugs: null,
    is_built_in: true,
    user_profile_id: null,
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
]

const initialProfile: TrainingProfile = {
  id: 1,
  user_profile_id: 1,
  experience_level: 'beginner',
  training_goals: ['general_fitness'],
  available_days: ['monday', 'wednesday', 'friday'],
  preferred_duration_minutes: 60,
  available_equipment: ['bodyweight'],
  excluded_exercises: [],
  excluded_muscle_groups: [],
  training_considerations: '',
}

const mockSavedConfigs: SavedTrainingProfile[] = [
  {
    id: 101,
    user_profile_id: 1,
    name: 'Travel Quick 30m',
    description: 'Hotel room bodyweight routine',
    experience_level: 'intermediate',
    training_goals: ['endurance'],
    available_days: ['tuesday', 'thursday'],
    preferred_duration_minutes: 30,
    available_equipment: ['bodyweight'],
    excluded_exercises: [],
    excluded_muscle_groups: [],
    training_considerations: 'Keep rest periods short',
    created_at: '2026-10-25T10:00:00',
    updated_at: '2026-10-25T10:00:00',
  },
]

vi.mock('../services/exerciseService', () => ({
  exerciseService: {
    getExercises: vi.fn(),
  },
}))

vi.mock('../services/trainingProfileService', () => ({
  trainingProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    listSavedConfigs: vi.fn(),
    createSavedConfig: vi.fn(),
    updateSavedConfig: vi.fn(),
    deleteSavedConfig: vi.fn(),
    applySavedConfig: vi.fn(),
  },
}))

import { exerciseService } from '../services/exerciseService'
import { trainingProfileService } from '../services/trainingProfileService'

describe('Training Profile Persistence and Saved Configurations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(exerciseService.getExercises).mockResolvedValue(mockExercises)
    vi.mocked(trainingProfileService.getProfile).mockResolvedValue({ ...initialProfile })
    vi.mocked(trainingProfileService.listSavedConfigs).mockResolvedValue([...mockSavedConfigs])
    vi.mocked(trainingProfileService.updateProfile).mockImplementation(async (data) => ({
      ...initialProfile,
      ...data,
      experience_level: data.experience_level ?? initialProfile.experience_level,
      training_goals: data.training_goals ?? initialProfile.training_goals,
      available_days: data.available_days ?? initialProfile.available_days,
      preferred_duration_minutes: data.preferred_duration_minutes ?? initialProfile.preferred_duration_minutes,
      available_equipment: data.available_equipment ?? initialProfile.available_equipment,
      excluded_exercises: data.excluded_exercises ?? initialProfile.excluded_exercises,
      excluded_muscle_groups: data.excluded_muscle_groups ?? initialProfile.excluded_muscle_groups,
      training_considerations: data.training_considerations ?? initialProfile.training_considerations,
    }))
    vi.mocked(trainingProfileService.createSavedConfig).mockImplementation(async (data) => ({
      id: 102,
      user_profile_id: 1,
      name: data.name,
      description: data.description ?? null,
      experience_level: data.experience_level ?? 'beginner',
      training_goals: data.training_goals ?? ['general_fitness'],
      available_days: data.available_days ?? ['monday'],
      preferred_duration_minutes: data.preferred_duration_minutes ?? 60,
      available_equipment: data.available_equipment ?? ['bodyweight'],
      excluded_exercises: data.excluded_exercises ?? [],
      excluded_muscle_groups: data.excluded_muscle_groups ?? [],
      training_considerations: data.training_considerations ?? null,
      created_at: '2026-10-25T11:00:00',
      updated_at: '2026-10-25T11:00:00',
    }))
    vi.mocked(trainingProfileService.applySavedConfig).mockImplementation(async () => ({
      ...initialProfile,
      experience_level: 'intermediate',
      preferred_duration_minutes: 30,
      training_goals: ['endurance'],
      available_days: ['tuesday', 'thursday'],
    }))
  })

  it('preserves unsaved edits across tab navigation and displays unsaved changes banner', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    // Navigate to Training Profile
    const profileTab = screen.getByRole('button', { name: /training profile/i })
    await act(async () => {
      fireEvent.click(profileTab)
    })

    // Initially no unsaved changes banner
    expect(
      screen.queryByText(/you have unsaved changes to this profile/i)
    ).not.toBeInTheDocument()

    // Change duration to 45 min preset
    const preset45 = screen.getByRole('button', { name: '45m' })
    await act(async () => {
      fireEvent.click(preset45)
    })

    // Unsaved changes banner should now appear
    expect(
      screen.getByText(/you have unsaved changes to this profile/i)
    ).toBeInTheDocument()

    // Navigate away to Exercise Catalogue tab
    const catalogueTab = screen.getByRole('button', { name: /exercise catalogue/i })
    await act(async () => {
      fireEvent.click(catalogueTab)
    })
    expect(
      screen.getByRole('heading', { name: /exercise catalogue/i })
    ).toBeInTheDocument()

    // Navigate back to Training Profile tab
    await act(async () => {
      fireEvent.click(profileTab)
    })

    // Verify 45 min duration and unsaved changes banner are preserved!
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(
      screen.getByText(/you have unsaved changes to this profile/i)
    ).toBeInTheDocument()
  })

  it('discards unsaved edits when Discard Edits is clicked', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const profileTab = screen.getByRole('button', { name: /training profile/i })
    await act(async () => {
      fireEvent.click(profileTab)
    })

    // Change duration to 90m
    const preset90 = screen.getByRole('button', { name: '90m' })
    await act(async () => {
      fireEvent.click(preset90)
    })
    expect(screen.getByText('90')).toBeInTheDocument()

    // Click Discard Edits in banner
    const discardBtn = screen.getByRole('button', { name: /discard edits/i })
    await act(async () => {
      fireEvent.click(discardBtn)
    })

    // Reverted back to initial 60 minutes and banner cleared
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(
      screen.queryByText(/you have unsaved changes to this profile/i)
    ).not.toBeInTheDocument()
  })

  it('duration slider uses strict 15-minute steps and presets', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const profileTab = screen.getByRole('button', { name: /training profile/i })
    await act(async () => {
      fireEvent.click(profileTab)
    })

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('step', '15')
    expect(slider).toHaveAttribute('min', '15')
    expect(slider).toHaveAttribute('max', '180')

    // Test preset clicks: 15m, 30m, 75m, 120m
    for (const presetVal of ['15m', '30m', '75m', '120m']) {
      const btn = screen.getByRole('button', { name: presetVal })
      await act(async () => {
        fireEvent.click(btn)
      })
      expect(screen.getByText(presetVal.replace('m', ''))).toBeInTheDocument()
    }
  })

  it('supports saving current settings as a new named configuration preset and applying to active', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const profileTab = screen.getByRole('button', { name: /training profile/i })
    await act(async () => {
      fireEvent.click(profileTab)
    })

    // Click "Save as New Profile" button
    const saveAsNewBtn = screen.getByRole('button', { name: /save as new profile/i })
    await act(async () => {
      fireEvent.click(saveAsNewBtn)
    })

    // Modal appears
    expect(screen.getByText(/save as new profile configuration/i)).toBeInTheDocument()
    const nameInput = screen.getByPlaceholderText(/travel bodyweight routine/i)
    fireEvent.change(nameInput, { target: { value: 'Home Gym Heavy' } })

    // Save in modal
    const modalSaveBtn = screen.getByRole('button', { name: /save profile preset/i })
    await act(async () => {
      fireEvent.click(modalSaveBtn)
    })

    expect(trainingProfileService.createSavedConfig).toHaveBeenCalled()

    // Select existing saved configuration from dropdown
    const select = screen.getByRole('combobox', { name: /select saved configuration/i })
    await act(async () => {
      fireEvent.change(select, { target: { value: '101' } })
    })

    // Action buttons visible for selected config
    const applyBtn = screen.getByRole('button', { name: /apply to active/i })
    await act(async () => {
      fireEvent.click(applyBtn)
    })

    expect(trainingProfileService.applySavedConfig).toHaveBeenCalledWith(101)
  })
})
