/**
 * FitPulse Theme Infrastructure
 * 
 * Manages light and dark theme switching and persistence.
 * Default is Light mode. Dark mode activates intentionally designed navy surfaces.
 */

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'fitpulse_theme'

/**
 * Safely retrieve the stored theme preference.
 * Defaults strictly to 'light' for missing, empty, or invalid values.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'light'
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark') {
      return 'dark'
    }
    return 'light'
  } catch {
    return 'light'
  }
}

/**
 * Apply the theme class to the document root element.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

/**
 * Persist the theme choice to localStorage and apply it immediately to the DOM.
 */
export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage unavailable or disabled; proceed with applying to DOM
    }
  }
  applyTheme(theme)
}

/**
 * Initialize theme on app bootstrap.
 */
export function initTheme(): ThemeMode {
  const current = getStoredTheme()
  applyTheme(current)
  return current
}

