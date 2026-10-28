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
    <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xs border border-sand dark:border-darkBorder p-6 text-left transition-colors motion-reduce:transition-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-sand/70 dark:border-darkBorder/70 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink dark:text-darkInk">Shopping List</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs text-inkSecondary hover:text-ink sm:hidden cursor-pointer"
              >
                ✕ Close
              </button>
            )}
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Combined ingredient totals across 7 days for <strong className="text-ink dark:text-darkInk">{planName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportText}
            className="px-3.5 py-1.5 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist rounded-xl border border-sand dark:border-darkBorder transition cursor-pointer"
          >
            📋 Export / Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary hover:text-ink dark:hover:text-darkInk hover:bg-mist/40 dark:hover:bg-darkMist/40 rounded-xl transition hidden sm:block cursor-pointer"
            >
              Back to Plan
            </button>
          )}
        </div>
      </div>

      {/* Progress & Disclaimer */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-canvas/70 dark:bg-darkCanvas/70 p-3.5 rounded-xl border border-sand dark:border-darkBorder">
        <div className="text-xs text-inkSecondary dark:text-darkInkSecondary">
          <span className="font-bold text-ink dark:text-darkInk">{checkedItems}</span> of{' '}
          <span className="font-bold text-ink dark:text-darkInk">{totalItems}</span> items checked off
        </div>
        <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary italic">
          Prices are not tracked locally. Cost estimates are never fabricated.
        </div>
      </div>

      {/* Incomplete Meals Notice */}
      {incompleteMealCount && incompleteMealCount > 0 ? (
        <div className="mt-3 p-3.5 bg-status-error dark:bg-darkSurface border border-border-card rounded-2xl text-xs text-alert dark:text-darkCoral flex items-start gap-2">
          <span className="font-bold shrink-0">⚠️ Notice:</span>
          <div>
            Your meal plan currently contains <strong>{incompleteMealCount}</strong> incomplete meal slot(s).
            Because these slots have no recipes or ingredients assigned, their groceries cannot be included in this shopping list.
            Return to the meal plan and use <strong>Replace</strong> to choose recipes and include their ingredients.
          </div>
        </div>
      ) : null}

      {error && (
        <div role="alert" className="mt-4 p-3.5 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Category Groups */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-2" />
            <p>Loading shopping list...</p>
          </div>
        ) : Object.keys(categoriesMap).length === 0 ? (
          <div className="py-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
            No shopping list items found.
          </div>
        ) : (
          Object.entries(categoriesMap).map(([category, catItems]) => (
            <div key={category} className="border border-sand dark:border-darkBorder rounded-2xl overflow-hidden bg-surface dark:bg-darkSurface shadow-2xs">
              <div className="bg-canvas dark:bg-darkCanvas px-4 py-2.5 text-xs font-bold text-ink dark:text-darkInk uppercase tracking-wider border-b border-sand dark:border-darkBorder flex justify-between items-center">
                <span>{category}</span>
                <span className="text-[11px] font-semibold text-inkSecondary dark:text-darkInkSecondary lowercase">
                  {catItems.filter((i) => i.is_checked).length}/{catItems.length} checked
                </span>
              </div>
              <div className="divide-y divide-sand/50 dark:divide-darkBorder/60">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleCheck(item)}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-canvas/50 dark:hover:bg-darkCanvas/50 transition ${
                      item.is_checked ? 'bg-canvas/40 dark:bg-darkCanvas/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id={`shopping-item-${item.id}`}
                        name={`shopping-item-${item.id}`}
                        type="checkbox"
                        aria-label={`Mark ${item.ingredient_name} as purchased`}
                        checked={item.is_checked}
                        onChange={() => {}} // handled by row click
                        className="h-4 w-4 rounded-md border-sand dark:border-darkBorder text-midnight focus:ring-periwinkle cursor-pointer"
                      />
                      <span className={`text-sm font-medium ${item.is_checked ? 'line-through text-inkSecondary dark:text-darkInkSecondary' : 'text-ink dark:text-darkInk'}`}>
                        {item.ingredient_name}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-ink dark:text-darkInk">
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
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity motion-reduce:transition-none"
        >
          <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-2xl max-w-lg w-full p-6 text-left border border-sand dark:border-darkBorder">
            <div className="flex items-center justify-between pb-3 border-b border-sand dark:border-darkBorder">
              <h3 className="text-base font-bold text-ink dark:text-darkInk">Export Shopping List</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk rounded-xl p-1.5 hover:bg-mist/40 dark:hover:bg-darkMist/40 transition cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mb-2 font-medium">
                Copy plain text shopping list or download structured JSON.
              </p>
              <textarea
                id="export-shopping-list-text"
                name="export-shopping-list-text"
                aria-label="Exported shopping list content"
                readOnly
                rows={12}
                value={exportData.plain_text}
                className="w-full p-3 font-mono text-xs bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder rounded-xl text-ink dark:text-darkInk focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-between items-center pt-3 border-t border-sand dark:border-darkBorder">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3.5 py-1.5 text-xs font-semibold text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder rounded-xl transition cursor-pointer"
              >
                💾 Download JSON
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white rounded-xl shadow-xs transition cursor-pointer"
                >
                  {copySuccess ? '✓ Copied!' : '📋 Copy Text'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk rounded-xl transition cursor-pointer"
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
