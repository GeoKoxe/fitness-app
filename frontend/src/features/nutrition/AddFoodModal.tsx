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

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
          Generic (USDA)
        </span>
      )
    }
    if (source === 'open_food_facts') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border border-amber-300 dark:border-darkButter/40">
          OpenFoodFacts
        </span>
      )
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand dark:border-darkBorder">
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
      let foodId: number | undefined
      if (selectedFood.id && typeof selectedFood.id === 'number') {
        foodId = selectedFood.id
      } else {
        const persisted = await foodService.createFood(selectedFood)
        foodId = persisted.id
      }

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
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity motion-reduce:transition-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden transition-colors motion-reduce:transition-none"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-sand dark:border-darkBorder flex justify-between items-center">
          <div>
            <h2 id="add-food-title" className="text-lg font-bold text-ink dark:text-darkInk capitalize">
              Add Food to {mealCategory}
            </h2>
            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">Date: {loggedDate}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk p-1.5 rounded-xl hover:bg-mist/40 dark:hover:bg-darkMist/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-sand dark:border-darkBorder px-5 gap-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'search'
                ? 'border-midnight text-midnight dark:border-darkMidnight dark:text-darkMidnight'
                : 'border-transparent text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
            }`}
          >
            Search Food
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recents')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'recents'
                ? 'border-midnight text-midnight dark:border-darkMidnight dark:text-darkMidnight'
                : 'border-transparent text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
            }`}
          >
            Favorites &amp; Recents ({recentFoods.length})
          </button>
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="ml-auto pb-2.5 text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle rounded"
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
                  className="w-full pl-9 pr-9 py-2.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle transition"
                />
                <svg className="w-4 h-4 text-inkSecondary dark:text-darkInkSecondary absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-2.5 text-inkSecondary hover:text-ink text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isSearching && (
                <div className="py-8 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
                  <div className="inline-block animate-spin w-6 h-6 border-2 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-2" />
                  <p>Searching food catalogue &amp; Open Food Facts...</p>
                </div>
              )}

              {searchError && (
                <div className="mt-3 p-3 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral rounded-xl text-xs font-medium">
                  {searchError}
                </div>
              )}

              {!isSearching && query.trim() && searchResults.length === 0 && (
                <div className="py-8 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
                  No foods found for "{query}". You can create a custom food.
                </div>
              )}

              {/* Search Results List */}
              <div className="divide-y divide-sand/50 dark:divide-darkBorder/60 mt-2 max-h-56 overflow-y-auto">
                {searchResults.map((f, idx) => (
                  <button
                    key={`${f.name}_${idx}`}
                    type="button"
                    onClick={() => handleSelectFood(f)}
                    className={`w-full text-left p-3 rounded-xl transition flex justify-between items-center gap-2 cursor-pointer ${
                      selectedFood?.name === f.name
                        ? 'bg-mist/50 dark:bg-darkMist border border-sand dark:border-darkBorder'
                        : 'hover:bg-canvas/50 dark:hover:bg-darkCanvas/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink dark:text-darkInk">{f.name}</span>
                        {f.brand && <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">({f.brand})</span>}
                        {renderSourceBadge(f.source)}
                      </div>
                      <div className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
                        {Math.round(f.calories_kcal)} kcal • P: {f.protein_g}g • C: {f.carbs_g}g • F: {f.fat_g}g (per {f.nutritional_basis}{f.serving_description ? ` • Serving: ${f.serving_description}` : ''})
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-midnight dark:text-darkMidnight">Select →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'recents' && (
            <div className="divide-y divide-sand/50 dark:divide-darkBorder/60 max-h-64 overflow-y-auto">
              {recentFoods.length === 0 ? (
                <div className="p-8 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
                  No recent or favorite foods yet. Star a food or log your first meal!
                </div>
              ) : (
                recentFoods.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFood(f)}
                    className={`w-full text-left p-3 rounded-xl transition flex justify-between items-center gap-2 cursor-pointer ${
                      selectedFood?.name === f.name
                        ? 'bg-mist/50 dark:bg-darkMist border border-sand dark:border-darkBorder'
                        : 'hover:bg-canvas/50 dark:hover:bg-darkCanvas/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink dark:text-darkInk">{f.name}</span>
                        {f.brand && <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">({f.brand})</span>}
                        {renderSourceBadge(f.source)}
                        {f.is_favorite && <span className="text-xs text-amber-700 dark:text-darkButter font-bold" title="Favorite">★</span>}
                      </div>
                      <div className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
                        {Math.round(f.calories_kcal)} kcal • P: {f.protein_g}g • C: {f.carbs_g}g • F: {f.fat_g}g (per {f.nutritional_basis})
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-midnight dark:text-darkMidnight">Select →</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Portion & Scaling Calculator */}
          {selectedFood && (
            <div className="p-4 bg-canvas/70 dark:bg-darkCanvas/70 rounded-2xl border border-sand dark:border-darkBorder text-left">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
                    Selected Food
                  </span>
                  <h4 className="font-bold text-sm text-ink dark:text-darkInk mt-0.5">
                    {selectedFood.name} {selectedFood.brand ? `(${selectedFood.brand})` : ''}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-ink dark:text-darkInk">
                    {previewCalories}
                  </span>
                  <span className="text-xs font-medium text-inkSecondary dark:text-darkInkSecondary ml-1">kcal</span>
                </div>
              </div>

              {/* Portion Inputs */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                    Portion Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-surface dark:bg-darkSurface text-ink dark:text-darkInk font-bold focus:outline-none focus:ring-2 focus:ring-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-surface dark:bg-darkSurface text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                  >
                    <option value="g">grams (g)</option>
                    <option value="ml">milliliters (ml)</option>
                    <option value="serving">servings ({selectedFood.serving_description || 'portion'})</option>
                  </select>
                </div>
              </div>

              {/* Notes input */}
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. with almond milk, post-workout"
                  className="w-full px-3 py-1.5 text-xs border border-sand dark:border-darkBorder rounded-xl bg-surface dark:bg-darkSurface text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>

              {/* Preview Macro Breakdown */}
              <div className="flex items-center gap-4 text-xs font-medium text-inkSecondary dark:text-darkInkSecondary pt-2 border-t border-sand/60 dark:border-darkBorder/60">
                <span className="text-ink dark:text-darkInk font-semibold">Protein: {previewProtein}g</span>
                <span className="text-amber-800 dark:text-darkButter font-semibold">Carbs: {previewCarbs}g</span>
                <span className="text-ink dark:text-darkInk font-semibold">Fat: {previewFat}g</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-canvas/40 dark:bg-darkCanvas/40 border-t border-sand dark:border-darkBorder flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFood || isSubmitting}
            onClick={handleLogFood}
            className="px-6 py-2 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
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
