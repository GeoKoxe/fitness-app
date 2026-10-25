import { request } from './api'
import type {
  SavedTrainingProfile,
  SavedTrainingProfileCreate,
  SavedTrainingProfileUpdate,
  TrainingProfile,
  TrainingProfileUpdate,
} from '../types/trainingProfile'

export const trainingProfileService = {
  getProfile: async (): Promise<TrainingProfile> => {
    return request<TrainingProfile>('/workouts/profile')
  },

  updateProfile: async (
    data: TrainingProfileUpdate
  ): Promise<TrainingProfile> => {
    return request<TrainingProfile>('/workouts/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  listSavedConfigs: async (): Promise<SavedTrainingProfile[]> => {
    return request<SavedTrainingProfile[]>('/workouts/profile/saved')
  },

  getSavedConfig: async (id: number): Promise<SavedTrainingProfile> => {
    return request<SavedTrainingProfile>(`/workouts/profile/saved/${id}`)
  },

  createSavedConfig: async (
    data: SavedTrainingProfileCreate
  ): Promise<SavedTrainingProfile> => {
    return request<SavedTrainingProfile>('/workouts/profile/saved', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateSavedConfig: async (
    id: number,
    data: SavedTrainingProfileUpdate
  ): Promise<SavedTrainingProfile> => {
    return request<SavedTrainingProfile>(`/workouts/profile/saved/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteSavedConfig: async (id: number): Promise<void> => {
    return request<void>(`/workouts/profile/saved/${id}`, {
      method: 'DELETE',
    })
  },

  applySavedConfig: async (id: number): Promise<TrainingProfile> => {
    return request<TrainingProfile>(`/workouts/profile/saved/${id}/apply`, {
      method: 'POST',
    })
  },
}

