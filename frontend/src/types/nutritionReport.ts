export interface DailyReportItem {
  date: string
  has_logs: boolean
  entries_count: number
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
}

export interface WeightTrendReport {
  has_sufficient_data: boolean
  measurement_count: number
  start_date?: string | null
  start_weight_kg?: number | null
  end_date?: string | null
  end_weight_kg?: number | null
  weight_change_kg?: number | null
  disclaimer: string
}

export interface NutritionReportResponse {
  start_date: string
  end_date: string
  total_days: number
  days_with_logs: number
  days_without_logs: number
  avg_calories_kcal?: number | null
  avg_protein_g?: number | null
  avg_carbs_g?: number | null
  avg_fat_g?: number | null
  avg_fiber_g?: number | null
  calculation_note: string
  daily_items: DailyReportItem[]
  weight_trend: WeightTrendReport
}

