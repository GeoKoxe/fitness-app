import React from 'react'

interface SkipLinkProps {
  targetId?: string
  className?: string
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId = 'main-content',
  className = '',
}) => {
  return (
    <a
      href={`#${targetId}`}
      className={`sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-midnight focus:text-white dark:focus:bg-darkMidnight dark:focus:text-darkCanvas focus:font-semibold focus:text-sm focus:rounded-xl focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle focus:ring-offset-2 focus:ring-offset-canvas dark:focus:ring-offset-darkCanvas transition-colors motion-reduce:transition-none ${className}`}
    >
      Skip to main content
    </a>
  )
}

