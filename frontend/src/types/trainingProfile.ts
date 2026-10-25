export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export type TrainingGoal =
  | 'strength'
  | 'hypertrophy'
  | 'endurance'
  | 'general_fitness'

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface TrainingProfile {
  id: number | null
  user_profile_id: number | null
  experience_level: ExperienceLevel
  training_goals: string[]
  available_days: string[]
  preferred_duration_minutes: number
  available_equipment: string[]
  excluded_exercises: string[]
  excluded_muscle_groups: string[]
  training_considerations: string | null
  created_at?: string | null | undefined
  updated_at?: string | null | undefined
}

export interface TrainingProfileUpdate {
  experience_level?: ExperienceLevel | undefined
  training_goals?: string[] | undefined
  available_days?: string[] | undefined
  preferred_duration_minutes?: number | undefined
  available_equipment?: string[] | undefined
  excluded_exercises?: string[] | undefined
  excluded_muscle_groups?: string[] | undefined
  training_considerations?: string | null | undefined
}

export interface SavedTrainingProfile {
  id: number
  user_profile_id: number
  name: string
  description: string | null
  experience_level: ExperienceLevel
  training_goals: string[]
  available_days: string[]
  preferred_duration_minutes: number
  available_equipment: string[]
  excluded_exercises: string[]
  excluded_muscle_groups: string[]
  training_considerations: string | null
  created_at: string
  updated_at: string
}

export interface SavedTrainingProfileCreate {
  name: string
  description?: string | null | undefined
  experience_level?: ExperienceLevel | undefined
  training_goals?: string[] | undefined
  available_days?: string[] | undefined
  preferred_duration_minutes?: number | undefined
  available_equipment?: string[] | undefined
  excluded_exercises?: string[] | undefined
  excluded_muscle_groups?: string[] | undefined
  training_considerations?: string | null | undefined
}

export interface SavedTrainingProfileUpdate {
  name?: string | undefined
  description?: string | null | undefined
  experience_level?: ExperienceLevel | undefined
  training_goals?: string[] | undefined
  available_days?: string[] | undefined
  preferred_duration_minutes?: number | undefined
  available_equipment?: string[] | undefined
  excluded_exercises?: string[] | undefined
  excluded_muscle_groups?: string[] | undefined
  training_considerations?: string | null | undefined
}

export const TRAINING_GOALS: {
  value: TrainingGoal
  label: string
  description: string
}[] = [
  {
    value: 'strength',
    label: 'Strength',
    description:
      'Heavy compound lifts, lower rep ranges, maximizing neuromuscular force.',
  },
  {
    value: 'hypertrophy',
    label: 'Hypertrophy',
    description:
      'Muscle size and physique development with moderate reps and targeted volume.',
  },
  {
    value: 'endurance',
    label: 'Endurance',
    description:
      'Higher rep density, conditioning, and muscular fatigue resistance.',
  },
  {
    value: 'general_fitness',
    label: 'General Fitness',
    description:
      'Balanced strength, mobility, and cardiovascular health for overall longevity.',
  },
]

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
]

export const EXPERIENCE_LEVELS: {
  value: ExperienceLevel
  label: string
  subtitle: string
  description: string
}[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    subtitle: '< 1 year experience',
    description:
      'Focus on mastering fundamental movement mechanics and linear progress.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    subtitle: '1 – 3 years consistent',
    description:
      'Ready for dedicated movement splits, progressive overload, and varied rep ranges.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    subtitle: '3+ years training',
    description:
      'High training age; requires volume management, specific intensity, and periodization.',
  },
]

export const DEFAULT_AVAILABLE_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'bodyweight',
  'bench',
  'pullup_bar',
  'cable',
  'machine',
  'resistance_band',
]

