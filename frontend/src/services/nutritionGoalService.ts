import type { GoalEstimate, NutritionGoal } from '../types/nutritionGoal'
import type { NutritionReportResponse } from '../types/nutritionReport'
import { request } from './api'

export const nutritionGoalService = {
  getGoals: (): Promise<NutritionGoal> => request<NutritionGoal>('/nutrition/goals'),

  updateGoals: (goals: Partial<NutritionGoal>): Promise<NutritionGoal> =>
    request<NutritionGoal>('/nutrition/goals', {
      method: 'PUT',
      body: JSON.stringify(goals),
    }),

  estimateGoals: (): Promise<GoalEstimate> =>
    request<GoalEstimate>('/nutrition/goals/estimate'),

  getReport: (startDate: string, endDate: string): Promise<NutritionReportResponse> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    })
    return request<NutritionReportResponse>(`/nutrition/reports?${params.toString()}`)
  },
}

