import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdjustPortionsModal } from '../features/mealPlanning/AdjustPortionsModal'
import { DislikedFoodsModal } from '../features/mealPlanning/DislikedFoodsModal'
import { MealPlannerDashboard } from '../features/mealPlanning/MealPlannerDashboard'
import { PlannedMealCard } from '../features/mealPlanning/PlannedMealCard'
import { RecipesView } from '../features/mealPlanning/RecipesView'
import { ReplaceMealModal } from '../features/mealPlanning/ReplaceMealModal'
import { ShoppingListView } from '../features/mealPlanning/ShoppingListView'
import { WeeklyOverviewCard } from '../features/mealPlanning/WeeklyOverviewCard'
import { MealCategoryCard } from '../features/nutrition/MealCategoryCard'
import { NutritionGoalModal } from '../features/nutrition/NutritionGoalModal'
import { mealPlanService } from '../services/mealPlanService'
import { nutritionGoalService } from '../services/nutritionGoalService'
import { recipeService } from '../services/recipeService'
import type { MealPlan, ShoppingListItem, WeeklyNutritionOverview } from '../types/mealPlan'
import type { MealLog } from '../types/nutrition'
import type { RecipeSummary } from '../types/recipe'

vi.mock('../services/nutritionGoalService', () => ({
  nutritionGoalService: {
    getGoals: vi.fn(),
    updateGoals: vi.fn(),
    estimateGoals: vi.fn(),
    getReport: vi.fn(),
  },
}))

vi.mock('../services/mealPlanService', () => ({
  mealPlanService: {
    getActivePlan: vi.fn(),
    generatePlan: vi.fn(),
    deletePlan: vi.fn(),
    replacePlannedMeal: vi.fn(),
    adjustMealServings: vi.fn(),
    regenerateMeal: vi.fn(),
    logPlannedMeals: vi.fn(),
    getShoppingList: vi.fn(),
    updateShoppingListItem: vi.fn(),
    exportShoppingList: vi.fn(),
    getDislikedFoods: vi.fn(),
    addDislikedFood: vi.fn(),
    removeDislikedFood: vi.fn(),
    dislikeAndRegenerate: vi.fn(),
  },
}))

vi.mock('../services/recipeService', () => ({
  recipeService: {
    getRecipes: vi.fn(),
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  },
}))

