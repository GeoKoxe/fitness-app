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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 text-left border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Manage Disliked Foods</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Excluded from future meal plans. Preserves existing planned meals and catalogue records.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
            {successMsg}
          </div>
        )}

        {/* Add food form */}
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Add an ingredient (e.g. mushrooms, pork)..."
            value={newFoodName}
            onChange={(e) => setNewFoodName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={submitting || !newFoodName.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Adding...' : '+ Add'}
          </button>
        </form>

        {/* Food list */}
        <div className="mt-4 flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading disliked foods...</div>
          ) : foods.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500">
              No disliked foods yet. You can dislike ingredients directly from any planned meal card or add them here.
            </div>
          ) : (
            foods.map((food) => (
              <div
                key={food.id}
                className="py-2.5 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">{food.food_name}</div>
                  <div className="text-[11px] text-slate-400">
                    {food.food_category ? `Category: ${food.food_category}` : 'Custom exclusion'}
                    {food.food_source && ` • Source: ${food.food_source}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(food)}
                  className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                  title="Remove from Disliked Foods"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

