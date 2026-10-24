import { useState } from 'react'
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

  const isDayMode = !meal && dayNumber != null

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-left border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {isDayMode ? `Log Meals for ${dayName || 'Day'}` : `Log ${meal?.name}`}
            </h3>
            <p className="text-xs text-slate-500">Record planned nutrition into your actual food diary</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* Target Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Log for Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Items Preview */}
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Items to be recorded:
            </div>
            {meal ? (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-40 overflow-y-auto divide-y divide-slate-100">
                {meal.items.map((it) => (
                  <div key={it.id} className="py-1.5 flex justify-between text-xs text-slate-700">
                    <span className="font-medium text-slate-800">{it.food_name || 'Ingredient'}</span>
                    <span className="text-slate-500">
                      {it.quantity} {it.unit} (~{it.calories_kcal} kcal)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-600">
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
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="skipDuplicates" className="text-xs text-slate-600 leading-snug cursor-pointer">
              <span className="font-medium text-slate-800">Prevent duplicate entries:</span> Skip ingredients that
              have already been recorded in your food diary for this date and category.
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Note:</strong> Planned meals never enter your food diary automatically. Confirming will create
            official diary entries with calculated nutrition snapshots.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging...' : 'Confirm & Log to Diary'}
          </button>
        </div>
      </div>
    </div>
  )
}

