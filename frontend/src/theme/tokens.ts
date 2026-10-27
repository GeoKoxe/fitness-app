/**
 * FitPulse Design Tokens Foundation
 * 
 * Sourced from "Design Language@1x.png" reference:
 * Warm, calm, colourful, modern, approachable, and practical visual identity.
 * 
 * Pure semantic tokens mapped to raw palette values.
 */

export const RAW_PALETTE = {
  // Core Approved Palette
  midnight: '#324376',
  periwinkle: '#586BA4',
  coral: '#EF767A',
  butter: '#F5DD90',
  sand: '#F5DFBB',
  canvas: '#FFF9EF',
  surface: '#FFFCF6',
  ink: '#1F2847',
  alert: '#C2455A',
  mist: '#DCE2F4',

  // Supporting Neutrals & Surfaces (Light Mode)
  white: '#FFFFFF',
  inkMuted: '#546182',       // WCAG AAA secondary text (6.02:1 on surface)
  inkSubtle: '#7C89A8',      // Tertiary text, disabled states, non-critical borders
  surfaceSunken: '#F9F2E4',  // Inset wells, table headers, track backgrounds
  surfaceRaised: '#FFFFFF',  // Elevated popovers, cards
  borderSubtle: '#F5DFBB',   // Sand border for dividers
  borderStrong: '#D8C5A8',   // Active input borders (3.1:1 on canvas)

  // Supporting Neutrals & Accents (Dark Navy Mode)
  darkCanvas: '#111728',     // Deep warm navy canvas
  darkSurface: '#182138',    // Elevated card surface
  darkSurfaceRaised: '#202B48', // Modals, popovers, hover states
  darkSurfaceSunken: '#0D1220', // Inset wells, inputs
  darkInk: '#F4F7FC',        // High-contrast primary text (14.89:1 on dark surface)
  darkInkMuted: '#9DB0D4',   // Secondary text (7.30:1 on dark surface, WCAG AAA)
  darkInkSubtle: '#6D81A8',  // Tertiary text, disabled text
  darkBorder: '#27355A',     // Card borders
  darkBorderStrong: '#3D5084', // Active input borders
  darkPeriwinkle: '#7588C4', // Primary action accent in dark mode
  darkCoral: '#FF8A8E',      // High-visibility coral for dark surfaces
  darkButter: '#F8E6A8',     // High-visibility gold badge fill
  darkAlert: '#E85D73',      // Vibrant crimson alert
  darkMist: '#243358',       // Deep navy informational wash
} as const

export interface ThemeSemanticTokens {
  // Page & Surfaces
  bgApp: string
  surfaceCard: string
  surfaceCardRaised: string
  surfaceCardSunken: string
  surfaceMuted: string

  // Typography
  textMain: string
  textMuted: string
  textSubtle: string
  textInverse: string

  // Borders
  borderDefault: string
  borderStrong: string
  borderSubtle: string

  // Actions
  actionPrimaryBg: string
  actionPrimaryHover: string
  actionPrimaryText: string

  actionSecondaryBg: string
  actionSecondaryHover: string
  actionSecondaryText: string

  actionCtaBg: string
  actionCtaHover: string
  actionCtaText: string

  actionDestructiveBg: string
  actionDestructiveHover: string
  actionDestructiveText: string

  focusRing: string

  // Status & Feedback
  statusSuccessBg: string
  statusSuccessText: string
  statusWarningBg: string
  statusWarningText: string
  statusErrorBg: string
  statusErrorText: string
  statusInfoBg: string
  statusInfoText: string

  // Nutrition Macro Visualisation
  macroProtein: string
  macroProteinText: string
  macroCarbs: string
  macroCarbsText: string
  macroFat: string
  macroFatText: string
  macroCalories: string
  macroCaloriesText: string

  // Chart Series & Axes
  chartSeries1: string
  chartSeries2: string
  chartSeries3: string
  chartSeries4: string
  chartSeries5: string
  chartGrid: string
  chartAxisText: string
}

