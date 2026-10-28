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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-recipe-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-xl w-full p-6 text-left border border-edge max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <h3 id="create-recipe-title" className="text-lg font-bold text-ink">
            Create Custom Recipe
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-inkSecondary hover:text-ink rounded-lg p-1 hover:bg-surfaceMuted transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border text-status-danger-fg text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="create-recipe-name" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Recipe Name *
            </label>
            <input
              id="create-recipe-name"
              type="text"
              required
              placeholder="e.g. Grandma's Lentil Soup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="create-recipe-desc" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              id="create-recipe-desc"
              type="text"
              placeholder="e.g. Nutritious and filling staple stew"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="create-recipe-category" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                id="create-recipe-category"
                value={mealCategory}
                onChange={(e) => setMealCategory(e.target.value)}
                className="w-full px-2.5 py-2 bg-surface border border-edge rounded-lg text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snacks">Snacks</option>
                <option value="any">Any Meal</option>
              </select>
            </div>

            <div>
              <label htmlFor="create-recipe-servings" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Servings
              </label>
              <input
                id="create-recipe-servings"
                type="number"
                min="1"
                max="20"
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-2 bg-surface border border-edge rounded-lg text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="create-recipe-prep" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Prep (min)
              </label>
              <input
                id="create-recipe-prep"
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-2 bg-surface border border-edge rounded-lg text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="create-recipe-cook" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Cook (min)
              </label>
              <input
                id="create-recipe-cook"
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-2 bg-surface border border-edge rounded-lg text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Add Ingredients Section */}
          <div className="bg-surfaceMuted p-4 rounded-xl border border-edge space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
              Ingredients ({ingredients.length})
            </h4>

            {/* Added list */}
            {ingredients.length > 0 && (
              <div className="divide-y divide-edge border border-edge rounded-lg bg-surface overflow-hidden">
                {ingredients.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-ink">{it.food_name}</span>
                      {it.preparation_notes && (
                        <span className="text-[10px] text-inkSecondary ml-1.5">({it.preparation_notes})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-inkSecondary font-medium">
                        {it.quantity} {it.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(idx)}
                        aria-label={`Remove ingredient ${it.food_name}`}
                        className="text-status-danger-fg hover:underline font-bold px-1"
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
                    id="recipe-ingredient-search"
                    name="recipe-ingredient-search"
                    type="text"
                    placeholder="Search catalogue food to add..."
                    aria-label="Search catalogue food to add"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
                  />
                  {searching && (
                    <div className="absolute right-3 top-2 text-[10px] text-inkMuted">Searching...</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-surface border border-edge rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-edge">
                      {searchResults.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => {
                            setSelectedFood(f)
                            setIngUnit(f.serving_unit || 'g')
                          }}
                          className="p-2 text-xs hover:bg-surfaceMuted cursor-pointer flex justify-between"
                        >
                          <span className="font-medium text-ink">{f.name}</span>
                          <span className="text-inkSecondary">{f.calories_kcal} kcal / 100g</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 bg-brand/10 p-2.5 rounded-lg border border-brand/20">
                  <div className="flex-1 min-w-[120px]">
                    <span className="text-[10px] text-brand uppercase font-bold block">Selected</span>
                    <span className="text-xs font-bold text-ink">{selectedFood.name}</span>
                  </div>
                  <input
                    id="recipe-ingredient-qty"
                    name="recipe-ingredient-qty"
                    type="number"
                    min="0.1"
                    step="1"
                    aria-label="Ingredient quantity"
                    value={ingQuantity}
                    onChange={(e) => setIngQuantity(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-surface border border-edge rounded text-xs text-center text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
                  />
                  <select
                    id="recipe-ingredient-unit"
                    name="recipe-ingredient-unit"
                    value={ingUnit}
                    aria-label="Ingredient unit"
                    onChange={(e) => setIngUnit(e.target.value)}
                    className="px-2 py-1 bg-surface border border-edge rounded text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="serving">serving</option>
                  </select>
                  <input
                    id="recipe-ingredient-notes"
                    name="recipe-ingredient-notes"
                    type="text"
                    placeholder="notes (optional)"
                    aria-label="Ingredient preparation notes"
                    value={ingNotes}
                    onChange={(e) => setIngNotes(e.target.value)}
                    className="w-24 px-2 py-1 bg-surface border border-edge rounded text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1 bg-brand hover:bg-brandHover text-white rounded text-xs font-semibold shadow-xs transition-colors"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFood(null)}
                    className="text-xs text-inkSecondary hover:text-ink px-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="create-recipe-instructions" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Instructions
            </label>
            <textarea
              id="create-recipe-instructions"
              rows={3}
              placeholder="Step-by-step preparation instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="create-recipe-tags" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Tags
            </label>
            <input
              id="create-recipe-tags"
              type="text"
              placeholder="e.g. high-protein, quick, budget-friendly"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-xs text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="pt-3 border-t border-edge flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-inkSecondary bg-surfaceMuted hover:bg-surfaceRaised rounded-lg border border-edge transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brandHover rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
