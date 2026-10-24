import { useCallback, useEffect, useState } from 'react'
import type { ShoppingListExport, ShoppingListItem } from '../../types/mealPlan'
import { mealPlanService } from '../../services/mealPlanService'

interface ShoppingListViewProps {
  planId: number
  planName: string
  incompleteMealCount?: number
  onClose?: () => void
}

export function ShoppingListView({ planId, planName, incompleteMealCount, onClose }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<boolean>(false)
  const [showExportModal, setShowExportModal] = useState<boolean>(false)
  const [exportData, setExportData] = useState<ShoppingListExport | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const data = await mealPlanService.getShoppingList(planId)
      setItems(data)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping list.')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleToggleCheck = async (item: ShoppingListItem) => {
    const newChecked = !item.is_checked
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: newChecked } : i))
    )
    try {
      await mealPlanService.updateShoppingListItem(item.id, { is_checked: newChecked })
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_checked: !newChecked } : i))
      )
    }
  }

  const handleExportText = async () => {
    try {
      const res = await mealPlanService.exportShoppingList(planId)
      setExportData(res)
      setShowExportModal(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export shopping list.')
    }
  }

  const handleCopyText = () => {
    if (exportData?.plain_text) {
      navigator.clipboard.writeText(exportData.plain_text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    }
  }

  const handleDownloadJson = () => {
    if (!exportData) return
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shopping-list-${planId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group items by category
  const categoriesMap = items.reduce((acc, it) => {
    const cat = it.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(it)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  const totalItems = items.length
  const checkedItems = items.filter((i) => i.is_checked).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Shopping List</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 sm:hidden"
              >
                ✕ Close
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Combined ingredient totals across 7 days for <span className="font-medium text-slate-700">{planName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportText}
            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
          >
            📋 Export / Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block"
            >
              Back to Plan
            </button>
          )}
        </div>
      </div>

      {/* Progress & Disclaimer */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{checkedItems}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> items checked off
        </div>
        <div className="text-[11px] text-slate-500 italic">
          Prices are not tracked locally. Cost estimates are never fabricated.
        </div>
      </div>

      {/* Incomplete Meals Notice */}
      {incompleteMealCount && incompleteMealCount > 0 ? (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <span className="text-amber-600 font-bold shrink-0">⚠️ Notice:</span>
          <div>
            Your meal plan currently contains <strong>{incompleteMealCount}</strong> incomplete meal slot(s).
            Because these slots have no recipes or ingredients assigned, their groceries cannot be included in this shopping list.
            Return to the meal plan and use <strong>Replace</strong> to choose recipes and include their ingredients.
          </div>
        </div>
      ) : null}

      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Category Groups */}
      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading shopping list...</div>
        ) : Object.keys(categoriesMap).length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No shopping list items found.</div>
        ) : (
          Object.entries(categoriesMap).map(([category, catItems]) => (
            <div key={category} className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                <span>{category}</span>
                <span className="text-[11px] font-medium text-slate-400 lowercase">
                  {catItems.filter((i) => i.is_checked).length}/{catItems.length} checked
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleCheck(item)}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors ${
                      item.is_checked ? 'bg-slate-50/40 text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.is_checked}
                        onChange={() => {}} // handled by row click
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`text-sm font-medium ${item.is_checked ? 'line-through text-slate-400' : ''}`}>
                        {item.ingredient_name}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
                      {item.total_quantity} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 text-left border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">Export Shopping List</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">
                Copy plain text shopping list or download structured JSON.
              </p>
              <textarea
                readOnly
                rows={12}
                value={exportData.plain_text}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="mt-5 flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                💾 Download JSON
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  {copySuccess ? '✓ Copied!' : '📋 Copy Text'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
