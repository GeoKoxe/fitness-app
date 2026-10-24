export interface NutritionGoal {
  id?: number
  user_profile_id?: number
  calories_kcal?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
  created_at?: string
  updated_at?: string
}

export interface GoalEstimate {
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  bmr_kcal: number
  tdee_kcal: number
  formula_explanation: string
}

