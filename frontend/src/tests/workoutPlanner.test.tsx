import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import { WorkoutPlannerView } from '../features/workouts/WorkoutPlannerView'
import type { Exercise } from '../types/exercise'
import type { WorkoutPlan } from '../types/workoutPlan'

const mockPlan: WorkoutPlan = {
  id: 1,
  user_profile_id: 1,
  name: '7-Day Full Body Routine',
  split_type: 'full_body',
  start_date: '2026-10-26',
  end_date: '2026-11-01',
  is_active: true,
  generation_settings: null,
  notes: 'Generated for Beginner level',
  created_at: '2026-10-26T08:00:00',
  updated_at: '2026-10-26T08:00:00',
  sessions: [
    {
      id: 101,
      workout_plan_id: 1,
      day_of_week_index: 0,
      day_of_week_name: 'monday',
      plan_date: '2026-10-26',
      is_rest_day: false,
      session_name: 'Full Body A',
      session_focus: 'Quad & Push Emphasis',
      estimated_duration_minutes: 60,
      warmup_notes: '5-10 min dynamic mobility: leg swings, cat-cow.',
      cooldown_notes: '5 min static stretching.',
      exercises: [
        {
          id: 501,
          planned_session_id: 101,
          exercise_id: 1,
          order_in_session: 1,
          exercise_slug: 'barbell_back_squat',
          exercise_name: 'Barbell Back Squat',
          primary_muscle: 'quadriceps',
          secondary_muscles: 'glutes',
          movement_category: 'squat',
          equipment_required: 'barbell',
          target_sets: 3,
          target_reps: '8-10',
          rest_seconds: 90,
          progression_notes: 'Linear progression cue',
          warmup_guidance: '2 warm-up sets',
        },
        {
          id: 502,
          planned_session_id: 101,
          exercise_id: 2,
          order_in_session: 2,
          exercise_slug: 'barbell_bench_press',
          exercise_name: 'Barbell Bench Press',
          primary_muscle: 'chest',
          secondary_muscles: 'triceps',
          movement_category: 'horizontal_push',
          equipment_required: 'barbell',
          target_sets: 3,
          target_reps: '8-10',
          rest_seconds: 90,
          progression_notes: 'Linear progression cue',
          warmup_guidance: '1-2 warm-up sets',
        },
      ],
    },
    {
      id: 102,
      workout_plan_id: 1,
      day_of_week_index: 1,
      day_of_week_name: 'tuesday',
      plan_date: '2026-10-27',
      is_rest_day: true,
      session_name: 'Rest & Recovery',
      session_focus: 'Recovery & Adaptation',
      estimated_duration_minutes: 0,
      warmup_notes: 'Optional 20 min walk.',
      cooldown_notes: null,
      exercises: [],
    },
  ],
}

const mockAlternativeExercise: Exercise = {
  id: 3,
  slug: 'goblet_squat',
  name: 'Dumbbell Goblet Squat',
  movement_category: 'squat',
  primary_muscle: 'quadriceps',
  secondary_muscles: 'glutes',
  equipment_required: 'dumbbell',
  difficulty_level: 'beginner',
  instructions: 'Hold dumbbell at chest and squat.',
  alternative_exercise_slugs: null,
  is_built_in: true,
  user_profile_id: null,
  created_at: '2026-10-26T08:00:00',
  updated_at: '2026-10-26T08:00:00',
}

vi.mock('../services/workoutPlanService', () => ({
  workoutPlanService: {
    getActivePlan: vi.fn(),
    generatePlan: vi.fn(),
    listPlans: vi.fn(),
    getPlanById: vi.fn(),
    getAlternatives: vi.fn(),
    replaceExercise: vi.fn(),
    regenerateExercise: vi.fn(),
  },
}))

import { workoutPlanService } from '../services/workoutPlanService'