describe('Phase 5: Meal Planning and Shopping Lists', () => {
  const mockPlan: MealPlan = {
    id: 10,
    user_profile_id: 1,
    name: 'Weekly Balanced Plan',
    start_date: '2026-10-26',
    end_date: '2026-11-01',
    is_active: true,
    created_at: '2026-10-24T12:00:00Z',
    updated_at: '2026-10-24T12:00:00Z',
    weekly_overview: {
      average_daily_calories: 2050,
      average_daily_protein: 135,
      average_daily_carbs: 220,
      average_daily_fat: 65,
      average_daily_fiber: 28,
      target_calories: 2000,
      target_protein: 130,
      target_carbs: 220,
      target_fat: 65,
      target_fiber: 30,
      adherence_calories_pct: 102.5,
      adherence_protein_pct: 103.8,
    },
    days: [
      {
        day_number: 1,
        plan_date: '2026-10-26',
        day_name: 'Monday',
        total_calories: 2050,
        total_protein: 135,
        total_carbs: 220,
        total_fat: 65,
        total_fiber: 28,
        meals: [
          {
            id: 101,
            meal_plan_id: 10,
            plan_date: '2026-10-26',
            day_number: 1,
            meal_category: 'breakfast',
            name: 'Classic Banana Honey Oatmeal',
            servings: 1.0,
            calories_kcal: 450,
            protein_g: 15,
            carbs_g: 75,
            fat_g: 10,
            fiber_g: 6,
            items: [
              {
                id: 1001,
                planned_meal_id: 101,
                food_id: 18,
                food_name: 'Oats (rolled, dry)',
                quantity: 60,
                unit: 'g',
                calories_kcal: 227,
                protein_g: 8,
                carbs_g: 40,
                fat_g: 4,
              },
            ],
          },
          {
            id: 102,
            meal_plan_id: 10,
            plan_date: '2026-10-26',
            day_number: 1,
            meal_category: 'lunch',
            name: 'Grilled Chicken Breast with Brown Rice',
            servings: 1.0,
            calories_kcal: 650,
            protein_g: 55,
            carbs_g: 60,
            fat_g: 15,
            fiber_g: 5,
            items: [],
          },
        ],
      },
    ],
  }

  const mockShoppingList: ShoppingListItem[] = [
    {
      id: 201,
      meal_plan_id: 10,
      food_id: 18,
      ingredient_name: 'Oats (rolled, dry)',
      category: 'Grains',
      total_quantity: 420,
      unit: 'g',
      is_checked: false,
      is_excluded: false,
    },
    {
      id: 202,
      meal_plan_id: 10,
      food_id: 31,
      ingredient_name: 'Chicken Breast (skinless, raw)',
      category: 'Meat/Poultry',
      total_quantity: 800,
      unit: 'g',
      is_checked: true,
      is_excluded: false,
    },
  ]

  const mockRecipes: RecipeSummary[] = [
    {
      id: 1,
      name: 'Classic Banana Honey Oatmeal',
      meal_category: 'breakfast',
      servings: 1,
      prep_time_minutes: 5,
      cook_time_minutes: 5,
      is_built_in: true,
      ingredients_count: 5,
      per_serving_calories: 450,
      per_serving_protein: 15,
      per_serving_carbs: 75,
      per_serving_fat: 10,
      per_serving_fiber: 6,
    },
    {
      id: 2,
      name: 'Mediterranean Tuna Salad',
      meal_category: 'lunch',
      servings: 1,
      prep_time_minutes: 10,
      cook_time_minutes: 0,
      is_built_in: true,
      ingredients_count: 5,
      per_serving_calories: 520,
      per_serving_protein: 42,
      per_serving_carbs: 40,
      per_serving_fat: 16,
      per_serving_fiber: 5,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders MealPlannerDashboard with plan overview, days, and planned meals', async () => {
    vi.mocked(mealPlanService.getActivePlan).mockResolvedValue(mockPlan)

    await act(async () => {
      render(<MealPlannerDashboard />)
    })

    expect(screen.getByText('Weekly Balanced Plan')).toBeInTheDocument()
    expect(screen.getByText('Weekly Planned Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Planned (Not Logged)')).toBeInTheDocument()
    expect(screen.getByText('Classic Banana Honey Oatmeal')).toBeInTheDocument()
    expect(screen.getByText('Grilled Chicken Breast with Brown Rice')).toBeInTheDocument()
    expect(screen.getByText('Day 1 — Monday (2026-10-26)')).toBeInTheDocument()
  })

  it('opens Log Planned Meal modal with duplicate prevention notice and triggers log service', async () => {
    vi.mocked(mealPlanService.getActivePlan).mockResolvedValue(mockPlan)
    vi.mocked(mealPlanService.logPlannedMeals).mockResolvedValue({
      success: true,
      logged_count: 1,
      skipped_count: 0,
      message: 'Successfully logged 1 item(s).',
      logged_items: [{ food_name: 'Oats', quantity: 60, unit: 'g', meal_log_id: 1 }],
    })

    await act(async () => {
      render(<MealPlannerDashboard />)
    })

    // Click "Log to Diary" button on the first meal card
    const logButtons = screen.getAllByRole('button', { name: /Log to Diary/i })
    expect(logButtons.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(logButtons[0]!)
    })

    // Modal should be open
    expect(screen.getByText('Log Classic Banana Honey Oatmeal')).toBeInTheDocument()
    expect(screen.getByText(/Prevent duplicate entries:/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Planned meals never enter your food diary automatically/i)
    ).toBeInTheDocument()

    // Confirm log
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Log to Diary/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(mealPlanService.logPlannedMeals).toHaveBeenCalledWith({
      target_date: expect.any(String),
      planned_meal_id: 101,
      skip_if_already_logged: true,
    })
  })

  it('renders ShoppingListView with categories, checkboxes, and disclaimer', async () => {
    vi.mocked(mealPlanService.getShoppingList).mockResolvedValue(mockShoppingList)
    vi.mocked(mealPlanService.updateShoppingListItem).mockResolvedValue({
      ...mockShoppingList[0]!,
      is_checked: true,
    })

    await act(async () => {
      render(<ShoppingListView planId={10} planName="Weekly Balanced Plan" />)
    })

    expect(screen.getByText('Shopping List')).toBeInTheDocument()
    expect(
      screen.getByText(/Prices are not tracked locally\. Cost estimates are never fabricated\./i)
    ).toBeInTheDocument()
    expect(screen.getByText('Oats (rolled, dry)')).toBeInTheDocument()
    expect(screen.getByText('Chicken Breast (skinless, raw)')).toBeInTheDocument()
    expect(screen.getByText('420 g')).toBeInTheDocument()

    // Toggle check
    const checkboxRow = screen.getByText('Oats (rolled, dry)')
    await act(async () => {
      fireEvent.click(checkboxRow)
    })

    expect(mealPlanService.updateShoppingListItem).toHaveBeenCalledWith(201, {
      is_checked: true,
    })
  })

  it('renders RecipesView with search, category filtering, and recipe cards', async () => {
    vi.mocked(recipeService.getRecipes).mockResolvedValue(mockRecipes)

    await act(async () => {
      render(<RecipesView />)
    })

    expect(screen.getByText('Recipe Library')).toBeInTheDocument()
    expect(screen.getByText('Classic Banana Honey Oatmeal')).toBeInTheDocument()
    expect(screen.getByText('Mediterranean Tuna Salad')).toBeInTheDocument()
    expect(screen.getAllByText('Built-in Staple').length).toBe(2)
  })

  it('Feature A: displays dislike button on expanded ingredients and triggers dislikeAndRegenerate', async () => {
    vi.mocked(mealPlanService.getActivePlan).mockResolvedValue(mockPlan)
    vi.mocked(mealPlanService.dislikeAndRegenerate).mockResolvedValue({
      disliked_food: {
        id: 1,
        user_profile_id: 1,
        food_id: 18,
        food_name: 'Oats (rolled, dry)',
        created_at: '2026-10-24T12:00:00Z',
      },
      affected_meals_count: 1,
      regenerated_meals_count: 1,
      failed_meals_count: 0,
      message: 'Regenerated 1 meal(s) avoiding disliked ingredient "Oats (rolled, dry)".',
      plan: mockPlan,
    })

    // Mock confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await act(async () => {
      render(<MealPlannerDashboard />)
    })

    // Expand ingredients on the first meal card
    const expandBtn = screen.getAllByText(/View Ingredients/i)[0]!
    await act(async () => {
      fireEvent.click(expandBtn)
    })

    // Dislike button should be visible
    const dislikeBtn = screen.getByTitle('Mark Oats (rolled, dry) as disliked')
    expect(dislikeBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(dislikeBtn)
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(mealPlanService.dislikeAndRegenerate).toHaveBeenCalledWith({
      food_name: 'Oats (rolled, dry)',
      food_id: 18,
    })
  })

  it('Feature B: manages disliked foods modal (list, add, and remove)', async () => {
    vi.mocked(mealPlanService.getDislikedFoods).mockResolvedValue([
      {
        id: 5,
        user_profile_id: 1,
        food_name: 'Mushrooms',
        food_category: 'Vegetables',
        created_at: '2026-10-24T10:00:00Z',
      },
    ])
    vi.mocked(mealPlanService.addDislikedFood).mockResolvedValue({
      id: 6,
      user_profile_id: 1,
      food_name: 'Olives',
      created_at: '2026-10-24T10:05:00Z',
    })
    vi.mocked(mealPlanService.removeDislikedFood).mockResolvedValue()

    await act(async () => {
      render(<DislikedFoodsModal onClose={vi.fn()} />)
    })

    expect(screen.getByText('Manage Disliked Foods')).toBeInTheDocument()
    expect(screen.getByText('Mushrooms')).toBeInTheDocument()
    expect(screen.getByText(/Category: Vegetables/i)).toBeInTheDocument()

    // Add new disliked food
    const input = screen.getByPlaceholderText(/Add an ingredient/i)
    fireEvent.change(input, { target: { value: 'Olives' } })
    const addBtn = screen.getByRole('button', { name: /\+ Add/i })

    await act(async () => {
      fireEvent.click(addBtn)
    })
    expect(mealPlanService.addDislikedFood).toHaveBeenCalledWith({ food_name: 'Olives' })

    // Remove disliked food
    const removeBtn = screen.getByRole('button', { name: /Remove/i })
    await act(async () => {
      fireEvent.click(removeBtn)
    })
    expect(mealPlanService.removeDislikedFood).toHaveBeenCalledWith(5)
  })

  it('Feature D & E: AdjustPortionsModal steps by whole servings and rejects 1.5x', async () => {
    const meal = mockPlan.days[0]!.meals[0]!
    vi.mocked(mealPlanService.adjustMealServings).mockResolvedValue(mockPlan)

    await act(async () => {
      render(<AdjustPortionsModal meal={meal} onClose={vi.fn()} onSuccess={vi.fn()} />)
    })

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(1)

    // Type 1.5
    fireEvent.change(input, { target: { value: '1.5' } })
    const saveBtn = screen.getByRole('button', { name: /Update Portions/i })

    await act(async () => {
      fireEvent.click(saveBtn)
    })

    // Should display validation error and NOT call adjustMealServings
    expect(screen.getByText(/1.5x serving option is not supported/i)).toBeInTheDocument()
    expect(mealPlanService.adjustMealServings).not.toHaveBeenCalled()

    // Now change to 2
    fireEvent.change(input, { target: { value: '2' } })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(mealPlanService.adjustMealServings).toHaveBeenCalledWith(101, 2)
  })

  it('Feature F: MealCategoryCard provides Remove All button with confirmation', async () => {
    const mockLogs: MealLog[] = [
      {
        id: 11,
        user_profile_id: 1,
        logged_date: '2026-10-26',
        meal_category: 'breakfast',
        food_id: 1,
        food_name: 'Whole Milk',
        food_brand: null,
        serving_size_num: 200,
        serving_size_unit: 'ml',
        quantity: 200,
        unit: 'ml',
        calories_kcal: 128,
        protein_g: 6.8,
        carbs_g: 9.6,
        fat_g: 7.2,
        fiber_g: 0,
        created_at: '2026-10-26T08:00:00Z',
        updated_at: '2026-10-26T08:00:00Z',
      },
      {
        id: 12,
        user_profile_id: 1,
        logged_date: '2026-10-26',
        meal_category: 'breakfast',
        food_id: 2,
        food_name: 'Rolled Oats',
        food_brand: null,
        serving_size_num: 50,
        serving_size_unit: 'g',
        quantity: 50,
        unit: 'g',
        calories_kcal: 189,
        protein_g: 6.5,
        carbs_g: 33.5,
        fat_g: 3.5,
        fiber_g: 5.0,
        created_at: '2026-10-26T08:00:00Z',
        updated_at: '2026-10-26T08:00:00Z',
      },
    ]

    const onRemoveAllMock = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await act(async () => {
      render(
        <MealCategoryCard
          category="breakfast"
          title="Breakfast"
          logs={mockLogs}
          onAddFood={vi.fn()}
          onUpdateQuantity={vi.fn()}
          onDeleteLog={vi.fn()}
          onRemoveAll={onRemoveAllMock}
        />
      )
    })

    const removeAllBtn = screen.getByRole('button', { name: /Remove All/i })
    expect(removeAllBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(removeAllBtn)
    })

    expect(window.confirm).toHaveBeenCalledWith(
      'Remove all 2 logged items from Breakfast for this date?'
    )
    expect(onRemoveAllMock).toHaveBeenCalledWith('breakfast')
  })

  it('Feature G: WeeklyOverviewCard renders tolerance and unmet constraint suggestions', async () => {
    const overviewWithUnmet: WeeklyNutritionOverview = {
      average_daily_calories: 2280,
      average_daily_protein: 110,
      average_daily_carbs: 260,
      average_daily_fat: 75,
      average_daily_fiber: 25,
      target_calories: 2000,
      target_protein: 130,
      tolerance_pct: 12,
      adherence_calories_pct: 114,
      adherence_protein_pct: 84.6,
      unmet_constraints: [
        {
          target_name: 'Daily Calories',
          target_value: 2000,
          actual_value: 2280,
          tolerance_pct: 12,
          upper_limit: 2240,
          status: 'exceeded',
          suggestion: 'Consider reducing portion sizes or selecting leaner meal combinations.',
        },
      ],
    }

    await act(async () => {
      render(<WeeklyOverviewCard overview={overviewWithUnmet} />)
    })

    expect(screen.getByText(/Tolerance: ±12%/i)).toBeInTheDocument()
    expect(screen.getByText(/Unmet Target Constraints \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Daily Calories:/i)).toBeInTheDocument()
    expect(screen.getByText(/Actual/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Consider reducing portion sizes or selecting leaner meal combinations\./i)
    ).toBeInTheDocument()
  })

  it('Bug 1: logs planned meals and notifies onMealLogged callback with targetDate', async () => {
    vi.mocked(mealPlanService.getActivePlan).mockResolvedValue(mockPlan)
    vi.mocked(mealPlanService.logPlannedMeals).mockResolvedValue({
      success: true,
      logged_count: 1,
      skipped_count: 0,
      message: 'Successfully logged 1 item(s) to Daily Log for 2026-10-26.',
      logged_items: [{ food_name: 'Oats (rolled, dry)', quantity: 60, unit: 'g', meal_log_id: 99 }],
    })

    const onMealLoggedMock = vi.fn()

    await act(async () => {
      render(<MealPlannerDashboard onMealLogged={onMealLoggedMock} />)
    })

    const logBtns = screen.getAllByRole('button', { name: /Log to Diary/i })
    await act(async () => {
      fireEvent.click(logBtns[0]!)
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Log to Diary/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(mealPlanService.logPlannedMeals).toHaveBeenCalledWith(
      expect.objectContaining({
        target_date: '2026-10-26',
        planned_meal_id: 101,
        skip_if_already_logged: true,
      })
    )
    expect(onMealLoggedMock).toHaveBeenCalledWith('2026-10-26')
  })

  it('Bug 2: NutritionGoalModal standardizes suggested goals to integers and saves whole numbers', async () => {
    vi.mocked(nutritionGoalService.estimateGoals).mockResolvedValue({
      calories_kcal: 2150.7,
      protein_g: 134.4,
      carbs_g: 241.9,
      fat_g: 71.6,
      fiber_g: 30.1,
      bmr_kcal: 1650,
      tdee_kcal: 2150.7,
      formula_explanation: 'Mifflin-St Jeor calculation',
    })
    vi.mocked(nutritionGoalService.updateGoals).mockResolvedValue({
      calories_kcal: 2151,
      protein_g: 134,
      carbs_g: 242,
      fat_g: 72,
      fiber_g: 30,
    })

    const onGoalsSavedMock = vi.fn()
    await act(async () => {
      render(
        <NutritionGoalModal
          currentGoals={null}
          onGoalsSaved={onGoalsSavedMock}
          onClose={vi.fn()}
        />
      )
    })

    // Click Calculate Suggestion
    const calcBtn = screen.getByRole('button', { name: /Calculate Suggestion/i })
    await act(async () => {
      fireEvent.click(calcBtn)
    })

    // Check that input values were rounded to whole numbers
    const proteinInput = screen.getByLabelText(/Protein Target/i) as HTMLInputElement
    expect(proteinInput.value).toBe('134')
    const caloriesInput = screen.getByLabelText(/Daily Calorie Target/i) as HTMLInputElement
    expect(caloriesInput.value).toBe('2151')

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Goals/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(nutritionGoalService.updateGoals).toHaveBeenCalledWith({
      calories_kcal: 2151,
      protein_g: 134,
      carbs_g: 242,
      fat_g: 72,
      fiber_g: 30,
    })
    expect(onGoalsSavedMock).toHaveBeenCalled()
  })

  it('Bug 3: PlannedMealCard renders Recipe button when recipe_id is present and triggers onViewRecipe', async () => {
    const onViewRecipeMock = vi.fn()
    const mealWithRecipe = mockPlan.days[0]!.meals[0]!

    await act(async () => {
      render(
        <PlannedMealCard
          meal={{ ...mealWithRecipe, recipe_id: 42 }}
          onLogMeal={vi.fn()}
          onAdjustPortions={vi.fn()}
          onReplaceMeal={vi.fn()}
          onPlanUpdated={vi.fn()}
          onViewRecipe={onViewRecipeMock}
        />
      )
    })

    const recipeBtn = screen.getByRole('button', { name: /Recipe/i })
    expect(recipeBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(recipeBtn)
    })
    expect(onViewRecipeMock).toHaveBeenCalledWith(42)
  })

  it('Bug 3: PlannedMealCard displays non-clickable disabled Recipe when recipe_id is absent', async () => {
    const mealWithoutRecipe = mockPlan.days[0]!.meals[0]!

    await act(async () => {
      render(
        <PlannedMealCard
          meal={{ ...mealWithoutRecipe, recipe_id: null }}
          onLogMeal={vi.fn()}
          onAdjustPortions={vi.fn()}
          onReplaceMeal={vi.fn()}
          onPlanUpdated={vi.fn()}
        />
      )
    })

    const recipeLabel = screen.getByText('Recipe')
    expect(recipeLabel.tagName).toBe('SPAN')
    expect(recipeLabel).toHaveClass('cursor-not-allowed')
  })

  it('Bug 4: WeeklyOverviewCard dismisses individual warnings and hides container when all dismissed', async () => {
    const overviewWithMultipleWarnings: WeeklyNutritionOverview = {
      average_daily_calories: 2280,
      average_daily_protein: 100,
      average_daily_carbs: 260,
      average_daily_fat: 75,
      average_daily_fiber: 25,
      target_calories: 2000,
      target_protein: 130,
      tolerance_pct: 10,
      unmet_constraints: [
        {
          target_name: 'Daily Calories',
          target_value: 2000,
          actual_value: 2280,
          tolerance_pct: 10,
          upper_limit: 2200,
          status: 'exceeded',
          suggestion: 'Reduce portions',
        },
        {
          target_name: 'Daily Protein',
          target_value: 130,
          actual_value: 100,
          tolerance_pct: 10,
          upper_limit: 143,
          status: 'under',
          suggestion: 'Add protein powder',
        },
      ],
    }

    await act(async () => {
      render(<WeeklyOverviewCard overview={overviewWithMultipleWarnings} />)
    })

    expect(screen.getByText(/Unmet Target Constraints \(2\)/i)).toBeInTheDocument()

    // Dismiss first warning (Daily Calories)
    const dismissCalBtn = screen.getByRole('button', { name: /Dismiss warning for Daily Calories/i })
    await act(async () => {
      fireEvent.click(dismissCalBtn)
    })

    // Container still exists but now shows (1)
    expect(screen.getByText(/Unmet Target Constraints \(1\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/Daily Calories:/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Daily Protein:/i)).toBeInTheDocument()

    // Dismiss second warning (Daily Protein)
    const dismissProtBtn = screen.getByRole('button', { name: /Dismiss warning for Daily Protein/i })
    await act(async () => {
      fireEvent.click(dismissProtBtn)
    })

    // Entire section must be hidden
    expect(screen.queryByText(/Unmet Target Constraints/i)).not.toBeInTheDocument()
  })

  it('Bug 7: RecipesView provides "This Week\'s Plan" filter and badges active recipes', async () => {
    vi.mocked(recipeService.getRecipes).mockResolvedValue(mockRecipes)
    // mockPlan has meal with recipe_id = 1 (Classic Banana Honey Oatmeal)
    vi.mocked(mealPlanService.getActivePlan).mockResolvedValue({
      ...mockPlan,
      days: [
        {
          ...mockPlan.days[0]!,
          meals: [
            {
              ...mockPlan.days[0]!.meals[0]!,
              recipe_id: 1,
            },
          ],
        },
      ],
    })

    await act(async () => {
      render(<RecipesView />)
    })

    // Filter button for This Week's Plan exists
    const thisWeekBtn = screen.getByRole('button', { name: /This Week's Plan/i })
    expect(thisWeekBtn).toBeInTheDocument()

    // Badge on the card in active plan
    expect(screen.getByText('In Active Plan')).toBeInTheDocument()

    // Toggle filter to only show this week's plan
    await act(async () => {
      fireEvent.click(thisWeekBtn)
    })

    // Recipe 1 should remain, Recipe 2 (id=2, Mediterranean Tuna Salad) should be filtered out
    expect(screen.getByText('Classic Banana Honey Oatmeal')).toBeInTheDocument()
    expect(screen.queryByText('Mediterranean Tuna Salad')).not.toBeInTheDocument()
  })

  it('Phase 6: ReplaceMealModal warns and disables recipes violating 2-day spacing rule', async () => {
    vi.mocked(recipeService.getRecipes).mockResolvedValue(mockRecipes)
    // Meal on Day 1
    const targetMeal = mockPlan.days[0]!.meals[0]! // Day 1 meal

    // Active plan has Recipe 2 (id=2) on Day 2 (|2 - 1| = 1 < 3 -> conflict!)
    const planWithDay2Conflict: MealPlan = {
      ...mockPlan,
      days: [
        mockPlan.days[0]!,
        {
          ...mockPlan.days[0]!,
          day_number: 2,
          meals: [
            {
              ...mockPlan.days[0]!.meals[0]!,
              id: 999,
              recipe_id: 2, // Mediterranean Tuna Salad is on Day 2
            },
          ],
        },
      ],
    }

    await act(async () => {
      render(
        <ReplaceMealModal
          meal={targetMeal}
          activePlan={planWithDay2Conflict}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )
    })

    // Recipe 2 should be marked unavailable with warning badge
    expect(screen.getByText(/Used on Day 2 \(needs ≥2 days separation\)/i)).toBeInTheDocument()

    // Unavailable button should be disabled
    const unavailableBtn = screen.getByRole('button', { name: /Unavailable/i })
    expect(unavailableBtn).toBeDisabled()
  })
})

