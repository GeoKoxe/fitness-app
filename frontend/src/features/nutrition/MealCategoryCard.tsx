import { useState } from 'react'
import type { MealCategory, MealLog } from '../../types/nutrition'

interface MealCategoryCardProps {
  category: MealCategory
  title: string
  logs: MealLog[]
  onAddFood: (category: MealCategory) => void
  onUpdateQuantity: (logId: number, newQuantity: number) => Promise<void>
  onDeleteLog: (logId: number) => Promise<void>
  onRemoveAll?: (category: MealCategory) => Promise<void>
}

export function MealCategoryCard({
  category,
  title,
  logs,
  onAddFood,
  onUpdateQuantity,
  onDeleteLog,
  onRemoveAll,
}: MealCategoryCardProps) {
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)

  const mealTotalCalories = Math.round(logs.reduce((acc, l) => acc + l.calories_kcal, 0))
  const mealTotalProtein = Math.round(logs.reduce((acc, l) => acc + l.protein_g, 0) * 10) / 10
  const mealTotalCarbs = Math.round(logs.reduce((acc, l) => acc + l.carbs_g, 0) * 10) / 10
  const mealTotalFat = Math.round(logs.reduce((acc, l) => acc + l.fat_g, 0) * 10) / 10

  const handleStartEdit = (log: MealLog) => {
    setEditingLogId(log.id)
    setEditQty(String(log.quantity))
  }

  const handleSaveEdit = async (logId: number) => {
    const q = parseFloat(editQty)
    if (isNaN(q) || q <= 0) return
    setIsUpdating(true)
    try {
      await onUpdateQuantity(logId, q)
      setEditingLogId(null)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (logId: number, foodName: string) => {
    if (window.confirm(`Are you sure you want to remove "${foodName}" from this meal?`)) {
      await onDeleteLog(logId)
    }
  }

  const handleRemoveAll = async () => {
    if (logs.length === 0 || !onRemoveAll) return
    const confirmed = window.confirm(
      `Remove all ${logs.length} logged items from ${title} for this date?`
    )
    if (!confirmed) return
    setIsDeletingCategory(true)
    try {
      await onRemoveAll(category)
    } finally {
      setIsDeletingCategory(false)
    }
  }

  const getMealIcon = () => {
    switch (category) {
      case 'breakfast':
        return (
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )
      case 'lunch':
        return (
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'dinner':
        return (
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )
      case 'snacks':
        return (
          <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-left">
      {/* Category Header */}
      <div className="p-4 sm:p-5 flex justify-between items-center bg-slate-50/60 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            {getMealIcon()}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            {logs.length > 0 && (
              <span className="text-xs text-slate-500">
                P: {mealTotalProtein}g • C: {mealTotalCarbs}g • F: {mealTotalFat}g
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mr-1">
            {mealTotalCalories} <span className="text-xs font-normal text-slate-500">kcal</span>
          </span>
          {logs.length > 0 && onRemoveAll && (
            <button
              type="button"
              disabled={isDeletingCategory}
              onClick={handleRemoveAll}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition flex items-center gap-1 disabled:opacity-50"
              title={`Remove all ${logs.length} foods from ${title}`}
            >
              {isDeletingCategory ? 'Removing...' : 'Remove All'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onAddFood(category)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Food</span>
          </button>
        </div>
      </div>

      {/* Logged Items List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
            No foods logged for {title.toLowerCase()}.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {log.food_name}
                  </span>
                  {log.food_brand && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal truncate">
                      ({log.food_brand})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {log.quantity} {log.unit}
                  </span>
                  <span>•</span>
                  <span>{Math.round(log.calories_kcal)} kcal</span>
                  <span>•</span>
                  <span>P: {log.protein_g}g</span>
                  <span>C: {log.carbs_g}g</span>
                  <span>F: {log.fat_g}g</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {editingLogId === log.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                      aria-label="Edit quantity"
                    />
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleSaveEdit(log.id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLogId(null)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(log)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit portion"
                      aria-label={`Edit ${log.food_name} portion`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id, log.food_name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Delete entry"
                      aria-label={`Delete ${log.food_name} entry`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

