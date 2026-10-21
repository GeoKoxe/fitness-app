export interface BodyMeasurement {
  id: number
  user_profile_id: number
  measured_at: string
  source: string
  notes: string | null

  // Core metrics
  weight_kg: number | null
  height_cm: number | null
  bmi: number | null
  bmi_calculated: boolean

  // Body composition
  body_fat_percentage: number | null
  fat_mass_kg: number | null
  muscle_mass_kg: number | null
  skeletal_muscle_mass_kg: number | null
  body_water_percentage: number | null
  body_water_mass_kg: number | null
  bone_mineral_content_kg: number | null
  visceral_fat_level: number | null
  basal_metabolic_rate_kcal: number | null
  heart_rate_bpm: number | null

  // Circumferences (cm)
  waist_circumference_cm: number | null
  hip_circumference_cm: number | null
  chest_circumference_cm: number | null
  arms_circumference_cm: number | null
  thighs_circumference_cm: number | null
  neck_circumference_cm: number | null

  created_at: string
  updated_at: string
}

export interface BodyMeasurementCreate {
  measured_at?: string
  source?: string
  notes?: string | null

  // Core metrics
  weight_kg?: number | null
  height_cm?: number | null
  bmi?: number | null

  // Body composition
  body_fat_percentage?: number | null
  fat_mass_kg?: number | null
  muscle_mass_kg?: number | null
  skeletal_muscle_mass_kg?: number | null
  body_water_percentage?: number | null
  body_water_mass_kg?: number | null
  bone_mineral_content_kg?: number | null
  visceral_fat_level?: number | null
  basal_metabolic_rate_kcal?: number | null
  heart_rate_bpm?: number | null

  // Circumferences
  waist_circumference_cm?: number | null
  hip_circumference_cm?: number | null
  chest_circumference_cm?: number | null
  arms_circumference_cm?: number | null
  thighs_circumference_cm?: number | null
  neck_circumference_cm?: number | null
}

export interface BodyMeasurementListResponse {
  items: BodyMeasurement[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

