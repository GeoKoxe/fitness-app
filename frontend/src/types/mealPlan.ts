export interface PlannedMealItem {
  id: number
  planned_meal_id: number
  food_id?: number | null | undefined
  food_name?: string | null | undefined
  quantity: number
  unit: string
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number | null | undefined
}

export interface PlannedMeal {
  id: number
  meal_plan_id: number
  plan_date: string
  day_number: number
  meal_category: string
  recipe_id?: number | null | undefined
  food_id?: number | null | undefined
  name: string
  servings: number
  notes?: string | null | undefined
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number | null | undefined
  items: PlannedMealItem[]
}

export interface DayMealPlan {
  day_number: number
  plan_date: string
  day_name: string
  meals: PlannedMeal[]
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
}

export interface UnmetConstraintDetail {
  target_name: string
  target_value: number
  actual_value: number
  tolerance_pct: number
  upper_limit: number
  status: 'acceptable' | 'exceeded' | 'under' | 'conflict' | 'relaxed'
  suggestion?: string | null | undefined
}

export interface WeeklyNutritionOverview {
  average_daily_calories: number
  average_daily_protein: number
  average_daily_carbs: number
  average_daily_fat: number
  average_daily_fiber: number

  target_calories?: number | null | undefined
  target_protein?: number | null | undefined
  target_carbs?: number | null | undefined
  target_fat?: number | null | undefined
  target_fiber?: number | null | undefined

  tolerance_pct?: number | undefined
  adherence_calories_pct?: number | null | undefined
  adherence_protein_pct?: number | null | undefined
  adherence_carbs_pct?: number | null | undefined
  adherence_fat_pct?: number | null | undefined
  adherence_fiber_pct?: number | null | undefined
  unmet_constraints?: UnmetConstraintDetail[] | undefined
}

export interface MealPlan {
  id: number
  user_profile_id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  target_tolerance_pct?: number | undefined
  notes?: string | null | undefined
  created_at: string
  updated_at: string
  days: DayMealPlan[]
  weekly_overview: WeeklyNutritionOverview
}

export interface MealPlanSummary {
  id: number
  user_profile_id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  target_tolerance_pct?: number | undefined
  notes?: string | null | undefined
  created_at: string
  updated_at: string
  meals_count: number
  average_daily_calories: number
}

export interface MealPlanGenerateRequest {
  name?: string | undefined
  start_date?: string | null | undefined
  enabled_categories?: string[] | undefined
  disliked_foods?: string[] | undefined
  max_cooking_time_minutes?: number | null | undefined
  target_calories?: number | null | undefined
  target_protein?: number | null | undefined
  target_carbs?: number | null | undefined
  target_fat?: number | null | undefined
  target_fiber?: number | null | undefined
  simplicity_preference?: string | undefined
  reuse_ingredients?: boolean | undefined
  daily_budget?: number | null | undefined
  target_tolerance_pct?: number | undefined
}

export interface ShoppingListItem {
  id: number
  meal_plan_id: number
  food_id?: number | null | undefined
  ingredient_name: string
  category: string
  total_quantity: number
  unit: string
  preparation_state?: string | null | undefined
  is_checked: boolean
  is_excluded: boolean
}

export interface ShoppingListExport {
  meal_plan_id: number
  meal_plan_name: string
  total_items_count: number
  checked_items_count: number
  categories: Record<string, ShoppingListItem[]>
  plain_text: string
}

export interface LogPlannedMealRequest {
  target_date: string
  planned_meal_id?: number | undefined
  day_number?: number | undefined
  skip_if_already_logged?: boolean | undefined
}

export interface LoggedItemSummary {
  food_name: string
  quantity: number
  unit: string
  meal_log_id: number
}

export interface LogPlannedMealResponse {
  success: boolean
  logged_count: number
  skipped_count: number
  message: string
  logged_items: LoggedItemSummary[]
}

export interface PlannerPreferences {
  id: number
  user_profile_id: number
  enabled_categories: string
  disliked_foods: string
  max_cooking_time_minutes?: number | null | undefined
  simplicity_preference: string
  daily_budget?: number | null | undefined
  reuse_ingredients: boolean
  target_tolerance_pct: number
  created_at: string
  updated_at: string
}

export interface DislikedFood {
  id: number
  user_profile_id: number
  food_id?: number | null | undefined
  food_name: string
  food_category?: string | null | undefined
  food_source?: string | null | undefined
  created_at: string
}

export interface DislikeIngredientRequest {
  food_name: string
  food_id?: number | null | undefined
}

export interface DislikeIngredientResponse {
  disliked_food: DislikedFood
  affected_meals_count: number
  regenerated_meals_count: number
  failed_meals_count: number
  message: string
  plan?: MealPlan | null | undefined
}
