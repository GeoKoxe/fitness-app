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

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updatedPlan = await mealPlanService.regenerateMeal(meal.id)
      onPlanUpdated(updatedPlan)
    } finally {
      setRegenerating(false)
    }
  }

  const categoryColor = () => {
    switch (meal.meal_category.toLowerCase()) {
      case 'breakfast':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'lunch':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'dinner':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 transition-all hover:border-slate-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${categoryColor()}`}
          >
            {meal.meal_category}
          </span>
          <h4 className="text-sm font-bold text-slate-800">{meal.name}</h4>
          {meal.servings !== 1.0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {meal.servings}x serving
            </span>
          )}
        </div>

        {/* Nutrition Pills */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-slate-900">{meal.calories_kcal} kcal</span>
          <span className="font-semibold text-indigo-600">{meal.protein_g}g P</span>
          <span className="font-semibold text-amber-600">{meal.carbs_g}g C</span>
          <span className="font-semibold text-rose-600">{meal.fat_g}g F</span>
          {meal.fiber_g != null && (
            <span className="font-semibold text-emerald-600">{meal.fiber_g}g Fib</span>
          )}
        </div>
      </div>

      {/* Expanded Ingredients List */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Ingredients ({meal.items.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            {meal.items.map((it) => (
              <div
                key={it.id}
                className="text-xs flex items-center justify-between text-slate-700 bg-white p-2 rounded-md border border-slate-150 gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">{it.food_name || 'Item'}</div>
                  <div className="text-[11px] text-slate-500 whitespace-nowrap">
                    {it.quantity} {it.unit} &middot; {it.calories_kcal} kcal
                  </div>
                </div>
                {onDislikeIngredient && (
                  <button
                    type="button"
                    onClick={() => onDislikeIngredient(it.food_name || '', it.food_id ?? null)}
                    title={`Mark ${it.food_name || 'ingredient'} as disliked`}
                    className="shrink-0 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded transition-colors flex items-center gap-1"
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
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          {expanded ? 'Hide Ingredients ▲' : `View Ingredients (${meal.items.length}) ▼`}
        </button>

        <div className="flex items-center gap-1.5">
          {meal.recipe_id ? (
            <button
              type="button"
              onClick={() => onViewRecipe?.(meal.recipe_id!)}
              title="View recipe details"
              className="px-2 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
            >
              Recipe
            </button>
          ) : (
            <span
              title="This meal is not linked to a specific recipe in the library"
              className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-50 rounded-md cursor-not-allowed select-none"
            >
              Recipe
            </span>
          )}
          <button
            type="button"
            onClick={() => onAdjustPortions(meal)}
            title="Adjust portion size"
            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Portions
          </button>
          <button
            type="button"
            onClick={() => onReplaceMeal(meal)}
            title="Replace with another recipe"
            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerate this meal with another matching recipe"
            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
          >
            {regenerating ? '...' : '↺ Shuffle'}
          </button>
          <button
            type="button"
            onClick={() => onLogMeal(meal)}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-2xs transition-colors"
          >
            Log to Diary
          </button>
        </div>
      </div>
    </div>
  )
}

