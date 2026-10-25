import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutAnalyticsView } from '../features/workouts/WorkoutAnalyticsView'
import { WorkoutDashboard } from '../features/workouts/WorkoutDashboard'
import type {
  ExercisePerformanceHistory,
  LoggedExerciseSummaryItem,
  WorkoutAnalyticsSummary,
  WorkoutWeeklySeries,
} from '../types/workoutAnalytics'

const mockSummary: WorkoutAnalyticsSummary = {
  time_range: '4w',
  total_completed_workouts: 8,
  active_training_days: 7,
  total_training_duration_seconds: 28800, // 8 hours = 480 mins
  average_session_duration_seconds: 3600, // 60 mins
  total_completed_sets: 48,
  total_completed_reps: 450,
  target_training_days_per_week: 3,
  consistency_percentage: 66.7,
  exercise_frequency: [
    {
      exercise_slug: 'barbell_bench_press',
      exercise_name: 'Barbell Bench Press',
      primary_muscle: 'chest',
      completed_count: 4,
    },
    {
      exercise_slug: 'barbell_squat',
      exercise_name: 'Barbell Squat',
      primary_muscle: 'quadriceps',
      completed_count: 4,
    },
  ],
}

const mockWeeklySeries: WorkoutWeeklySeries = {
  time_range: '4w',
  weeks: [
    {
      week_label: 'Oct 01 - Oct 07',
      start_date: '2026-10-01',
      end_date: '2026-10-07',
      completed_workouts: 2,
      total_duration_minutes: 120,
      completed_sets: 12,
      target_workouts: 3,
      consistency_percent: 66.7,
    },
    {
      week_label: 'Oct 08 - Oct 14',
      start_date: '2026-10-08',
      end_date: '2026-10-14',
      completed_workouts: 2,
      total_duration_minutes: 125,
      completed_sets: 12,
      target_workouts: 3,
      consistency_percent: 66.7,
    },
  ],
}

const mockLoggedExercises: LoggedExerciseSummaryItem[] = [
  {
    exercise_slug: 'barbell_bench_press',
    exercise_name: 'Barbell Bench Press',
    primary_muscle: 'chest',
    equipment_required: 'barbell',
    completed_sessions_count: 4,
  },
  {
    exercise_slug: 'barbell_squat',
    exercise_name: 'Barbell Squat',
    primary_muscle: 'quadriceps',
    equipment_required: 'barbell',
    completed_sessions_count: 4,
  },
]

const mockBenchHistory: ExercisePerformanceHistory = {
  exercise_slug: 'barbell_bench_press',
  exercise_name: 'Barbell Bench Press',
  primary_muscle: 'chest',
  equipment_required: 'barbell',
  movement_category: 'horizontal_push',
  best_weight_kg: 85.0,
  best_reps_at_best_weight: 10,
  best_estimated_1rm_kg: 113.3,
  is_1rm_estimate: true,
  total_completed_sessions: 4,
  total_completed_sets: 12,
  sessions: [
    {
      session_id: 10,
      session_name: 'Upper Body A',
      completed_at: '2026-10-24 10:00',
      target_sets: 3,
      target_reps: '8-10',
      best_set_weight_kg: 85.0,
      session_estimated_1rm_kg: 113.3,
      total_volume_kg: 2550.0,
      sets: [
        {
          set_number: 1,
          weight_kg: 85.0,
          reps: 10,
          is_completed: true,
          is_skipped: false,
          estimated_1rm_kg: 113.3,
        },
        {
          set_number: 2,
          weight_kg: 85.0,
          reps: 10,
          is_completed: true,
          is_skipped: false,
          estimated_1rm_kg: 113.3,
        },
        {
          set_number: 3,
          weight_kg: 85.0,
          reps: 10,
          is_completed: true,
          is_skipped: false,
          estimated_1rm_kg: 113.3,
        },
      ],
    },
  ],
  recommendation: {
    exercise_slug: 'barbell_bench_press',
    exercise_name: 'Barbell Bench Press',
    category: 'increase_load',
    headline: 'Consider increasing load (+2.5 kg)',
    rationale:
      'All 3 sets cleanly met or exceeded the upper target of 10 reps at 85.0 kg.',
    suggested_action:
      'Increase working weight by approximately 2.5 kg next session, aiming for 8 reps.',
    supporting_evidence: [
      'Prescription: 3 sets × 8-10 reps',
      'Recent Performance: Set 1: 10 reps @ 85.0kg, Set 2: 10 reps @ 85.0kg, Set 3: 10 reps @ 85.0kg',
      'Best estimated 1RM: 113.3 kg (Epley estimate)',
    ],
    is_advisory: true,
  },
}

