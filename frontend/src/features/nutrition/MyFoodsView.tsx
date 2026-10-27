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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder p-5 rounded-2xl shadow-xs transition-colors motion-reduce:transition-none">
        <div>
          <h2 className="text-base font-bold text-ink dark:text-darkInk">
            Food Catalogue ({foods.length})
          </h2>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Manage your saved custom foods and recipes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle ${
              favoritesOnly
                ? 'bg-butter/50 dark:bg-darkButter/20 border-amber-300 dark:border-darkButter/40 text-amber-900 dark:text-darkButter'
                : 'border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist'
            }`}
          >
            <span>★</span>
            <span>Favorites Only</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
          >
            + Create Food
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral rounded-2xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
          <p className="font-medium">Loading catalogue foods...</p>
        </div>
      ) : foods.length === 0 ? (
        <div className="p-12 text-center bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl text-inkSecondary dark:text-darkInkSecondary text-xs">
          No foods saved yet. Click "+ Create Food" to add your first custom recipe.
        </div>
      ) : (
        <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl divide-y divide-sand/50 dark:divide-darkBorder/60 shadow-xs overflow-hidden">
          {foods.map((food) => (
            <div
              key={food.id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-canvas/40 dark:hover:bg-darkCanvas/40 transition"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleToggleFav(food)}
                    className={`text-base leading-none transition cursor-pointer p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle ${
                      food.is_favorite ? 'text-amber-700 dark:text-darkButter' : 'text-sand dark:text-darkBorder hover:text-amber-700'
                    }`}
                    title={food.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={`Toggle favorite for ${food.name}`}
                  >
                    ★
                  </button>
                  <span className="font-semibold text-sm text-ink dark:text-darkInk">{food.name}</span>
                  {food.brand && <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-normal">({food.brand})</span>}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
                    {food.nutritional_basis}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
                  <span className="font-bold text-ink dark:text-darkInk">{Math.round(food.calories_kcal)} kcal</span>
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
                  className="px-3 py-1 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist transition text-ink dark:text-darkInk cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(food)}
                  className="px-3 py-1 text-xs font-semibold rounded-xl border border-alert/30 dark:border-darkCoral/30 bg-canvas dark:bg-darkCanvas hover:bg-mist/40 text-alert dark:text-darkCoral transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert"
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
