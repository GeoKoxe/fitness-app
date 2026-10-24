import { useEffect, useState } from 'react'
import type { MealPlan, PlannedMeal } from '../../types/mealPlan'
import type { NutritionGoal } from '../../types/nutritionGoal'
import { mealPlanService } from '../../services/mealPlanService'
import { AdjustPortionsModal } from './AdjustPortionsModal'
import { DislikedFoodsModal } from './DislikedFoodsModal'
import { LogPlannedMealModal } from './LogPlannedMealModal'
import { PlanGenerationModal } from './PlanGenerationModal'
import { PlannedMealCard } from './PlannedMealCard'
import { ReplaceMealModal } from './ReplaceMealModal'
import { ShoppingListView } from './ShoppingListView'
import { WeeklyOverviewCard } from './WeeklyOverviewCard'

interface MealPlannerDashboardProps {
  goals?: NutritionGoal | null | undefined
  onMealLogged?: (targetDate: string) => void
  onViewRecipe?: (recipeId: number) => void
}

export function MealPlannerDashboard({ goals, onMealLogged, onViewRecipe }: MealPlannerDashboardProps) {
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null)
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  // Modals / View toggles
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false)
  const [showShoppingList, setShowShoppingList] = useState<boolean>(false)
  const [showDislikedModal, setShowDislikedModal] = useState<boolean>(false)
  const [mealToLog, setMealToLog] = useState<PlannedMeal | null>(null)
  const [dayToLog, setDayToLog] = useState<number | null>(null)
  const [mealToAdjust, setMealToAdjust] = useState<PlannedMeal | null>(null)
  const [mealToReplace, setMealToReplace] = useState<PlannedMeal | null>(null)

  const loadActivePlan = async () => {
    setLoading(true)
    try {
      const plan = await mealPlanService.getActivePlan()
      setActivePlan(plan)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load meal plan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivePlan()
  }, [])

  const handleDeletePlan = async () => {
    if (!activePlan) return
    if (!window.confirm('Are you sure you want to delete this meal plan?')) return
    try {
      await mealPlanService.deletePlan(activePlan.id)
      setActivePlan(null)
      setNotification('Meal plan deleted.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan.')
    }
  }

  const handleDislikeIngredient = async (foodName: string, foodId?: number | null) => {
    if (!foodName) return
    const confirmed = window.confirm(
      `Mark "${foodName}" as disliked?\n\nThis will add it to your persistent disliked foods list and regenerate only the meals in this plan containing it, preserving the rest of your week.`
    )
    if (!confirmed) return

    try {
      const res = await mealPlanService.dislikeAndRegenerate({
        food_name: foodName,
        food_id: foodId,
      })
      if (res.plan) {
        setActivePlan(res.plan)
      }
      setNotification(res.message)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dislike ingredient.')
    }
  }

  const selectedDay = activePlan?.days.find((d) => d.day_number === selectedDayNumber) || activePlan?.days[0]

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl flex items-center justify-between shadow-xs">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium rounded-xl flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 text-xs font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800">
              {activePlan ? activePlan.name : 'Personalized Meal Planner'}
            </h2>
            {activePlan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                Active 7-Day Plan
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activePlan
              ? `${activePlan.start_date} to ${activePlan.end_date} • Deterministic macro targeting`
              : 'Generate a 7-day personalized meal plan tailored to your nutritional goals.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDislikedModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            title="Manage disliked ingredients"
          >
            🚫 Disliked Foods
          </button>

          {activePlan && (
            <>
              <button
                type="button"
                onClick={() => setShowShoppingList(!showShoppingList)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                🛒 {showShoppingList ? 'View Plan' : 'Shopping List'}
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
              >
                Delete Plan
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            ✨ {activePlan ? 'Regenerate Week' : 'Generate 7-Day Plan'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading meal plan...
        </div>
      ) : !activePlan ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="text-4xl">🥗</div>
          <h3 className="text-base font-bold text-slate-800">No active meal plan found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create a custom 7-day plan matching your daily calorie and protein goals. Our offline rule-based planner
            selects wholesome staple recipes with minimal food waste.
          </p>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
          >
            Generate Your First Meal Plan
          </button>
        </div>
      ) : showShoppingList ? (
        <ShoppingListView
          planId={activePlan.id}
          planName={activePlan.name}
          onClose={() => setShowShoppingList(false)}
        />
      ) : (
        <>
          {/* Weekly Overview */}
          <WeeklyOverviewCard overview={activePlan.weekly_overview} />

          {/* 7-Day Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {activePlan.days.map((day) => {
              const isSelected = day.day_number === selectedDayNumber
              return (
                <button
                  key={day.day_number}
                  type="button"
                  onClick={() => setSelectedDayNumber(day.day_number)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className={`text-xs font-bold ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    Day {day.day_number}
                  </div>
                  <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {day.day_name.slice(0, 3)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold mt-1.5 ${
                      isSelected ? 'text-indigo-200' : 'text-slate-600'
                    }`}
                  >
                    {day.total_calories} kcal
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected Day Content */}
          {selectedDay && (
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/80 gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Day {selectedDay.day_number} — {selectedDay.day_name} ({selectedDay.plan_date})
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                    <span>
                      Planned: <strong className="text-slate-800">{selectedDay.total_calories} kcal</strong>
                    </span>
                    <span>
                      Protein: <strong className="text-indigo-600">{selectedDay.total_protein}g</strong>
                    </span>
                    <span>
                      Carbs: <strong className="text-amber-600">{selectedDay.total_carbs}g</strong>
                    </span>
                    <span>
                      Fat: <strong className="text-rose-600">{selectedDay.total_fat}g</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDayToLog(selectedDay.day_number)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
                >
                  ✓ Log All Meals for This Day
                </button>
              </div>

              {/* Planned Meals List */}
              <div className="space-y-3">
                {selectedDay.meals.map((meal) => (
                  <PlannedMealCard
                    key={meal.id}
                    meal={meal}
                    onLogMeal={(m) => setMealToLog(m)}
                    onAdjustPortions={(m) => setMealToAdjust(m)}
                    onReplaceMeal={(m) => setMealToReplace(m)}
                    onPlanUpdated={(updated) => setActivePlan(updated)}
                    onDislikeIngredient={handleDislikeIngredient}
                    onViewRecipe={onViewRecipe}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Generation Modal */}
      {showGenerateModal && (
        <PlanGenerationModal
          goals={goals}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={(plan) => {
            setActivePlan(plan)
            setSelectedDayNumber(1)
            setNotification('7-day meal plan generated successfully!')
          }}
        />
      )}

      {/* Log Planned Meal Modal */}
      {(mealToLog || dayToLog != null) && (
        <LogPlannedMealModal
          meal={mealToLog}
          dayNumber={dayToLog}
          dayName={selectedDay?.day_name}
          initialDate={selectedDay?.plan_date || new Date().toISOString().split('T')[0]!}
          onClose={() => {
            setMealToLog(null)
            setDayToLog(null)
          }}
          onSuccess={(msg, targetDate) => {
            setNotification(msg)
            onMealLogged?.(targetDate)
          }}
        />
      )}

      {/* Adjust Portions Modal */}
      {mealToAdjust && (
        <AdjustPortionsModal
          meal={mealToAdjust}
          onClose={() => setMealToAdjust(null)}
          onSuccess={(updated) => {
            setActivePlan(updated)
            setNotification('Meal portions updated.')
          }}
        />
      )}

      {/* Replace Meal Modal */}
      {mealToReplace && (
        <ReplaceMealModal
          meal={mealToReplace}
          onClose={() => setMealToReplace(null)}
          onSuccess={(updated) => {
            setActivePlan(updated)
            setNotification('Meal replaced successfully.')
          }}
        />
      )}

      {/* Disliked Foods Modal */}
      {showDislikedModal && (
        <DislikedFoodsModal
          onClose={() => setShowDislikedModal(false)}
        />
      )}
    </div>
  )
}

