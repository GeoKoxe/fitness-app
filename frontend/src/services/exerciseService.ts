import { request } from './api'
import type {
  Exercise,
  ExerciseCreate,
  ExerciseFilterParams,
  ExerciseUpdate,
} from '../types/exercise'

export const exerciseService = {
  getExercises: async (params?: ExerciseFilterParams): Promise<Exercise[]> => {
    const query = new URLSearchParams()
    if (params?.q?.trim()) query.set('q', params.q.trim())
    if (params?.primary_muscle && params.primary_muscle !== 'all') {
      query.set('primary_muscle', params.primary_muscle)
    }
    if (params?.equipment && params.equipment !== 'all') {
      query.set('equipment', params.equipment)
    }
    if (params?.movement_category && params.movement_category !== 'all') {
      query.set('movement_category', params.movement_category)
    }
    if (params?.difficulty && params.difficulty !== 'all') {
      query.set('difficulty', params.difficulty)
    }
    if (params?.include_built_in !== undefined) {
      query.set('include_built_in', String(params.include_built_in))
    }
    if (params?.skip !== undefined) query.set('skip', String(params.skip))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))

    const queryString = query.toString()
    return request<Exercise[]>(`/exercises${queryString ? `?${queryString}` : ''}`)
  },

  getExercise: async (id: number): Promise<Exercise> => {
    return request<Exercise>(`/exercises/${id}`)
  },

  createExercise: async (data: ExerciseCreate): Promise<Exercise> => {
    return request<Exercise>('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateExercise: async (id: number, data: ExerciseUpdate): Promise<Exercise> => {
    return request<Exercise>(`/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteExercise: async (id: number): Promise<void> => {
    return request<void>(`/exercises/${id}`, {
      method: 'DELETE',
    })
  },
}

