import React from 'react'

export type CardVariant = 'default' | 'raised' | 'sunken' | 'highlight'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  interactive?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses: Record<CardVariant, string> = {
      default:
        'bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-2xs',
      raised:
        'bg-surfaceRaised dark:bg-darkSurfaceRaised border border-sand dark:border-darkBorder shadow-md',
      sunken:
        'bg-surfaceSunken dark:bg-darkSurfaceSunken border border-border-subtle dark:border-darkBorder/60',
      highlight:
        'bg-surface dark:bg-darkSurface border-2 border-butter dark:border-darkButter shadow-2xs',
    }

    const interactiveClasses = interactive
      ? 'transition duration-150 hover:shadow-xs hover:border-border-strong dark:hover:border-darkBorderStrong cursor-pointer'
      : ''

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-5 text-ink dark:text-darkInk ${variantClasses[variant]} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`flex flex-col space-y-1 mb-4 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3
    className={`text-lg font-bold tracking-tight text-ink dark:text-darkInk ${className}`}
    {...props}
  >
    {children}
  </h3>
)

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className = '', children, ...props }) => (
  <p
    className={`text-xs text-inkMuted dark:text-darkInkMuted ${className}`}
    {...props}
  >
    {children}
  </p>
)

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => <div className={`${className}`} {...props}>{children}</div>

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex items-center justify-between pt-4 mt-4 border-t border-border-subtle dark:border-darkBorder ${className}`}
    {...props}
  >
    {children}
  </div>
)

