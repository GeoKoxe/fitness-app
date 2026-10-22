import { useEffect, useState } from 'react'
import type { Food, FoodSearchResult } from '../../types/food'
import type { MealCategory, MealLog } from '../../types/nutrition'
import { foodService } from '../../services/foodService'
import { mealLogService } from '../../services/mealLogService'
import { CustomFoodModal } from './CustomFoodModal'

interface AddFoodModalProps {
  mealCategory: MealCategory
  loggedDate: string
  onFoodLogged: (log: MealLog) => void
  onClose: () => void
}

export function AddFoodModal({
  mealCategory,
  loggedDate,
  onFoodLogged,
  onClose,
}: AddFoodModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'recents'>('search')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [recentFoods, setRecentFoods] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Selection & portion state
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showCustomModal, setShowCustomModal] = useState(false)

  // Load recent & favorites
  useEffect(() => {
    let ignore = false
    async function loadRecents() {
      try {
        const [recents, favs] = await Promise.all([
          mealLogService.getRecentFoods(15),
          foodService.listFoods({ favoritesOnly: true, pageSize: 20 }),
        ])
        if (!ignore) {
          // Merge distinct foods
          const map = new Map<number, Food>()
          for (const f of favs.items) map.set(f.id, f)
          for (const f of recents) map.set(f.id, f)
          setRecentFoods(Array.from(map.values()))
        }
      } catch (e) {
        console.warn('Failed to load recents:', e)
      }
    }
    loadRecents()
    return () => {
      ignore = true
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const results = await foodService.searchFoods(q, true)
        setSearchResults(results)
      } catch (err: unknown) {
        setSearchError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Select food
  const handleSelectFood = (food: FoodSearchResult | Food) => {
    setSelectedFood(food)
    if (food.serving_quantity && food.serving_unit) {
      setQuantity(String(food.serving_quantity))
      setUnit(food.serving_unit)
    } else if (food.nutritional_basis === '100ml') {
      setQuantity('100')
      setUnit('ml')
    } else if (food.nutritional_basis === 'serving') {
      setQuantity('1')
      setUnit('serving')
    } else {
      setQuantity('100')
      setUnit('g')
    }
  }

  const renderSourceBadge = (source?: string) => {
    if (source === 'generic_usda') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          Generic (USDA)
        </span>
      )
    }
    if (source === 'open_food_facts') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          OpenFoodFacts
        </span>
      )
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        Custom
      </span>
    )
  }

  // Live scaled nutrition preview
  const numQty = parseFloat(quantity)
  const validQty = !isNaN(numQty) && numQty > 0 ? numQty : 0
  let scaleFactor = 1.0
  if (selectedFood) {
    if (unit === 'serving') {
      if (selectedFood.nutritional_basis === 'serving') {
        scaleFactor = validQty
      } else if (selectedFood.serving_quantity && selectedFood.serving_quantity > 0) {
        scaleFactor = (validQty * selectedFood.serving_quantity) / 100.0
      } else {
        scaleFactor = validQty
      }
    } else {
      scaleFactor = validQty / 100.0
    }
  }

  const previewCalories = selectedFood ? Math.round(selectedFood.calories_kcal * scaleFactor) : 0
  const previewProtein = selectedFood ? Math.round(selectedFood.protein_g * scaleFactor * 10) / 10 : 0
  const previewCarbs = selectedFood ? Math.round(selectedFood.carbs_g * scaleFactor * 10) / 10 : 0
  const previewFat = selectedFood ? Math.round(selectedFood.fat_g * scaleFactor * 10) / 10 : 0

  const handleLogFood = async () => {
    if (!selectedFood) return
    const q = parseFloat(quantity)
    if (isNaN(q) || q <= 0) return

    setIsSubmitting(true)
    try {
      // 1. Ensure food is stored in local database if external
      let foodId: number | undefined
      if (selectedFood.id && typeof selectedFood.id === 'number') {
        foodId = selectedFood.id
      } else {
        const persisted = await foodService.createFood(selectedFood)
        foodId = persisted.id
      }

      // 2. Create meal log with snapshot
      const log = await mealLogService.createMealLog({
        logged_date: loggedDate,
        meal_category: mealCategory,
        food_id: foodId,
        quantity: q,
        unit,
        notes: notes.trim() || null,
      })

      onFoodLogged(log)
      onClose()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to log food.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCustomFoodSaved = (food: Food) => {
    setShowCustomModal(false)
    handleSelectFood(food)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 id="add-food-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              Add Food to {mealCategory}
            </h2>
            <span className="text-xs text-slate-500">Date: {loggedDate}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'search'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Search Food
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recents')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'recents'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Favorites & Recents ({recentFoods.length})
          </button>
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="ml-auto pb-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            + Create Custom Food
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'search' && (
            <div>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by food name, brand, or barcode..."
                  className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 transition"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isSearching && (
                <div className="py-8 text-center text-xs text-slate-400">
                  <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
                  <p>Searching food catalogue & Open Food Facts...</p>
                </div>
              )}

              {searchError && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs">
                  {searchError}
                </div>
              )}

              {!isSearching && query.trim() && searchResults.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No foods found for "{query}". You can create a custom food.
                </div>
              )}

              {/* Search Results List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-56 overflow-y-auto">
                {searchResults.map((f, idx) => (
                  <button
                    key={`${f.name}_${idx}`}
                    type="button"
                    onClick={() => handleSelectFood(f)}
                    className={`w-full text-left p-3 rounded-xl transition flex justify-between items-center gap-2 ${
                      selectedFood?.name === f.name
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{f.name}</span>
                        {f.brand && <span className="text-xs text-slate-400">({f.brand})</span>}
                        {renderSourceBadge(f.source)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {Math.round(f.calories_kcal)} kcal • P: {f.protein_g}g • C: {f.carbs_g}g • F: {f.fat_g}g (per {f.nutritional_basis}{f.serving_description ? ` • Serving: ${f.serving_description}` : ''})
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Select →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'recents' && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {recentFoods.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No recent or favorite foods yet. Star a food or log your first meal!
                </div>
              ) : (
                recentFoods.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFood(f)}
                    className={`w-full text-left p-3 rounded-xl transition flex justify-between items-center gap-2 ${
                      selectedFood?.name === f.name
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{f.name}</span>
                        {f.brand && <span className="text-xs text-slate-400">({f.brand})</span>}
                        {renderSourceBadge(f.source)}
                        {f.is_favorite && <span className="text-xs text-amber-500" title="Favorite">★</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {Math.round(f.calories_kcal)} kcal • P: {f.protein_g}g • C: {f.carbs_g}g • F: {f.fat_g}g (per {f.nutritional_basis})
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Select →</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Portion & Scaling Calculator */}
          {selectedFood && (
            <div className="p-4 bg-emerald-50/50 dark:bg-slate-850 rounded-2xl border border-emerald-200/80 dark:border-slate-700 text-left">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Selected Food
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedFood.name} {selectedFood.brand ? `(${selectedFood.brand})` : ''}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {previewCalories}
                  </span>
                  <span className="text-xs font-medium text-slate-500 ml-1">kcal</span>
                </div>
              </div>

              {/* Portion Inputs */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Portion Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                  >
                    <option value="g">grams (g)</option>
                    <option value="ml">milliliters (ml)</option>
                    <option value="serving">servings ({selectedFood.serving_description || 'portion'})</option>
                  </select>
                </div>
              </div>

              {/* Notes input */}
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. with almond milk, post-workout"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
              </div>

              {/* Preview Macro Breakdown */}
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300 pt-2 border-t border-emerald-200/50 dark:border-slate-700/80">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Protein: {previewProtein}g</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Carbs: {previewCarbs}g</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Fat: {previewFat}g</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFood || isSubmitting}
            onClick={handleLogFood}
            className="px-6 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Logging...' : `Log to ${mealCategory}`}
          </button>
        </div>
      </div>

      {showCustomModal && (
        <CustomFoodModal
          onFoodSaved={handleCustomFoodSaved}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  )
}
