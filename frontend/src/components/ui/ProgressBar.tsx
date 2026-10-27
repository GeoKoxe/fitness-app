import React from 'react'

export type ProgressColor =
  | 'primary'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'calories'
  | 'alert'

export type ProgressSize = 'sm' | 'md' | 'lg'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  color?: ProgressColor
  size?: ProgressSize
  label?: string
  showValue?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  label,
  showValue = false,
  className = '',
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizeClasses: Record<ProgressSize, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }

  const fillColors: Record<ProgressColor, string> = {
    primary: 'bg-midnight dark:bg-darkPeriwinkle',
    protein: 'bg-coral dark:bg-darkCoral',
    carbs: 'bg-butter dark:bg-darkButter',
    fat: 'bg-periwinkle dark:bg-darkPeriwinkle',
    calories: 'bg-midnight dark:bg-[#9BB0EC]',
    alert: 'bg-alert dark:bg-darkAlert',
  }

  return (
    <div className={`w-full space-y-1.5 ${className}`} {...props}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs font-semibold text-ink dark:text-darkInk">
          {label && <span>{label}</span>}
          {showValue && (
            <span className="text-inkMuted dark:text-darkInkMuted font-mono">
              {Math.round(value)} / {max}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        className={`w-full overflow-hidden rounded-full bg-sand/40 dark:bg-darkSurfaceSunken ${sizeClasses[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

