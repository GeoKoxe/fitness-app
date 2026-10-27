import React, { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, setStoredTheme, type ThemeMode } from './theme'

export interface ThemeContextValue {
  theme: ThemeMode
  isDark: boolean
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    setStoredTheme(newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const value: ThemeContextValue = {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to access current theme state and toggler.
 * Can be used within ThemeProvider, or standalone with fallback to direct DOM/storage management.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context) {
    return context
  }

  // Fallback for standalone usage outside ThemeProvider
  const current = getStoredTheme()
  return {
    theme: current,
    isDark: current === 'dark',
    setTheme: (t: ThemeMode) => setStoredTheme(t),
    toggleTheme: () => setStoredTheme(current === 'light' ? 'dark' : 'light'),
  }
}

