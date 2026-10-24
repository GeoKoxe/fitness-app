import { useEffect, useState } from 'react'
import type { NutritionReportResponse } from '../../types/nutritionReport'
import { nutritionGoalService } from '../../services/nutritionGoalService'

function formatDateInput(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().split('T')[0]!
}

type PeriodPreset = '7d' | '14d' | '30d' | 'custom'

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Historical Nutrition Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated nutrient averages and body weight trend observations over selected periods.
          </p>
        </div>

        {/* Period Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleApplyPreset('7d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                preset === '7d'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('14d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                preset === '14d'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              14 Days
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('30d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                preset === '30d'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
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
              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset('custom')
                setEndDate(e.target.value)
              }}
              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-2xl text-xs">
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="p-12 text-center text-xs text-slate-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
          <p>Generating historical report...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Logged Days */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Days Logged</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {report.days_with_logs}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {report.total_days} days
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {report.days_with_logs === 0
                  ? 'No meal logs in period'
                  : `${Math.round((report.days_with_logs / report.total_days) * 100)}% consistency`}
              </div>
            </div>

            {/* Average Daily Calories */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Avg Daily Calories</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {report.avg_calories_kcal != null ? Math.round(report.avg_calories_kcal) : '--'}{' '}
                <span className="text-xs font-normal text-slate-500">kcal / day</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {report.days_with_logs > 0 ? `Across ${report.days_with_logs} logged days` : 'No data'}
              </div>
            </div>

            {/* Average Macros */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Daily Macro Averages</span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">Protein:</span>
                  <span>{report.avg_protein_g != null ? `${report.avg_protein_g} g` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Carbs:</span>
                  <span>{report.avg_carbs_g != null ? `${report.avg_carbs_g} g` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Fat:</span>
                  <span>{report.avg_fat_g != null ? `${report.avg_fat_g} g` : '--'}</span>
                </div>
              </div>
            </div>

            {/* Period Weight Trend Observation */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Weight Trend Observation</span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {report.weight_trend.has_sufficient_data && report.weight_trend.weight_change_kg != null ? (
                  <span
                    className={
                      report.weight_trend.weight_change_kg < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : report.weight_trend.weight_change_kg > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }
                  >
                    {report.weight_trend.weight_change_kg > 0
                      ? `+${report.weight_trend.weight_change_kg}`
                      : `${report.weight_trend.weight_change_kg}`}{' '}
                    <span className="text-xs font-normal text-slate-500">kg</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    {report.weight_trend.measurement_count === 1 ? '1 measurement' : 'No records'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {report.weight_trend.has_sufficient_data
                  ? `${report.weight_trend.measurement_count} scale records in range`
                  : 'Needs ≥ 2 scale records'}
              </div>
            </div>
          </div>

          {/* Transparent Calculation & Observational Disclaimers */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Methodology:</span>
              <span className="text-slate-600 dark:text-slate-400">{report.calculation_note}</span>
            </div>
            <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-700 dark:text-slate-300">Clinical Note:</span>
              <span className="text-slate-500 dark:text-slate-400">{report.weight_trend.disclaimer}</span>
            </div>
          </div>

          {/* Daily Breakdown Table and Bar Visualization */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Daily Breakdown ({report.daily_items.length} days)
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {report.daily_items.map((day) => {
                const dayDate = new Date(`${day.date}T00:00:00`)
                const dayLabel = dayDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
                const calPct = day.has_logs ? Math.min((day.calories_kcal / maxDailyCal) * 100, 100) : 0

                return (
                  <div key={day.date} className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                    <div className="w-40 flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                        {dayLabel}
                      </span>
                      {day.has_logs ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                          {day.entries_count} {day.entries_count === 1 ? 'item' : 'items'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                          Empty
                        </span>
                      )}
                    </div>

                    {/* Progress Bar & Calories */}
                    <div className="flex-1 max-w-xs flex items-center gap-3">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${calPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-16 text-right">
                        {day.has_logs ? `${Math.round(day.calories_kcal)}` : '0'}{' '}
                        <span className="text-[10px] font-normal text-slate-400">kcal</span>
                      </span>
                    </div>

                    {/* Macros breakdown */}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        P: {day.has_logs ? day.protein_g : '--'}g
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        C: {day.has_logs ? day.carbs_g : '--'}g
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        F: {day.has_logs ? day.fat_g : '--'}g
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">
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

