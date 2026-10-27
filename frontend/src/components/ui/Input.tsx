import React from 'react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    // Generate IDs for accessibility linking if label is provided
    const generatedId = React.useId()
    const inputId = id || (label ? `input-${generatedId}` : undefined)
    const errorId = error ? `error-${generatedId}` : undefined
    const helperId = helperText ? `helper-${generatedId}` : undefined

    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

    const borderStyle = error
      ? 'border-alert focus:ring-alert'
      : 'border-border-strong dark:border-darkBorder focus:border-periwinkle focus:ring-periwinkle'

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-ink dark:text-darkInk"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-surface dark:bg-darkSurfaceSunken text-ink dark:text-darkInk border ${borderStyle} transition duration-150 placeholder:text-inkSubtle dark:placeholder:text-darkInkSubtle disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-canvas dark:focus:ring-offset-darkCanvas ${className}`}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs font-medium text-alert dark:text-darkAlert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className="text-xs text-inkMuted dark:text-darkInkMuted"
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

