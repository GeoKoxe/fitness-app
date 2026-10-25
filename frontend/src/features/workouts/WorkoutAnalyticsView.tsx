import { useCallback, useEffect, useState } from 'react'
import type {
  ExercisePerformanceHistory,
  LoggedExerciseSummaryItem,
  WorkoutAnalyticsSummary,
  WorkoutWeeklySeries,
} from '../../types/workoutAnalytics'
import { workoutAnalyticsService } from '../../services/workoutAnalyticsService'

type TimeRangePreset = '4w' | '12w' | 'all'

function formatDurationHoursMinutes(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function WorkoutAnalyticsView() {
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('4w')
  const [summary, setSummary] = useState<WorkoutAnalyticsSummary | null>(null)
  const [weeklySeries, setWeeklySeries] = useState<WorkoutWeeklySeries | null>(null)
  const [loggedExercises, setLoggedExercises] = useState<LoggedExerciseSummaryItem[]>([])
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string>('')
  const [exerciseHistory, setExerciseHistory] = useState<ExercisePerformanceHistory | null>(null)

  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWeeklyTable, setShowWeeklyTable] = useState(false)

  // Load summary, weekly series, and logged exercises
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumData, seriesData, exList] = await Promise.all([
        workoutAnalyticsService.getSummary(timeRange),
        workoutAnalyticsService.getWeeklySeries(timeRange),
        workoutAnalyticsService.listLoggedExercises(),
      ])
      setSummary(sumData)
      setWeeklySeries(seriesData)
      setLoggedExercises(exList)

      // Auto-select first exercise if available and none selected
      const firstEx = exList[0]
      if (firstEx && !selectedExerciseSlug) {
        setSelectedExerciseSlug(firstEx.exercise_slug)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout analytics.')
    } finally {
      setLoading(false)
    }
  }, [timeRange, selectedExerciseSlug])

  // Load exercise history when selected exercise or time range changes
  useEffect(() => {
    if (!selectedExerciseSlug) return

    let isCurrent = true
    const fetchHistory = async () => {
      setHistoryLoading(true)
      try {
        const hist = await workoutAnalyticsService.getExerciseHistory(
          selectedExerciseSlug,
          timeRange
        )
        if (isCurrent) {
          setExerciseHistory(hist)
        }
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'Failed to load exercise history.')
        }
      } finally {
        if (isCurrent) {
          setHistoryLoading(false)
        }
      }
    }

    fetchHistory()
    return () => {
      isCurrent = false
    }
  }, [selectedExerciseSlug, timeRange])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  if (loading && !summary) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading workout analytics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Range Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Workout Performance & Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Objective performance trends, weekly consistency, and explainable progression recommendations.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTimeRange('4w')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeRange === '4w'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Last 4 Weeks
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('12w')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeRange === '12w'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Last 12 Weeks
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeRange === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadDashboardData}
            className="font-bold underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Overview Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
              {summary.total_completed_workouts}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Workouts logged
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Active Days
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
              {summary.active_training_days}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Unique calendar days
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Training Time
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
              {formatDurationHoursMinutes(summary.total_training_duration_seconds)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {summary.average_session_duration_seconds
                ? `Avg ${Math.round(summary.average_session_duration_seconds / 60)}m / session`
                : 'No duration data'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Completed Sets
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
              {summary.total_completed_sets}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Excludes skipped sets
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Reps
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
              {summary.total_completed_reps}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Logged repetitions
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Consistency
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {summary.consistency_percentage !== null
                ? `${summary.consistency_percentage}%`
                : '—'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {summary.target_training_days_per_week > 0
                ? `Goal: ${summary.target_training_days_per_week} days/wk`
                : 'No schedule configured'}
            </span>
          </div>
        </div>
      )}

      {/* Weekly Activity & Duration Breakdown */}
      {weeklySeries && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Weekly Training Volume & Duration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Completed sessions and active training duration across each 7-day period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeeklyTable((v) => !v)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {showWeeklyTable ? 'Show Visual Cards' : 'Show Data Table'}
            </button>
          </div>

          {showWeeklyTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Week Window</th>
                    <th className="py-2.5 px-3">Workouts Completed</th>
                    <th className="py-2.5 px-3">Schedule Target</th>
                    <th className="py-2.5 px-3">Completed Sets</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Weekly Consistency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {weeklySeries.weeks.map((wk, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {wk.week_label}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {wk.completed_workouts}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {wk.target_workouts > 0 ? `${wk.target_workouts} days` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {wk.completed_sets} sets
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {wk.total_duration_minutes} mins
                      </td>
                      <td className="py-2.5 px-3">
                        {wk.consistency_percent !== null ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              wk.consistency_percent >= 100
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : wk.consistency_percent >= 66
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {wk.consistency_percent}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {weeklySeries.weeks.map((wk, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {wk.week_label}
                    </span>
                    {wk.consistency_percent !== null && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {wk.consistency_percent}% goal
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                        {wk.completed_workouts}
                      </span>
                      {wk.target_workouts > 0 && (
                        <span className="text-xs text-slate-400 ml-1">
                          / {wk.target_workouts} target
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {wk.total_duration_minutes}m duration
                    </span>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          wk.target_workouts > 0
                            ? (wk.completed_workouts / wk.target_workouts) * 100
                            : wk.completed_workouts > 0
                              ? 100
                              : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>{wk.completed_sets} sets completed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exercise Performance History & Progression Guidance */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Exercise Performance & Progression
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review personal records, estimated 1RM calculations, and rule-based progression advice.
            </p>
          </div>

          {/* Exercise Selector */}
          {loggedExercises.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="exercise-selector" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Exercise:
              </label>
              <select
                id="exercise-selector"
                value={selectedExerciseSlug}
                onChange={(e) => setSelectedExerciseSlug(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {loggedExercises.map((ex) => (
                  <option key={ex.exercise_slug} value={ex.exercise_slug}>
                    {ex.exercise_name} ({ex.completed_sessions_count} sessions)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loggedExercises.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No completed exercises in history yet.
            </p>
            <p className="text-xs text-slate-400">
              Start and complete a workout session in the Workout Log tab to view performance metrics.
            </p>
          </div>
        ) : historyLoading ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading exercise details...</p>
          </div>
        ) : exerciseHistory ? (
          <div className="space-y-6">
            {/* Best Stats Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Best Logged Weight
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {exerciseHistory.best_weight_kg !== null
                    ? `${exerciseHistory.best_weight_kg} kg`
                    : exerciseHistory.equipment_required === 'bodyweight'
                      ? 'Bodyweight'
                      : '—'}
                </span>
                {exerciseHistory.best_reps_at_best_weight !== null && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {exerciseHistory.best_reps_at_best_weight} reps achieved
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Estimated 1RM
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                    Estimate
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {exerciseHistory.best_estimated_1rm_kg !== null
                    ? `${exerciseHistory.best_estimated_1rm_kg} kg`
                    : '—'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Epley: w × (1 + r/30)
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Sessions Logged
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {exerciseHistory.total_completed_sessions}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block capitalize">
                  {exerciseHistory.primary_muscle} • {exerciseHistory.equipment_required}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Completed Sets
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {exerciseHistory.total_completed_sets}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block capitalize">
                  {exerciseHistory.movement_category.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Progression Recommendation Card */}
            {exerciseHistory.recommendation && (
              <div
                className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${
                  exerciseHistory.recommendation.category === 'increase_load'
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : exerciseHistory.recommendation.category === 'maintain_load'
                      ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                      : exerciseHistory.recommendation.category === 'review_technique_recovery'
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        exerciseHistory.recommendation.category === 'increase_load'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : exerciseHistory.recommendation.category === 'maintain_load'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : exerciseHistory.recommendation.category === 'review_technique_recovery'
                              ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {exerciseHistory.recommendation.category.replace(/_/g, ' ')}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {exerciseHistory.recommendation.headline}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium italic">
                    Advisory recommendation
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {exerciseHistory.recommendation.rationale}
                </p>

                <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                  <strong className="text-slate-900 dark:text-slate-100 font-semibold block">
                    Suggested Next Action:
                  </strong>
                  <span className="text-slate-600 dark:text-slate-300">
                    {exerciseHistory.recommendation.suggested_action}
                  </span>
                </div>

                {exerciseHistory.recommendation.supporting_evidence.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Supporting Performance Data:
                    </span>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
                      {exerciseHistory.recommendation.supporting_evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Session History Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Performance Log History ({exerciseHistory.sessions.length} sessions)
              </h4>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Completed Sets Breakdown</th>
                      <th className="py-2.5 px-3">Session Est. 1RM</th>
                      <th className="py-2.5 px-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {exerciseHistory.sessions.map((sess) => (
                      <tr key={sess.session_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-medium text-slate-500">
                          {sess.completed_at}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {sess.session_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {sess.target_sets ? `${sess.target_sets} × ${sess.target_reps || 'reps'}` : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {sess.sets.map((st) => (
                              <span
                                key={st.set_number}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                  st.is_completed
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                    : st.is_skipped
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through'
                                      : 'bg-rose-50 text-rose-600'
                                }`}
                              >
                                S{st.set_number}: {st.weight_kg !== null ? `${st.weight_kg}kg × ` : ''}{st.reps ?? 0}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {sess.session_estimated_1rm_kg !== null
                            ? `${sess.session_estimated_1rm_kg} kg`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {sess.total_volume_kg !== null ? `${sess.total_volume_kg} kg` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
