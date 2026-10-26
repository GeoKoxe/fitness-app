import { request } from './api'
import type {
  WorkoutSessionLog,
  WorkoutSessionLogSummary,
  WorkoutSessionLogUpdate,
  WorkoutSessionStartRequest,
  WorkoutSessionTransitionRequest,
} from '../types/workoutLog'

export const workoutExecutionService = {
  startSession: async (
    req: WorkoutSessionStartRequest
  ): Promise<WorkoutSessionLog> => {
    return request<WorkoutSessionLog>('/workouts/sessions/start', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  getActiveSession: async (): Promise<WorkoutSessionLog | null> => {
    return request<WorkoutSessionLog | null>('/workouts/sessions/active')
  },

  listSessions: async (
    status?: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<WorkoutSessionLogSummary[]> => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (skip) params.set('skip', String(skip))
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    return request<WorkoutSessionLogSummary[]>(
      `/workouts/sessions${qs ? `?${qs}` : ''}`
    )
  },

  getSessionById: async (id: number): Promise<WorkoutSessionLog> => {
    return request<WorkoutSessionLog>(`/workouts/sessions/${id}`)
  },

  updateSession: async (
    id: number,
    update: WorkoutSessionLogUpdate
  ): Promise<WorkoutSessionLog> => {
    return request<WorkoutSessionLog>(`/workouts/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  },

  completeSession: async (
    id: number,
    req?: WorkoutSessionTransitionRequest
  ): Promise<WorkoutSessionLog> => {
    return request<WorkoutSessionLog>(
      `/workouts/sessions/${id}/complete`,
      req ? { method: 'POST', body: JSON.stringify(req) } : { method: 'POST' }
    )
  },

  cancelSession: async (
    id: number,
    req?: WorkoutSessionTransitionRequest
  ): Promise<WorkoutSessionLog> => {
    return request<WorkoutSessionLog>(
      `/workouts/sessions/${id}/cancel`,
      req ? { method: 'POST', body: JSON.stringify(req) } : { method: 'POST' }
    )
  },
}

