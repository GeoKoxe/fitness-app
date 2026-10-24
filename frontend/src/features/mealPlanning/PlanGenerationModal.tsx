import { useState } from 'react'
import type { MealPlan } from '../../types/mealPlan'
import type { NutritionGoal } from '../../types/nutritionGoal'
import { mealPlanService } from '../../services/mealPlanService'

interface PlanGenerationModalProps {
  goals?: NutritionGoal | null | undefined
  onClose: () => void
  onSuccess: (plan: MealPlan) => void
}

export function PlanGenerationModal({ goals, onClose, onSuccess }: PlanGenerationModalProps) {
  const [name, setName] = useState<string>('7-Day Meal Plan')
  const [targetCalories, setTargetCalories] = useState<number>(Math.round(goals?.calories_kcal || 2000))
  const [targetProtein, setTargetProtein] = useState<number>(Math.round(goals?.protein_g || 120))
  const [enabledCategories, setEnabledCategories] = useState<string[]>([
    'breakfast',
    'lunch',
    'dinner',
    'snacks',
  ])
  const [dislikedFoodsStr, setDislikedFoodsStr] = useState<string>('')
  const [simplicityPreference, setSimplicityPreference] = useState<string>('simple')
  const [maxCookingTime, setMaxCookingTime] = useState<string>('')
  const [targetTolerance, setTargetTolerance] = useState<number>(10)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (cat: string) => {
    setEnabledCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enabledCategories.length === 0) {
      setError('Please select at least one meal category.')
      return
    }

    setLoading(true)
    setError(null)

    const disliked = dislikedFoodsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    try {
      const plan = await mealPlanService.generatePlan({
        name: name.trim() || '7-Day Meal Plan',
        enabled_categories: enabledCategories,
        disliked_foods: disliked,
        target_calories: targetCalories,
        target_protein: targetProtein,
        simplicity_preference: simplicityPreference,
        max_cooking_time_minutes: maxCookingTime ? parseInt(maxCookingTime, 10) : null,
        target_tolerance_pct: targetTolerance,
      })
      onSuccess(plan)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate meal plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 text-left border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Generate 7-Day Meal Plan</h3>
            <p className="text-xs text-slate-500">
              Deterministic planner matching your targets with local staple recipes
            </p>
          </div>
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

        <form onSubmit={handleGenerate} className="mt-4 space-y-4">
          {/* Plan Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Plan Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Calories (kcal)
              </label>
              <input
                type="number"
                min="800"
                max="8000"
                value={targetCalories}
                onChange={(e) => setTargetCalories(parseInt(e.target.value, 10) || 2000)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Protein (g)
              </label>
              <input
                type="number"
                min="20"
                max="500"
                value={targetProtein}
                onChange={(e) => setTargetProtein(parseInt(e.target.value, 10) || 120)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Tolerance */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Target Tolerance
              </label>
              <span className="text-xs font-bold text-indigo-600">&plusmn;{targetTolerance}%</span>
            </div>
            <select
              value={targetTolerance}
              onChange={(e) => setTargetTolerance(parseFloat(e.target.value) || 10)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="10">&plusmn;10% (Default - Strict)</option>
              <option value="12">&plusmn;12% (Balanced)</option>
              <option value="15">&plusmn;15% (Flexible)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Allows planner to fit wholesome staple foods without exceeding upper limits.
            </p>
          </div>

          {/* Meal Categories */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Daily Meal Structure
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snacks'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center capitalize transition-colors ${
                    enabledCategories.includes(cat)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Simplicity & Variety */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Meal Structure & Routine
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition-colors ${
                  simplicityPreference === 'simple'
                    ? 'bg-indigo-50/70 border-indigo-400'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="simplicity"
                  value="simple"
                  checked={simplicityPreference === 'simple'}
                  onChange={() => setSimplicityPreference('simple')}
                  className="sr-only"
                />
                <div className="text-xs font-bold text-slate-800">Simple & Efficient</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Reuses fresh ingredients and staples across alternating days for simpler prep and lower waste.
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition-colors ${
                  simplicityPreference === 'varied'
                    ? 'bg-indigo-50/70 border-indigo-400'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="simplicity"
                  value="varied"
                  checked={simplicityPreference === 'varied'}
                  onChange={() => setSimplicityPreference('varied')}
                  className="sr-only"
                />
                <div className="text-xs font-bold text-slate-800">Maximum Variety</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Prioritizes distinct recipe choices each day of the week.
                </div>
              </label>
            </div>
          </div>

          {/* Disliked Foods */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Disliked Foods / Exclusions
            </label>
            <input
              type="text"
              placeholder="e.g. olives, mushrooms (comma-separated)"
              value={dislikedFoodsStr}
              onChange={(e) => setDislikedFoodsStr(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Uses exact word matching. Excluding <code className="text-slate-700 bg-slate-100 px-1 rounded">olives</code> will strictly exclude olives but will <span className="font-semibold text-slate-700">not</span> exclude olive oil.
            </p>
          </div>

          {/* Max Cooking Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Max Total Cooking Time (optional)
            </label>
            <select
              value={maxCookingTime}
              onChange={(e) => setMaxCookingTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No limit</option>
              <option value="15">Quick (under 15 min)</option>
              <option value="30">Under 30 min</option>
              <option value="45">Under 45 min</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating Plan...' : 'Generate 7-Day Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

