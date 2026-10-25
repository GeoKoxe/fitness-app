import { request } from './api'
import type {
  ExercisePerformanceHistory,
  LoggedExerciseSummaryItem,
  ProgressionRecommendation,
  WorkoutAnalyticsSummary,
  WorkoutWeeklySeries,
} from '../types/workoutAnalytics'

export const workoutAnalyticsService = {
  async getSummary(timeRange: string = '4w'): Promise<WorkoutAnalyticsSummary> {
    return request<WorkoutAnalyticsSummary>(
      `/workouts/analytics/summary?time_range=${encodeURIComponent(timeRange)}`
    )
  },

  async getWeeklySeries(timeRange: string = '4w'): Promise<WorkoutWeeklySeries> {
    return request<WorkoutWeeklySeries>(
      `/workouts/analytics/weekly?time_range=${encodeURIComponent(timeRange)}`
    )
  },

  async listLoggedExercises(): Promise<LoggedExerciseSummaryItem[]> {
    return request<LoggedExerciseSummaryItem[]>('/workouts/analytics/exercises')
  },

  async getExerciseHistory(
    exerciseIdentifier: string,
    timeRange: string = 'all'
  ): Promise<ExercisePerformanceHistory> {
    return request<ExercisePerformanceHistory>(
      `/workouts/analytics/exercises/${encodeURIComponent(exerciseIdentifier)}?time_range=${encodeURIComponent(timeRange)}`
    )
  },

  async getRecommendations(): Promise<ProgressionRecommendation[]> {
    return request<ProgressionRecommendation[]>('/workouts/analytics/recommendations')
  },
}

