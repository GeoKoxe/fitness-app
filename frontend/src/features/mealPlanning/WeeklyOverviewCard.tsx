import { useEffect, useState } from 'react'
import type { WeeklyNutritionOverview } from '../../types/mealPlan'

interface WeeklyOverviewCardProps {
  overview: WeeklyNutritionOverview
}

export function WeeklyOverviewCard({ overview }: WeeklyOverviewCardProps) {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set())

  // Reset dismissed warnings when plan or overview targets change
  useEffect(() => {
    setDismissedWarnings(new Set())
  }, [
    overview.average_daily_calories,
    overview.average_daily_protein,
    overview.constraint_count,
    overview.unmet_constraints?.length,
  ])

  const calAdh = overview.adherence_calories_pct
  const pAdh = overview.adherence_protein_pct
  const cAdh = overview.adherence_carbs_pct
  const fAdh = overview.adherence_fat_pct
  const unmetConstraints = overview.unmet_constraints || []
  const visibleConstraints = unmetConstraints.filter((c) => !dismissedWarnings.has(c.target_name) && !dismissedWarnings.has(`${c.day_number || ''}-${c.target_name}`))
  const metrics = overview.strategy_metrics

  const getAdherenceBadge = (pct: number | null | undefined) => {
    if (pct == null) return null
    const dev = Math.round((pct - 100) * 10) / 10
    const devStr = dev > 0 ? `+${dev}%` : `${dev}%`
    if (Math.abs(pct - 100) <= 5) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-success dark:bg-darkSurface text-status-success-fg dark:text-emerald-400 border border-border-card">
          {pct}% on target ({devStr})
        </span>
      )
    }
    if (pct < 95) {
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

  const renderStatusBadge = () => {
    if (overview.is_successful === true) {
      if ((overview.constraint_count ?? 0) === 0) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Fully Compliant (0 Constraints)
          </span>
        )
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Permitted Single Constraint
        </span>
      )
    }

    if (overview.plan_status === 'best_effort' || (overview.constraint_count ?? 0) > 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Best-Effort Plan ({overview.constraint_count ?? unmetConstraints.length} Unmet)
        </span>
      )
    }

    return null
  }

  return (
    <div className="bg-surface dark:bg-darkSurface rounded-2xl shadow-xs border border-sand dark:border-darkBorder p-5 space-y-4 text-left transition-colors motion-reduce:transition-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sand/70 dark:border-darkBorder/70 gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink dark:text-darkInk">Weekly Planned Nutrition</h3>
            {overview.tolerance_pct != null && (
              <span className="text-[11px] font-semibold text-inkSecondary dark:text-darkInkSecondary bg-canvas dark:bg-darkCanvas border border-sand/70 dark:border-darkBorder px-2.5 py-0.5 rounded-full">
                Tolerance: &plusmn;{overview.tolerance_pct}%
              </span>
            )}
            {renderStatusBadge()}
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Average daily planned intake compared against your daily nutrition goals across 7 days.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60 self-start sm:self-auto">
          Planned (Not Logged)
        </span>
      </div>

      {/* Target Constraints Notification Banner */}
      {visibleConstraints.length > 0 && (
        <div className="p-4 bg-canvas/80 dark:bg-darkCanvas/80 border border-sand dark:border-darkBorder rounded-2xl text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-ink dark:text-darkInk">
              <span>⚠️</span>
              <span>
                Unmet Target Constraints ({visibleConstraints.length})
              </span>
            </div>
            {overview.is_successful && overview.permitted_exception_count === 1 && (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                1 Exception Allowed by Optimization Policy
              </span>
            )}
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary leading-relaxed">
            The optimization engine evaluated all 28 daily macro constraints (Calories, Protein, Carbohydrates, Fat across 7 days):
          </p>
          <div className="space-y-2 pt-1">
            {visibleConstraints.map((item, idx) => {
              const warningKey = `${item.day_number || ''}-${item.target_name}`
              return (
                <div
                  key={idx}
                  className="bg-surface dark:bg-darkSurface p-3 rounded-xl border border-sand dark:border-darkBorder text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      {item.day_number && (
                        <span className="font-bold px-1.5 py-0.5 bg-canvas dark:bg-darkCanvas rounded border border-sand dark:border-darkBorder text-[10px]">
                          Day {item.day_number}
                        </span>
                      )}
                      <span className="font-bold text-ink dark:text-darkInk">{item.target_name}: </span>
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        Actual <strong className="text-ink dark:text-darkInk">{item.actual_value}</strong> vs Target {item.target_value}
                        {item.discrepancy != null && (
                          <span className="text-alert dark:text-darkCoral ml-1 font-semibold">
                            ({item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy})
                          </span>
                        )}
                      </span>
                    </div>
                    {item.explanation && (
                      <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
                        {item.explanation}
                      </div>
                    )}
                    {item.suggestion && (
                      <div className="text-[11px] text-amber-800 dark:text-darkButter font-medium">
                        💡 {item.suggestion}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.is_permitted_exception
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/40'
                          : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/40'
                      }`}
                    >
                      {item.is_permitted_exception ? 'Permitted Exception' : (item.status || 'Constraint')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedWarnings((prev) => new Set([...prev, warningKey]))
                      }}
                      className="p-1 text-inkSecondary hover:text-ink hover:bg-mist/40 dark:hover:bg-darkMist/40 rounded-lg transition text-xs font-bold leading-none cursor-pointer"
                      aria-label={`Dismiss warning for ${item.target_name}`}
                      title={`Dismiss warning for ${item.target_name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Average Daily Targets */}
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

      {/* Strategy Performance Metrics Grid */}
      {metrics && (
        <div className="p-4 bg-canvas/40 dark:bg-darkCanvas/40 border border-sand dark:border-darkBorder rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink dark:text-darkInk uppercase tracking-wider">
              Strategy & Practicality Metrics
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {metrics.target_compliance_rate}% Overall Compliance
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-center">
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Unique Recipes</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.unique_recipes_count}</div>
            </div>
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Unique Items</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.unique_ingredients_count}</div>
            </div>
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Ingredient Reuse</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.ingredient_reuse_score}%</div>
            </div>
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Repetition Rate</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.meal_repetition_rate}%</div>
            </div>
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Est. Cook Time</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.total_cooking_time_minutes} min</div>
            </div>
            <div className="p-2 bg-surface dark:bg-darkSurface rounded-lg border border-sand/80 dark:border-darkBorder/80">
              <div className="text-[10px] uppercase font-semibold text-inkSecondary dark:text-darkInkSecondary">Grocery Items</div>
              <div className="text-sm font-extrabold text-ink dark:text-darkInk mt-0.5">{metrics.shopping_list_item_count}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