describe('Workout Planner & Routine Generation (Phase 7.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workoutPlanService.getActivePlan).mockResolvedValue(mockPlan)
    vi.mocked(workoutPlanService.listPlans).mockResolvedValue([
      {
        id: 1,
        user_profile_id: 1,
        name: '7-Day Full Body Routine',
        split_type: 'full_body',
        start_date: '2026-10-26',
        end_date: '2026-11-01',
        is_active: true,
        session_count: 7,
        created_at: '2026-10-26T08:00:00',
      },
    ])
    vi.mocked(workoutPlanService.getAlternatives).mockResolvedValue({
      current_planned_exercise_id: 501,
      current_exercise_name: 'Barbell Back Squat',
      compatible_alternatives: [mockAlternativeExercise],
    })
    vi.mocked(workoutPlanService.replaceExercise).mockResolvedValue({
      ...mockPlan,
      sessions: [
        {
          ...mockPlan.sessions[0],
          exercises: [
            {
              ...mockPlan.sessions[0].exercises[0],
              exercise_id: 3,
              exercise_slug: 'goblet_squat',
              exercise_name: 'Dumbbell Goblet Squat',
              equipment_required: 'dumbbell',
            },
            mockPlan.sessions[0].exercises[1],
          ],
        },
        mockPlan.sessions[1],
      ],
    })
    vi.mocked(workoutPlanService.regenerateExercise).mockResolvedValue({
      ...mockPlan,
      sessions: [
        {
          ...mockPlan.sessions[0],
          exercises: [
            {
              ...mockPlan.sessions[0].exercises[0],
              exercise_id: 3,
              exercise_slug: 'goblet_squat',
              exercise_name: 'Dumbbell Goblet Squat',
            },
            mockPlan.sessions[0].exercises[1],
          ],
        },
        mockPlan.sessions[1],
      ],
    })
  })

  it('navigates to Routines & Planner sub-tab within WorkoutDashboard and renders active routine', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const plannerTabBtn = screen.getByRole('button', {
      name: /routines & planner/i,
    })
    await act(async () => {
      fireEvent.click(plannerTabBtn)
    })

    const mondayBtn = screen.getByRole('button', { name: /mon/i })
    await act(async () => {
      fireEvent.click(mondayBtn)
    })

    // Plan header rendered
    expect(screen.getByText('7-Day Full Body Routine')).toBeInTheDocument()
    expect(screen.getByText('full body')).toBeInTheDocument()
    expect(screen.getByText(/Barbell Back Squat/i)).toBeInTheDocument()
    expect(screen.getByText(/Barbell Bench Press/i)).toBeInTheDocument()
  })

  it('renders empty state when no active routine exists and allows generation', async () => {
    vi.mocked(workoutPlanService.getActivePlan).mockResolvedValueOnce(null)
    vi.mocked(workoutPlanService.generatePlan).mockResolvedValueOnce(mockPlan)

    await act(async () => {
      render(<WorkoutPlannerView />)
    })

    expect(screen.getByText('No Active Workout Routine')).toBeInTheDocument()

    const generateBtn = screen.getByRole('button', {
      name: /generate your first routine/i,
    })
    await act(async () => {
      fireEvent.click(generateBtn)
    })

    expect(workoutPlanService.generatePlan).toHaveBeenCalledWith({})
    expect(await screen.findByText('7-Day Full Body Routine')).toBeInTheDocument()
  })

  it('allows switching days between workout sessions and rest days', async () => {
    await act(async () => {
      render(<WorkoutPlannerView />)
    })

    // Click Tuesday (Rest day in mockPlan)
    const tuesdayBtn = screen.getByRole('button', { name: /tue/i })
    await act(async () => {
      fireEvent.click(tuesdayBtn)
    })

    expect(screen.getByText('Recovery & Adaptation Day')).toBeInTheDocument()

    // Click Monday (Active workout session)
    const mondayBtn = screen.getByRole('button', { name: /mon/i })
    await act(async () => {
      fireEvent.click(mondayBtn)
    })

    expect(screen.getByText('Quad & Push Emphasis')).toBeInTheDocument()
    expect(screen.getByText('Barbell Back Squat')).toBeInTheDocument()
  })

  it('regenerates a planned exercise slot with a compatible alternative', async () => {
    await act(async () => {
      render(<WorkoutPlannerView />)
    })

    // Click Monday
    const mondayBtn = screen.getByRole('button', { name: /mon/i })
    await act(async () => {
      fireEvent.click(mondayBtn)
    })

    const regenBtn = screen.getByRole('button', {
      name: /regenerate barbell back squat/i,
    })
    await act(async () => {
      fireEvent.click(regenBtn)
    })

    expect(workoutPlanService.regenerateExercise).toHaveBeenCalledWith(1, 501)
    expect(
      await screen.findByText(/slot regenerated with compatible alternative/i)
    ).toBeInTheDocument()
  })

  it('opens replacement modal, loads alternatives, and replaces exercise', async () => {
    await act(async () => {
      render(<WorkoutPlannerView />)
    })

    // Click Monday
    const mondayBtn = screen.getByRole('button', { name: /mon/i })
    await act(async () => {
      fireEvent.click(mondayBtn)
    })

    // Click Replace on first exercise
    const replaceBtns = screen.getAllByRole('button', { name: /replace/i })
    await act(async () => {
      fireEvent.click(replaceBtns[0])
    })

    // Modal opens
    expect(screen.getByText('Replace Planned Exercise')).toBeInTheDocument()
    expect(
      await screen.findByText('Dumbbell Goblet Squat')
    ).toBeInTheDocument()

    // Confirm replacement
    const confirmBtn = screen.getByRole('button', {
      name: /confirm replacement/i,
    })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(workoutPlanService.replaceExercise).toHaveBeenCalledWith(1, 501, 3)
  })

  it('displays error banner if routine generation fails due to constraints', async () => {
    vi.mocked(workoutPlanService.generatePlan).mockRejectedValueOnce(
      new Error('No exercises found matching your available equipment')
    )

    await act(async () => {
      render(<WorkoutPlannerView />)
    })

    // Click regenerate button (triggers confirmation dialog first)
    const topGenBtn = screen.getByRole('button', {
      name: /regenerate weekly plan/i,
    })
    await act(async () => {
      fireEvent.click(topGenBtn)
    })

    // Confirm dialog shown
    expect(
      screen.getByText('Replace Active Workout Plan?')
    ).toBeInTheDocument()
    const confirmGenBtn = screen.getByRole('button', {
      name: /confirm & generate/i,
    })
    await act(async () => {
      fireEvent.click(confirmGenBtn)
    })

    // Error banner shown
    expect(
      await screen.findByText(
        'No exercises found matching your available equipment'
      )
    ).toBeInTheDocument()
  })
})
