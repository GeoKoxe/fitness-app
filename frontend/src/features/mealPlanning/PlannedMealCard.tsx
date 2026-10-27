import { useState } from 'react'
import type { MealPlan, PlannedMeal } from '../../types/mealPlan'
import { mealPlanService } from '../../services/mealPlanService'

interface PlannedMealCardProps {
  meal: PlannedMeal
  onLogMeal: (meal: PlannedMeal) => void
  onAdjustPortions: (meal: PlannedMeal) => void
  onReplaceMeal: (meal: PlannedMeal) => void
  onPlanUpdated: (plan: MealPlan) => void
  onDislikeIngredient?: ((foodName: string, foodId?: number | null) => void) | undefined
  onViewRecipe?: ((recipeId: number) => void) | undefined
}

export function PlannedMealCard({
  meal,
  onLogMeal,
  onAdjustPortions,
  onReplaceMeal,
  onPlanUpdated,
  onDislikeIngredient,
  onViewRecipe,
}: PlannedMealCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const [regenerating, setRegenerating] = useState<boolean>(false)
  const isIncomplete = !meal.recipe_id && meal.items.length === 0

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updatedPlan = await mealPlanService.regenerateMeal(meal.id)
      onPlanUpdated(updatedPlan)
    } finally {
      setRegenerating(false)
    }
  }

  const categoryBadgeClass = () => {
    switch (meal.meal_category.toLowerCase()) {
      case 'breakfast':
        return 'bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border-amber-300 dark:border-darkButter/40'
      case 'lunch':
        return 'bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border-sand/60 dark:border-darkBorder/60'
      case 'dinner':
        return 'bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border-sand/60 dark:border-darkBorder/60'
      default:
        return 'bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border-sand dark:border-darkBorder'
    }
  }

  return (
    <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xs border border-sand dark:border-darkBorder p-4 transition text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${categoryBadgeClass()}`}
          >
            {meal.meal_category}
          </span>
          <h4 className="text-sm font-bold text-ink dark:text-darkInk">{meal.name}</h4>
          {meal.servings !== 1.0 && (
            <span className="text-xs font-medium text-inkSecondary dark:text-darkInkSecondary bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder px-2 py-0.5 rounded-full">
              {meal.servings}x serving
            </span>
          )}
        </div>

        {/* Nutrition Summary */}
        <div className="flex items-center gap-3 text-xs flex-wrap font-medium text-inkSecondary dark:text-darkInkSecondary">
          <span className="font-bold text-ink dark:text-darkInk">{meal.calories_kcal} kcal</span>
          <span className="text-ink dark:text-darkInk font-semibold">{meal.protein_g}g P</span>
          <span className="text-amber-800 dark:text-darkButter font-semibold">{meal.carbs_g}g C</span>
          <span className="text-ink dark:text-darkInk font-semibold">{meal.fat_g}g F</span>
          {meal.fiber_g != null && (
            <span className="font-semibold text-status-success-fg dark:text-emerald-400">{meal.fiber_g}g Fib</span>
          )}
        </div>
      </div>

      {/* Incomplete Slot Warning Banner */}
      {isIncomplete && (
        <div className="mt-3 p-3 bg-status-error dark:bg-darkSurface border border-border-card rounded-xl text-xs text-alert dark:text-darkCoral flex items-start gap-2">
          <span className="font-bold shrink-0">⚠️ Incomplete Slot:</span>
          <div className="flex-1">
            <span>No recipe currently assigned. Click <strong>Replace</strong> to choose or create a recipe.</span>
            {meal.notes && <div className="text-[11px] mt-0.5">{meal.notes}</div>}
          </div>
        </div>
      )}

      {/* Expanded Ingredients List */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-sand/60 dark:border-darkBorder/60">
          <div className="text-[11px] font-semibold text-inkSecondary dark:text-darkInkSecondary uppercase tracking-wider mb-2">
            Ingredients ({meal.items.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-canvas/60 dark:bg-darkCanvas/60 p-3 rounded-xl border border-sand dark:border-darkBorder">
            {meal.items.map((it) => (
              <div
                key={it.id}
                className="text-xs flex items-center justify-between text-ink dark:text-darkInk bg-surface dark:bg-darkSurface p-2.5 rounded-xl border border-sand/70 dark:border-darkBorder/70 gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink dark:text-darkInk truncate">{it.food_name || 'Item'}</div>
                  <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary whitespace-nowrap">
                    {it.quantity} {it.unit} &middot; {it.calories_kcal} kcal
                  </div>
                </div>
                {onDislikeIngredient && (
                  <button
                    type="button"
                    onClick={() => onDislikeIngredient(it.food_name || '', it.food_id ?? null)}
                    title={`Mark ${it.food_name || 'ingredient'} as disliked`}
                    className="shrink-0 px-2 py-1 text-[11px] font-semibold text-alert dark:text-darkCoral hover:bg-mist/30 dark:hover:bg-darkMist/30 border border-alert/30 dark:border-darkCoral/30 rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <span>👎</span> Dislike
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-sand/60 dark:border-darkBorder/60 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk transition cursor-pointer"
        >
          {expanded ? 'Hide Ingredients ▲' : `View Ingredients (${meal.items.length}) ▼`}
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          {meal.recipe_id ? (
            <button
              type="button"
              onClick={() => onViewRecipe?.(meal.recipe_id!)}
              title="View recipe details"
              className="px-2.5 py-1 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer"
            >
              Recipe
            </button>
          ) : (
            <span
              title="This meal is not linked to a specific recipe in the library"
              className="px-2.5 py-1 text-xs font-medium text-inkSecondary/60 dark:text-darkInkSecondary/60 bg-canvas dark:bg-darkCanvas border border-sand/40 dark:border-darkBorder/40 rounded-xl cursor-not-allowed select-none"
            >
              Recipe
            </span>
          )}
          <button
            type="button"
            onClick={() => onAdjustPortions(meal)}
            disabled={isIncomplete}
            title={isIncomplete ? 'Cannot adjust portions for an incomplete meal' : 'Adjust portion size'}
            className="px-2.5 py-1 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Portions
          </button>
          <button
            type="button"
            onClick={() => onReplaceMeal(meal)}
            title="Replace with another recipe"
            className="px-2.5 py-1 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerate this meal with another matching recipe"
            className="px-2.5 py-1 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {regenerating ? '...' : '↺ Shuffle'}
          </button>
          <button
            type="button"
            onClick={() => onLogMeal(meal)}
            disabled={isIncomplete}
            title={isIncomplete ? 'Assign a recipe before logging to diary' : 'Log to food diary'}
            className={`px-3 py-1 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer ${
              isIncomplete
                ? 'bg-canvas dark:bg-darkCanvas text-inkSecondary/60 dark:text-darkInkSecondary/60 border border-sand/50 dark:border-darkBorder/50 cursor-not-allowed'
                : 'text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white'
            }`}
          >
            Log to Diary
          </button>
        </div>
      </div>
    </div>
  )
}
