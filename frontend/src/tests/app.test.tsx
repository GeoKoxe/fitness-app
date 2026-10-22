import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'

vi.mock('../services/profileService', () => ({
  profileService: {
    getProfile: vi.fn().mockResolvedValue(null),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

vi.mock('../services/measurementService', () => ({
  measurementService: {
    getLatestMeasurement: vi.fn().mockResolvedValue(null),
    listMeasurements: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 15,
      total_pages: 0,
    }),
  },
}))

vi.mock('../services/mealLogService', () => ({
  mealLogService: {
    getDailySummary: vi.fn().mockResolvedValue({
      logged_date: '2026-10-23',
      totals: { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      by_category: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      total_entries: 0,
    }),
  },
}))

describe('App', () => {
  it('renders application brand and allows navigation between nutrition and measurements', async () => {
    render(<App />)
    expect(screen.getByText('FitPulse')).toBeInTheDocument()
    expect(screen.getByText('Food & Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Body & Measurements')).toBeInTheDocument()

    // Switch to Body & Measurements
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Body & Measurements/i }))
    })

    expect(await screen.findByText('Welcome to Your Fitness Hub')).toBeInTheDocument()
  })
})
