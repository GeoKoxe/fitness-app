export type SexType = 'male' | 'female' | 'other'

export type ActivityLevelType =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active'

export interface UserProfile {
  id: number
  name: string
  date_of_birth: string | null
  sex: SexType | null
  height_cm: number | null
  activity_level: ActivityLevelType | null
  created_at: string
  updated_at: string
}

export interface UserProfileCreate {
  name: string
  date_of_birth?: string | null
  sex?: SexType | null
  height_cm?: number | null
  activity_level?: ActivityLevelType | null
}

export interface UserProfileUpdate {
  name?: string | null
  date_of_birth?: string | null
  sex?: SexType | null
  height_cm?: number | null
  activity_level?: ActivityLevelType | null
}

