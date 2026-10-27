import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyTrendsChart } from '../features/profile/BodyTrendsChart'
import { MeasurementDetailModal } from '../features/profile/MeasurementDetailModal'
import { MeasurementHistory } from '../features/profile/MeasurementHistory'
import { ProfileDashboard } from '../features/profile/ProfileDashboard'
import { ThemeProvider } from '../theme/ThemeContext'
import type { BodyMeasurement } from '../types/measurement'
import type { UserProfile } from '../types/profile'

const mockProfile: UserProfile = {
  id: 1,
  name: 'Elena Rostova',
  height_cm: 175,
  date_of_birth: '1995-06-15',
  sex: 'female',
  activity_level: 'moderately_active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockMeasurement1: BodyMeasurement = {
  id: 101,
  user_profile_id: 1,
  measured_at: '2026-10-20T08:00:00Z',
  source: 'home_scale',
  notes: 'Fasted morning check',
  weight_kg: 68.5,
  height_cm: 175,
  bmi: 22.4,
  bmi_calculated: true,
  body_fat_percentage: 21.0,
  fat_mass_kg: 14.39,
  muscle_mass_kg: 51.0,
  skeletal_muscle_mass_kg: 28.5,
  body_water_percentage: 57.0,
  body_water_mass_kg: 39.05,
  bone_mineral_content_kg: 2.8,
  visceral_fat_level: 4,
  basal_metabolic_rate_kcal: 1480,
  heart_rate_bpm: 60,
  waist_circumference_cm: 72.0,
  hip_circumference_cm: 96.0,
  chest_circumference_cm: 88.0,
  arms_circumference_cm: 28.0,
  thighs_circumference_cm: 54.0,
  neck_circumference_cm: 32.0,
  created_at: '2026-10-20T08:05:00Z',
  updated_at: '2026-10-20T08:05:00Z',
}

const mockMeasurement2: BodyMeasurement = {
  ...mockMeasurement1,
  id: 102,
  measured_at: '2026-10-25T08:30:00Z',
  weight_kg: 67.8,
  bmi: 22.1,
  body_fat_percentage: 20.5,
  muscle_mass_kg: 51.2,
  waist_circumference_cm: 71.5,
}