const mockSquatHistory: ExercisePerformanceHistory = {
  exercise_slug: 'barbell_squat',
  exercise_name: 'Barbell Squat',
  primary_muscle: 'quadriceps',
  equipment_required: 'barbell',
  movement_category: 'squat',
  best_weight_kg: 110.0,
  best_reps_at_best_weight: 8,
  best_estimated_1rm_kg: 139.3,
  is_1rm_estimate: true,
  total_completed_sessions: 4,
  total_completed_sets: 12,
  sessions: [],
  recommendation: {
    exercise_slug: 'barbell_squat',
    exercise_name: 'Barbell Squat',
    category: 'maintain_load',
    headline: 'Maintain current load',
    rationale:
      'You are successfully training within the target rep range (8-10 reps).',
    suggested_action: 'Keep 110.0 kg working weight and aim for 9 reps.',
    supporting_evidence: ['Prescription: 3 sets × 8-10 reps'],
    is_advisory: true,
  },
}

vi.mock('../services/workoutAnalyticsService', () => ({
  workoutAnalyticsService: {
    getSummary: vi.fn(),
    getWeeklySeries: vi.fn(),
    listLoggedExercises: vi.fn(),
    getExerciseHistory: vi.fn(),
    getRecommendations: vi.fn(),
  },
}))

import { workoutAnalyticsService } from '../services/workoutAnalyticsService'

