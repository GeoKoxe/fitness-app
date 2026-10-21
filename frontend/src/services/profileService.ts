import { request } from './api'
import type { UserProfile, UserProfileCreate, UserProfileUpdate } from '../types/profile'

export const profileService = {
  async getProfile(): Promise<UserProfile | null> {
    return request<UserProfile | null>('/profile')
  },

  async createProfile(data: UserProfileCreate): Promise<UserProfile> {
    return request<UserProfile>('/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateProfile(data: UserProfileUpdate): Promise<UserProfile> {
    return request<UserProfile>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}

