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
    <div className="space-y-6 text-left">
      {/* Toast Notification */}
      {notification && (
        <div role="status" className="p-3.5 bg-status-success dark:bg-darkSurface border border-border-card text-status-success-fg dark:text-emerald-400 text-sm font-medium rounded-2xl flex items-center justify-between shadow-xs">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold ml-3 cursor-pointer hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral text-sm font-medium rounded-2xl flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-bold ml-3 cursor-pointer hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-darkSurface p-5 rounded-2xl shadow-xs border border-sand dark:border-darkBorder transition-colors motion-reduce:transition-none">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-ink dark:text-darkInk">
              {activePlan ? activePlan.name : 'Personalized Meal Planner'}
            </h2>
            {activePlan && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
                Active 7-Day Plan
              </span>
            )}
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
            {activePlan
              ? `${activePlan.start_date} to ${activePlan.end_date} • Deterministic macro targeting`
              : 'Generate a 7-day personalized meal plan tailored to your nutritional goals.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDislikedModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
            title="Manage disliked ingredients"
          >
            🚫 Disliked Foods
          </button>

          {activePlan && (
            <>
              <button
                type="button"
                onClick={() => setShowShoppingList(!showShoppingList)}
                className="px-3.5 py-2 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
              >
                🛒 {showShoppingList ? 'View Plan' : 'Shopping List'}
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                className="px-3 py-2 text-xs font-semibold text-alert dark:text-darkCoral hover:bg-mist/30 dark:hover:bg-darkMist/30 rounded-xl border border-alert/30 dark:border-darkCoral/30 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert"
              >
                Delete Plan
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
          >
            ✨ {activePlan ? 'Regenerate Week' : 'Generate 7-Day Plan'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-inkSecondary dark:text-darkInkSecondary bg-surface dark:bg-darkSurface rounded-2xl border border-sand dark:border-darkBorder">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
          <p className="font-medium">Loading meal plan...</p>
        </div>
      ) : !activePlan ? (
        <div className="p-10 text-center bg-surface dark:bg-darkSurface rounded-2xl border border-sand dark:border-darkBorder shadow-xs space-y-4">
          <div className="text-4xl">🥗</div>
          <h3 className="text-base font-bold text-ink dark:text-darkInk">No active meal plan found</h3>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary max-w-md mx-auto leading-relaxed">
            Create a custom 7-day plan matching your daily calorie and protein goals. Our offline rule-based planner
            selects wholesome staple recipes with minimal food waste.
          </p>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white rounded-xl shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
          >
            Generate Your First Meal Plan
          </button>
        </div>
      ) : showShoppingList ? (
        <ShoppingListView
          planId={activePlan.id}
          planName={activePlan.name}
          incompleteMealCount={
            activePlan.days.flatMap((d) => d.meals).filter((m) => !m.recipe_id && m.items.length === 0).length
          }
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
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white border-midnight dark:border-darkMidnight shadow-xs'
                      : 'bg-surface dark:bg-darkSurface border-sand dark:border-darkBorder text-ink dark:text-darkInk hover:bg-canvas dark:hover:bg-darkCanvas'
                  }`}
                >
                  <div className={`text-xs font-bold ${isSelected ? 'text-sand dark:text-white' : 'text-inkSecondary dark:text-darkInkSecondary'}`}>
                    Day {day.day_number}
                  </div>
                  <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-ink dark:text-darkInk'}`}>
                    {day.day_name.slice(0, 3)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold mt-1.5 ${
                      isSelected ? 'text-sand/90 dark:text-white/90' : 'text-inkSecondary dark:text-darkInkSecondary'
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
            <div className="bg-surface dark:bg-darkSurface rounded-2xl p-5 border border-sand dark:border-darkBorder space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-sand/70 dark:border-darkBorder/70 gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink dark:text-darkInk">
                    Day {selectedDay.day_number} — {selectedDay.day_name} ({selectedDay.plan_date})
                  </h3>
                  <div className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5 flex flex-wrap gap-3">
                    <span>
                      Planned: <strong className="text-ink dark:text-darkInk">{selectedDay.total_calories} kcal</strong>
                    </span>
                    <span>
                      Protein: <strong className="text-ink dark:text-darkInk font-semibold">{selectedDay.total_protein}g</strong>
                    </span>
                    <span>
                      Carbs: <strong className="text-amber-800 dark:text-darkButter font-semibold">{selectedDay.total_carbs}g</strong>
                    </span>
                    <span>
                      Fat: <strong className="text-ink dark:text-darkInk font-semibold">{selectedDay.total_fat}g</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDayToLog(selectedDay.day_number)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl shadow-2xs transition cursor-pointer self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
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
          activePlan={activePlan}
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
