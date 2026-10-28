import { useEffect, useState } from 'react'
import type { DislikedFood } from '../../types/mealPlan'
import { mealPlanService } from '../../services/mealPlanService'

interface DislikedFoodsModalProps {
  onClose: () => void
  onDislikedFoodsChanged?: () => void
}

export function DislikedFoodsModal({ onClose, onDislikedFoodsChanged }: DislikedFoodsModalProps) {
  const [foods, setFoods] = useState<DislikedFood[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [newFoodName, setNewFoodName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const loadFoods = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await mealPlanService.getDislikedFoods()
      setFoods(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load disliked foods.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFoods()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFoodName.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await mealPlanService.addDislikedFood({ food_name: trimmed })
      setNewFoodName('')
      setSuccessMsg(`"${trimmed}" added to disliked foods list.`)
      await loadFoods()
      onDislikedFoodsChanged?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add disliked food.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (food: DislikedFood) => {
    setError(null)
    setSuccessMsg(null)
    try {
      await mealPlanService.removeDislikedFood(food.id)
      setSuccessMsg(`"${food.food_name}" removed from disliked foods list.`)
      await loadFoods()
      onDislikedFoodsChanged?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove disliked food.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disliked-foods-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 text-left border border-edge max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div>
            <h3 id="disliked-foods-title" className="text-base font-bold text-ink">
              Manage Disliked Foods
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Excluded from future meal plans. Preserves existing planned meals and catalogue records.
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
          <div role="alert" className="mt-3 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-xs rounded-lg">
            {error}
          </div>
        )}

        {successMsg && (
          <div role="status" className="mt-3 p-3 bg-status-success-bg border border-status-success-border text-status-success-fg text-xs rounded-lg">
            {successMsg}
          </div>
        )}

        {/* Add food form */}
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            id="disliked-food-input"
            name="disliked-food-input"
            type="text"
            placeholder="Add an ingredient (e.g. mushrooms, pork)..."
            aria-label="Add an ingredient"
            value={newFoodName}
            onChange={(e) => setNewFoodName(e.target.value)}
            className="flex-1 px-3 py-2 bg-surface border border-edge rounded-lg text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={submitting || !newFoodName.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brandHover rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting ? 'Adding...' : '+ Add'}
          </button>
        </form>

        {/* Food list */}
        <div className="mt-4 flex-1 overflow-y-auto divide-y divide-edge border border-edge rounded-xl pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-inkMuted">Loading disliked foods...</div>
          ) : foods.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-inkSecondary">
              No disliked foods yet. You can dislike ingredients directly from any planned meal card or add them here.
            </div>
          ) : (
            foods.map((food) => (
              <div
                key={food.id}
                className="py-2.5 px-3 flex items-center justify-between hover:bg-surfaceMuted transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">{food.food_name}</div>
                  <div className="text-[11px] text-inkSecondary">
                    {food.food_category ? `Category: ${food.food_category}` : 'Custom exclusion'}
                    {food.food_source && ` • Source: ${food.food_source}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(food)}
                  className="px-2.5 py-1 text-xs font-medium text-status-danger-fg hover:bg-status-danger-bg border border-status-danger-border rounded-lg transition-colors"
                  title="Remove from Disliked Foods"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-edge flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
