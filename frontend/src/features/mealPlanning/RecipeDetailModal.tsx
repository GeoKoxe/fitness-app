import { useEffect, useState } from 'react'
import type { Recipe } from '../../types/recipe'
import { recipeService } from '../../services/recipeService'

interface RecipeDetailModalProps {
  recipeId: number
  onClose: () => void
  onRecipeDeleted?: (id: number) => void
}

export function RecipeDetailModal({ recipeId, onClose, onRecipeDeleted }: RecipeDetailModalProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [servingsMultiplier, setServingsMultiplier] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true)
      try {
        const data = await recipeService.getRecipe(recipeId)
        setRecipe(data)
        setServingsMultiplier(data.servings || 1)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load recipe details.')
      } finally {
        setLoading(false)
      }
    }
    fetchRecipe()
  }, [recipeId])

  const handleDelete = async () => {
    if (!recipe) return
    if (!window.confirm(`Delete recipe "${recipe.name}"?`)) return
    setDeleting(true)
    try {
      await recipeService.deleteRecipe(recipe.id)
      if (onRecipeDeleted) onRecipeDeleted(recipe.id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe.')
    } finally {
      setDeleting(false)
    }
  }

  const ratio = recipe && recipe.servings > 0 ? servingsMultiplier / recipe.servings : 1

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-800">{recipe?.name || 'Recipe Details'}</h3>
              {recipe?.is_built_in && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                  Built-in
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 capitalize">
              {recipe?.meal_category} • {recipe ? (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) : 0} min total time
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading recipe details...</div>
        ) : recipe ? (
          <div className="mt-4 space-y-5">
            {/* Description */}
            {recipe.description && (
              <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                "{recipe.description}"
              </p>
            )}

            {/* Servings Adjuster */}
            <div className="flex items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <span className="text-xs font-semibold text-indigo-900">Servings Scale:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setServingsMultiplier((s) => Math.max(1, s - 1))}
                  className="w-7 h-7 bg-white rounded border border-indigo-200 text-indigo-800 font-bold text-xs"
                >
                  -
                </button>
                <span className="text-sm font-bold text-indigo-900 px-2">{servingsMultiplier}</span>
                <button
                  type="button"
                  onClick={() => setServingsMultiplier((s) => s + 1)}
                  className="w-7 h-7 bg-white rounded border border-indigo-200 text-indigo-800 font-bold text-xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* Scaled Macro Highlights */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Calories</div>
                <div className="text-sm font-bold text-slate-900">
                  {Math.round(recipe.per_serving_calories * servingsMultiplier)} kcal
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Protein</div>
                <div className="text-sm font-bold text-indigo-600">
                  {(recipe.per_serving_protein * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Carbs</div>
                <div className="text-sm font-bold text-amber-600">
                  {(recipe.per_serving_carbs * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Fat</div>
                <div className="text-sm font-bold text-rose-600">
                  {(recipe.per_serving_fat * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
            </div>

            {/* Ingredients Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ingredients ({recipe.ingredients.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {recipe.ingredients.map((ing) => {
                  const scaledQty = Math.round(ing.quantity * ratio * 10) / 10
                  const scaledCal = ing.calories_kcal != null ? Math.round(ing.calories_kcal * ratio) : null
                  return (
                    <div key={ing.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-800">{ing.food_name || 'Ingredient'}</span>
                        {ing.preparation_notes && (
                          <span className="text-[10px] text-slate-400 ml-1.5">({ing.preparation_notes})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-700">
                          {scaledQty} {ing.unit}
                        </span>
                        {scaledCal != null && (
                          <span className="text-slate-400 w-16 text-right">~{scaledCal} kcal</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Instructions */}
            {recipe.instructions && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Instructions
                </h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {recipe.instructions}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
          {recipe && !recipe.is_built_in ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-rose-600 hover:text-rose-800"
            >
              {deleting ? 'Deleting...' : 'Delete Recipe'}
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