describe('Workout Analytics & Progression Recommendations (Phase 7.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workoutAnalyticsService.getSummary).mockResolvedValue(mockSummary)
    vi.mocked(workoutAnalyticsService.getWeeklySeries).mockResolvedValue(mockWeeklySeries)
    vi.mocked(workoutAnalyticsService.listLoggedExercises).mockResolvedValue(mockLoggedExercises)
    vi.mocked(workoutAnalyticsService.getExerciseHistory).mockImplementation(
      async (slug) => {
        if (slug === 'barbell_squat') return mockSquatHistory
        return mockBenchHistory
      }
    )
  })

  it('navigates to Progress & Analytics tab from WorkoutDashboard and renders dashboard', async () => {
    await act(async () => {
      render(<WorkoutDashboard />)
    })

    const progressTabBtn = screen.getByRole('button', {
      name: /progress & analytics/i,
    })
    await act(async () => {
      fireEvent.click(progressTabBtn)
    })

    expect(
      screen.getByText('Workout Performance & Analytics')
    ).toBeInTheDocument()
    expect(screen.getByText('Workouts logged')).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()
  })

  it('renders summary metrics, weekly series, and toggle table', async () => {
    await act(async () => {
      render(<WorkoutAnalyticsView />)
    })

    // Check KPIs
    expect(screen.getByText('8')).toBeInTheDocument() // completed workouts
    expect(screen.getByText('7')).toBeInTheDocument() // active days
    expect(screen.getByText('8h 0m')).toBeInTheDocument() // training time
    expect(screen.getByText('48')).toBeInTheDocument() // completed sets
    expect(screen.getByText('450')).toBeInTheDocument() // reps

    // Check Weekly Visual cards
    expect(screen.getByText('Oct 01 - Oct 07')).toBeInTheDocument()
    expect(screen.getByText('Oct 08 - Oct 14')).toBeInTheDocument()

    // Toggle data table
    const tableToggleBtn = screen.getByRole('button', {
      name: /show data table/i,
    })
    await act(async () => {
      fireEvent.click(tableToggleBtn)
    })

    expect(screen.getByText('Week Window')).toBeInTheDocument()
    expect(screen.getByText('Schedule Target')).toBeInTheDocument()
  })

  it('switches time range presets and requests updated analytics', async () => {
    await act(async () => {
      render(<WorkoutAnalyticsView />)
    })

    const twelveWeeksBtn = screen.getByRole('button', {
      name: /last 12 weeks/i,
    })
    await act(async () => {
      fireEvent.click(twelveWeeksBtn)
    })

    expect(workoutAnalyticsService.getSummary).toHaveBeenCalledWith('12w')
    expect(workoutAnalyticsService.getWeeklySeries).toHaveBeenCalledWith('12w')

    const allHistoryBtn = screen.getByRole('button', {
      name: /all history/i,
    })
    await act(async () => {
      fireEvent.click(allHistoryBtn)
    })

    expect(workoutAnalyticsService.getSummary).toHaveBeenCalledWith('all')
    expect(workoutAnalyticsService.getWeeklySeries).toHaveBeenCalledWith('all')
  })

  it('allows selecting different exercises to review performance history & progression', async () => {
    await act(async () => {
      render(<WorkoutAnalyticsView />)
    })

    // Initially loads first exercise (barbell bench press)
    expect(await screen.findByText('85 kg')).toBeInTheDocument()
    expect(screen.getAllByText('113.3 kg').length).toBeGreaterThan(0)
    expect(screen.getByText('Consider increasing load (+2.5 kg)')).toBeInTheDocument()
    expect(
      screen.getByText(/All 3 sets cleanly met or exceeded the upper target/i)
    ).toBeInTheDocument()

    // Change exercise selector to Barbell Squat
    const selector = screen.getByLabelText(/exercise:/i)
    await act(async () => {
      fireEvent.change(selector, { target: { value: 'barbell_squat' } })
    })

    expect(workoutAnalyticsService.getExerciseHistory).toHaveBeenCalledWith(
      'barbell_squat',
      '4w'
    )
    expect(await screen.findByText('110 kg')).toBeInTheDocument()
    expect(screen.getByText('Maintain current load')).toBeInTheDocument()
  })

  it('renders empty state when no exercises have been logged', async () => {
    vi.mocked(workoutAnalyticsService.getSummary).mockResolvedValueOnce({
      ...mockSummary,
      total_completed_workouts: 0,
      total_completed_sets: 0,
      total_completed_reps: 0,
      total_training_duration_seconds: 0,
      average_session_duration_seconds: null,
      consistency_percentage: null,
      exercise_frequency: [],
    })
    vi.mocked(workoutAnalyticsService.listLoggedExercises).mockResolvedValueOnce([])

    await act(async () => {
      render(<WorkoutAnalyticsView />)
    })

    expect(
      screen.getByText(/No completed exercises in history yet/i)
    ).toBeInTheDocument()
  })

  it('displays error banner and allows retry when API fails', async () => {
    vi.mocked(workoutAnalyticsService.getSummary).mockRejectedValueOnce(
      new Error('Database network timeout')
    )

    await act(async () => {
      render(<WorkoutAnalyticsView />)
    })

    expect(screen.getByText('Database network timeout')).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })

    vi.mocked(workoutAnalyticsService.getSummary).mockResolvedValueOnce(mockSummary)
    await act(async () => {
      fireEvent.click(retryBtn)
    })

    expect(
      await screen.findByText('Workout Performance & Analytics')
    ).toBeInTheDocument()
  })
})
