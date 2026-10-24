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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
          {pct}% on target ({devStr})
        </span>
      )
    }
    if (pct < 100 - tolerance) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          {pct}% under ({devStr})
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
        {pct}% over ({devStr})
      </span>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Weekly Planned Nutrition</h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Tolerance: &plusmn;{tolerance}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Average daily planned intake compared against your daily nutrition goals.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
          Planned (Not Logged)
        </span>
      </div>

      {/* Unmet Constraints Alert Banner */}
      {visibleConstraints.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <span>⚠️</span>
            <span>Unmet Target Constraints ({visibleConstraints.length})</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            The planner could not strictly satisfy all nutritional targets within your configured &plusmn;{tolerance}% tolerance. Daily totals were constrained from intentionally exceeding the upper limit:
          </p>
          <div className="space-y-1.5 pt-1">
            {visibleConstraints.map((item, idx) => (
              <div
                key={idx}
                className="bg-white/80 p-2.5 rounded-lg border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
              >
                <div>
                  <span className="font-semibold text-slate-800">{item.target_name}: </span>
                  <span className="text-slate-600">
                    Actual <strong>{item.actual_value}</strong> vs Target {item.target_value} (max {item.upper_limit})
                  </span>
                  {item.suggestion && (
                    <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                      💡 {item.suggestion}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'conflict'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : item.status === 'relaxed'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : item.status === 'exceeded'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedWarnings((prev) => new Set([...prev, item.target_name]))
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors text-xs font-bold leading-none"
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Calories */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Calories</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900">{overview.average_daily_calories}</span>
            <span className="text-xs text-slate-500">
              / {overview.target_calories ? `${overview.target_calories} kcal` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(calAdh)}</div>
        </div>

        {/* Protein */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Protein</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-indigo-600">{overview.average_daily_protein}g</span>
            <span className="text-xs text-slate-500">
              / {overview.target_protein ? `${overview.target_protein}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(pAdh)}</div>
        </div>

        {/* Carbs */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Carbs</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-600">{overview.average_daily_carbs}g</span>
            <span className="text-xs text-slate-500">
              / {overview.target_carbs ? `${overview.target_carbs}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(cAdh)}</div>
        </div>

        {/* Fat */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Fat</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-rose-600">{overview.average_daily_fat}g</span>
            <span className="text-xs text-slate-500">
              / {overview.target_fat ? `${overview.target_fat}g` : 'target'}
            </span>
          </div>
          <div className="mt-2">{getAdherenceBadge(fAdh)}</div>
        </div>
      </div>
    </div>
  )
}