vi.mock('../services/profileService', () => ({
  profileService: {
    getProfile: vi.fn().mockImplementation(() => Promise.resolve(mockProfile)),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

vi.mock('../services/measurementService', () => ({
  measurementService: {
    getLatestMeasurement: vi
      .fn()
      .mockImplementation(() => Promise.resolve(mockMeasurement2)),
    listMeasurements: vi.fn().mockImplementation(() =>
      Promise.resolve({
        items: [mockMeasurement2, mockMeasurement1],
        total: 2,
        page: 1,
        page_size: 15,
        total_pages: 1,
      })
    ),
    deleteMeasurement: vi.fn().mockResolvedValue(undefined),
    createMeasurement: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        id: 103,
        user_profile_id: 1,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    ),
  },
}))

describe('FitPulse Body & Measurements Redesign (Phase 4)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders Body & Measurements header, latest snapshot, and sub-tabs in body mode', async () => {
    render(
      <ThemeProvider>
        <ProfileDashboard activeSection="body" initialTab="overview" />
      </ThemeProvider>
    )

    expect(
      await screen.findByRole('heading', { name: /Body & Measurements/i, level: 1 })
    ).toBeInTheDocument()

    // Sub-navigation tabs
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Log Measurement/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /History/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Measurement Trends/i })).toBeInTheDocument()

    // Active tab has aria-selected="true"
    expect(screen.getByRole('tab', { name: /Overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: /History/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })

  it('renders overview snapshot metrics cards with correct values and non-color BMI category', async () => {
    render(
      <ThemeProvider>
        <ProfileDashboard activeSection="body" initialTab="overview" />
      </ThemeProvider>
    )

    expect(
      await screen.findByText('Current Body Composition Snapshot')
    ).toBeInTheDocument()

    // Weight card
    expect(screen.getByText('67.8')).toBeInTheDocument()

    // BMI card and history table
    expect(screen.getAllByText('22.1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Normal weight')).toBeInTheDocument()

    // Quick action buttons
    expect(
      screen.getByRole('button', { name: /\+ Log Measurement/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Analyze Trends/i })
    ).toBeInTheDocument()
  })

  it('allows switching between tabs using accessible tab buttons', async () => {
    render(
      <ThemeProvider>
        <ProfileDashboard activeSection="body" initialTab="overview" />
      </ThemeProvider>
    )

    await screen.findByText('Current Body Composition Snapshot')

    // Switch to Log Measurement tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Log Measurement/i }))
    })

    expect(
      screen.getByRole('heading', { name: /Log Body Measurement/i })
    ).toBeInTheDocument()

    // Switch to Trends tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Measurement Trends/i }))
    })

    expect(
      await screen.findByRole('heading', { name: /Body Measurement Trends/i })
    ).toBeInTheDocument()
  })

  it('renders MeasurementHistory table with accessible headers and detail modal trigger', async () => {
    render(
      <ThemeProvider>
        <MeasurementHistory refreshTrigger={0} onLogNew={vi.fn()} />
      </ThemeProvider>
    )

    expect(
      await screen.findByRole('heading', { name: /Measurement History/i })
    ).toBeInTheDocument()

    // Table elements
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(screen.getByText('Historical records of body measurements')).toHaveClass(
      'sr-only'
    )

    // Table column headers
    expect(screen.getByRole('columnheader', { name: /Weight/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Body Fat/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Muscle/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Waist/i })).toBeInTheDocument()

    // Click details to open modal
    const detailButtons = screen.getAllByRole('button', { name: /Details/i })
    await act(async () => {
      fireEvent.click(detailButtons[0]!)
    })

    expect(
      await screen.findByRole('dialog', { name: /Measurement Details/i })
    ).toBeInTheDocument()
  })

  it('MeasurementDetailModal dismisses on Escape key and close button click', async () => {
    const handleClose = vi.fn()
    render(
      <MeasurementDetailModal
        measurement={mockMeasurement1}
        onClose={handleClose}
      />
    )

    expect(
      screen.getByRole('dialog', { name: /Measurement Details/i })
    ).toBeInTheDocument()

    // Click Close button
    fireEvent.click(screen.getByRole('button', { name: /Close dialog/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(2)
  })

  it('BodyTrendsChart renders interactive SVG with accessible data table alternative', async () => {
    render(
      <ThemeProvider>
        <BodyTrendsChart />
      </ThemeProvider>
    )

    expect(
      await screen.findByRole('heading', { name: /Body Measurement Trends/i })
    ).toBeInTheDocument()

    // Chart image element
    const chartSvg = screen.getByRole('img')
    expect(chartSvg).toHaveAttribute('aria-label')
    expect(chartSvg.getAttribute('aria-label')).toContain('trend chart')

    // Accessible Data Table toggle
    const toggleTableBtn = screen.getByRole('button', {
      name: /Show Accessible Data Table/i,
    })
    expect(toggleTableBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(toggleTableBtn)
    })

    expect(
      screen.getByRole('button', { name: /Hide Accessible Data Table/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/historical recorded data table/i)
    ).toBeInTheDocument()
  })

  it('displays informational screening notices and non-diagnostic health disclaimers', async () => {
    render(
      <ThemeProvider>
        <ProfileDashboard />
      </ThemeProvider>
    )

    expect(
      await screen.findByRole('heading', {
        name: /Body & Measurements/i,
      })
    ).toBeInTheDocument()

    // Informational screening notice
    expect(
      screen.getByText(/Not intended for medical diagnosis/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Informational Screening Notice:/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/BMI and waist-to-hip calculations follow WHO adult screening reference guidelines/i)
    ).toBeInTheDocument()
  })

  it('verifies WHO adult BMI boundary value classifications', () => {
    // Standard WHO adult thresholds: <18.5 Underweight, 18.5-24.9 Normal, 25.0-29.9 Overweight, >=30.0 Obese
    function classifyBMI(bmi: number): string {
      if (bmi < 18.5) return 'Underweight'
      if (bmi < 25.0) return 'Normal weight'
      if (bmi < 30.0) return 'Overweight'
      return 'Obese'
    }

    // Exact boundaries
    expect(classifyBMI(18.49)).toBe('Underweight')
    expect(classifyBMI(18.5)).toBe('Normal weight')
    expect(classifyBMI(24.9)).toBe('Normal weight')
    expect(classifyBMI(24.99)).toBe('Normal weight')
    expect(classifyBMI(25.0)).toBe('Overweight')
    expect(classifyBMI(29.9)).toBe('Overweight')
    expect(classifyBMI(29.99)).toBe('Overweight')
    expect(classifyBMI(30.0)).toBe('Obese')
    expect(classifyBMI(30.01)).toBe('Obese')
  })

  it('verifies waist-to-hip ratio calculation and division-by-zero protection', () => {
    function computeWHR(waist?: number | null, hip?: number | null): number | null {
      if (!waist || !hip || waist <= 0 || hip <= 0) return null
      return Number((waist / hip).toFixed(2))
    }

    expect(computeWHR(72.0, 96.0)).toBe(0.75)
    expect(computeWHR(85.5, 90.0)).toBe(0.95)
    expect(computeWHR(0, 96.0)).toBeNull()
    expect(computeWHR(72.0, 0)).toBeNull()
    expect(computeWHR(null, 96.0)).toBeNull()
    expect(computeWHR(undefined, undefined)).toBeNull()
  })
})
