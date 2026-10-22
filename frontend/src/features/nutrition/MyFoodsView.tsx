import { useCallback, useEffect, useState } from 'react'
import type { Food } from '../../types/food'
import { foodService } from '../../services/foodService'
import { CustomFoodModal } from './CustomFoodModal'

export function MyFoodsView() {
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadFoods = useCallback(async () => {
    setLoading(true)
    try {
      const res = await foodService.listFoods({
        pageSize: 100,
        favoritesOnly,
      })
      setFoods(res.items)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load foods')
    } finally {
      setLoading(false)
    }
  }, [favoritesOnly])

  useEffect(() => {
    loadFoods()
  }, [loadFoods])

  const handleToggleFav = async (food: Food) => {
    try {
      const updated = await foodService.toggleFavorite(food.id)
      setFoods((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to toggle favorite')
    }
  }

  const handleDelete = async (food: Food) => {
    if (!window.confirm(`Delete "${food.name}" from your catalogue? Historical meal logs will be preserved.`)) {
      return
    }
    try {
      await foodService.deleteFood(food.id)
      setFoods((prev) => prev.filter((f) => f.id !== food.id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete food')
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Food Catalogue ({foods.length})
          </h2>
          <p className="text-xs text-slate-500">Manage your saved custom foods and recipes</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1 ${
              favoritesOnly
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>★</span>
            <span>Favorites Only</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            + Create Food
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs">{error}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
          <p>Loading catalogue foods...</p>
        </div>
      ) : foods.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
          No foods saved yet. Click "+ Create Food" to add your first custom recipe.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
          {foods.map((food) => (
            <div
              key={food.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFav(food)}
                    className={`text-base leading-none transition ${
                      food.is_favorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-400'
                    }`}
                    title={food.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={`Toggle favorite for ${food.name}`}
                  >
                    ★
                  </button>
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{food.name}</span>
                  {food.brand && <span className="text-xs text-slate-400">({food.brand})</span>}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {food.nutritional_basis}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 mt-1">
                  <span>{Math.round(food.calories_kcal)} kcal</span>
                  <span>•</span>
                  <span>Protein: {food.protein_g}g</span>
                  <span>•</span>
                  <span>Carbs: {food.carbs_g}g</span>
                  <span>•</span>
                  <span>Fat: {food.fat_g}g</span>
                  {food.fiber_g != null && (
                    <>
                      <span>•</span>
                      <span>Fiber: {food.fiber_g}g</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setEditingFood(food)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(food)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreateModal || editingFood) && (
        <CustomFoodModal
          initialFood={editingFood}
          onFoodSaved={() => {
            setShowCreateModal(false)
            setEditingFood(null)
            loadFoods()
          }}
          onClose={() => {
            setShowCreateModal(false)
            setEditingFood(null)
          }}
        />
      )}
    </div>
  )
}
