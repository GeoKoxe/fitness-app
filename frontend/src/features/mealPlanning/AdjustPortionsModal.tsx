import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-portions-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 text-left border border-edge">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <h3 id="adjust-portions-title" className="text-base font-bold text-ink">
            Adjust Portions
          </h3>
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

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs text-inkSecondary font-medium">Meal</span>
            <div className="text-sm font-semibold text-ink">{meal.name}</div>
          </div>

          <div>
            <label htmlFor="adjust-servings-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Servings
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                aria-label="Decrease servings"
                className="w-10 h-10 rounded-lg border border-edge text-ink font-bold hover:bg-surfaceMuted transition-colors bg-surface"
              >
                -
              </button>
              <input
                id="adjust-servings-input"
                type="number"
                step="1"
                min="1"
                max="10"
                value={servings}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1
                  setServings(val)
                }}
                className="flex-1 text-center font-bold text-ink bg-surface border border-edge rounded-lg py-2 focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => setServings((s) => s + 1)}
                aria-label="Increase servings"
                className="w-10 h-10 rounded-lg border border-edge text-ink font-bold hover:bg-surfaceMuted transition-colors bg-surface"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-inkSecondary mt-1">
              Whole servings only. Quantities are rounded to multiples of 5 (g/ml) or whole units.
            </p>
          </div>

          <div className="bg-surfaceMuted border border-edge rounded-lg p-3 text-xs text-inkSecondary space-y-1">
            <div className="flex justify-between">
              <span>Estimated Calories:</span>
              <span className="font-semibold text-ink">~{estimatedCalories} kcal</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Protein:</span>
              <span className="font-semibold text-brand">~{estimatedProtein} g</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-edge">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brandHover rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update Portions'}
          </button>
        </div>
      </div>
    </div>
  )
}
