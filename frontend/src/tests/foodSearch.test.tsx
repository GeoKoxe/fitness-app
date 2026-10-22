import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddFoodModal } from '../features/nutrition/AddFoodModal'
import { CustomFoodModal } from '../features/nutrition/CustomFoodModal'
import { foodService } from '../services/foodService'
import { mealLogService } from '../services/mealLogService'
import type { FoodSearchResult } from '../types/food'

vi.mock('../services/foodService', () => ({
  foodService: {
    searchFoods: vi.fn(),
    createFood: vi.fn(),
    listFoods: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
  },
}))

vi.mock('../services/mealLogService', () => ({
  mealLogService: {
    getRecentFoods: vi.fn().mockResolvedValue([]),
    createMealLog: vi.fn().mockResolvedValue({ id: 101 }),
  },
}))

describe('Food Search and Custom Food Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches foods and displays results with live macro scaling', async () => {
    const mockResults: FoodSearchResult[] = [
      {
        id: 12,
        name: 'Oats (rolled, dry)',
        calories_kcal: 379.0,
        protein_g: 13.2,
        carbs_g: 67.7,
        fat_g: 6.5,
        nutritional_basis: '100g',
        source: 'generic_usda',
      },
    ]

    vi.mocked(foodService.searchFoods).mockResolvedValueOnce(mockResults)

    render(
      <AddFoodModal
        mealCategory="breakfast"
        loggedDate="2026-10-23"
        onFoodLogged={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText(/Search by food name/i)

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Oats' } })
      // Wait for debounce 300ms
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(await screen.findByText('Oats (rolled, dry)')).toBeInTheDocument()
    expect(screen.getByText('Generic (USDA)')).toBeInTheDocument()

    // Select the food
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select →/i }))
    })

    // Portion calculator shows 379 kcal for default 100g
    expect(screen.getByText('379')).toBeInTheDocument()
    expect(screen.getByText(/Protein: 13.2g/i)).toBeInTheDocument()

    // Log the food directly
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Log to breakfast/i }))
    })

    // Ensure foodService.createFood was NOT called because food has existing id=12
    expect(foodService.createFood).not.toHaveBeenCalled()
    expect(mealLogService.createMealLog).toHaveBeenCalledWith(
      expect.objectContaining({
        food_id: 12,
        quantity: 100,
        unit: 'g',
      })
    )
  })

  it('renders OpenFoodFacts source badge for external branded foods', async () => {
    const mockResults: FoodSearchResult[] = [
      {
        name: 'Whole Milk 3.5%',
        brand: 'Arla',
        calories_kcal: 64.0,
        protein_g: 3.4,
        carbs_g: 4.8,
        fat_g: 3.5,
        nutritional_basis: '100ml',
        source: 'open_food_facts',
      },
    ]

    vi.mocked(foodService.searchFoods).mockResolvedValueOnce(mockResults)

    render(
      <AddFoodModal
        mealCategory="breakfast"
        loggedDate="2026-10-23"
        onFoodLogged={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText(/Search by food name/i)

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Milk' } })
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(await screen.findByText('Whole Milk 3.5%')).toBeInTheDocument()
    expect(screen.getByText('OpenFoodFacts')).toBeInTheDocument()
  })

  it('validates custom food required inputs', async () => {
    render(
      <CustomFoodModal
        onFoodSaved={vi.fn()}
        onClose={vi.fn()}
      />
    )

    // Submit with empty name
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Food/i }))
    })

    expect(await screen.findByText(/Food name is required/i)).toBeInTheDocument()
  })
})

