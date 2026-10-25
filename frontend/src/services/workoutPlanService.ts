import { request } from './api'
import type {
  ExerciseAlternativesResponse,
  WorkoutPlan,
  WorkoutPlanGenerateRequest,
  WorkoutPlanSummary,
} from '../types/workoutPlan'

export const workoutPlanService = {
  getActivePlan: async (): Promise<WorkoutPlan | null> => {
    return request<WorkoutPlan | null>('/workouts/plans/active')
  },

  generatePlan: async (
    data: WorkoutPlanGenerateRequest
  ): Promise<WorkoutPlan> => {
    return request<WorkoutPlan>('/workouts/plans/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  listPlans: async (
    skip: number = 0,
    limit: number = 50
  ): Promise<WorkoutPlanSummary[]> => {
    return request<WorkoutPlanSummary[]>(
      `/workouts/plans?skip=${skip}&limit=${limit}`
    )
  },

  getPlanById: async (id: number): Promise<WorkoutPlan> => {
    return request<WorkoutPlan>(`/workouts/plans/${id}`)
  },

  getAlternatives: async (
    planId: number,
    exerciseId: number
  ): Promise<ExerciseAlternativesResponse> => {
    return request<ExerciseAlternativesResponse>(
      `/workouts/plans/${planId}/exercises/${exerciseId}/alternatives`
    )
  },

  replaceExercise: async (
    planId: number,
    exerciseId: number,
    newExerciseId: number
  ): Promise<WorkoutPlan> => {
    return request<WorkoutPlan>(
      `/workouts/plans/${planId}/exercises/${exerciseId}/replace`,
      {
        method: 'PUT',
        body: JSON.stringify({ new_exercise_id: newExerciseId }),
      }
    )
  },

  regenerateExercise: async (
    planId: number,
    exerciseId: number
  ): Promise<WorkoutPlan> => {
    return request<WorkoutPlan>(
      `/workouts/plans/${planId}/exercises/${exerciseId}/regenerate`,
      {
        method: 'POST',
      }
    )
  },
}

