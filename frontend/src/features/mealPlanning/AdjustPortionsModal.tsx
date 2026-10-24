import { useState } from 'react'
import type { MealPlan, PlannedMeal } from '../../types/mealPlan'
import { mealPlanService } from '../../services/mealPlanService'

interface AdjustPortionsModalProps {
  meal: PlannedMeal
  onClose: () => void
  onSuccess: (updatedPlan: MealPlan) => void
}

export function AdjustPortionsModal({ meal, onClose, onSuccess }: AdjustPortionsModalProps) {
  const [servings, setServings] = useState<number>(meal.servings)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (servings <= 0) {
      setError('Servings must be greater than 0.')
      return
    }
    if (Math.abs(servings - 1.5) < 1e-4) {
      setError('1.5x serving option is not supported. Please choose a whole serving (1, 2, 3...).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const updatedPlan = await mealPlanService.adjustMealServings(meal.id, servings)
      onSuccess(updatedPlan)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to adjust servings.')
    } finally {
      setLoading(false)
    }
  }

  const multiplier = meal.servings > 0 ? servings / meal.servings : 1.0
  const estimatedCalories = Math.round(meal.calories_kcal * multiplier)
  const estimatedProtein = (meal.protein_g * multiplier).toFixed(1)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-left border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Adjust Portions</h3>
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

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs text-slate-500 font-medium">Meal</span>
            <div className="text-sm font-semibold text-slate-800">{meal.name}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Servings
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="w-10 h-10 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                step="1"
                min="1"
                max="10"
                value={servings}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1
                  setServings(val)
                }}
                className="flex-1 text-center font-bold text-slate-900 border border-slate-300 rounded-lg py-2 focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setServings((s) => s + 1)}
                className="w-10 h-10 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Whole servings only. Quantities are rounded to multiples of 5 (g/ml) or whole units.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Estimated Calories:</span>
              <span className="font-semibold text-slate-900">~{estimatedCalories} kcal</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Protein:</span>
              <span className="font-semibold text-indigo-600">~{estimatedProtein} g</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update Portions'}
          </button>
        </div>
      </div>
    </div>
  )
}

