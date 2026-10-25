export interface ExerciseFrequencyItem {
  exercise_slug: string
  exercise_name: string
  primary_muscle: string
  completed_count: number
}

export interface WorkoutAnalyticsSummary {
  time_range: string
  total_completed_workouts: number
  active_training_days: number
  total_training_duration_seconds: number
  average_session_duration_seconds: number | null
  total_completed_sets: number
  total_completed_reps: number
  target_training_days_per_week: number
  consistency_percentage: number | null
  exercise_frequency: {
    exercise_slug: string
    exercise_name: string
    primary_muscle: string
    completed_count: number
  }[]
}

export interface WorkoutWeeklyDatapoint {
  week_label: string
  start_date: string
  end_date: string
  completed_workouts: number
  total_duration_minutes: number
  completed_sets: number
  target_workouts: number
  consistency_percent: number | null
}

export interface WorkoutWeeklySeries {
  time_range: string
  weeks: WorkoutWeeklyDatapoint[]
}

export interface ProgressionRecommendation {
  exercise_slug: string
  exercise_name: string
  category: 'increase_load' | 'maintain_load' | 'review_technique_recovery' | 'insufficient_data'
  headline: string
  rationale: string
  suggested_action: string
  supporting_evidence: string[]
  is_advisory: boolean
}

export interface LoggedSetPerformance {
  set_number: number
  weight_kg: number | null
  reps: number | null
  is_completed: boolean
  is_skipped: boolean
  estimated_1rm_kg: number | null
}

export interface ExerciseSessionPerformance {
  session_id: number
  session_name: string
  completed_at: string
  target_sets: number | null
  target_reps: string | null
  best_set_weight_kg: number | null
  session_estimated_1rm_kg: number | null
  total_volume_kg: number | null
  sets: LoggedSetPerformance[]
}

export interface ExercisePerformanceHistory {
  exercise_slug: string
  exercise_name: string
  primary_muscle: string
  equipment_required: string
  movement_category: string
  best_weight_kg: number | null
  best_reps_at_best_weight: number | null
  best_estimated_1rm_kg: number | null
  is_1rm_estimate: boolean
  total_completed_sessions: number
  total_completed_sets: number
  sessions: ExerciseSessionPerformance[]
  recommendation: ProgressionRecommendation | null
}

export interface LoggedExerciseSummaryItem {
  exercise_slug: string
  exercise_name: string
  primary_muscle: string
  equipment_required: string
  completed_sessions_count: number
}
