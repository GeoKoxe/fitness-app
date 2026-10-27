import React from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'cta'
  | 'destructive'
  | 'ghost'
  | 'outline'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseClasses =
      'inline-flex items-center justify-center font-semibold rounded-xl transition duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-periwinkle focus:ring-offset-2 focus:ring-offset-canvas dark:focus:ring-offset-darkCanvas'

    // Size variants
    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
    }

    // Color variants grounded in Design Language semantic tokens
    const variantClasses: Record<ButtonVariant, string> = {
      // Primary: Midnight in light, Periwinkle in dark
      primary:
        'bg-midnight hover:bg-[#27355E] text-white dark:bg-darkPeriwinkle dark:hover:bg-[#8A9CD4] dark:text-darkCanvas shadow-2xs',

      // Secondary: Soft Mist wash in light, Dark Mist in dark
      secondary:
        'bg-mist hover:bg-[#C9D4F0] text-midnight border border-sand dark:bg-darkMist dark:hover:bg-[#2E416E] dark:text-darkInk dark:border-darkBorder',

      // CTA / Highlight: Coral with dark Ink text for guaranteed WCAG AA normal text contrast
      cta:
        'bg-coral hover:bg-[#E56367] text-ink dark:bg-darkCoral dark:hover:bg-[#FFA1A4] dark:text-darkCanvas shadow-2xs',

      // Destructive: Crimson Alert
      destructive:
        'bg-alert hover:bg-[#A83B4E] text-white dark:bg-darkAlert dark:hover:bg-[#F07589] dark:text-darkCanvas shadow-2xs',

      // Ghost: Subtle hover fill
      ghost:
        'bg-transparent hover:bg-sand/30 dark:hover:bg-darkBorder/40 text-ink dark:text-darkInk',

      // Outline: Structured Sand border
      outline:
        'bg-transparent border border-sand hover:bg-sand/20 text-ink dark:border-darkBorder dark:hover:bg-darkSurfaceRaised dark:text-darkInk',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'

