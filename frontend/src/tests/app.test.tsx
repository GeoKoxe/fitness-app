import { render, screen } from '@testing-library/react'
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

describe('App', () => {
  it('renders application brand and Phase 1 banner', async () => {
    render(<App />)
    expect(screen.getByText('FitPulse')).toBeInTheDocument()
    expect(
      screen.getByText('Phase 1: Profile & Measurements')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Welcome to Your Fitness Hub')
    ).toBeInTheDocument()
  })
})
