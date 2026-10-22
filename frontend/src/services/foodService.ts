import type { Food, FoodCreate, FoodListResponse, FoodSearchResult, FoodUpdate } from '../types/food'
import { request } from './api'

export const foodService = {
  createFood: (data: FoodCreate): Promise<Food> =>
    request<Food>('/foods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listFoods: (params?: {
    page?: number
    pageSize?: number
    favoritesOnly?: boolean
    category?: string
  }): Promise<FoodListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize))
    if (params?.favoritesOnly) searchParams.set('favorites_only', 'true')
    if (params?.category) searchParams.set('category', params.category)

    const query = searchParams.toString()
    return request<FoodListResponse>(`/foods${query ? `?${query}` : ''}`)
  },

  searchFoods: (query: string, includeExternal: boolean = true): Promise<FoodSearchResult[]> => {
    const searchParams = new URLSearchParams({
      q: query,
      include_external: String(includeExternal),
    })
    return request<FoodSearchResult[]>(`/foods/search?${searchParams.toString()}`)
  },

  getFood: (id: number): Promise<Food> => request<Food>(`/foods/${id}`),

  updateFood: (id: number, data: FoodUpdate): Promise<Food> =>
    request<Food>(`/foods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteFood: (id: number): Promise<void> =>
    request<void>(`/foods/${id}`, {
      method: 'DELETE',
    }),

  toggleFavorite: (id: number): Promise<Food> =>
    request<Food>(`/foods/${id}/toggle-favorite`, {
      method: 'POST',
    }),
}

