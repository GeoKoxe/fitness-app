import { useEffect, useState } from 'react'
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
  const [targetCarbs, setTargetCarbs] = useState<number>(Math.round(goals?.carbs_g || 225))
  const [targetFat, setTargetFat] = useState<number>(Math.round(goals?.fat_g || 65))
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

  // Live Atwater Mathematical Compatibility Check
  const macroCalories = 4 * targetProtein + 4 * targetCarbs + 9 * targetFat
  const macroDiff = Math.abs(macroCalories - targetCalories)
  const macroDiffPct = targetCalories > 0 ? (macroDiff / targetCalories) * 100 : 0
  const hasMacroConflict = macroDiffPct > targetTolerance * 1.5

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
        target_carbs: targetCarbs,
        target_fat: targetFat,
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-generation-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 text-left border border-edge max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div>
            <h3 id="plan-generation-title" className="text-lg font-bold text-ink">
              Generate 7-Day Meal Plan
            </h3>
            <p className="text-xs text-inkSecondary">
              Deterministic planner matching your targets with local staple recipes
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
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="mt-4 space-y-4">
          {/* Plan Name */}
          <div>
            <label htmlFor="plan-name-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Plan Name
            </label>
            <input
              id="plan-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="plan-target-calories" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Calories (kcal)
              </label>
              <input
                id="plan-target-calories"
                type="number"
                min="800"
                max="8000"
                value={targetCalories}
                onChange={(e) => setTargetCalories(parseInt(e.target.value, 10) || 2000)}
                className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="plan-target-protein" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Protein (g)
              </label>
              <input
                id="plan-target-protein"
                type="number"
                min="20"
                max="500"
                value={targetProtein}
                onChange={(e) => setTargetProtein(parseInt(e.target.value, 10) || 120)}
                className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="plan-target-carbs" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Carbs (g)
              </label>
              <input
                id="plan-target-carbs"
                type="number"
                min="0"
                max="1000"
                value={targetCarbs}
                onChange={(e) => setTargetCarbs(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="plan-target-fat" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Fat (g)
              </label>
              <input
                id="plan-target-fat"
                type="number"
                min="0"
                max="500"
                value={targetFat}
                onChange={(e) => setTargetFat(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Live Atwater Feedback */}
          {hasMacroConflict ? (
            <div className="p-3 bg-status-danger-bg border border-status-danger-border rounded-xl text-status-danger-fg text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span>⚠️</span>
                <span>Macronutrient & Energy Discrepancy</span>
              </div>
              <p className="leading-relaxed">
                Configured macros ({targetProtein}g P, {targetCarbs}g C, {targetFat}g F) provide approximately{' '}
                <strong>{macroCalories} kcal</strong> via 4/4/9 kcal/g conversion, which deviates by{' '}
                <strong>{macroDiffPct.toFixed(1)}%</strong> from your {targetCalories} kcal goal. The planner will flag this conflict in your overview.
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-inkSecondary flex items-center justify-between px-1">
              <span>
                Calculated energy: <strong className="text-ink">{macroCalories} kcal</strong> (4P + 4C + 9F)
              </span>
              <span className="text-status-success-fg font-semibold">
                ✓ Compatible within &plusmn;{targetTolerance}%
              </span>
            </div>
          )}

          {/* Tolerance */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="plan-target-tolerance" className="block text-xs font-semibold text-ink uppercase tracking-wider">
                Target Tolerance
              </label>
              <span className="text-xs font-bold text-brand">&plusmn;{targetTolerance}%</span>
            </div>
            <select
              id="plan-target-tolerance"
              value={targetTolerance}
              onChange={(e) => setTargetTolerance(parseFloat(e.target.value) || 10)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
            >
              <option value="10">&plusmn;10% (Default - Strict)</option>
              <option value="12">&plusmn;12% (Balanced)</option>
              <option value="15">&plusmn;15% (Flexible)</option>
            </select>
            <p className="text-[11px] text-inkSecondary mt-1">
              Allows planner to fit wholesome staple foods without exceeding upper limits.
            </p>
          </div>

          {/* Meal Categories */}
          <div>
            <span className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              Daily Meal Structure
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snacks'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center capitalize transition-colors ${
                    enabledCategories.includes(cat)
                      ? 'bg-brand/10 border-brand text-brand font-semibold'
                      : 'bg-surface border-edge text-inkSecondary hover:bg-surfaceMuted'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Simplicity & Variety */}
          <div>
            <span className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              Meal Structure & Routine
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition-colors ${
                  simplicityPreference === 'simple'
                    ? 'bg-brand/10 border-brand'
                    : 'bg-surface border-edge hover:bg-surfaceMuted'
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
                <div className="text-xs font-bold text-ink">Simple & Efficient</div>
                <div className="text-[11px] text-inkSecondary mt-1 leading-snug">
                  Reuses fresh ingredients and staples across alternating days for simpler prep and lower waste.
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-left transition-colors ${
                  simplicityPreference === 'varied'
                    ? 'bg-brand/10 border-brand'
                    : 'bg-surface border-edge hover:bg-surfaceMuted'
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
                <div className="text-xs font-bold text-ink">Maximum Variety</div>
                <div className="text-[11px] text-inkSecondary mt-1 leading-snug">
                  Prioritizes distinct recipe choices each day of the week.
                </div>
              </label>
            </div>
          </div>

          {/* Disliked Foods */}
          <div>
            <label htmlFor="plan-disliked-foods" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Disliked Foods / Exclusions
            </label>
            <input
              id="plan-disliked-foods"
              type="text"
              placeholder="e.g. olives, mushrooms (comma-separated)"
              value={dislikedFoodsStr}
              onChange={(e) => setDislikedFoodsStr(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
            <p className="text-[11px] text-inkSecondary mt-1 leading-normal">
              Uses exact word matching. Excluding <code className="text-ink bg-surfaceMuted px-1 rounded">olives</code> will strictly exclude olives but will <span className="font-semibold text-ink">not</span> exclude olive oil.
            </p>
          </div>

          {/* Max Cooking Time */}
          <div>
            <label htmlFor="plan-max-cooking-time" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Max Total Cooking Time (optional)
            </label>
            <select
              id="plan-max-cooking-time"
              value={maxCookingTime}
              onChange={(e) => setMaxCookingTime(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
            >
              <option value="">No limit</option>
              <option value="15">Quick (under 15 min)</option>
              <option value="30">Under 30 min</option>
              <option value="45">Under 45 min</option>
            </select>
          </div>

          <div className="pt-4 border-t border-edge flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brandHover rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating Plan...' : 'Generate 7-Day Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
