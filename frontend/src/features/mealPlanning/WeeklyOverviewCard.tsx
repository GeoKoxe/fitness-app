import { useEffect, useState } from 'react'
import type { WeeklyNutritionOverview } from '../../types/mealPlan'

interface WeeklyOverviewCardProps {
  overview: WeeklyNutritionOverview
}

export function WeeklyOverviewCard({ overview }: WeeklyOverviewCardProps) {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set())

  // Reset dismissed warnings when plan or overview targets/adherence change
  useEffect(() => {
    setDismissedWarnings(new Set())
  }, [
    overview.average_daily_calories,
    overview.average_daily_protein,
    overview.tolerance_pct,
    overview.unmet_constraints?.length,
  ])

  const calAdh = overview.adherence_calories_pct
  const pAdh = overview.adherence_protein_pct
  const cAdh = overview.adherence_carbs_pct
  const fAdh = overview.adherence_fat_pct
  const tolerance = overview.tolerance_pct ?? 10
  const unmetConstraints = overview.unmet_constraints || []
  const visibleConstraints = unmetConstraints.filter((c) => !dismissedWarnings.has(c.target_name))

  const getAdherenceBadge = (pct: number | null | undefined) => {
    if (pct == null) return null
    const dev = Math.round((pct - 100) * 10) / 10
    const devStr = dev > 0 ? `+${dev}%` : `${dev}%`
    if (pct >= 100 - tolerance && pct <= 100 + tolerance) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-success dark:bg-darkSurface text-status-success-fg dark:text-emerald-400 border border-border-card">
          {pct}% on target ({devStr})
        </span>
      )
    }
    if (pct < 100 - tolerance) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border border-amber-300 dark:border-darkButter/40">
          {pct}% under ({devStr})
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-border-card">
        {pct}% over ({devStr})
      </span>
    )
  }

  return (
    <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xs border border-sand dark:border-darkBorder p-5 space-y-4 text-left transition-colors motion-reduce:transition-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sand/70 dark:border-darkBorder/70 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink dark:text-darkInk">Weekly Planned Nutrition</h3>
            <span className="text-[11px] font-semibold text-inkSecondary dark:text-darkInkSecondary bg-canvas dark:bg-darkCanvas border border-sand/70 dark:border-darkBorder px-2.5 py-0.5 rounded-full">
              Tolerance: &plusmn;{tolerance}%
            </span>
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Average daily planned intake compared against your daily nutrition goals.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60 self-start sm:self-auto">
          Planned (Not Logged)
        </span>
      </div>

      {/* Unmet Constraints Alert Banner */}
      {visibleConstraints.length > 0 && (
        <div className="p-4 bg-canvas/80 dark:bg-darkCanvas/80 border border-sand dark:border-darkBorder rounded-2xl text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-ink dark:text-darkInk">
            <span>⚠️</span>
            <span>Unmet Target Constraints ({visibleConstraints.length})</span>
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary leading-relaxed">
            The planner could not strictly satisfy all nutritional targets within your configured &plusmn;{tolerance}% tolerance. Daily totals were constrained from intentionally exceeding the upper limit:
          </p>
          <div className="space-y-2 pt-1">
            {visibleConstraints.map((item, idx) => (
              <div
                key={idx}
                className="bg-surface dark:bg-darkSurface p-3 rounded-xl border border-sand dark:border-darkBorder text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-ink dark:text-darkInk">{item.target_name}: </span>
                  <span className="text-inkSecondary dark:text-darkInkSecondary">
                    Actual <strong className="text-ink dark:text-darkInk">{item.actual_value}</strong> vs Target {item.target_value} (max {item.upper_limit})
                  </span>
                  {item.suggestion && (
                    <div className="text-[11px] text-amber-800 dark:text-darkButter mt-0.5 font-medium">
                      💡 {item.suggestion}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'conflict' || item.status === 'exceeded'
                        ? 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-alert/30 dark:border-darkCoral/30'
                        : 'bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border border-amber-300 dark:border-darkButter/40'
                    }`}
                  >
                    {item.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedWarnings((prev) => new Set([...prev, item.target_name]))
                    }}
                    className="p-1 text-inkSecondary hover:text-ink hover:bg-mist/40 dark:hover:bg-darkMist/40 rounded-lg transition text-xs font-bold leading-none cursor-pointer"
                    aria-label={`Dismiss warning for ${item.target_name}`}
                    title={`Dismiss warning for ${item.target_name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Calories */}
        <div className="bg-canvas/70 dark:bg-darkCanvas/70 rounded-xl p-3.5 border border-sand dark:border-darkBorder">
          <div className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary uppercase tracking-wide">Avg Calories</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-ink dark:text-darkInk">{overview.average_daily_calories}</span>
            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
              / {overview.target_calories ? `${overview.target_calories} kcal` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(calAdh)}</div>
        </div>

        {/* Protein */}
        <div className="bg-canvas/70 dark:bg-darkCanvas/70 rounded-xl p-3.5 border border-sand dark:border-darkBorder">
          <div className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary uppercase tracking-wide">Avg Protein</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-ink dark:text-darkInk">{overview.average_daily_protein}g</span>
            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
              / {overview.target_protein ? `${overview.target_protein}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(pAdh)}</div>
        </div>

        {/* Carbs */}
        <div className="bg-canvas/70 dark:bg-darkCanvas/70 rounded-xl p-3.5 border border-sand dark:border-darkBorder">
          <div className="text-xs font-semibold text-amber-800 dark:text-darkButter uppercase tracking-wide">Avg Carbs</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-ink dark:text-darkInk">{overview.average_daily_carbs}g</span>
            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
              / {overview.target_carbs ? `${overview.target_carbs}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(cAdh)}</div>
        </div>

        {/* Fat */}
        <div className="bg-canvas/70 dark:bg-darkCanvas/70 rounded-xl p-3.5 border border-sand dark:border-darkBorder">
          <div className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary uppercase tracking-wide">Avg Fat</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-ink dark:text-darkInk">{overview.average_daily_fat}g</span>
            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
              / {overview.target_fat ? `${overview.target_fat}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(fAdh)}</div>
        </div>
      </div>
    </div>
  )
}
