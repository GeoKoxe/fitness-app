import type { Recipe, RecipeCreateInput, RecipeSummary } from '../types/recipe'
import { request } from './api'

export const recipeService = {
  getRecipes: (category?: string, search?: string): Promise<RecipeSummary[]> => {
    const params = new URLSearchParams()
    if (category && category !== 'all') params.append('category', category)
    if (search && search.trim()) params.append('search', search.trim())
    const q = params.toString() ? `?${params.toString()}` : ''
    return request<RecipeSummary[]>(`/recipes${q}`)
  },

  getRecipe: (id: number): Promise<Recipe> => request<Recipe>(`/recipes/${id}`),

  createRecipe: (data: RecipeCreateInput): Promise<Recipe> =>
    request<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecipe: (id: number, data: Partial<RecipeCreateInput>): Promise<Recipe> =>
    request<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRecipe: (id: number): Promise<void> =>
    request<void>(`/recipes/${id}`, {
      method: 'DELETE',
    }),
}

