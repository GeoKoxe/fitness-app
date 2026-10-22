export interface Food {
  id: number
  name: string
  brand: string | null
  category: string | null
  source: string
  external_id: string | null
  barcode: string | null
  nutritional_basis: string
  serving_description: string | null
  serving_quantity: number | null
  serving_unit: string | null
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  saturated_fat_g: number | null
  sodium_mg: number | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface FoodCreate {
  name: string
  brand?: string | null
  category?: string | null
  source?: string
  external_id?: string | null
  barcode?: string | null
  nutritional_basis?: string
  serving_description?: string | null
  serving_quantity?: number | null
  serving_unit?: string | null
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number | null
  sugar_g?: number | null
  saturated_fat_g?: number | null
  sodium_mg?: number | null
  is_favorite?: boolean
}

export interface FoodSearchResult extends FoodCreate {
  id?: number
  created_at?: string
  updated_at?: string
}

export interface FoodUpdate {
  name?: string
  brand?: string | null
  category?: string | null
  nutritional_basis?: string
  serving_description?: string | null
  serving_quantity?: number | null
  serving_unit?: string | null
  calories_kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number | null
  sugar_g?: number | null
  saturated_fat_g?: number | null
  sodium_mg?: number | null
  is_favorite?: boolean
}

export interface FoodListResponse {
  items: Food[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
