import { useEffect, useState } from 'react'
import type { DailyNutritionSummary, MealCategory } from '../../types/nutrition'
import type { NutritionGoal } from '../../types/nutritionGoal'
import { mealLogService } from '../../services/mealLogService'
import { nutritionGoalService } from '../../services/nutritionGoalService'
import { MealPlannerDashboard } from '../mealPlanning/MealPlannerDashboard'
import { RecipesView } from '../mealPlanning/RecipesView'
import { AddFoodModal } from './AddFoodModal'
import { DailyProgressDashboard } from './DailyProgressDashboard'
import { MealCategoryCard } from './MealCategoryCard'
import { MyFoodsView } from './MyFoodsView'
import { NutritionBackupModal } from './NutritionBackupModal'
import { NutritionGoalModal } from './NutritionGoalModal'
import { NutritionReportsView } from './NutritionReportsView'

function getTodayString(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().split('T')[0]!
}

export type NutritionSubTab = 'log' | 'planner' | 'recipes' | 'catalogue' | 'reports'

export function NutritionDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString)
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null)
  const [goals, setGoals] = useState<NutritionGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<NutritionSubTab>('log')
  const [selectedRecipeIdForView, setSelectedRecipeIdForView] = useState<number | null>(null)

  // Modals
  const [addFoodCategory, setAddFoodCategory] = useState<MealCategory | null>(null)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)

  const loadDailySummary = async (dateStr: string) => {
    setLoading(true)
    try {
      const [data, userGoals] = await Promise.all([
        mealLogService.getDailySummary(dateStr),
        nutritionGoalService.getGoals(),
      ])
      setSummary(data)
      setGoals(userGoals)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load daily nutrition log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeSubTab === 'log') {
      loadDailySummary(selectedDate)
    }
  }, [selectedDate, activeSubTab])

  const handleMealLogged = async (targetDate: string) => {
    setSelectedDate(targetDate)
    await loadDailySummary(targetDate)
  }

  const handleViewRecipe = (recipeId: number) => {
    setSelectedRecipeIdForView(recipeId)
    setActiveSubTab('recipes')
  }

  const changeDateByDays = (days: number) => {
    const current = new Date(`${selectedDate}T00:00:00`)
    current.setDate(current.getDate() + days)
    const offset = current.getTimezoneOffset() * 60000
    const nextStr = new Date(current.getTime() - offset).toISOString().split('T')[0]!
    setSelectedDate(nextStr)
  }

  const handleUpdateQuantity = async (logId: number, newQuantity: number) => {
    try {
      await mealLogService.updateMealLog(logId, { quantity: newQuantity })
      await loadDailySummary(selectedDate)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update quantity')
    }
  }

  const handleDeleteLog = async (logId: number) => {
    try {
      await mealLogService.deleteMealLog(logId)
      await loadDailySummary(selectedDate)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete log')
    }
  }

  const handleRemoveCategoryLogs = async (category: MealCategory) => {
    try {
      await mealLogService.deleteCategoryLogs(selectedDate, category)
      await loadDailySummary(selectedDate)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear category meals')
    }
  }

  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const isToday = selectedDate === getTodayString()

  const tabs: { id: NutritionSubTab; label: string }[] = [
    { id: 'log', label: 'Daily Log' },
    { id: 'planner', label: 'Meal Planner' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'catalogue', label: 'My Foods' },
    { id: 'reports', label: 'Reports & Trends' },
  ]

  return (
    <div className="w-full text-left space-y-6">
      {/* Section Header Card */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-left transition-colors motion-reduce:transition-none">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-darkInk">
              Nutrition &amp; Meals
            </h1>
            <span className="inline-block whitespace-nowrap shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-mist/70 dark:bg-darkMist text-ink dark:text-darkInk border border-sand/70 dark:border-darkBorder self-start sm:self-auto">
              Metric (kcal / g / mg)
            </span>
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
            Log daily meals, monitor macronutrients against targets, and plan weekly nutrition.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer shadow-xs flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
            title="Backup & Restore Nutrition Data"
          >
            <svg className="w-4 h-4 text-midnight dark:text-darkMidnight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>Backup</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div
        role="tablist"
        aria-label="Nutrition Sections"
        className="flex border-b border-sand dark:border-darkBorder gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-0.5"
      >
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSubTab(tab.id)}
              className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition cursor-pointer motion-reduce:transition-none border-b-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle ${
                isActive
                  ? 'border-midnight text-midnight dark:border-darkMidnight dark:text-darkMidnight'
                  : 'border-transparent text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Date Navigator (Visible on Daily Log tab) */}
      {activeSubTab === 'log' && (
        <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-2.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => changeDateByDays(-1)}
              className="p-1.5 sm:p-2 rounded-xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder hover:bg-mist/50 dark:hover:bg-darkMist text-ink dark:text-darkInk transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
              aria-label="Previous day"
            >
              ◀
            </button>

            <div className="relative">
              <input
                id="nutrition-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle cursor-pointer"
                aria-label="Selected date"
              />
            </div>

            <button
              type="button"
              onClick={() => changeDateByDays(1)}
              className="p-1.5 sm:p-2 rounded-xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder hover:bg-mist/50 dark:hover:bg-darkMist text-ink dark:text-darkInk transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
              aria-label="Next day"
            >
              ▶
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(getTodayString())}
              disabled={isToday}
              className={`text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle ${
                isToday
                  ? 'bg-mist/30 dark:bg-darkMist/30 border-sand/50 dark:border-darkBorder/50 text-inkSecondary dark:text-darkInkSecondary cursor-default'
                  : 'bg-canvas dark:bg-darkCanvas border-sand dark:border-darkBorder text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist'
              }`}
            >
              Today
            </button>
          </div>

          <div className="text-xs font-medium text-inkSecondary dark:text-darkInkSecondary">
            Viewing: <strong className="text-ink dark:text-darkInk">{formattedDate}</strong>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral text-xs font-medium"
        >
          {error}
        </div>
      )}

      {/* Main Tab Content */}
      {activeSubTab === 'log' && (
        <div className="space-y-6">
          {summary && (
            <DailyProgressDashboard
              totals={summary.totals}
              totalEntries={summary.total_entries}
              goals={goals}
              onOpenGoalsModal={() => setShowGoalsModal(true)}
            />
          )}

          {loading && !summary ? (
            <div className="p-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
              <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
              <p className="font-medium">Loading daily meal log...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <MealCategoryCard
                category="breakfast"
                title="Breakfast"
                logs={summary?.by_category.breakfast || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
                onRemoveAll={handleRemoveCategoryLogs}
              />
              <MealCategoryCard
                category="lunch"
                title="Lunch"
                logs={summary?.by_category.lunch || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
                onRemoveAll={handleRemoveCategoryLogs}
              />
              <MealCategoryCard
                category="dinner"
                title="Dinner"
                logs={summary?.by_category.dinner || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
                onRemoveAll={handleRemoveCategoryLogs}
              />
              <MealCategoryCard
                category="snacks"
                title="Snacks"
                logs={summary?.by_category.snacks || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
                onRemoveAll={handleRemoveCategoryLogs}
              />
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'planner' && (
        <MealPlannerDashboard
          goals={goals}
          onMealLogged={handleMealLogged}
          onViewRecipe={handleViewRecipe}
        />
      )}
      {activeSubTab === 'recipes' && (
        <RecipesView
          initialRecipeId={selectedRecipeIdForView}
          onCloseInitialRecipe={() => setSelectedRecipeIdForView(null)}
        />
      )}
      {activeSubTab === 'catalogue' && <MyFoodsView />}
      {activeSubTab === 'reports' && <NutritionReportsView />}

      {/* Add Food Modal */}
      {addFoodCategory && (
        <AddFoodModal
          mealCategory={addFoodCategory}
          loggedDate={selectedDate}
          onFoodLogged={() => loadDailySummary(selectedDate)}
          onClose={() => setAddFoodCategory(null)}
        />
      )}

      {/* Edit Goals Modal */}
      {showGoalsModal && (
        <NutritionGoalModal
          currentGoals={goals}
          onGoalsSaved={(updated) => {
            setGoals(updated)
            loadDailySummary(selectedDate)
          }}
          onClose={() => setShowGoalsModal(false)}
        />
      )}

      {/* Backup & Restore Modal */}
      {showBackupModal && (
        <NutritionBackupModal
          onDataRestored={() => loadDailySummary(selectedDate)}
          onClose={() => setShowBackupModal(false)}
        />
      )}
    </div>
  )
}
