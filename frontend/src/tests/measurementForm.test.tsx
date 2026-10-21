import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MeasurementForm } from '../features/profile/MeasurementForm'
import type { UserProfile } from '../types/profile'

const mockProfile: UserProfile = {
  id: 1,
  name: 'Panos',
  height_cm: 180,
  date_of_birth: '1992-04-10',
  sex: 'male',
  activity_level: 'moderately_active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

vi.mock('../services/measurementService', () => ({
  measurementService: {
    createMeasurement: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        id: 10,
        user_profile_id: 1,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    ),
  },
}))

describe('MeasurementForm', () => {
  it('renders form and displays live BMI calculation when weight is entered', async () => {
    render(
      <MeasurementForm
        userProfile={mockProfile}
        onMeasurementSaved={vi.fn()}
      />
    )

    // Pre-populated height from profile is 180 cm
    expect(screen.getByLabelText(/Height \(cm\)/i)).toHaveValue(180)

    // Enter 81 kg -> BMI should be 81 / (1.8^2) = 25.0
    fireEvent.change(screen.getByLabelText(/Weight \(kg\)/i), {
      target: { value: '81' },
    })

    expect(await screen.findByText(/BMI Preview:/i)).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('(Overweight)')).toBeInTheDocument()
  })

  it('shows error if no metrics are provided', async () => {
    // Profile with no height
    const profileNoHeight: UserProfile = {
      ...mockProfile,
      height_cm: null,
    }
    render(
      <MeasurementForm
        userProfile={profileNoHeight}
        onMeasurementSaved={vi.fn()}
      />
    )

    // Clear any input and click save
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Save Measurement/i })
      )
    })

    expect(
      await screen.findByText(
        'Please enter at least one measurement (e.g. weight, waist circumference).'
      )
    ).toBeInTheDocument()
  })

  it('submits valid measurement', async () => {
    const handleSaved = vi.fn()
    render(
      <MeasurementForm
        userProfile={mockProfile}
        onMeasurementSaved={handleSaved}
      />
    )

    fireEvent.change(screen.getByLabelText(/Weight \(kg\)/i), {
      target: { value: '75.5' },
    })

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Save Measurement/i })
      )
    })

    await vi.waitFor(() => {
      expect(handleSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          weight_kg: 75.5,
          user_profile_id: 1,
        })
      )
    })
  })
})
