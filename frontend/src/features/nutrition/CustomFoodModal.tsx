import { useEffect, useState, type FormEvent } from 'react'
import type { Food, FoodCreate } from '../../types/food'
import { foodService } from '../../services/foodService'

interface CustomFoodModalProps {
  initialFood?: Food | null
  onFoodSaved: (food: Food) => void
  onClose: () => void
}

export function CustomFoodModal({
  initialFood,
  onFoodSaved,
  onClose,
}: CustomFoodModalProps) {
  const [name, setName] = useState(initialFood?.name || '')
  const [brand, setBrand] = useState(initialFood?.brand || '')
  const [category, setCategory] = useState(initialFood?.category || '')
  const [basis, setBasis] = useState(initialFood?.nutritional_basis || '100g')

  const [servingDesc, setServingDesc] = useState(initialFood?.serving_description || '')
  const [servingQty, setServingQty] = useState(initialFood?.serving_quantity != null ? String(initialFood.serving_quantity) : '')
  const [servingUnit, setServingUnit] = useState(initialFood?.serving_unit || 'g')

  const [calories, setCalories] = useState(initialFood ? String(initialFood.calories_kcal) : '')
  const [protein, setProtein] = useState(initialFood ? String(initialFood.protein_g) : '')
  const [carbs, setCarbs] = useState(initialFood ? String(initialFood.carbs_g) : '')
  const [fat, setFat] = useState(initialFood ? String(initialFood.fat_g) : '')

  const [fiber, setFiber] = useState(initialFood?.fiber_g != null ? String(initialFood.fiber_g) : '')
  const [sugar, setSugar] = useState(initialFood?.sugar_g != null ? String(initialFood.sugar_g) : '')
  const [satFat, setSatFat] = useState(initialFood?.saturated_fat_g != null ? String(initialFood.saturated_fat_g) : '')
  const [sodium, setSodium] = useState(initialFood?.sodium_mg != null ? String(initialFood.sodium_mg) : '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const parseNum = (val: string): number | null => {
    if (!val.trim()) return null
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Food name is required.')
      return
    }

    const cal = parseNum(calories)
    const pro = parseNum(protein)
    const carb = parseNum(carbs)
    const f = parseNum(fat)

    if (cal == null || cal < 0 || pro == null || pro < 0 || carb == null || carb < 0 || f == null || f < 0) {
      setError('Please provide valid positive values for Calories, Protein, Carbs, and Fat.')
      return
    }

    const payload: FoodCreate = {
      name: trimmedName,
      brand: brand.trim() || null,
      category: category.trim() || null,
      source: initialFood?.source || 'manual',
      nutritional_basis: basis,
      serving_description: servingDesc.trim() || null,
      serving_quantity: parseNum(servingQty),
      serving_unit: servingUnit.trim() || null,
      calories_kcal: cal,
      protein_g: pro,
      carbs_g: carb,
      fat_g: f,
      fiber_g: parseNum(fiber),
      sugar_g: parseNum(sugar),
      saturated_fat_g: parseNum(satFat),
      sodium_mg: parseNum(sodium),
      is_favorite: initialFood?.is_favorite ?? false,
    }

    setLoading(true)
    try {
      let saved: Food
      if (initialFood) {
        saved = await foodService.updateFood(initialFood.id, payload)
      } else {
        saved = await foodService.createFood(payload)
      }
      onFoodSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save food.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-food-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity motion-reduce:transition-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-left transition-colors motion-reduce:transition-none"
      >
        <div className="flex justify-between items-center pb-4 border-b border-sand dark:border-darkBorder">
          <h2 id="custom-food-title" className="text-lg font-bold text-ink dark:text-darkInk">
            {initialFood ? 'Edit Food' : 'Create Custom Food'}
          </h2>
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

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-error dark:bg-darkSurface border border-border-card rounded-xl text-xs font-medium text-alert dark:text-darkCoral">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="custom-food-name" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
              Food Name *
            </label>
            <input
              id="custom-food-name"
              name="custom-food-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rolled Oats"
              className="w-full px-3 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="custom-food-brand" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
                Brand (optional)
              </label>
              <input
                id="custom-food-brand"
                name="custom-food-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Quaker"
                className="w-full px-3 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label htmlFor="custom-food-category" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
                Category (optional)
              </label>
              <input
                id="custom-food-category"
                name="custom-food-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Grains, Dairy"
                className="w-full px-3 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="custom-food-basis" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
                Nutritional Basis
              </label>
              <select
                id="custom-food-basis"
                name="custom-food-basis"
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              >
                <option value="100g">Per 100 g</option>
                <option value="100ml">Per 100 ml</option>
                <option value="serving">Per Serving</option>
              </select>
            </div>
            <div>
              <label htmlFor="custom-food-serving-desc" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
                Serving Description
              </label>
              <input
                id="custom-food-serving-desc"
                name="custom-food-serving-desc"
                type="text"
                value={servingDesc}
                onChange={(e) => setServingDesc(e.target.value)}
                placeholder="e.g. 1 cup, 1 slice"
                className="w-full px-3 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label htmlFor="custom-food-serving-qty" className="block text-xs font-semibold text-ink dark:text-darkInk mb-1">
                Serving Size (qty / unit)
              </label>
              <div className="flex gap-1.5">
                <input
                  id="custom-food-serving-qty"
                  name="custom-food-serving-qty"
                  type="number"
                  step="any"
                  value={servingQty}
                  onChange={(e) => setServingQty(e.target.value)}
                  placeholder="30"
                  aria-label="Serving quantity"
                  className="w-16 px-2.5 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
                <input
                  id="custom-food-serving-unit"
                  name="custom-food-serving-unit"
                  type="text"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                  placeholder="g"
                  aria-label="Serving unit"
                  className="w-14 px-2 py-2 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
            </div>
          </div>

          {/* Core Macros */}
          <div className="pt-3 border-t border-sand/60 dark:border-darkBorder/60">
            <span className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary mb-2 block">
              Nutritional Values ({basis})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="custom-food-calories" className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                  Calories (kcal) *
                </label>
                <input
                  id="custom-food-calories"
                  name="custom-food-calories"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-bold border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-protein" className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                  Protein (g) *
                </label>
                <input
                  id="custom-food-protein"
                  name="custom-food-protein"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-carbs" className="block text-[11px] font-semibold text-amber-800 dark:text-darkButter mb-1">
                  Carbs (g) *
                </label>
                <input
                  id="custom-food-carbs"
                  name="custom-food-carbs"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-fat" className="block text-[11px] font-semibold text-ink dark:text-darkInk mb-1">
                  Fat (g) *
                </label>
                <input
                  id="custom-food-fat"
                  name="custom-food-fat"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
            </div>
          </div>

          {/* Optional Nutrients */}
          <div className="pt-3 border-t border-sand/60 dark:border-darkBorder/60">
            <span className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary mb-2 block">
              Optional Micronutrients
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="custom-food-fiber" className="block text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary mb-1">Fiber (g)</label>
                <input
                  id="custom-food-fiber"
                  name="custom-food-fiber"
                  type="number"
                  step="any"
                  min="0"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-sugar" className="block text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary mb-1">Sugar (g)</label>
                <input
                  id="custom-food-sugar"
                  name="custom-food-sugar"
                  type="number"
                  step="any"
                  min="0"
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-satfat" className="block text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary mb-1">Sat Fat (g)</label>
                <input
                  id="custom-food-satfat"
                  name="custom-food-satfat"
                  type="number"
                  step="any"
                  min="0"
                  value={satFat}
                  onChange={(e) => setSatFat(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
              <div>
                <label htmlFor="custom-food-sodium" className="block text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary mb-1">Sodium (mg)</label>
                <input
                  id="custom-food-sodium"
                  name="custom-food-sodium"
                  type="number"
                  step="any"
                  min="0"
                  value={sodium}
                  onChange={(e) => setSodium(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-sand dark:border-darkBorder">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? 'Saving...' : initialFood ? 'Update Food' : 'Save Food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
