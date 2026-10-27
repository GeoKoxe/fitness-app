import { useEffect, useState } from 'react'
import type { MealPlan, PlannedMeal } from '../../types/mealPlan'
import type { RecipeSummary } from '../../types/recipe'
import { mealPlanService } from '../../services/mealPlanService'
import { recipeService } from '../../services/recipeService'

interface ReplaceMealModalProps {
  meal: PlannedMeal
  activePlan?: MealPlan | null | undefined
  onClose: () => void
  onSuccess: (updatedPlan: MealPlan) => void
}

export function ReplaceMealModal({ meal, activePlan, onClose, onSuccess }: ReplaceMealModalProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>(meal.meal_category)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Check repetition and spacing against activePlan
  const checkConflict = (recipeId: number): string | null => {
    if (!activePlan) return null
    const otherOccurrences: number[] = []
    for (const d of activePlan.days) {
      for (const m of d.meals) {
        if (m.id !== meal.id && m.recipe_id === recipeId) {
          otherOccurrences.push(d.day_number)
        }
      }
    }
    if (otherOccurrences.length >= 2) {
      return 'Used twice this week (max limit)'
    }
    for (const d of otherOccurrences) {
      if (Math.abs(meal.day_number - d) < 3) {
        return `Used on Day ${d} (needs ≥2 days separation)`
      }
    }
    return null
  }

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true)
      try {
        const data = await recipeService.getRecipes(
          selectedCategory === 'all' ? undefined : selectedCategory,
          search || undefined
        )
        setRecipes(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load recipes.')
      } finally {
        setLoading(false)
      }
    }
    fetchRecipes()
  }, [selectedCategory, search])

  const handleSelectRecipe = async (recipeId: number) => {
    setSubmitting(true)
    setError(null)
    try {
      const updatedPlan = await mealPlanService.replacePlannedMeal(meal.id, recipeId, meal.servings)
      onSuccess(updatedPlan)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to replace meal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-meal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-edge max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div>
            <h3 id="replace-meal-title" className="text-base font-bold text-ink">
              Replace Meal
            </h3>
            <p className="text-xs text-inkSecondary">
              Select another recipe to replace <span className="font-semibold text-ink">{meal.name}</span>
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
          <div role="alert" className="mt-3 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search recipes or tags..."
            aria-label="Search recipes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter category"
            className="px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
          >
            <option value="all">All Categories</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snacks">Snacks</option>
          </select>
        </div>

        {/* Recipe List */}
        <div className="mt-4 flex-1 overflow-y-auto divide-y divide-edge pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-inkMuted">Loading recipes...</div>
          ) : recipes.length === 0 ? (
            <div className="py-8 text-center text-xs text-inkMuted">No matching recipes found.</div>
          ) : (
            recipes.map((r) => {
              const conflict = checkConflict(r.id)
              return (
                <div
                  key={r.id}
                  className={`py-3 flex items-center justify-between px-2 rounded-lg transition-colors group ${
                    conflict ? 'opacity-60 bg-surfaceMuted/50' : 'hover:bg-surfaceMuted'
                  }`}
                >
                  <div className="pr-3">
                    <div className="text-sm font-semibold text-ink flex items-center gap-2 flex-wrap">
                      <span>{r.name}</span>
                      {r.is_built_in && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surfaceMuted text-inkSecondary border border-edge">
                          Built-in
                        </span>
                      )}
                      {conflict && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-status-warning-bg text-status-warning-fg border border-status-warning-border">
                          ⚠️ {conflict}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-inkSecondary mt-0.5 flex gap-3">
                      <span>{r.per_serving_calories} kcal</span>
                      <span>{r.per_serving_protein}g P</span>
                      <span>{r.per_serving_carbs}g C</span>
                      <span>{r.per_serving_fat}g F</span>
                      <span>🕒 {r.prep_time_minutes + r.cook_time_minutes} min</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectRecipe(r.id)}
                    disabled={submitting || conflict !== null}
                    title={conflict || 'Select this recipe'}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                      conflict
                        ? 'bg-surfaceMuted text-inkMuted cursor-not-allowed border border-edge'
                        : 'text-brand bg-brand/10 hover:bg-brand/20 border border-brand/30'
                    }`}
                  >
                    {submitting ? 'Applying...' : conflict ? 'Unavailable' : 'Select'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-edge flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
