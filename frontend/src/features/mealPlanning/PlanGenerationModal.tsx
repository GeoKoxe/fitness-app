import { useEffect, useState } from 'react'
import type { MealPlan } from '../../types/mealPlan'
import type { GenerateGoalsResponse, GeneratedProfile, NutritionGoal } from '../../types/nutritionGoal'
import { mealPlanService } from '../../services/mealPlanService'
import { nutritionGoalService } from '../../services/nutritionGoalService'

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
  const [simplicityPreference, setSimplicityPreference] = useState<'simple' | 'varied'>('simple')
  const [maxCookingTime, setMaxCookingTime] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Goal Generator Drawer State
  const [showGoalDrawer, setShowGoalDrawer] = useState<boolean>(false)
  const [generatedData, setGeneratedData] = useState<GenerateGoalsResponse | null>(null)
  const [loadingGoals, setLoadingGoals] = useState<boolean>(false)
  const [goalGenError, setGoalGenError] = useState<string | null>(null)
  const [appliedGoalNotice, setAppliedGoalNotice] = useState<string | null>(null)

  // Live Atwater Mathematical Compatibility Check
  const macroCalories = 4 * targetProtein + 4 * targetCarbs + 9 * targetFat
  const macroDiff = Math.abs(macroCalories - targetCalories)
  const hasMacroConflict = macroDiff > 15

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

  const handleFetchGoalProfiles = async () => {
    setLoadingGoals(true)
    setGoalGenError(null)
    setAppliedGoalNotice(null)
    try {
      const data = await nutritionGoalService.generateGoals()
      setGeneratedData(data)
    } catch (err: unknown) {
      setGoalGenError(
        err instanceof Error ? err.message : 'Could not generate goal profiles. Ensure body profile and measurements are set.'
      )
    } finally {
      setLoadingGoals(false)
    }
  }

  const handleApplyProfile = (prof: GeneratedProfile) => {
    setTargetCalories(Math.round(prof.calories_kcal))
    setTargetProtein(Math.round(prof.protein_g))
    setTargetCarbs(Math.round(prof.carbs_g))
    setTargetFat(Math.round(prof.fat_g))
    setAppliedGoalNotice(`Applied ${prof.name} targets (${prof.calories_kcal} kcal)!`)
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
        generation_strategy: simplicityPreference,
        enabled_categories: enabledCategories,
        disliked_foods: disliked,
        target_calories: targetCalories,
        target_protein: targetProtein,
        target_carbs: targetCarbs,
        target_fat: targetFat,
        simplicity_preference: simplicityPreference,
        max_cooking_time_minutes: maxCookingTime ? parseInt(maxCookingTime, 10) : null,
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
      <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-sand dark:border-darkBorder max-h-[92vh] overflow-y-auto transition-colors motion-reduce:transition-none">
        <div className="flex items-center justify-between pb-3 border-b border-sand dark:border-darkBorder">
          <div>
            <h3 id="plan-generation-title" className="text-lg font-bold text-ink dark:text-darkInk">
              Generate 7-Day Meal Plan
            </h3>
            <p className="text-xs text-inkSecondary dark:text-darkInkSecondary">
              Multi-macro backtracking optimizer satisfying daily Calories, Protein, Carbs, and Fat simultaneously.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk rounded-lg p-1 hover:bg-mist/40 dark:hover:bg-darkMist transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-error dark:bg-darkSurface border border-alert/30 rounded-xl text-alert dark:text-darkCoral text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="mt-4 space-y-4">
          {/* Plan Name */}
          <div>
            <label htmlFor="plan-name-input" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
              Plan Name
            </label>
            <input
              id="plan-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk placeholder:text-inkSecondary focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          {/* Goal Generator Helper Banner */}
          <div className="p-3.5 bg-canvas/70 dark:bg-darkCanvas/70 rounded-xl border border-sand dark:border-darkBorder space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-ink dark:text-darkInk">Need personalized targets?</span>
                <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
                  Generate 3 Mifflin-St Jeor profiles (Weight Loss, Bulking, Sustainability) with Atwater reconciliation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGoalDrawer(!showGoalDrawer)
                  if (!generatedData && !loadingGoals) {
                    handleFetchGoalProfiles()
                  }
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition cursor-pointer shadow-xs shrink-0"
              >
                {showGoalDrawer ? 'Hide Profiles' : 'Generate Goals'}
              </button>
            </div>

            {appliedGoalNotice && (
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 pt-1">
                ✓ {appliedGoalNotice}
              </div>
            )}

            {showGoalDrawer && (
              <div className="pt-2 border-t border-sand/60 dark:border-darkBorder/60 space-y-2">
                {goalGenError && (
                  <div className="p-2.5 bg-status-error/20 border border-alert/30 text-alert dark:text-darkCoral rounded-lg text-xs">
                    {goalGenError}
                  </div>
                )}
                {loadingGoals && (
                  <div className="text-xs text-inkSecondary dark:text-darkInkSecondary py-2 text-center font-medium">
                    Calculating metabolic profiles from your body metrics...
                  </div>
                )}
                {generatedData && (
                  <div className="grid grid-cols-1 gap-2">
                    {generatedData.profiles.map((p) => (
                      <div
                        key={p.key}
                        className="p-3 bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-xl text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink dark:text-darkInk">{p.name} ({p.purpose})</span>
                          <button
                            type="button"
                            onClick={() => handleApplyProfile(p)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-200 cursor-pointer"
                          >
                            Apply to Targets
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                          <div className="p-1 bg-canvas dark:bg-darkCanvas rounded font-bold text-ink dark:text-darkInk">
                            {p.calories_kcal} kcal
                          </div>
                          <div className="p-1 bg-canvas dark:bg-darkCanvas rounded text-inkSecondary dark:text-darkInkSecondary">
                            P: <strong className="text-ink dark:text-darkInk">{p.protein_g}g</strong> ({p.protein_pct}%)
                          </div>
                          <div className="p-1 bg-canvas dark:bg-darkCanvas rounded text-inkSecondary dark:text-darkInkSecondary">
                            C: <strong className="text-ink dark:text-darkInk">{p.carbs_g}g</strong> ({p.carbs_pct}%)
                          </div>
                          <div className="p-1 bg-canvas dark:bg-darkCanvas rounded text-inkSecondary dark:text-darkInkSecondary">
                            F: <strong className="text-ink dark:text-darkInk">{p.fat_g}g</strong> ({p.fat_pct}%)
                          </div>
                        </div>
                        <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary italic">
                          {p.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="plan-target-calories" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
                Calories (kcal)
              </label>
              <input
                id="plan-target-calories"
                type="number"
                min="800"
                max="8000"
                value={targetCalories}
                onChange={(e) => setTargetCalories(parseInt(e.target.value, 10) || 2000)}
                className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-bold text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label htmlFor="plan-target-protein" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
                Protein (g)
              </label>
              <input
                id="plan-target-protein"
                type="number"
                min="20"
                max="500"
                value={targetProtein}
                onChange={(e) => setTargetProtein(parseInt(e.target.value, 10) || 120)}
                className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label htmlFor="plan-target-carbs" className="block text-xs font-semibold text-amber-800 dark:text-darkButter uppercase tracking-wider mb-1">
                Carbs (g)
              </label>
              <input
                id="plan-target-carbs"
                type="number"
                min="0"
                max="1000"
                value={targetCarbs}
                onChange={(e) => setTargetCarbs(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label htmlFor="plan-target-fat" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
                Fat (g)
              </label>
              <input
                id="plan-target-fat"
                type="number"
                min="0"
                max="500"
                value={targetFat}
                onChange={(e) => setTargetFat(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          {/* Live Atwater Feedback */}
          {hasMacroConflict ? (
            <div className="p-3 bg-amber-50 dark:bg-darkCanvas border border-amber-200 dark:border-darkButter/30 rounded-xl text-amber-900 dark:text-darkButter text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span>⚠️ Atwater Discrepancy: {macroDiff} kcal</span>
                <button
                  type="button"
                  onClick={() => setTargetCalories(macroCalories)}
                  className="px-2 py-0.5 rounded bg-amber-200 dark:bg-darkButter/20 text-[11px] hover:bg-amber-300 font-semibold cursor-pointer"
                >
                  Sync to {macroCalories} kcal
                </button>
              </div>
              <p className="leading-relaxed text-[11px]">
                Configured macros ({targetProtein}g P, {targetCarbs}g C, {targetFat}g F) provide approximately{' '}
                <strong>{macroCalories} kcal</strong> (4P + 4C + 9F), which differs from your {targetCalories} kcal goal by{' '}
                <strong>{macroDiff} kcal</strong>. Multi-macro optimization performs best with chemically balanced targets.
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center justify-between px-1 font-medium">
              <span>
                Calculated energy: <strong className="text-ink dark:text-darkInk">{macroCalories} kcal</strong> (4P + 4C + 9F)
              </span>
              <span>
                ✓ Chemically balanced
              </span>
            </div>
          )}

          {/* Meal Categories */}
          <div>
            <span className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1.5">
              Daily Meal Structure
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['breakfast', 'lunch', 'dinner', 'snacks'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center capitalize transition-colors cursor-pointer ${
                    enabledCategories.includes(cat)
                      ? 'bg-midnight text-white border-midnight dark:bg-darkMidnight dark:text-white'
                      : 'bg-canvas dark:bg-darkCanvas border-sand dark:border-darkBorder text-inkSecondary dark:text-darkInkSecondary hover:bg-mist/40 dark:hover:bg-darkMist/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Selection */}
          <div>
            <span className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1.5">
              Generation Strategy
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer text-left transition-all ${
                  simplicityPreference === 'simple'
                    ? 'bg-periwinkle/10 border-midnight dark:border-darkButter ring-1 ring-midnight dark:ring-darkButter'
                    : 'bg-canvas dark:bg-darkCanvas border-sand dark:border-darkBorder hover:bg-mist/30 dark:hover:bg-darkMist/30'
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink dark:text-darkInk">Simple & Efficient</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    High Reuse
                  </span>
                </div>
                <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1 leading-relaxed">
                  Batch cooking and ingredient reuse across alternating days. Produces smaller shopping lists and reduces prep overhead.
                </p>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer text-left transition-all ${
                  simplicityPreference === 'varied'
                    ? 'bg-periwinkle/10 border-midnight dark:border-darkButter ring-1 ring-midnight dark:ring-darkButter'
                    : 'bg-canvas dark:bg-darkCanvas border-sand dark:border-darkBorder hover:bg-mist/30 dark:hover:bg-darkMist/30'
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink dark:text-darkInk">Maximum Variety</span>
                  <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-darkButter bg-amber-50 dark:bg-darkCanvas px-1.5 py-0.5 rounded border border-amber-200 dark:border-darkButter/30">
                    &ge; 20 Recipes
                  </span>
                </div>
                <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1 leading-relaxed">
                  Maximizes distinct recipes across all 7 days with minimal repetition while maintaining strict daily nutrient accuracy.
                </p>
              </label>
            </div>
          </div>

          {/* Disliked Foods */}
          <div>
            <label htmlFor="plan-disliked-foods" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
              Disliked Foods / Exclusions
            </label>
            <input
              id="plan-disliked-foods"
              type="text"
              placeholder="e.g. olives, mushrooms (comma-separated)"
              value={dislikedFoodsStr}
              onChange={(e) => setDislikedFoodsStr(e.target.value)}
              className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk placeholder:text-inkSecondary focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
            <p className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1 leading-normal">
              Uses exact word matching. Excluding <code className="text-ink dark:text-darkInk bg-sand/60 dark:bg-darkMist px-1 rounded">olives</code> will exclude olives but will <span className="font-semibold text-ink dark:text-darkInk">not</span> exclude olive oil.
            </p>
          </div>

          {/* Max Cooking Time */}
          <div>
            <label htmlFor="plan-max-cooking-time" className="block text-xs font-semibold text-ink dark:text-darkInk uppercase tracking-wider mb-1">
              Max Total Cooking Time (optional)
            </label>
            <select
              id="plan-max-cooking-time"
              value={maxCookingTime}
              onChange={(e) => setMaxCookingTime(e.target.value)}
              className="w-full px-3 py-2 bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-sm font-semibold text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
            >
              <option value="">No limit</option>
              <option value="15">Quick (under 15 min)</option>
              <option value="30">Under 30 min</option>
              <option value="45">Under 45 min</option>
            </select>
          </div>

          <div className="pt-4 border-t border-sand dark:border-darkBorder flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? 'Optimizing 7-Day Plan...' : 'Generate 7-Day Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
