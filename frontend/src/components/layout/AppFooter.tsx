import React from 'react'

export const AppFooter: React.FC = () => {
  return (
    <footer className="border-t border-sand dark:border-darkBorder py-6 pb-28 md:pb-6 text-center text-xs text-inkSecondary dark:text-darkInkSecondary bg-surface/40 dark:bg-darkSurface/40 transition-colors motion-reduce:transition-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <span>Personal Health &amp; Fitness Web App (Greece / Metric)</span>
        </div>
        <div>
          <span>Local Data Control • Non-Clinical Consumer Tracking</span>
        </div>
      </div>
    </footer>
  )
}
