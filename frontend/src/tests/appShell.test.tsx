import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AppFooter, AppHeader, SkipLink } from '../components/layout'
import { ThemeProvider } from '../theme/ThemeContext'

vi.mock('../services/profileService', () => ({
  profileService: {
    getProfile: vi.fn().mockResolvedValue({
      id: 'usr-1',
      name: 'Alex Rider',
      height_cm: 180,
      sex: 'male',
      activity_level: 'moderate',
    }),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

vi.mock('../services/measurementService', () => ({
  measurementService: {
    getLatestMeasurement: vi.fn().mockResolvedValue({
      id: 'm-1',
      measured_at: '2026-10-25T08:00:00Z',
      weight_kg: 78.5,
      bmi: 24.2,
      body_fat_percentage: 16.5,
      muscle_mass_kg: 62.0,
    }),
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
      totals: { calories_kcal: 2100, protein_g: 160, carbs_g: 220, fat_g: 65 },
      by_category: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      total_entries: 0,
    }),
  },
}))

describe('FitPulse App Shell, Responsive Navigation & Theme Integration (Phase 3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  it('renders standard semantic landmarks: header, nav, main, and footer', async () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument() // <header>
    expect(screen.getByRole('navigation', { name: /Main Navigation/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument() // <footer>
  })

  it('includes an accessible skip-to-main-content link pointing to #main-content', () => {
    render(<App />)

    const skipLink = screen.getByRole('link', { name: /Skip to main content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(skipLink).toHaveClass('sr-only')
    expect(skipLink).toHaveClass('focus:not-sr-only')

    const mainElement = screen.getByRole('main')
    expect(mainElement).toHaveAttribute('id', 'main-content')
    expect(mainElement).toHaveAttribute('tabIndex', '-1')
  })

  it('exposes active navigation destination with aria-current="page" and non-color indicator', async () => {
    render(<App />)

    // Initial default section is Food & Nutrition
    const nutritionBtn = screen.getByRole('button', { name: /Food & Nutrition/i })
    const workoutsBtn = screen.getByRole('button', { name: /Workouts/i })
    const bodyBtn = screen.getByRole('button', { name: /Body & Measurements/i })
    const profileBtn = screen.getByRole('button', { name: /Profile/i })

    expect(nutritionBtn).toHaveAttribute('aria-current', 'page')
    expect(workoutsBtn).not.toHaveAttribute('aria-current')
    expect(bodyBtn).not.toHaveAttribute('aria-current')
    expect(profileBtn).not.toHaveAttribute('aria-current')

    // Click Workouts
    await act(async () => {
      fireEvent.click(workoutsBtn)
    })

    expect(workoutsBtn).toHaveAttribute('aria-current', 'page')
    expect(nutritionBtn).not.toHaveAttribute('aria-current')

    // Click Body & Measurements
    await act(async () => {
      fireEvent.click(bodyBtn)
    })

    expect(bodyBtn).toHaveAttribute('aria-current', 'page')
    expect(workoutsBtn).not.toHaveAttribute('aria-current')

    // Click Profile
    await act(async () => {
      fireEvent.click(profileBtn)
    })

    expect(profileBtn).toHaveAttribute('aria-current', 'page')
    expect(bodyBtn).not.toHaveAttribute('aria-current')
  })

  it('ensures touch targets satisfy minimum 44px height for mobile accessibility', () => {
    render(<App />)

    const navButtons = screen.getAllByRole('button', {
      name: /Food & Nutrition|Workouts|Body & Measurements|Profile/i,
    })

    expect(navButtons.length).toBe(4)
    navButtons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[48px\]/)
    })
  })

  it('integrates ThemeToggle into header and switches theme dynamically across shell', async () => {
    render(<App />)

    const themeToggle = screen.getByRole('button', { name: /Switch to dark theme/i })
    expect(themeToggle).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Switch to dark mode
    await act(async () => {
      fireEvent.click(themeToggle)
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem('fitpulse_theme')).toBe('dark')
    expect(
      screen.getByRole('button', { name: /Switch to light theme/i })
    ).toBeInTheDocument()

    // Switch back to light mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Switch to light theme/i }))
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('fitpulse_theme')).toBe('light')
  })

  it('renders AppFooter with regulatory notices and local privacy text', () => {
    render(<AppFooter />)

    expect(screen.getByText(/Personal Health & Fitness Web App \(Greece \/ Metric\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Local Data Control • Non-Clinical Consumer Tracking/i)).toBeInTheDocument()
  })

  it('renders SkipLink component in isolation and verifies focus styles', () => {
    render(<SkipLink />)

    const link = screen.getByRole('link', { name: /Skip to main content/i })
    expect(link).toHaveAttribute('href', '#main-content')
    expect(link.className).toContain('focus:ring-2')
    expect(link.className).toContain('focus:ring-periwinkle')
  })

  it('supports navigation callback via AppHeader component directly', () => {
    const handleSelect = vi.fn()
    render(
      <ThemeProvider>
        <AppHeader activeSection="nutrition" onSelectSection={handleSelect} />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Workouts/i }))
    expect(handleSelect).toHaveBeenCalledWith('workouts')

    fireEvent.click(screen.getByRole('button', { name: /Body & Measurements/i }))
    expect(handleSelect).toHaveBeenCalledWith('body')

    fireEvent.click(screen.getByRole('button', { name: /Profile/i }))
    expect(handleSelect).toHaveBeenCalledWith('profile')
  })
})

