export interface RecipeIngredient {
  id: number
  food_id: number
  food_name?: string | null | undefined
  food_category?: string | null | undefined
  quantity: number
  unit: string
  preparation_notes?: string | null | undefined
  calories_kcal?: number | null | undefined
  protein_g?: number | null | undefined
  carbs_g?: number | null | undefined
  fat_g?: number | null | undefined
  fiber_g?: number | null | undefined
}

export interface RecipeIngredientInput {
  food_id: number
  quantity: number
  unit: string
  preparation_notes?: string | null | undefined
}

export interface RecipeSummary {
  id: number
  user_profile_id?: number | null | undefined
  name: string
  description?: string | null | undefined
  meal_category: string
  servings: number
  prep_time_minutes: number
  cook_time_minutes: number
  instructions?: string | null | undefined
  tags?: string | null | undefined
  is_built_in: boolean
  ingredients_count: number
  per_serving_calories: number
  per_serving_protein: number
  per_serving_carbs: number
  per_serving_fat: number
  per_serving_fiber: number
}

export interface Recipe extends RecipeSummary {
  created_at: string
  updated_at: string
  ingredients: RecipeIngredient[]
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_fiber: number
}

export interface RecipeCreateInput {
  name: string
  description?: string | null | undefined
  meal_category?: string | undefined
  servings?: number | undefined
  prep_time_minutes?: number | undefined
  cook_time_minutes?: number | undefined
  instructions?: string | null | undefined
  tags?: string | null | undefined
  ingredients?: RecipeIngredientInput[] | undefined
}

