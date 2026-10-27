import { useEffect, useState } from 'react'
import type { NutritionReportResponse } from '../../types/nutritionReport'
import { nutritionGoalService } from '../../services/nutritionGoalService'

function formatDateInput(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().split('T')[0]!
}

export type PeriodPreset = '7d' | '14d' | '30d' | 'custom'

export function NutritionReportsView() {
  const [preset, setPreset] = useState<PeriodPreset>('7d')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return formatDateInput(d)
  })
  const [endDate, setEndDate] = useState<string>(() => formatDateInput(new Date()))

  const [report, setReport] = useState<NutritionReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleApplyPreset = (p: PeriodPreset) => {
    setPreset(p)
    const end = new Date()
    const start = new Date()
    if (p === '7d') {
      start.setDate(end.getDate() - 6)
    } else if (p === '14d') {
      start.setDate(end.getDate() - 13)
    } else if (p === '30d') {
      start.setDate(end.getDate() - 29)
    }
    if (p !== 'custom') {
      setStartDate(formatDateInput(start))
      setEndDate(formatDateInput(end))
    }
  }

  const loadReport = async (s: string, e: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await nutritionGoalService.getReport(s, e)
      setReport(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate historical report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport(startDate, endDate)
  }, [startDate, endDate])

  const maxDailyCal = report?.daily_items?.length
    ? Math.max(...report.daily_items.map((i) => i.calories_kcal), 2500)
    : 2500

  return (
    <div className="space-y-6 text-left">
      {/* Top Filter Bar */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors motion-reduce:transition-none">
        <div>
          <h2 className="text-lg font-bold text-ink dark:text-darkInk">
            Historical Nutrition Reports
          </h2>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Aggregated nutrient averages and body weight trend observations over selected periods.
          </p>
        </div>

        {/* Period Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleApplyPreset('7d')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                preset === '7d'
                  ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-2xs'
                  : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('14d')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                preset === '14d'
                  ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-2xs'
                  : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
              }`}
            >
              14 Days
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('30d')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                preset === '30d'
                  ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-2xs'
                  : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
              }`}
            >
              30 Days
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset('custom')
                setStartDate(e.target.value)
              }}
              className="px-2.5 py-1.5 border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-periwinkle"
              aria-label="Report start date"
            />
            <span className="text-inkSecondary dark:text-darkInkSecondary font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset('custom')
                setEndDate(e.target.value)
              }}
              className="px-2.5 py-1.5 border border-sand dark:border-darkBorder rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-periwinkle"
              aria-label="Report end date"
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral rounded-2xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="p-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
          <p className="font-medium">Generating historical report...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Logged Days */}
            <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary">Days Logged</span>
              <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                {report.days_with_logs}{' '}
                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                  / {report.total_days} days
                </span>
              </div>
              <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1">
                {report.days_with_logs === 0
                  ? 'No meal logs in period'
                  : `${Math.round((report.days_with_logs / report.total_days) * 100)}% consistency`}
              </div>
            </div>

            {/* Average Daily Calories */}
            <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary">Avg Daily Calories</span>
              <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                {report.avg_calories_kcal != null ? Math.round(report.avg_calories_kcal) : '--'}{' '}
                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">kcal / day</span>
              </div>
              <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1">
                {report.days_with_logs > 0 ? `Across ${report.days_with_logs} logged days` : 'No data'}
              </div>
            </div>

            {/* Average Macros */}
            <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary">Daily Macro Averages</span>
              <div className="text-xs font-bold text-ink dark:text-darkInk mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-inkSecondary dark:text-darkInkSecondary font-medium">Protein:</span>
                  <span>{report.avg_protein_g != null ? `${report.avg_protein_g} g` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-800 dark:text-darkButter font-medium">Carbs:</span>
                  <span>{report.avg_carbs_g != null ? `${report.avg_carbs_g} g` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-inkSecondary dark:text-darkInkSecondary font-medium">Fat:</span>
                  <span>{report.avg_fat_g != null ? `${report.avg_fat_g} g` : '--'}</span>
                </div>
              </div>
            </div>

            {/* Period Weight Trend Observation */}
            <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary">Weight Trend Observation</span>
              <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                {report.weight_trend.has_sufficient_data && report.weight_trend.weight_change_kg != null ? (
                  <span
                    className={
                      report.weight_trend.weight_change_kg < 0
                        ? 'text-status-success-fg dark:text-emerald-400'
                        : report.weight_trend.weight_change_kg > 0
                        ? 'text-midnight dark:text-darkMidnight'
                        : 'text-ink dark:text-darkInk'
                    }
                  >
                    {report.weight_trend.weight_change_kg > 0
                      ? `+${report.weight_trend.weight_change_kg}`
                      : `${report.weight_trend.weight_change_kg}`}{' '}
                    <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">kg</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-inkSecondary dark:text-darkInkSecondary">
                    {report.weight_trend.measurement_count === 1 ? '1 measurement' : 'No records'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-1">
                {report.weight_trend.has_sufficient_data
                  ? `${report.weight_trend.measurement_count} scale records in range`
                  : 'Needs ≥ 2 scale records'}
              </div>
            </div>
          </div>

          {/* Transparent Calculation & Observational Disclaimers */}
          <div className="p-4 bg-canvas/60 dark:bg-darkCanvas/60 rounded-2xl border border-sand dark:border-darkBorder text-xs space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-bold text-ink dark:text-darkInk">Methodology:</span>
              <span className="text-inkSecondary dark:text-darkInkSecondary">{report.calculation_note}</span>
            </div>
            <div className="flex items-start gap-2 pt-2 border-t border-sand/60 dark:border-darkBorder/60">
              <span className="font-bold text-ink dark:text-darkInk">Clinical Note:</span>
              <span className="text-inkSecondary dark:text-darkInkSecondary">{report.weight_trend.disclaimer}</span>
            </div>
          </div>

          {/* Daily Breakdown Table and Bar Visualization */}
          <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-sand dark:border-darkBorder">
              <h3 className="font-bold text-sm text-ink dark:text-darkInk">
                Daily Breakdown ({report.daily_items.length} days)
              </h3>
            </div>

            <div className="divide-y divide-sand/50 dark:divide-darkBorder/60 max-h-96 overflow-y-auto">
              {report.daily_items.map((day) => {
                const dayDate = new Date(`${day.date}T00:00:00`)
                const dayLabel = dayDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
                const calPct = day.has_logs ? Math.min((day.calories_kcal / maxDailyCal) * 100, 100) : 0

                return (
                  <div key={day.date} className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-canvas/40 dark:hover:bg-darkCanvas/40 transition">
                    <div className="w-40 flex items-center gap-2">
                      <span className="font-semibold text-xs text-ink dark:text-darkInk">
                        {dayLabel}
                      </span>
                      {day.has_logs ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60 font-medium">
                          {day.entries_count} {day.entries_count === 1 ? 'item' : 'items'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-canvas dark:bg-darkCanvas border border-sand/60 dark:border-darkBorder/60 text-inkSecondary dark:text-darkInkSecondary">
                          Empty
                        </span>
                      )}
                    </div>

                    {/* Progress Bar & Calories */}
                    <div className="flex-1 max-w-xs flex items-center gap-3">
                      <div className="w-full bg-sand/60 dark:bg-darkBorder/80 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-midnight dark:bg-darkMidnight h-full rounded-full transition-all duration-200"
                          style={{ width: `${calPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-ink dark:text-darkInk w-16 text-right">
                        {day.has_logs ? `${Math.round(day.calories_kcal)}` : '0'}{' '}
                        <span className="text-[10px] font-normal text-inkSecondary dark:text-darkInkSecondary">kcal</span>
                      </span>
                    </div>

                    {/* Macros breakdown */}
                    <div className="flex items-center gap-3 text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
                      <span>P: {day.has_logs ? day.protein_g : '--'}g</span>
                      <span className="text-amber-800 dark:text-darkButter">C: {day.has_logs ? day.carbs_g : '--'}g</span>
                      <span>F: {day.has_logs ? day.fat_g : '--'}g</span>
                      <span className="hidden sm:inline">
                        Fib: {day.has_logs && day.fiber_g != null ? `${day.fiber_g}g` : '--'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
