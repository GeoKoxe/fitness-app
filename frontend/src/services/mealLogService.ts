import type { Food } from '../types/food'
import type {
  DailyNutritionSummary,
  MealLog,
  MealLogCreate,
  MealLogUpdate,
} from '../types/nutrition'
import { request } from './api'

export const mealLogService = {
  createMealLog: (data: MealLogCreate): Promise<MealLog> =>
    request<MealLog>('/meal-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDailySummary: (date: string): Promise<DailyNutritionSummary> =>
    request<DailyNutritionSummary>(`/meal-logs/summary?date=${encodeURIComponent(date)}`),

  getRecentFoods: (limit: number = 10): Promise<Food[]> =>
    request<Food[]>(`/meal-logs/recent-foods?limit=${limit}`),

  getMealLog: (id: number): Promise<MealLog> => request<MealLog>(`/meal-logs/${id}`),

  updateMealLog: (id: number, data: MealLogUpdate): Promise<MealLog> =>
    request<MealLog>(`/meal-logs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMealLog: (id: number): Promise<void> =>
    request<void>(`/meal-logs/${id}`, {
      method: 'DELETE',
    }),

  deleteCategoryLogs: (
    date: string,
    mealCategory: string
  ): Promise<{ deleted_count: number; message: string }> =>
    request<{ deleted_count: number; message: string }>(
      `/meal-logs/category?date=${encodeURIComponent(date)}&meal_category=${encodeURIComponent(mealCategory)}`,
      {
        method: 'DELETE',
      }
    ),
}

