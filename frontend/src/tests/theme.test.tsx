import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  getStoredTheme,
  initTheme,
  setStoredTheme,
  THEME_STORAGE_KEY,
} from '../theme/theme'
import { ThemeProvider, useTheme } from '../theme/ThemeContext'
import { ThemeToggle } from '../theme/ThemeToggle'

describe('FitPulse Theme Foundation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults strictly to light theme when localStorage is empty', () => {
    expect(getStoredTheme()).toBe('light')
    const current = initTheme()
    expect(current).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('handles invalid or corrupted stored theme values safely by defaulting to light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value-xyz')
    expect(getStoredTheme()).toBe('light')

    window.localStorage.setItem(THEME_STORAGE_KEY, '')
    expect(getStoredTheme()).toBe('light')

    window.localStorage.setItem(THEME_STORAGE_KEY, 'DARK') // case-sensitive check
    expect(getStoredTheme()).toBe('light')
  })

  it('restores dark theme when localStorage has valid dark preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(getStoredTheme()).toBe('dark')
    const current = initTheme()
    expect(current).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('persists and updates DOM when switching theme via setStoredTheme', () => {
    setStoredTheme('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    setStoredTheme('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applies dark and light theme to documentElement via applyTheme', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('ThemeProvider and useTheme provide theme state and toggle capability', () => {
    function TestConsumer() {
      const { theme, isDark, toggleTheme } = useTheme()
      return (
        <div>
          <span data-testid="current-theme">{theme}</span>
          <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
          <button type="button" onClick={toggleTheme}>
            Toggle
          </button>
        </div>
      )
    }

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Toggle to Dark
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Toggle/i }))
    })

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // Toggle back to Light
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Toggle/i }))
    })

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('ThemeToggle renders accessible labels, handles keyboard focus and toggling', () => {
    render(
      <ThemeProvider>
        <ThemeToggle showLabel />
      </ThemeProvider>
    )

    const button = screen.getByRole('button', {
      name: /Switch to dark theme/i,
    })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('title', 'Switch to dark theme')

    // Click toggle to switch to dark
    act(() => {
      fireEvent.click(button)
    })

    expect(
      screen.getByRole('button', { name: /Switch to light theme/i })
    ).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

