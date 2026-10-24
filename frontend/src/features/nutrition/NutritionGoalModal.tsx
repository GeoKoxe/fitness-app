import { useEffect, useState } from 'react'
import type { GoalEstimate, NutritionGoal } from '../../types/nutritionGoal'
import { nutritionGoalService } from '../../services/nutritionGoalService'

interface NutritionGoalModalProps {
  currentGoals: NutritionGoal | null
  onGoalsSaved: (updated: NutritionGoal) => void
  onClose: () => void
}

export function NutritionGoalModal({
  currentGoals,
  onGoalsSaved,
  onClose,
}: NutritionGoalModalProps) {
  const [calories, setCalories] = useState<string>(
    currentGoals?.calories_kcal != null ? String(Math.round(currentGoals.calories_kcal)) : ''
  )
  const [protein, setProtein] = useState<string>(
    currentGoals?.protein_g != null ? String(Math.round(currentGoals.protein_g)) : ''
  )
  const [carbs, setCarbs] = useState<string>(
    currentGoals?.carbs_g != null ? String(Math.round(currentGoals.carbs_g)) : ''
  )
  const [fat, setFat] = useState<string>(
    currentGoals?.fat_g != null ? String(Math.round(currentGoals.fat_g)) : ''
  )
  const [fiber, setFiber] = useState<string>(
    currentGoals?.fiber_g != null ? String(Math.round(currentGoals.fiber_g)) : ''
  )

  const [estimate, setEstimate] = useState<GoalEstimate | null>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (currentGoals) {
      setCalories(currentGoals.calories_kcal != null ? String(Math.round(currentGoals.calories_kcal)) : '')
      setProtein(currentGoals.protein_g != null ? String(Math.round(currentGoals.protein_g)) : '')
      setCarbs(currentGoals.carbs_g != null ? String(Math.round(currentGoals.carbs_g)) : '')
      setFat(currentGoals.fat_g != null ? String(Math.round(currentGoals.fat_g)) : '')
      setFiber(currentGoals.fiber_g != null ? String(Math.round(currentGoals.fiber_g)) : '')
    }
  }, [currentGoals])

  const handleFetchEstimate = async () => {
    setLoadingEstimate(true)
    setErrorMessage(null)
    try {
      const data = await nutritionGoalService.estimateGoals()
      setEstimate(data)
      setCalories(String(Math.round(data.calories_kcal)))
      setProtein(String(Math.round(data.protein_g)))
      setCarbs(String(Math.round(data.carbs_g)))
      setFat(String(Math.round(data.fat_g)))
      setFiber(String(Math.round(data.fiber_g)))
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not compute estimate. Please ensure profile is created.'
      )
    } finally {
      setLoadingEstimate(false)
    }
  }

  const parseNumberOrNull = (val: string, name: string, maxVal: number): number | null => {
    const trimmed = val.trim()
    if (!trimmed) return null
    const num = parseFloat(trimmed)
    if (isNaN(num)) {
      throw new Error(`${name} must be a valid whole number.`)
    }
    if (num < 0) {
      throw new Error(`${name} cannot be negative.`)
    }
    if (num > maxVal) {
      throw new Error(`${name} exceeds maximum limit of ${maxVal}.`)
    }
    return Math.round(num)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const payload: Partial<NutritionGoal> = {
        calories_kcal: parseNumberOrNull(calories, 'Calories', 15000),
        protein_g: parseNumberOrNull(protein, 'Protein', 2000),
        carbs_g: parseNumberOrNull(carbs, 'Carbohydrates', 2000),
        fat_g: parseNumberOrNull(fat, 'Fat', 2000),
        fiber_g: parseNumberOrNull(fiber, 'Fiber', 500),
      }

      const saved = await nutritionGoalService.updateGoals(payload)
      onGoalsSaved(saved)
      onClose()
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save goals.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 id="goal-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Daily Nutrition Goals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalized targets for daily tracking. Leave blank if you prefer not to track a specific metric.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Goal Estimate Helper */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Need a starting point?
              </span>
              <button
                type="button"
                onClick={handleFetchEstimate}
                disabled={loadingEstimate}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition disabled:opacity-50"
              >
                {loadingEstimate ? 'Calculating...' : 'Calculate Suggestion'}
              </button>
            </div>
            {estimate && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700/60 pt-2">
                {estimate.formula_explanation}
              </p>
            )}
          </div>

          {/* Target Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Calories */}
            <div className="sm:col-span-2">
              <label htmlFor="target-calories" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily Calorie Target (kcal)
              </label>
              <input
                id="target-calories"
                type="number"
                step="1"
                min="0"
                max="15000"
                placeholder="e.g. 2000 (optional)"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-semibold focus:outline-emerald-500"
              />
            </div>

            {/* Protein */}
            <div>
              <label htmlFor="target-protein" className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                Protein Target (g)
              </label>
              <input
                id="target-protein"
                type="number"
                step="1"
                min="0"
                max="2000"
                placeholder="e.g. 140 (optional)"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-semibold focus:outline-blue-500"
              />
            </div>

            {/* Carbs */}
            <div>
              <label htmlFor="target-carbs" className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                Carbohydrate Target (g)
              </label>
              <input
                id="target-carbs"
                type="number"
                step="1"
                min="0"
                max="2000"
                placeholder="e.g. 220 (optional)"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-semibold focus:outline-amber-500"
              />
            </div>

            {/* Fat */}
            <div>
              <label htmlFor="target-fat" className="block text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                Fat Target (g)
              </label>
              <input
                id="target-fat"
                type="number"
                step="1"
                min="0"
                max="2000"
                placeholder="e.g. 65 (optional)"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-semibold focus:outline-rose-500"
              />
            </div>

            {/* Fiber */}
            <div>
              <label htmlFor="target-fiber" className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                Fiber Target (g)
              </label>
              <input
                id="target-fiber"
                type="number"
                step="1"
                min="0"
                max="500"
                placeholder="e.g. 30 (optional)"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-semibold focus:outline-emerald-500"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-2">
            Tip: These targets are stored locally in SQLite on your device. Changing body measurements in your profile will not alter your saved targets.
          </p>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Goals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

