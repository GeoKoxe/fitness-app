import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DailyProgressDashboard } from '../features/nutrition/DailyProgressDashboard'
import { NutritionGoalModal } from '../features/nutrition/NutritionGoalModal'
import { NutritionReportsView } from '../features/nutrition/NutritionReportsView'
import { BodyTrendsChart } from '../features/profile/BodyTrendsChart'
import { measurementService } from '../services/measurementService'
import { nutritionGoalService } from '../services/nutritionGoalService'
import type { DailyMacroTotals } from '../types/nutrition'
import type { GoalEstimate, NutritionGoal } from '../types/nutritionGoal'
import type { NutritionReportResponse } from '../types/nutritionReport'

vi.mock('../services/nutritionGoalService', () => ({
  nutritionGoalService: {
    getGoals: vi.fn(),
    updateGoals: vi.fn(),
    estimateGoals: vi.fn(),
    getReport: vi.fn(),
  },
}))

vi.mock('../services/measurementService', () => ({
  measurementService: {
    listMeasurements: vi.fn(),
  },
}))

describe('Phase 4: Goals, Daily Progress, Trends and Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders DailyProgressDashboard with targets, remaining amounts, and exceeded state', () => {
    const totals: DailyMacroTotals = {
      calories_kcal: 2200,
      protein_g: 155, // over target of 140
      carbs_g: 180, // under target of 200
      fat_g: 60,
      fiber_g: 25,
      sugar_g: 35,
      saturated_fat_g: 15,
      sodium_mg: 1800,
    }

    const goals: NutritionGoal = {
      calories_kcal: 2000,
      protein_g: 140,
      carbs_g: 200,
      fat_g: 65,
      fiber_g: 30,
    }

    render(
      <DailyProgressDashboard
        totals={totals}
        totalEntries={4}
        goals={goals}
        onOpenGoalsModal={vi.fn()}
      />
    )

    // Check main title and calorie target
    expect(screen.getByText('Daily Nutrition Progress')).toBeInTheDocument()
    expect(screen.getByText('2200')).toBeInTheDocument()
    expect(screen.getByText('200 kcal')).toBeInTheDocument() // 2200 - 2000 = 200 kcal over

    // Check Protein exceeded badge
    expect(screen.getByText('+15 g over')).toBeInTheDocument()

    // Check Carbs remaining badge
    expect(screen.getByText('20 g left')).toBeInTheDocument()
  })

  it('allows editing goals and requesting a reference estimate', async () => {
    const mockEstimate: GoalEstimate = {
      calories_kcal: 2150,
      protein_g: 134.4,
      carbs_g: 241.9,
      fat_g: 71.7,
      fiber_g: 30.1,
      bmr_kcal: 1650,
      tdee_kcal: 2150,
      formula_explanation: 'Calculated using Mifflin-St Jeor equation.',
    }

    vi.mocked(nutritionGoalService.estimateGoals).mockResolvedValueOnce(mockEstimate)
    vi.mocked(nutritionGoalService.updateGoals).mockResolvedValueOnce({
      calories_kcal: 2150,
      protein_g: 134.4,
      carbs_g: 241.9,
      fat_g: 71.7,
      fiber_g: 30.1,
    })

    const onGoalsSaved = vi.fn()
    const onClose = vi.fn()

    render(
      <NutritionGoalModal
        currentGoals={{ calories_kcal: 2000 }}
        onGoalsSaved={onGoalsSaved}
        onClose={onClose}
      />
    )

    // Click Calculate Suggestion
    const estimateBtn = screen.getByRole('button', { name: /Calculate Suggestion/i })
    await act(async () => {
      fireEvent.click(estimateBtn)
    })

    expect(await screen.findByText(/Calculated using Mifflin-St Jeor equation/i)).toBeInTheDocument()

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Goals/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(nutritionGoalService.updateGoals).toHaveBeenCalledWith(
      expect.objectContaining({
        calories_kcal: 2150,
      })
    )
    expect(onGoalsSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders historical nutrition reports and period weight change observations', async () => {
    const mockReport: NutritionReportResponse = {
      start_date: '2026-10-18',
      end_date: '2026-10-24',
      total_days: 7,
      days_with_logs: 5,
      days_without_logs: 2,
      avg_calories_kcal: 2100,
      avg_protein_g: 145,
      avg_carbs_g: 210,
      avg_fat_g: 65,
      avg_fiber_g: 28,
      calculation_note: 'Averages calculated across 5 logged days.',
      daily_items: [
        {
          date: '2026-10-18',
          has_logs: true,
          entries_count: 3,
          calories_kcal: 2100,
          protein_g: 145,
          carbs_g: 210,
          fat_g: 65,
        },
      ],
      weight_trend: {
        has_sufficient_data: true,
        measurement_count: 2,
        start_date: '2026-10-18',
        start_weight_kg: 80.5,
        end_date: '2026-10-24',
        end_weight_kg: 79.9,
        weight_change_kg: -0.6,
        disclaimer: 'Weight changes are historical observations without implied causation.',
      },
    }

    vi.mocked(nutritionGoalService.getReport).mockResolvedValueOnce(mockReport)

    render(<NutritionReportsView />)

    expect(await screen.findByText('Historical Nutrition Reports')).toBeInTheDocument()
    expect(await screen.findByText(/\/ 7 days/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/2100/)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('-0.6')).toBeInTheDocument() // Weight change
    expect(screen.getByText(/without implied causation/i)).toBeInTheDocument()
  })

  it('renders BodyTrendsChart with recorded measurements and handles metric switching', async () => {
    const mockMeasurements = {
      items: [
        {
          id: 1,
          user_profile_id: 1,
          measured_at: '2026-10-15T08:00:00Z',
          weight_kg: 81.0,
          body_fat_percentage: 22.0,
          source: 'manual',
          bmi_calculated: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          user_profile_id: 1,
          measured_at: '2026-10-22T08:00:00Z',
          weight_kg: 80.2,
          body_fat_percentage: 21.6,
          source: 'manual',
          bmi_calculated: false,
          created_at: '',
          updated_at: '',
        },
      ],
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    }

    vi.mocked(measurementService.listMeasurements).mockResolvedValueOnce(mockMeasurements)

    render(<BodyTrendsChart />)

    expect(await screen.findByText('Body Measurement Trends')).toBeInTheDocument()
    // Weight latest is 80.2
    expect((await screen.findAllByText(/80.2/)).length).toBeGreaterThanOrEqual(1)
    // Overall change is -0.8
    expect(screen.getByText(/-0.8/)).toBeInTheDocument()

    // Switch metric to Body Fat
    const bodyFatBtn = screen.getByRole('button', { name: 'Body Fat' })
    await act(async () => {
      fireEvent.click(bodyFatBtn)
    })

    expect((await screen.findAllByText(/21.6/)).length).toBeGreaterThanOrEqual(1) // Latest body fat
    expect(screen.getByText(/-0.4/)).toBeInTheDocument() // Body fat change
  })
})
