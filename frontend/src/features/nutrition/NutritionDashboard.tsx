import { useEffect, useState } from 'react'
import type { DailyNutritionSummary, MealCategory } from '../../types/nutrition'
import type { NutritionGoal } from '../../types/nutritionGoal'
import { mealLogService } from '../../services/mealLogService'
import { nutritionGoalService } from '../../services/nutritionGoalService'
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

type NutritionSubTab = 'log' | 'catalogue' | 'reports'

export function NutritionDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString)
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null)
  const [goals, setGoals] = useState<NutritionGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<NutritionSubTab>('log')

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
    loadDailySummary(selectedDate)
  }, [selectedDate])

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

  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Controls & Sub-navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Date Navigator */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => changeDateByDays(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            aria-label="Previous day"
          >
            ◀
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="text-xs font-semibold px-2 py-1 rounded-lg bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
          />

          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            ({formattedDate})
          </span>

          <button
            type="button"
            onClick={() => changeDateByDays(1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            aria-label="Next day"
          >
            ▶
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(getTodayString())}
            className="ml-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            Today
          </button>
        </div>

        {/* View Switcher & Backup */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSubTab('log')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'log'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Daily Log
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('catalogue')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'catalogue'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              My Foods
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('reports')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'reports'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Reports & Trends
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition shadow-xs text-xs font-medium flex items-center gap-1.5"
            title="Backup & Restore Nutrition Data"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="hidden sm:inline">Backup</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-2xl text-xs text-left">
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
            <div className="p-12 text-center text-xs text-slate-400">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
              <p>Loading daily meal log...</p>
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
              />
              <MealCategoryCard
                category="lunch"
                title="Lunch"
                logs={summary?.by_category.lunch || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
              />
              <MealCategoryCard
                category="dinner"
                title="Dinner"
                logs={summary?.by_category.dinner || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
              />
              <MealCategoryCard
                category="snacks"
                title="Snacks"
                logs={summary?.by_category.snacks || []}
                onAddFood={(cat) => setAddFoodCategory(cat)}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteLog={handleDeleteLog}
              />
            </div>
          )}
        </div>
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
