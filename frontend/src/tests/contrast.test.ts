import { describe, expect, it } from 'vitest'
import { RAW_PALETTE } from '../theme/tokens'

/**
 * Convert standard hex string to [r, g, b] (0..255)
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/**
 * Convert sRGB 8-bit channel to linear light value (IEC 61966-2-1)
 */
function srgbToLinear(val: number): number {
  const norm = val / 255
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4)
}

/**
 * Compute relative luminance according to WCAG 2.1 specification
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  )
}

/**
 * Compute contrast ratio between two hex colors (1.0 to 21.0)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1)
  const lum2 = getRelativeLuminance(hex2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('FitPulse Design Token Contrast (WCAG 2.1 AA Compliance)', () => {
  describe('Light Theme Core Semantic Pairs', () => {
    it('primary body text (Ink) exceeds WCAG AAA (>= 7:1) on Canvas and Surface', () => {
      const onCanvas = getContrastRatio(RAW_PALETTE.ink, RAW_PALETTE.canvas)
      const onSurface = getContrastRatio(RAW_PALETTE.ink, RAW_PALETTE.surface)

      expect(onCanvas).toBeGreaterThanOrEqual(7.0) // ~13.80:1
      expect(onSurface).toBeGreaterThanOrEqual(7.0) // ~14.12:1
    })

    it('headings and primary actions (Midnight) exceed WCAG AAA on Canvas and Surface', () => {
      const onCanvas = getContrastRatio(RAW_PALETTE.midnight, RAW_PALETTE.canvas)
      const onSurface = getContrastRatio(RAW_PALETTE.midnight, RAW_PALETTE.surface)

      expect(onCanvas).toBeGreaterThanOrEqual(7.0) // ~9.11:1
      expect(onSurface).toBeGreaterThanOrEqual(7.0) // ~9.32:1
    })

    it('primary button (White on Midnight) exceeds WCAG AAA (>= 7:1)', () => {
      const ratio = getContrastRatio(RAW_PALETTE.white, RAW_PALETTE.midnight)
      expect(ratio).toBeGreaterThanOrEqual(7.0) // ~9.55:1
    })

    it('secondary action (Midnight on Mist) exceeds WCAG AAA (>= 7:1)', () => {
      const ratio = getContrastRatio(RAW_PALETTE.midnight, RAW_PALETTE.mist)
      expect(ratio).toBeGreaterThanOrEqual(7.0) // ~7.38:1
    })

    it('supporting secondary text (Ink Muted) meets WCAG AA normal text (>= 4.5:1)', () => {
      const ratio = getContrastRatio(RAW_PALETTE.inkMuted, RAW_PALETTE.surface)
      expect(ratio).toBeGreaterThanOrEqual(4.5) // ~6.02:1
    })

    it('alert text and destructive buttons meet WCAG AA normal text (>= 4.5:1)', () => {
      const whiteOnAlert = getContrastRatio(RAW_PALETTE.white, RAW_PALETTE.alert)
      expect(whiteOnAlert).toBeGreaterThanOrEqual(4.5) // ~4.89:1
    })

    it('highlights on Butter and Sand strictly pair with dark Ink text (>= 4.5:1)', () => {
      const inkOnButter = getContrastRatio(RAW_PALETTE.ink, RAW_PALETTE.butter)
      const inkOnSand = getContrastRatio(RAW_PALETTE.ink, RAW_PALETTE.sand)

      expect(inkOnButter).toBeGreaterThanOrEqual(7.0) // ~10.76:1 (AAA)
      expect(inkOnSand).toBeGreaterThanOrEqual(7.0) // ~11.12:1 (AAA)
    })

    it('documents that White text on Butter and Coral FAILS normal text contrast, proving dark text requirement', () => {
      const whiteOnButter = getContrastRatio(RAW_PALETTE.white, RAW_PALETTE.butter)
      const whiteOnCoral = getContrastRatio(RAW_PALETTE.white, RAW_PALETTE.coral)

      // Both fail 4.5:1 normal text threshold
      expect(whiteOnButter).toBeLessThan(4.5) // ~1.34:1
      expect(whiteOnCoral).toBeLessThan(4.5) // ~2.78:1

      // Conversely, dark Ink on Coral passes WCAG AA normal text
      const inkOnCoral = getContrastRatio(RAW_PALETTE.ink, RAW_PALETTE.coral)
      expect(inkOnCoral).toBeGreaterThanOrEqual(4.5) // ~5.19:1
    })
  })

  describe('Dark Navy Theme Core Semantic Pairs', () => {
    it('dark primary text (Dark Ink) exceeds WCAG AAA (>= 7:1) on Dark Canvas and Surface', () => {
      const onCanvas = getContrastRatio(RAW_PALETTE.darkInk, RAW_PALETTE.darkCanvas)
      const onSurface = getContrastRatio(RAW_PALETTE.darkInk, RAW_PALETTE.darkSurface)

      expect(onCanvas).toBeGreaterThanOrEqual(7.0) // ~16.62:1
      expect(onSurface).toBeGreaterThanOrEqual(7.0) // ~14.89:1
    })

    it('dark secondary text (Dark Ink Muted) exceeds WCAG AAA (>= 7:1) on Dark Surface', () => {
      const ratio = getContrastRatio(
        RAW_PALETTE.darkInkMuted,
        RAW_PALETTE.darkSurface
      )
      expect(ratio).toBeGreaterThanOrEqual(7.0) // ~7.30:1
    })

    it('dark badges (Dark Butter and Dark Coral) pair with dark canvas text (>= 7:1)', () => {
      const onButter = getContrastRatio(
        RAW_PALETTE.darkCanvas,
        RAW_PALETTE.darkButter
      )
      const onCoral = getContrastRatio(
        RAW_PALETTE.darkCanvas,
        RAW_PALETTE.darkCoral
      )

      expect(onButter).toBeGreaterThanOrEqual(7.0) // ~14.34:1
      expect(onCoral).toBeGreaterThanOrEqual(7.0) // ~7.88:1
    })
  })

  describe('Redesigned Body & Measurements Component Pairs (Actual Component Colors)', () => {
    // Exact colors rendered in ProfileDashboard, MeasurementForm, MeasurementHistory, DetailModal
    const LIGHT_SURFACE = '#FFFCF6'
    const LIGHT_CANVAS = '#FFF9EF'
    const DARK_SURFACE = '#182138'
    const DARK_CANVAS = '#111728'

    const TEXT_PRIMARY_LIGHT = '#1F2847'
    const TEXT_SECONDARY_LIGHT = '#546182'
    const TEXT_SUCCESS_LIGHT = '#137333'
    const TEXT_WARNING_LIGHT = '#92400E' // amber-800
    const TEXT_ALERT_LIGHT = '#C2455A'
    const ACTION_MIDNIGHT_LIGHT = '#324376'

    const TEXT_PRIMARY_DARK = '#F4F7FC'
    const TEXT_SECONDARY_DARK = '#9DB0D4'
    const TEXT_SUCCESS_DARK = '#34D399' // emerald-400
    const TEXT_WARNING_DARK = '#F8E6A8' // darkButter
    const TEXT_ALERT_DARK = '#FF8A8E' // darkCoral
    const ACTION_MIDNIGHT_DARK = '#7588C4' // darkMidnight

    it('verifies all Light Theme component foregrounds exceed WCAG AA (>= 4.5:1) on Surface & Canvas', () => {
      // Primary text
      expect(getContrastRatio(TEXT_PRIMARY_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_PRIMARY_LIGHT, LIGHT_CANVAS)).toBeGreaterThanOrEqual(4.5)

      // Secondary text (dates, units, sub-labels)
      expect(getContrastRatio(TEXT_SECONDARY_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_SECONDARY_LIGHT, LIGHT_CANVAS)).toBeGreaterThanOrEqual(4.5)

      // Category indicators: Normal weight, Overweight/Underweight, Obese
      expect(getContrastRatio(TEXT_SUCCESS_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_WARNING_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_ALERT_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)

      // Interactive link / action buttons
      expect(getContrastRatio(ACTION_MIDNIGHT_LIGHT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(ACTION_MIDNIGHT_LIGHT, LIGHT_CANVAS)).toBeGreaterThanOrEqual(4.5)
    })

    it('verifies all Dark Navy component foregrounds exceed WCAG AA (>= 4.5:1) on Dark Surface & Dark Canvas', () => {
      // Primary text
      expect(getContrastRatio(TEXT_PRIMARY_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_PRIMARY_DARK, DARK_CANVAS)).toBeGreaterThanOrEqual(4.5)

      // Secondary text
      expect(getContrastRatio(TEXT_SECONDARY_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_SECONDARY_DARK, DARK_CANVAS)).toBeGreaterThanOrEqual(4.5)

      // Category indicators
      expect(getContrastRatio(TEXT_SUCCESS_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_WARNING_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(TEXT_ALERT_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)

      // Interactive links
      expect(getContrastRatio(ACTION_MIDNIGHT_DARK, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(ACTION_MIDNIGHT_DARK, DARK_CANVAS)).toBeGreaterThanOrEqual(4.5)
    })
  })
})

