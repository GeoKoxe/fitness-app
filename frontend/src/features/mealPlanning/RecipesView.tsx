import { useCallback, useEffect, useState } from 'react'
import type { RecipeSummary } from '../../types/recipe'
import { mealPlanService } from '../../services/mealPlanService'
import { recipeService } from '../../services/recipeService'
import { CreateRecipeModal } from './CreateRecipeModal'
import { RecipeDetailModal } from './RecipeDetailModal'

interface RecipesViewProps {
  initialRecipeId?: number | null | undefined
  onCloseInitialRecipe?: (() => void) | undefined
}

export function RecipesView({ initialRecipeId, onCloseInitialRecipe }: RecipesViewProps = {}) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [planRecipeIds, setPlanRecipeIds] = useState<Set<number>>(new Set())
  const [onlyPlanRecipes, setOnlyPlanRecipes] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [inspectRecipeId, setInspectRecipeId] = useState<number | null>(initialRecipeId ?? null)

  useEffect(() => {
    if (initialRecipeId != null) {
      setInspectRecipeId(initialRecipeId)
    }
  }, [initialRecipeId])

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await recipeService.getRecipes(
        selectedCategory === 'all' ? undefined : selectedCategory,
        search || undefined
      )
      setRecipes(data)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes.')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, search])

  const loadPlanRecipes = useCallback(async () => {
    try {
      const plan = await mealPlanService.getActivePlan()
      if (plan) {
        const ids = new Set<number>()
        for (const day of plan.days) {
          for (const meal of day.meals) {
            if (meal.recipe_id != null) {
              ids.add(meal.recipe_id)
            }
          }
        }
        setPlanRecipeIds(ids)
      } else {
        setPlanRecipeIds(new Set())
      }
    } catch {
      // Ignore if no active plan
    }
  }, [])

  useEffect(() => {
    loadRecipes()
    loadPlanRecipes()
  }, [loadRecipes, loadPlanRecipes])

  const categories = [
    { id: 'all', label: 'All Recipes' },
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'snack', label: 'Snacks' },
  ]

  const displayedRecipes = recipes.filter((r) => {
    if (onlyPlanRecipes && !planRecipeIds.has(r.id)) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-6 text-left">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-darkSurface p-5 rounded-2xl shadow-xs border border-sand dark:border-darkBorder transition-colors motion-reduce:transition-none">
        <div>
          <h2 className="text-xl font-bold text-ink dark:text-darkInk">Recipe Library</h2>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
            Curated staple recipes verified with USDA catalogue ingredients, plus your own custom meals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
        >
          + New Recipe
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral text-xs font-medium rounded-2xl">
          {error}
        </div>
      )}

      {/* Category Pills and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setOnlyPlanRecipes(false)
              setSelectedCategory('all')
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer whitespace-nowrap ${
              !onlyPlanRecipes && selectedCategory === 'all'
                ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                : 'bg-surface dark:bg-darkSurface text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk border border-sand dark:border-darkBorder'
            }`}
          >
            All Recipes
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyPlanRecipes(!onlyPlanRecipes)
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              onlyPlanRecipes
                ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                : 'bg-surface dark:bg-darkSurface text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk border border-sand dark:border-darkBorder'
            }`}
          >
            <span>📅</span>
            <span>This Week&apos;s Plan ({planRecipeIds.size})</span>
          </button>

          {categories
            .filter((c) => c.id !== 'all')
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOnlyPlanRecipes(false)
                  setSelectedCategory(c.id)
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer whitespace-nowrap ${
                  !onlyPlanRecipes && selectedCategory === c.id
                    ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-xs'
                    : 'bg-surface dark:bg-darkSurface text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk border border-sand dark:border-darkBorder'
                }`}
              >
                {c.label}
              </button>
            ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search recipes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-xs text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
          />
        </div>
      </div>

      {/* Recipes Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-inkSecondary dark:text-darkInkSecondary bg-surface dark:bg-darkSurface rounded-2xl border border-sand dark:border-darkBorder">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
          <p className="font-medium">Loading recipes...</p>
        </div>
      ) : displayedRecipes.length === 0 ? (
        <div className="py-16 text-center text-xs text-inkSecondary dark:text-darkInkSecondary bg-surface dark:bg-darkSurface rounded-2xl border border-sand dark:border-darkBorder">
          {onlyPlanRecipes
            ? "No recipes in this week's plan yet. Generate a 7-day meal plan in the Meal Planner to see its recipes here."
            : 'No recipes found matching your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedRecipes.map((r) => (
            <div
              key={r.id}
              onClick={() => setInspectRecipeId(r.id)}
              className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xs border border-sand dark:border-darkBorder p-5 hover:border-sand/90 dark:hover:border-darkBorder transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
                    {r.meal_category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {planRecipeIds.has(r.id) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
                        In Active Plan
                      </span>
                    )}
                    {r.is_built_in ? (
                      <span className="text-[10px] font-semibold text-status-success-fg dark:text-emerald-400">Built-in Staple</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-midnight dark:text-darkMidnight">Custom Recipe</span>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-ink dark:text-darkInk line-clamp-1">{r.name}</h3>
                {r.description && (
                  <p className="text-xs text-inkSecondary dark:text-darkInkSecondary line-clamp-2 mt-1 leading-relaxed">
                    {r.description}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-sand/60 dark:border-darkBorder/60">
                <div className="flex items-center justify-between text-xs text-inkSecondary dark:text-darkInkSecondary">
                  <span className="font-extrabold text-ink dark:text-darkInk">{r.per_serving_calories} kcal</span>
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <span>{r.per_serving_protein}g P</span>
                    <span className="text-amber-800 dark:text-darkButter">{r.per_serving_carbs}g C</span>
                    <span>{r.per_serving_fat}g F</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-2">
                  <span>🕒 {r.prep_time_minutes + r.cook_time_minutes} min</span>
                  <span>{r.ingredients_count} ingredients</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Recipe Modal */}
      {inspectRecipeId && (
        <RecipeDetailModal
          recipeId={inspectRecipeId}
          onClose={() => {
            setInspectRecipeId(null)
            onCloseInitialRecipe?.()
          }}
          onRecipeDeleted={() => {
            setInspectRecipeId(null)
            onCloseInitialRecipe?.()
            loadRecipes()
            loadPlanRecipes()
          }}
        />
      )}

      {/* Create Custom Recipe Modal */}
      {showCreateModal && (
        <CreateRecipeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadRecipes()
            loadPlanRecipes()
          }}
        />
      )}
    </div>
  )
}
