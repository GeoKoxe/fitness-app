import { useEffect, useState } from 'react'
import type { FoodSearchResult } from '../../types/food'
import type { Recipe, RecipeIngredientInput } from '../../types/recipe'
import { foodService } from '../../services/foodService'
import { recipeService } from '../../services/recipeService'

interface CreateRecipeModalProps {
  onClose: () => void
  onSuccess: (recipe: Recipe) => void
}

export function CreateRecipeModal({ onClose, onSuccess }: CreateRecipeModalProps) {
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [mealCategory, setMealCategory] = useState<string>('lunch')
  const [servings, setServings] = useState<number>(1)
  const [prepTime, setPrepTime] = useState<number>(10)
  const [cookTime, setCookTime] = useState<number>(15)
  const [instructions, setInstructions] = useState<string>('')
  const [tags, setTags] = useState<string>('')

  // Ingredients state
  const [ingredients, setIngredients] = useState<
    Array<RecipeIngredientInput & { food_name: string }>
  >([])

  // Food search state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState<boolean>(false)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [ingQuantity, setIngQuantity] = useState<number>(100)
  const [ingUnit, setIngUnit] = useState<string>('g')
  const [ingNotes, setIngNotes] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await foodService.searchFoods(searchQuery, false)
        setSearchResults(res)
      } catch {
        // Ignore search errors in modal
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleAddIngredient = () => {
    if (!selectedFood || !selectedFood.id) return
    setIngredients((prev) => [
      ...prev,
      {
        food_id: selectedFood.id!,
        food_name: selectedFood.name,
        quantity: ingQuantity,
        unit: ingUnit,
        preparation_notes: ingNotes || undefined,
      },
    ])
    setSelectedFood(null)
    setSearchQuery('')
    setSearchResults([])
    setIngQuantity(100)
    setIngNotes('')
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ingredients.length === 0) {
      setError('Please add at least one ingredient to the recipe.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const created = await recipeService.createRecipe({
        name: name.trim(),
        description: description.trim() || undefined,
        meal_category: mealCategory,
        servings,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        instructions: instructions.trim() || undefined,
        tags: tags.trim() || undefined,
        ingredients: ingredients.map(({ food_id, quantity, unit, preparation_notes }) => ({
          food_id,
          quantity,
          unit,
          preparation_notes,
        })),
      })
      onSuccess(created)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Create Custom Recipe</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Recipe Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grandma's Lentil Soup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Nutritious and filling staple stew"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={mealCategory}
                onChange={(e) => setMealCategory(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snacks">Snacks</option>
                <option value="any">Any Meal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Servings
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Prep (min)
              </label>
              <input
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cook (min)
              </label>
              <input
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Add Ingredients Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Ingredients ({ingredients.length})
            </h4>

            {/* Added list */}
            {ingredients.length > 0 && (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white overflow-hidden">
                {ingredients.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{it.food_name}</span>
                      {it.preparation_notes && (
                        <span className="text-[10px] text-slate-400 ml-1.5">({it.preparation_notes})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 font-medium">
                        {it.quantity} {it.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search and add ingredient */}
            <div className="space-y-2 pt-1">
              {!selectedFood ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search catalogue food to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
                  />
                  {searching && (
                    <div className="absolute right-3 top-2 text-[10px] text-slate-400">Searching...</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {searchResults.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => {
                            setSelectedFood(f)
                            setIngUnit(f.serving_unit || 'g')
                          }}
                          className="p-2 text-xs hover:bg-indigo-50 cursor-pointer flex justify-between"
                        >
                          <span className="font-medium text-slate-800">{f.name}</span>
                          <span className="text-slate-500">{f.calories_kcal} kcal / 100g</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-200">
                  <div className="flex-1 min-w-[120px]">
                    <span className="text-[10px] text-indigo-700 uppercase font-bold block">Selected</span>
                    <span className="text-xs font-bold text-slate-900">{selectedFood.name}</span>
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    step="1"
                    value={ingQuantity}
                    onChange={(e) => setIngQuantity(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
                  />
                  <select
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="serving">serving</option>
                  </select>
                  <input
                    type="text"
                    placeholder="notes (optional)"
                    value={ingNotes}
                    onChange={(e) => setIngNotes(e.target.value)}
                    className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFood(null)}
                    className="text-xs text-slate-500 hover:text-slate-700 px-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Step-by-step preparation instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tags
            </label>
            <input
              type="text"
              placeholder="e.g. high-protein, quick, budget-friendly"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
