import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NutritionDashboard } from '../features/nutrition/NutritionDashboard'
import { nutritionGoalService } from '../services/nutritionGoalService'
import type { DailyNutritionSummary } from '../types/nutrition'
import type { NutritionGoal } from '../types/nutritionGoal'

const mockSummary: DailyNutritionSummary = {
  logged_date: '2026-10-23',
  totals: {
    calories_kcal: 450.0,
    protein_g: 35.0,
    carbs_g: 40.0,
    fat_g: 15.0,
    fiber_g: 5.0,
    sugar_g: 4.0,
    saturated_fat_g: 2.0,
    sodium_mg: 300.0,
  },
  by_category: {
    breakfast: [
      {
        id: 1,
        user_profile_id: 1,
        food_id: 10,
        logged_date: '2026-10-23',
        meal_category: 'breakfast',
        quantity: 150.0,
        unit: 'g',
        food_name: 'Greek Yogurt 2%',
        food_brand: 'Fage',
        calories_kcal: 110.0,
        protein_g: 15.0,
        carbs_g: 6.0,
        fat_g: 3.0,
        fiber_g: null,
        sugar_g: 6.0,
        saturated_fat_g: 2.0,
        sodium_mg: 60.0,
        notes: null,
        created_at: '2026-10-23T08:00:00Z',
        updated_at: '2026-10-23T08:00:00Z',
      },
    ],
    lunch: [],
    dinner: [],
    snacks: [],
  },
  total_entries: 1,
}

const mockGoals: NutritionGoal = {
  id: 1,
  user_profile_id: 1,
  calories_kcal: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 65,
  fiber_g: 30,
  created_at: '2026-10-23T08:00:00Z',
  updated_at: '2026-10-23T08:00:00Z',
}

vi.mock('../services/mealLogService', () => ({
  mealLogService: {
    getDailySummary: vi.fn().mockImplementation(() => Promise.resolve(mockSummary)),
    createMealLog: vi.fn(),
    updateMealLog: vi.fn().mockResolvedValue({}),
    deleteMealLog: vi.fn().mockResolvedValue(undefined),
    getRecentFoods: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../services/foodService', () => ({
  foodService: {
    listFoods: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
    searchFoods: vi.fn().mockResolvedValue([]),
    createFood: vi.fn(),
    toggleFavorite: vi.fn(),
    deleteFood: vi.fn(),
  },
}))

vi.mock('../services/nutritionGoalService', () => ({
  nutritionGoalService: {
    getGoals: vi.fn(),
    updateGoals: vi.fn(),
    estimateGoals: vi.fn(),
    getReport: vi.fn(),
  },
}))

describe('NutritionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(nutritionGoalService.getGoals).mockResolvedValue(mockGoals)
  })

  it('renders daily nutrition summary and logged breakfast item', async () => {
    render(<NutritionDashboard />)

    expect(await screen.findByText(/Daily Nutrition Progress/i)).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument() // Total kcal
    expect(screen.getByText('35')).toBeInTheDocument() // Protein
    expect(screen.getByText('Greek Yogurt 2%')).toBeInTheDocument()
    expect(screen.getByText('150 g')).toBeInTheDocument()
  })

  it('renders all four meal category sections', async () => {
    render(<NutritionDashboard />)

    expect(await screen.findByText('Breakfast')).toBeInTheDocument()
    expect(screen.getByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('Dinner')).toBeInTheDocument()
    expect(screen.getByText('Snacks')).toBeInTheDocument()
  })

  it('allows navigating dates with previous and next day buttons', async () => {
    render(<NutritionDashboard />)

    const prevBtn = screen.getByLabelText('Previous day')
    const nextBtn = screen.getByLabelText('Next day')

    await act(async () => {
      fireEvent.click(prevBtn)
    })
    await act(async () => {
      fireEvent.click(nextBtn)
    })
  })
})
