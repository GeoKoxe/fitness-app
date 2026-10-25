export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Exercise {
  id: number
  slug: string
  name: string
  movement_category: string
  primary_muscle: string
  secondary_muscles: string | null
  equipment_required: string
  difficulty_level: DifficultyLevel
  instructions: string | null
  alternative_exercise_slugs: string | null
  is_built_in: boolean
  user_profile_id: number | null
  created_at: string
  updated_at: string
}

export interface ExerciseCreate {
  name: string
  movement_category: string
  primary_muscle: string
  secondary_muscles?: string | undefined
  equipment_required: string
  difficulty_level: DifficultyLevel
  instructions?: string | undefined
  alternative_exercise_slugs?: string | undefined
}

export interface ExerciseUpdate {
  name?: string | undefined
  movement_category?: string | undefined
  primary_muscle?: string | undefined
  secondary_muscles?: string | undefined
  equipment_required?: string | undefined
  difficulty_level?: DifficultyLevel | undefined
  instructions?: string | undefined
  alternative_exercise_slugs?: string | undefined
}

export interface ExerciseFilterParams {
  q?: string | undefined
  primary_muscle?: string | undefined
  equipment?: string | undefined
  movement_category?: string | undefined
  difficulty?: string | undefined
  include_built_in?: boolean | undefined
  skip?: number | undefined
  limit?: number | undefined
}

export const MOVEMENT_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'horizontal_push', label: 'Horizontal Push (Chest)' },
  { value: 'vertical_push', label: 'Vertical Push (Overhead)' },
  { value: 'horizontal_pull', label: 'Horizontal Pull (Row)' },
  { value: 'vertical_pull', label: 'Vertical Pull (Pulldown/Up)' },
  { value: 'squat', label: 'Squat Pattern' },
  { value: 'hinge', label: 'Hinge Pattern (Deadlift/RDL)' },
  { value: 'lunge', label: 'Lunge / Single Leg' },
  { value: 'isolation', label: 'Isolation (Arms/Calves)' },
  { value: 'core', label: 'Core / Abdominals' },
  { value: 'carry', label: 'Carry / Functional' },
] as const

export const MUSCLE_GROUPS = [
  { value: 'all', label: 'All Muscles' },
  { value: 'chest', label: 'Chest' },
  { value: 'lats', label: 'Lats' },
  { value: 'upper_back', label: 'Upper Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quadriceps', label: 'Quadriceps' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'abdominals', label: 'Abdominals' },
] as const

export const EQUIPMENT_OPTIONS = [
  { value: 'all', label: 'All Equipment' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'pullup_bar', label: 'Pull-Up Bar' },
  { value: 'bench', label: 'Bench' },
  { value: 'resistance_band', label: 'Resistance Band' },
] as const

export const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All Difficulties' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const