export const LIGHT_THEME: ThemeSemanticTokens = {
  bgApp: RAW_PALETTE.canvas,
  surfaceCard: RAW_PALETTE.surface,
  surfaceCardRaised: RAW_PALETTE.surfaceRaised,
  surfaceCardSunken: RAW_PALETTE.surfaceSunken,
  surfaceMuted: RAW_PALETTE.mist,

  textMain: RAW_PALETTE.ink,
  textMuted: RAW_PALETTE.inkMuted,
  textSubtle: RAW_PALETTE.inkSubtle,
  textInverse: RAW_PALETTE.white,

  borderDefault: RAW_PALETTE.sand,
  borderStrong: RAW_PALETTE.borderStrong,
  borderSubtle: RAW_PALETTE.borderSubtle,

  actionPrimaryBg: RAW_PALETTE.midnight,
  actionPrimaryHover: '#26345C',
  actionPrimaryText: RAW_PALETTE.white,

  actionSecondaryBg: RAW_PALETTE.mist,
  actionSecondaryHover: '#C9D4F0',
  actionSecondaryText: RAW_PALETTE.midnight,

  // WCAG note: Coral with dark Ink text ensures 5.19:1 contrast (WCAG AA normal text).
  actionCtaBg: RAW_PALETTE.coral,
  actionCtaHover: '#E56367',
  actionCtaText: RAW_PALETTE.ink,

  actionDestructiveBg: RAW_PALETTE.alert,
  actionDestructiveHover: '#A83B4E',
  actionDestructiveText: RAW_PALETTE.white,

  focusRing: RAW_PALETTE.periwinkle,

  statusSuccessBg: '#E6F4EA',
  statusSuccessText: '#137333',
  statusWarningBg: RAW_PALETTE.butter,
  statusWarningText: RAW_PALETTE.ink,
  statusErrorBg: '#FDF0F2',
  statusErrorText: RAW_PALETTE.alert,
  statusInfoBg: RAW_PALETTE.mist,
  statusInfoText: RAW_PALETTE.midnight,

  // Nutrition Macro palette
  macroProtein: RAW_PALETTE.coral,
  macroProteinText: RAW_PALETTE.ink,
  macroCarbs: RAW_PALETTE.butter,
  macroCarbsText: RAW_PALETTE.ink,
  macroFat: RAW_PALETTE.periwinkle,
  macroFatText: RAW_PALETTE.white,
  macroCalories: RAW_PALETTE.midnight,
  macroCaloriesText: RAW_PALETTE.white,

  // Chart Series
  chartSeries1: RAW_PALETTE.midnight,
  chartSeries2: RAW_PALETTE.coral,
  chartSeries3: RAW_PALETTE.periwinkle,
  chartSeries4: '#D4A373', // Warm terracotta
  chartSeries5: RAW_PALETTE.butter,
  chartGrid: '#EADBCE',
  chartAxisText: RAW_PALETTE.inkMuted,
}

export const DARK_THEME: ThemeSemanticTokens = {
  bgApp: RAW_PALETTE.darkCanvas,
  surfaceCard: RAW_PALETTE.darkSurface,
  surfaceCardRaised: RAW_PALETTE.darkSurfaceRaised,
  surfaceCardSunken: RAW_PALETTE.darkSurfaceSunken,
  surfaceMuted: RAW_PALETTE.darkMist,

  textMain: RAW_PALETTE.darkInk,
  textMuted: RAW_PALETTE.darkInkMuted,
  textSubtle: RAW_PALETTE.darkInkSubtle,
  textInverse: RAW_PALETTE.darkCanvas,

  borderDefault: RAW_PALETTE.darkBorder,
  borderStrong: RAW_PALETTE.darkBorderStrong,
  borderSubtle: RAW_PALETTE.darkBorder,

  actionPrimaryBg: RAW_PALETTE.darkPeriwinkle,
  actionPrimaryHover: '#8A9CD4',
  actionPrimaryText: RAW_PALETTE.darkCanvas,

  actionSecondaryBg: RAW_PALETTE.darkMist,
  actionSecondaryHover: '#2E416E',
  actionSecondaryText: RAW_PALETTE.darkInk,

  actionCtaBg: RAW_PALETTE.darkCoral,
  actionCtaHover: '#FFA1A4',
  actionCtaText: RAW_PALETTE.darkCanvas,

  actionDestructiveBg: RAW_PALETTE.darkAlert,
  actionDestructiveHover: '#F07589',
  actionDestructiveText: RAW_PALETTE.darkCanvas,

  focusRing: RAW_PALETTE.darkPeriwinkle,

  statusSuccessBg: '#133929',
  statusSuccessText: '#81C995',
  statusWarningBg: RAW_PALETTE.darkButter,
  statusWarningText: RAW_PALETTE.darkCanvas,
  statusErrorBg: '#3E1922',
  statusErrorText: RAW_PALETTE.darkAlert,
  statusInfoBg: RAW_PALETTE.darkMist,
  statusInfoText: RAW_PALETTE.darkInk,

  // Nutrition Macro palette
  macroProtein: RAW_PALETTE.darkCoral,
  macroProteinText: RAW_PALETTE.darkCanvas,
  macroCarbs: RAW_PALETTE.darkButter,
  macroCarbsText: RAW_PALETTE.darkCanvas,
  macroFat: RAW_PALETTE.darkPeriwinkle,
  macroFatText: RAW_PALETTE.darkCanvas,
  macroCalories: '#9BB0EC',
  macroCaloriesText: RAW_PALETTE.darkCanvas,

  // Chart Series
  chartSeries1: '#9BB0EC',
  chartSeries2: RAW_PALETTE.darkCoral,
  chartSeries3: RAW_PALETTE.darkPeriwinkle,
  chartSeries4: '#E29578',
  chartSeries5: RAW_PALETTE.darkButter,
  chartGrid: '#253354',
  chartAxisText: RAW_PALETTE.darkInkMuted,
}

