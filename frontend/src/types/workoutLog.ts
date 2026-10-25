export interface LoggedExerciseSet {
  id?: number | undefined
  logged_exercise_id?: number | undefined
  set_number: number
  weight_kg: number | null
  reps: number | null
  is_completed: boolean
  is_skipped: boolean
  notes?: string | null | undefined
  completed_at?: string | null | undefined
}

export interface LoggedExercise {
  id?: number | undefined
  session_log_id?: number | undefined
  exercise_id?: number | null | undefined
  planned_exercise_id?: number | null | undefined
  order_in_session: number
  exercise_slug: string
  exercise_name: string
  primary_muscle: string
  equipment_required: string
  movement_category: string
  target_sets?: number | null | undefined
  target_reps?: string | null | undefined
  rest_seconds?: number | null | undefined
  notes?: string | null | undefined
  sets: LoggedExerciseSet[]
}

export interface WorkoutSessionLog {
  id: number
  user_profile_id: number
  workout_plan_id: number | null
  planned_session_id: number | null
  session_name: string
  session_focus: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  started_at: string
  completed_at: string | null
  duration_seconds: number
  notes: string | null
  created_at: string
  updated_at: string
  exercises: LoggedExercise[]
}

export interface WorkoutSessionLogSummary {
  id: number
  user_profile_id: number
  workout_plan_id: number | null
  planned_session_id: number | null
  session_name: string
  session_focus: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  started_at: string
  completed_at: string | null
  duration_seconds: number
  total_exercises: number
  completed_sets: number
  created_at: string
}

export interface WorkoutSessionStartRequest {
  planned_session_id?: number | undefined
  session_name?: string | undefined
  notes?: string | undefined
}

export interface WorkoutSessionLogUpdate {
  session_name?: string | undefined
  notes?: string | undefined
  duration_seconds?: number | undefined
  exercises?: LoggedExercise[] | undefined
}

