import type { Exercise } from './exercise'

export interface PlannedExercise {
  id: number
  planned_session_id: number
  exercise_id: number | null
  order_in_session: number
  exercise_slug: string
  exercise_name: string
  primary_muscle: string
  secondary_muscles: string | null
  movement_category: string
  equipment_required: string
  target_sets: number
  target_reps: string
  rest_seconds: number
  progression_notes: string | null
  warmup_guidance: string | null
}

export interface PlannedWorkoutSession {
  id: number
  workout_plan_id: number
  day_of_week_index: number
  day_of_week_name: string
  plan_date: string
  is_rest_day: boolean
  session_name: string
  session_focus: string
  estimated_duration_minutes: number
  requested_duration_minutes?: number | null
  warmup_notes: string | null
  cooldown_notes: string | null
  exercises: PlannedExercise[]
}

export interface WorkoutPlan {
  id: number
  user_profile_id: number
  name: string
  split_type: string
  start_date: string
  end_date: string
  is_active: boolean
  generation_settings: string | null
  notes: string | null
  created_at: string
  updated_at: string
  sessions: PlannedWorkoutSession[]
}

export interface WorkoutPlanSummary {
  id: number
  user_profile_id: number
  name: string
  split_type: string
  start_date: string
  end_date: string
  is_active: boolean
  session_count: number
  created_at: string
}

export interface WorkoutPlanGenerateRequest {
  start_date?: string | undefined
  name?: string | undefined
}

export interface ExerciseAlternativesResponse {
  current_planned_exercise_id: number
  current_exercise_name: string
  compatible_alternatives: Exercise[]
}

