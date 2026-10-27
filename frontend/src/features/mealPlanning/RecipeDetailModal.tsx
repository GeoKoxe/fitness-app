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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-detail-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-edge max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="recipe-detail-title" className="text-lg font-bold text-ink">
                {recipe?.name || 'Recipe Details'}
              </h3>
              {recipe?.is_built_in && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surfaceMuted text-inkSecondary border border-edge uppercase">
                  Built-in
                </span>
              )}
            </div>
            <p className="text-xs text-inkSecondary capitalize">
              {recipe?.meal_category} • {recipe ? (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) : 0} min total time
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-inkSecondary hover:text-ink rounded-lg p-1 hover:bg-surfaceMuted transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-xs rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-inkMuted">Loading recipe details...</div>
        ) : recipe ? (
          <div className="mt-4 space-y-5">
            {/* Description */}
            {recipe.description && (
              <p className="text-xs text-inkSecondary italic bg-surfaceMuted p-3 rounded-lg border border-edge">
                "{recipe.description}"
              </p>
            )}

            {/* Servings Adjuster */}
            <div className="flex items-center justify-between bg-brand/10 p-3 rounded-xl border border-brand/20">
              <span className="text-xs font-semibold text-brand">Servings Scale:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setServingsMultiplier((s) => Math.max(1, s - 1))}
                  aria-label="Decrease servings multiplier"
                  className="w-7 h-7 bg-surface rounded border border-edge text-ink font-bold text-xs hover:bg-surfaceMuted transition-colors"
                >
                  -
                </button>
                <span className="text-sm font-bold text-ink px-2">{servingsMultiplier}</span>
                <button
                  type="button"
                  onClick={() => setServingsMultiplier((s) => s + 1)}
                  aria-label="Increase servings multiplier"
                  className="w-7 h-7 bg-surface rounded border border-edge text-ink font-bold text-xs hover:bg-surfaceMuted transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Scaled Macro Highlights */}
            <div className="grid grid-cols-4 gap-2 bg-surfaceMuted p-3 rounded-xl border border-edge text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-inkSecondary">Calories</div>
                <div className="text-sm font-bold text-ink">
                  {Math.round(recipe.per_serving_calories * servingsMultiplier)} kcal
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-inkSecondary">Protein</div>
                <div className="text-sm font-bold text-brand">
                  {(recipe.per_serving_protein * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-inkSecondary">Carbs</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {(recipe.per_serving_carbs * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-inkSecondary">Fat</div>
                <div className="text-sm font-bold text-status-danger-fg">
                  {(recipe.per_serving_fat * servingsMultiplier).toFixed(1)}g
                </div>
              </div>
            </div>

            {/* Ingredients Table */}
            <div>
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Ingredients ({recipe.ingredients.length})
              </h4>
              <div className="border border-edge rounded-xl overflow-hidden divide-y divide-edge">
                {recipe.ingredients.map((ing) => {
                  const scaledQty = Math.round(ing.quantity * ratio * 10) / 10
                  const scaledCal = ing.calories_kcal != null ? Math.round(ing.calories_kcal * ratio) : null
                  return (
                    <div key={ing.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-surfaceMuted transition-colors">
                      <div>
                        <span className="font-semibold text-ink">{ing.food_name || 'Ingredient'}</span>
                        {ing.preparation_notes && (
                          <span className="text-[10px] text-inkSecondary ml-1.5">({ing.preparation_notes})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-ink">
                          {scaledQty} {ing.unit}
                        </span>
                        {scaledCal != null && (
                          <span className="text-inkSecondary w-16 text-right">~{scaledCal} kcal</span>
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
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                  Instructions
                </h4>
                <div className="bg-surfaceMuted p-3 rounded-xl border border-edge text-xs text-ink whitespace-pre-line leading-relaxed">
                  {recipe.instructions}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-edge flex items-center justify-between">
          {recipe && !recipe.is_built_in ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-status-danger-fg hover:underline"
            >
              {deleting ? 'Deleting...' : 'Delete Recipe'}
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
