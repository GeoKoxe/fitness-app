import { useEffect, useState } from 'react'
import type { PlannedMeal } from '../../types/mealPlan'
import { mealPlanService } from '../../services/mealPlanService'

interface LogPlannedMealModalProps {
  meal?: PlannedMeal | null | undefined
  dayNumber?: number | null | undefined
  dayName?: string | undefined
  initialDate: string
  onClose: () => void
  onSuccess: (message: string, targetDate: string) => void
}

export function LogPlannedMealModal({
  meal,
  dayNumber,
  dayName,
  initialDate,
  onClose,
  onSuccess,
}: LogPlannedMealModalProps) {
  const [targetDate, setTargetDate] = useState<string>(initialDate)
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isDayMode = !meal && dayNumber != null
  const isIncompleteMeal = Boolean(meal && !meal.recipe_id && meal.items.length === 0)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await mealPlanService.logPlannedMeals({
        target_date: targetDate,
        planned_meal_id: meal?.id,
        day_number: dayNumber ?? undefined,
        skip_if_already_logged: skipDuplicates,
      })
      if (!res.success && res.logged_count === 0 && res.skipped_count === 0) {
        setError(res.message || 'Failed to log planned meal.')
        return
      }
      onSuccess(res.message, targetDate)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log planned meal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-planned-meal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6 text-left border border-edge">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div>
            <h3 id="log-planned-meal-title" className="text-lg font-bold text-ink">
              {isDayMode ? `Log Meals for ${dayName || 'Day'}` : `Log ${meal?.name}`}
            </h3>
            <p className="text-xs text-inkSecondary">Record planned nutrition into your actual food diary</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-inkSecondary hover:text-ink rounded-lg p-1.5 hover:bg-surfaceMuted transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-sm rounded-lg">
            {error}
          </div>
        )}

        {isIncompleteMeal && (
          <div className="mt-4 p-3 bg-status-warning-bg border border-status-warning-border text-status-warning-fg text-xs rounded-lg">
            ⚠️ <strong>Cannot Log Incomplete Meal:</strong> This slot has no recipe or ingredients assigned.
            Please use <strong>Replace</strong> to choose a recipe before logging it to your food diary.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Target Date Picker */}
          <div>
            <label htmlFor="log-target-date-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Log for Date
            </label>
            <input
              id="log-target-date-input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Items Preview */}
          <div>
            <div className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Items to be recorded:
            </div>
            {meal ? (
              <div className="bg-surfaceMuted rounded-lg p-3 border border-edge max-h-40 overflow-y-auto divide-y divide-edge">
                {meal.items.map((it) => (
                  <div key={it.id} className="py-1.5 flex justify-between text-xs text-ink">
                    <span className="font-medium text-ink">{it.food_name || 'Ingredient'}</span>
                    <span className="text-inkSecondary">
                      {it.quantity} {it.unit} (~{it.calories_kcal} kcal)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surfaceMuted rounded-lg p-3 border border-edge text-xs text-inkSecondary">
                All planned meals and ingredients for {dayName || 'this day'} will be logged for {targetDate}.
              </div>
            )}
          </div>

          {/* Duplicate Prevention Checkbox */}
          <div className="flex items-start gap-2.5 pt-2">
            <input
              type="checkbox"
              id="skipDuplicates"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-edge text-brand focus:ring-brand accent-brand"
            />
            <label htmlFor="skipDuplicates" className="text-xs text-inkSecondary leading-snug cursor-pointer">
              <span className="font-semibold text-ink">Prevent duplicate entries:</span> Skip ingredients that
              have already been recorded in your food diary for this date and category.
            </label>
          </div>

          <div className="bg-status-warning-bg border border-status-warning-border rounded-lg p-3 text-xs text-status-warning-fg">
            <strong>Note:</strong> Planned meals never enter your food diary automatically. Confirming will create
            official diary entries with calculated nutrition snapshots.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-edge">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || isIncompleteMeal}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand hover:bg-brandHover rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging...' : 'Confirm & Log to Diary'}
          </button>
        </div>
      </div>
    </div>
  )
}
