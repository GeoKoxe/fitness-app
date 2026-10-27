import React from 'react'

export type BadgeVariant =
  | 'default'
  | 'highlight'
  | 'coral'
  | 'alert'
  | 'outline'
  | 'neutral'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}) => {
  const sizeClasses: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }

  // Strictly compliant semantic contrast:
  // - Butter & Coral pair with dark Ink text
  // - Alert pairs with white text
  // - Mist pairs with Midnight text
  const variantClasses: Record<BadgeVariant, string> = {
    default:
      'bg-mist text-midnight border border-sand/60 dark:bg-darkMist dark:text-darkInk dark:border-darkBorder',
    highlight:
      'bg-butter text-ink font-bold border border-sand dark:bg-darkButter dark:text-darkCanvas',
    coral:
      'bg-coral text-ink font-bold border border-coral dark:bg-darkCoral dark:text-darkCanvas',
    alert:
      'bg-alert text-white font-bold border border-alert dark:bg-darkAlert dark:text-darkCanvas',
    outline:
      'bg-transparent border border-sand text-ink dark:border-darkBorder dark:text-darkInk',
    neutral:
      'bg-sand text-ink font-semibold dark:bg-darkBorder dark:text-darkInk',
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-full select-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}

