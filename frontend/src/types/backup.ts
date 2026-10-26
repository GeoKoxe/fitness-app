import type { Food } from './food'
import type { MealLog } from './nutrition'
import type { NutritionGoal } from './nutritionGoal'
import type { UserProfile } from './profile'

export interface SystemBackupV2 {
  format: string
  version: string
  exported_at: string
  app_version: string
  profile?: UserProfile | null
  body_measurements?: Array<Record<string, unknown>>
  nutrition: {
    foods: Food[]
    meal_logs: MealLog[]
    nutrition_goals?: NutritionGoal | null
    recipes?: Array<Record<string, unknown>>
    meal_plans?: Array<Record<string, unknown>>
    planner_preferences?: Record<string, unknown> | null
    disliked_foods?: Array<Record<string, unknown>>
  }
  training: {
    custom_exercises: Array<Record<string, unknown>>
    training_profile?: Record<string, unknown> | null
    saved_training_profiles?: Array<Record<string, unknown>>
    workout_plans?: Array<Record<string, unknown>>
    workout_session_logs?: Array<Record<string, unknown>>
  }
}

export interface BackupImportResult {
  success: boolean
  imported_profile?: boolean
  imported_measurements?: number
  imported_foods?: number
  imported_meal_logs?: number
  imported_goals?: boolean
  imported_recipes?: number
  imported_meal_plans?: number
  imported_disliked_foods?: number
  imported_custom_exercises?: number
  imported_training_profile?: boolean
  imported_saved_training_profiles?: number
  imported_workout_plans?: number
  imported_workout_sessions?: number
  skipped_duplicates?: number
  message: string
}

export interface LegacyNutritionBackup {
  version: string
  exported_at?: string
  foods: Food[]
  meal_logs: MealLog[]
  nutrition_goals?: NutritionGoal | null
  recipes?: Array<Record<string, unknown>>
  meal_plans?: Array<Record<string, unknown>>
  planner_preferences?: Record<string, unknown> | null
  disliked_foods?: Array<Record<string, unknown>>
}

export type AnyBackupPayload = SystemBackupV2 | LegacyNutritionBackup | Record<string, unknown>

