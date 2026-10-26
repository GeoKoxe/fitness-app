import type { BackupImportResult, LegacyNutritionBackup, SystemBackupV2 } from './backup'
export type { BackupImportResult, LegacyNutritionBackup, SystemBackupV2 }

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface MealLog {
  id: number
  user_profile_id: number
  food_id: number | null
  logged_date: string
  meal_category: MealCategory
  quantity: number
  unit: string
  food_name: string
  food_brand: string | null
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  saturated_fat_g: number | null
  sodium_mg: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MealLogCreate {
  logged_date: string
  meal_category: MealCategory
  quantity: number
  unit: string
  notes?: string | null
  food_id?: number | null
  food_name?: string | null
  food_brand?: string | null
  calories_kcal?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
  sugar_g?: number | null
  saturated_fat_g?: number | null
  sodium_mg?: number | null
}

export interface MealLogUpdate {
  logged_date?: string
  meal_category?: MealCategory
  quantity?: number
  unit?: string
  notes?: string | null
}

export interface DailyMacroTotals {
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  saturated_fat_g: number | null
  sodium_mg: number | null
}

export interface DailyNutritionSummary {
  logged_date: string
  totals: DailyMacroTotals
  by_category: Record<MealCategory, MealLog[]>
  total_entries: number
}

export type NutritionExportData = LegacyNutritionBackup
export type NutritionImportResult = BackupImportResult
