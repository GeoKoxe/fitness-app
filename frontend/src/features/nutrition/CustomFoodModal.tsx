import { useState, type FormEvent } from 'react'
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-left">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="custom-food-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {initialFood ? 'Edit Food' : 'Create Custom Food'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Food Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rolled Oats"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Brand (optional)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Quaker"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category (optional)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Grains, Dairy"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nutritional Basis
              </label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
              >
                <option value="100g">Per 100 g</option>
                <option value="100ml">Per 100 ml</option>
                <option value="serving">Per Serving</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serving Description
              </label>
              <input
                type="text"
                value={servingDesc}
                onChange={(e) => setServingDesc(e.target.value)}
                placeholder="e.g. 1 cup, 1 slice"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serving Size (qty / unit)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="any"
                  value={servingQty}
                  onChange={(e) => setServingQty(e.target.value)}
                  placeholder="30"
                  className="w-16 px-2 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                  placeholder="g"
                  className="w-12 px-2 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Core Macros */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              Nutritional Values ({basis})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Calories (kcal) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Protein (g) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-amber-600 dark:text-amber-400 mb-1">
                  Carbs (g) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-rose-600 dark:text-rose-400 mb-1">
                  Fat (g) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Optional Nutrients */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              Optional Micronutrients
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Fiber (g)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Sugar (g)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Sat Fat (g)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={satFat}
                  onChange={(e) => setSatFat(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Sodium (mg)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sodium}
                  onChange={(e) => setSodium(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              {loading ? 'Saving...' : initialFood ? 'Update Food' : 'Save Food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
