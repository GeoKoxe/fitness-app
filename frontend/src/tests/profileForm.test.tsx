import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileForm } from '../features/profile/ProfileForm'

vi.mock('../services/profileService', () => ({
  profileService: {
    createProfile: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        id: 1,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    ),
    updateProfile: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        id: 1,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    ),
  },
}))

describe('ProfileForm', () => {
  it('renders create profile form with all inputs', () => {
    render(<ProfileForm initialProfile={null} onProfileSaved={vi.fn()} />)
    expect(screen.getByText('Create User Profile')).toBeInTheDocument()
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Height \(cm\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Biological Sex/i)).toBeInTheDocument()
  })

  it('validates invalid height range', async () => {
    render(<ProfileForm initialProfile={null} onProfileSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Dimitris' },
    })
    fireEvent.change(screen.getByLabelText(/Height \(cm\)/i), {
      target: { value: '30' }, // Below 50 cm
    })

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Create Profile/i })
      )
    })

    expect(
      await screen.findByText('Height must be between 50 and 260 cm.')
    ).toBeInTheDocument()
  })

  it('submits valid profile data', async () => {
    const handleSaved = vi.fn()
    render(<ProfileForm initialProfile={null} onProfileSaved={handleSaved} />)

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Katerina' },
    })
    fireEvent.change(screen.getByLabelText(/Height \(cm\)/i), {
      target: { value: '168' },
    })

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Create Profile/i })
      )
    })

    await vi.waitFor(() => {
      expect(handleSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Katerina',
          height_cm: 168,
        })
      )
    })
  })
})
