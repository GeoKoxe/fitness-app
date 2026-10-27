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
      <div className="bg-surface border border-edge rounded-2xl p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-inkMuted">Loading workout analytics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Range Controls */}
      <div className="bg-surface border border-edge rounded-2xl p-5 sm:p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand/10 text-brand text-[11px] font-semibold tracking-wide uppercase mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Performance Insights
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
            Workout Performance & Analytics
          </h2>
          <p className="text-xs text-inkSecondary mt-0.5 max-w-xl">
            Objective performance trends, weekly consistency, and explainable progression recommendations.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-surfaceHover/80 border border-edge p-1.5 rounded-xl text-xs font-semibold self-start md:self-auto">
          <button
            type="button"
            onClick={() => setTimeRange('4w')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              timeRange === '4w'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-inkSecondary hover:text-ink hover:bg-surface/60'
            }`}
          >
            Last 4 Weeks
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('12w')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              timeRange === '12w'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-inkSecondary hover:text-ink hover:bg-surface/60'
            }`}
          >
            Last 12 Weeks
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              timeRange === 'all'
                ? 'bg-brand text-white shadow-xs font-semibold'
                : 'text-inkSecondary hover:text-ink hover:bg-surface/60'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-dangerSubtle border border-dangerBorder text-danger text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            className="font-bold underline hover:opacity-80 transition cursor-pointer ml-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Overview Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-extrabold text-ink mt-1 block tracking-tight">
              {summary.total_completed_workouts}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block">
              Workouts logged
            </span>
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Active Days
            </span>
            <span className="text-2xl font-extrabold text-ink mt-1 block tracking-tight">
              {summary.active_training_days}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block">
              Unique calendar days
            </span>
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Training Time
            </span>
            <span className="text-2xl font-extrabold text-ink mt-1 block tracking-tight">
              {formatDurationHoursMinutes(summary.total_training_duration_seconds)}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block truncate">
              {summary.average_session_duration_seconds
                ? `Avg ${Math.round(summary.average_session_duration_seconds / 60)}m / session`
                : 'No duration data'}
            </span>
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Completed Sets
            </span>
            <span className="text-2xl font-extrabold text-ink mt-1 block tracking-tight">
              {summary.total_completed_sets}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block">
              Excludes skipped sets
            </span>
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Total Reps
            </span>
            <span className="text-2xl font-extrabold text-ink mt-1 block tracking-tight">
              {summary.total_completed_reps}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block">
              Logged repetitions
            </span>
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-4 shadow-card hover:border-brand/30 transition">
            <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
              Consistency
            </span>
            <span className="text-2xl font-extrabold text-brand mt-1 block tracking-tight">
              {summary.consistency_percentage !== null
                ? `${summary.consistency_percentage}%`
                : '—'}
            </span>
            <span className="text-[10px] text-inkMuted mt-0.5 block truncate">
              {summary.target_training_days_per_week > 0
                ? `Goal: ${summary.target_training_days_per_week} days/wk`
                : 'No schedule configured'}
            </span>
          </div>
        </div>
      )}

      {/* Weekly Activity & Duration Breakdown */}
      {weeklySeries && (
        <div className="bg-surface border border-edge rounded-2xl p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">
                Weekly Training Volume & Duration
              </h3>
              <p className="text-xs text-inkSecondary mt-0.5">
                Completed sessions and active training duration across each 7-day period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeeklyTable((v) => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-edge hover:bg-surfaceHover transition text-ink cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-inkMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>{showWeeklyTable ? 'Show Visual Cards' : 'Show Data Table'}</span>
            </button>
          </div>

          {showWeeklyTable ? (
            <div className="overflow-x-auto border border-edge rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-surfaceHover/80 text-inkSecondary border-b border-edge font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Week Window</th>
                    <th className="py-2.5 px-3">Workouts Completed</th>
                    <th className="py-2.5 px-3">Schedule Target</th>
                    <th className="py-2.5 px-3">Completed Sets</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Weekly Consistency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {weeklySeries.weeks.map((wk, idx) => (
                    <tr key={idx} className="hover:bg-surfaceHover/50 transition">
                      <td className="py-2.5 px-3 font-semibold text-ink">
                        {wk.week_label}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-brand">
                        {wk.completed_workouts}
                      </td>
                      <td className="py-2.5 px-3 text-inkMuted">
                        {wk.target_workouts > 0 ? `${wk.target_workouts} days` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-inkSecondary">
                        {wk.completed_sets} sets
                      </td>
                      <td className="py-2.5 px-3 text-inkSecondary">
                        {wk.total_duration_minutes} mins
                      </td>
                      <td className="py-2.5 px-3">
                        {wk.consistency_percent !== null ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              wk.consistency_percent >= 100
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : wk.consistency_percent >= 66
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
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
                  className="bg-surfaceHover/40 border border-edge rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">
                      {wk.week_label}
                    </span>
                    {wk.consistency_percent !== null && (
                      <span className="text-[10px] font-bold text-brand px-1.5 py-0.5 rounded-full bg-brand/10">
                        {wk.consistency_percent}% goal
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-extrabold text-ink">
                        {wk.completed_workouts}
                      </span>
                      {wk.target_workouts > 0 && (
                        <span className="text-xs text-inkMuted ml-1">
                          / {wk.target_workouts} target
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-inkMuted">
                      {wk.total_duration_minutes}m duration
                    </span>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="w-full bg-surfaceHover rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand h-1.5 rounded-full transition-all duration-300"
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
                  <div className="text-[10px] text-inkMuted flex justify-between">
                    <span>{wk.completed_sets} sets completed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exercise Performance History & Progression Guidance */}
      <div className="bg-surface border border-edge rounded-2xl p-5 sm:p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge pb-4">
          <div>
            <h3 className="text-base font-bold text-ink">
              Exercise Performance & Progression
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Review personal records, estimated 1RM calculations, and rule-based progression advice.
            </p>
          </div>

          {/* Exercise Selector */}
          {loggedExercises.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="exercise-selector" className="text-xs font-semibold text-inkSecondary">
                Exercise:
              </label>
              <select
                id="exercise-selector"
                value={selectedExerciseSlug}
                onChange={(e) => setSelectedExerciseSlug(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-edge bg-surface text-xs font-medium text-ink focus:outline-hidden focus:ring-2 focus:ring-brand shadow-2xs"
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
            <div className="w-10 h-10 rounded-2xl bg-surfaceHover border border-edge flex items-center justify-center mx-auto text-inkMuted">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink">
              No completed exercises in history yet.
            </p>
            <p className="text-xs text-inkMuted">
              Start and complete a workout session in the Workout Log tab to view performance metrics.
            </p>
          </div>
        ) : historyLoading ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-inkMuted">Loading exercise details...</p>
          </div>
        ) : exerciseHistory ? (
          <div className="space-y-6">
            {/* Best Stats Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surfaceHover/40 border border-edge rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-inkMuted uppercase tracking-wider block">
                  Best Logged Weight
                </span>
                <span className="text-lg font-bold text-ink mt-0.5 block">
                  {exerciseHistory.best_weight_kg !== null
                    ? `${exerciseHistory.best_weight_kg} kg`
                    : exerciseHistory.equipment_required === 'bodyweight'
                      ? 'Bodyweight'
                      : '—'}
                </span>
                {exerciseHistory.best_reps_at_best_weight !== null && (
                  <span className="text-[10px] text-inkSecondary mt-0.5 block">
                    {exerciseHistory.best_reps_at_best_weight} reps achieved
                  </span>
                )}
              </div>

              <div className="bg-surfaceHover/40 border border-edge rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-inkMuted uppercase tracking-wider block">
                    Estimated 1RM
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
                    Estimate
                  </span>
                </div>
                <span className="text-lg font-bold text-brand mt-0.5 block">
                  {exerciseHistory.best_estimated_1rm_kg !== null
                    ? `${exerciseHistory.best_estimated_1rm_kg} kg`
                    : '—'}
                </span>
                <span className="text-[10px] text-inkMuted mt-0.5 block">
                  Epley: w × (1 + r/30)
                </span>
              </div>

              <div className="bg-surfaceHover/40 border border-edge rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-inkMuted uppercase tracking-wider block">
                  Sessions Logged
                </span>
                <span className="text-lg font-bold text-ink mt-0.5 block">
                  {exerciseHistory.total_completed_sessions}
                </span>
                <span className="text-[10px] text-inkSecondary mt-0.5 block capitalize">
                  {exerciseHistory.primary_muscle} • {exerciseHistory.equipment_required}
                </span>
              </div>

              <div className="bg-surfaceHover/40 border border-edge rounded-xl p-3.5">
                <span className="text-[10px] font-semibold text-inkMuted uppercase tracking-wider block">
                  Total Completed Sets
                </span>
                <span className="text-lg font-bold text-ink mt-0.5 block">
                  {exerciseHistory.total_completed_sets}
                </span>
                <span className="text-[10px] text-inkSecondary mt-0.5 block capitalize">
                  {exerciseHistory.movement_category.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Progression Recommendation Card */}
            {exerciseHistory.recommendation && (
              <div
                className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${
                  exerciseHistory.recommendation.category === 'increase_load'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : exerciseHistory.recommendation.category === 'maintain_load'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : exerciseHistory.recommendation.category === 'review_technique_recovery'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-surfaceHover/40 border-edge'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        exerciseHistory.recommendation.category === 'increase_load'
                          ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                          : exerciseHistory.recommendation.category === 'maintain_load'
                            ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300'
                            : exerciseHistory.recommendation.category === 'review_technique_recovery'
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                              : 'bg-surfaceHover text-inkSecondary'
                      }`}
                    >
                      {exerciseHistory.recommendation.category.replace(/_/g, ' ')}
                    </span>
                    <h4 className="text-sm font-bold text-ink">
                      {exerciseHistory.recommendation.headline}
                    </h4>
                  </div>
                  <span className="text-[10px] text-inkMuted font-medium italic">
                    Advisory recommendation
                  </span>
                </div>

                <p className="text-xs text-inkSecondary leading-relaxed">
                  {exerciseHistory.recommendation.rationale}
                </p>

                <div className="bg-surface/90 rounded-xl p-3 border border-edge text-xs space-y-1">
                  <strong className="text-ink font-semibold block">
                    Suggested Next Action:
                  </strong>
                  <span className="text-inkSecondary">
                    {exerciseHistory.recommendation.suggested_action}
                  </span>
                </div>

                {exerciseHistory.recommendation.supporting_evidence.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider block">
                      Supporting Performance Data:
                    </span>
                    <ul className="text-xs text-inkSecondary space-y-0.5 list-disc list-inside">
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-inkMuted">
                Performance Log History ({exerciseHistory.sessions.length} sessions)
              </h4>

              <div className="overflow-x-auto border border-edge rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surfaceHover/80 text-inkSecondary border-b border-edge font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Completed Sets Breakdown</th>
                      <th className="py-2.5 px-3">Session Est. 1RM</th>
                      <th className="py-2.5 px-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {exerciseHistory.sessions.map((sess) => (
                      <tr key={sess.session_id} className="hover:bg-surfaceHover/50 transition">
                        <td className="py-2.5 px-3 font-medium text-inkMuted">
                          {sess.completed_at}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-ink">
                          {sess.session_name}
                        </td>
                        <td className="py-2.5 px-3 text-inkMuted">
                          {sess.target_sets ? `${sess.target_sets} × ${sess.target_reps || 'reps'}` : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {sess.sets.map((st) => (
                              <span
                                key={st.set_number}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                  st.is_completed
                                    ? 'bg-surfaceHover text-ink border border-edge/60'
                                    : st.is_skipped
                                      ? 'bg-surfaceHover text-inkMuted line-through border border-edge/40'
                                      : 'bg-dangerSubtle text-danger border border-dangerBorder'
                                }`}
                              >
                                S{st.set_number}: {st.weight_kg !== null ? `${st.weight_kg}kg × ` : ''}{st.reps ?? 0}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-brand">
                          {sess.session_estimated_1rm_kg !== null
                            ? `${sess.session_estimated_1rm_kg} kg`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-inkSecondary">
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
