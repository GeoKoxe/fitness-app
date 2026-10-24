import type {
  DislikedFood,
  DislikeIngredientRequest,
  DislikeIngredientResponse,
  LogPlannedMealRequest,
  LogPlannedMealResponse,
  MealPlan,
  MealPlanGenerateRequest,
  MealPlanSummary,
  PlannerPreferences,
  ShoppingListExport,
  ShoppingListItem,
} from '../types/mealPlan'
import { request } from './api'

export const mealPlanService = {
  getActivePlan: (): Promise<MealPlan | null> => request<MealPlan | null>('/meal-plans/active'),

  listPlans: (): Promise<MealPlanSummary[]> => request<MealPlanSummary[]>('/meal-plans'),

  getPlan: (id: number): Promise<MealPlan> => request<MealPlan>(`/meal-plans/${id}`),

  generatePlan: (data: MealPlanGenerateRequest): Promise<MealPlan> =>
    request<MealPlan>('/meal-plans/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deletePlan: (id: number): Promise<void> =>
    request<void>(`/meal-plans/${id}`, {
      method: 'DELETE',
    }),

  replacePlannedMeal: (
    mealId: number,
    recipeId: number,
    servings?: number
  ): Promise<MealPlan> => {
    const q = servings ? `?recipe_id=${recipeId}&servings=${servings}` : `?recipe_id=${recipeId}`
    return request<MealPlan>(`/meal-plans/planned-meals/${mealId}/replace${q}`, {
      method: 'PUT',
    })
  },

  adjustMealServings: (mealId: number, servings: number): Promise<MealPlan> =>
    request<MealPlan>(`/meal-plans/planned-meals/${mealId}/servings?servings=${servings}`, {
      method: 'PUT',
    }),

  regenerateMeal: (mealId: number): Promise<MealPlan> =>
    request<MealPlan>(`/meal-plans/planned-meals/${mealId}/regenerate`, {
      method: 'POST',
    }),

  logPlannedMeals: (data: LogPlannedMealRequest): Promise<LogPlannedMealResponse> =>
    request<LogPlannedMealResponse>('/meal-plans/log-meals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShoppingList: (planId: number): Promise<ShoppingListItem[]> =>
    request<ShoppingListItem[]>(`/meal-plans/${planId}/shopping-list`),

  updateShoppingListItem: (
    itemId: number,
    data: { is_checked?: boolean; is_excluded?: boolean }
  ): Promise<ShoppingListItem> =>
    request<ShoppingListItem>(`/meal-plans/shopping-list/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  exportShoppingList: (planId: number): Promise<ShoppingListExport> =>
    request<ShoppingListExport>(`/meal-plans/${planId}/shopping-list/export`),

  getPreferences: (): Promise<PlannerPreferences> =>
    request<PlannerPreferences>('/meal-plans/preferences/me'),

  updatePreferences: (data: Partial<PlannerPreferences>): Promise<PlannerPreferences> =>
    request<PlannerPreferences>('/meal-plans/preferences/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getDislikedFoods: (): Promise<DislikedFood[]> =>
    request<DislikedFood[]>('/meal-plans/disliked-foods'),

  addDislikedFood: (data: { food_name: string; food_id?: number | null }): Promise<DislikedFood> =>
    request<DislikedFood>('/meal-plans/disliked-foods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeDislikedFood: (id: number): Promise<void> =>
    request<void>(`/meal-plans/disliked-foods/${id}`, {
      method: 'DELETE',
    }),

  dislikeAndRegenerate: (data: DislikeIngredientRequest): Promise<DislikeIngredientResponse> =>
    request<DislikeIngredientResponse>('/meal-plans/dislike-and-regenerate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

