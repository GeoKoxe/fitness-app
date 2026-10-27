import { useCallback, useEffect, useState } from 'react'
import type {
  PlannedExercise,
  WorkoutPlan,
  WorkoutPlanSummary,
} from '../../types/workoutPlan'
import { workoutPlanService } from '../../services/workoutPlanService'
import { ExerciseReplaceModal } from './ExerciseReplaceModal'

const WEEKDAY_NAMES_MAP: Record<number, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
}

interface WorkoutPlannerViewProps {
  onStartWorkoutSession?: (plannedSessionId: number) => void
}

export function WorkoutPlannerView({
  onStartWorkoutSession,
}: WorkoutPlannerViewProps) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null)
  const [historyPlans, setHistoryPlans] = useState<WorkoutPlanSummary[]>([])

  // Default selected day to current day of week (Monday=0..Sunday=6)
  const currentDayOfWeek = (new Date().getDay() + 6) % 7
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(currentDayOfWeek)

  // Replacement & Regeneration states
  const [exerciseToReplace, setExerciseToReplace] = useState<PlannedExercise | null>(null)
  const [regeneratingExerciseId, setRegeneratingExerciseId] = useState<number | null>(null)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)

  // Escape key for confirm dialog
  useEffect(() => {
    if (!showGenerateConfirm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGenerateConfirm(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showGenerateConfirm])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plan, history] = await Promise.all([
        workoutPlanService.getActivePlan(),
        workoutPlanService.listPlans(0, 10),
      ])
      setActivePlan(plan)
      setHistoryPlans(history)
      if (plan && plan.sessions.length > 0) {
        const hasCurrentDay = plan.sessions.some(
          (s) => s.day_of_week_index === currentDayOfWeek
        )
        if (!hasCurrentDay && plan.sessions[0]) {
          setSelectedDayIndex(plan.sessions[0].day_of_week_index)
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load active workout routine.'
      )
    } finally {
      setLoading(false)
    }
  }, [currentDayOfWeek])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Trigger Routine Generation
  const handleGenerate = async () => {
    if (activePlan && !showGenerateConfirm) {
      setShowGenerateConfirm(true)
      return
    }

    setShowGenerateConfirm(false)
    setGenerating(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const newPlan = await workoutPlanService.generatePlan({})
      setActivePlan(newPlan)
      setSuccessMessage('New 7-day workout routine generated successfully!')
      setTimeout(() => setSuccessMessage(null), 4000)

      // Refresh history
      const history = await workoutPlanService.listPlans(0, 10)
      setHistoryPlans(history)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate workout plan. Please check training profile settings.'
      )
    } finally {
      setGenerating(false)
    }
  }

  // Load a historical plan
  const handleSelectHistoryPlan = async (planId: number) => {
    setLoading(true)
    setError(null)
    try {
      const plan = await workoutPlanService.getPlanById(planId)
      setActivePlan(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  // Regenerate single exercise slot
  const handleRegenerate = async (exerciseId: number) => {
    if (!activePlan) return
    setRegeneratingExerciseId(exerciseId)
    setError(null)
    try {
      const updated = await workoutPlanService.regenerateExercise(
        activePlan.id,
        exerciseId
      )
      setActivePlan(updated)
      setSuccessMessage('Exercise slot regenerated with compatible alternative!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to regenerate exercise slot.'
      )
    } finally {
      setRegeneratingExerciseId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-edge rounded-2xl p-12 text-center space-y-4">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-inkSecondary">Loading workout routine...</p>
      </div>
    )
  }

  const selectedSession = activePlan?.sessions.find(
    (s) => s.day_of_week_index === selectedDayIndex
  )

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Card */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-ink">
                {activePlan ? activePlan.name : 'Weekly Routine Planner'}
              </h2>
              {activePlan && (
                <span className="text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20 px-2.5 py-0.5 rounded-full capitalize">
                  {activePlan.split_type.replace(/_/g, ' ')}
                </span>
              )}
              {activePlan && !activePlan.is_active && (
                <span className="text-[10px] font-semibold bg-surfaceMuted border border-edge text-inkSecondary px-2.5 py-0.5 rounded-full">
                  Historical
                </span>
              )}
            </div>
            <p className="text-xs text-inkSecondary mt-1 max-w-xl leading-relaxed">
              {activePlan
                ? `Active schedule from ${activePlan.start_date} to ${activePlan.end_date}. Tailored to your experience, duration limits, and equipment access.`
                : 'Generate a personalized 7-day schedule based on your training profile, weekly availability, and equipment catalogue.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {historyPlans.length > 1 && (
              <select
                aria-label="Select workout plan from history"
                value={activePlan?.id || ''}
                onChange={(e) => handleSelectHistoryPlan(Number(e.target.value))}
                className="px-3 py-2 rounded-xl text-xs bg-surface border border-edge text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
              >
                {historyPlans.map((hp) => (
                  <option key={hp.id} value={hp.id}>
                    {hp.is_active ? '★ (Active) ' : ''}
                    {hp.name} ({hp.start_date})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating Routine...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{activePlan ? 'Regenerate Weekly Plan' : 'Generate Weekly Routine'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border rounded-xl text-xs text-status-danger-fg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-2.5 py-1 rounded-lg bg-surface border border-status-danger-border text-status-danger-fg font-semibold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {successMessage && (
          <div role="status" className="mt-4 p-3 bg-status-success-bg border border-status-success-border rounded-xl text-xs text-status-success-fg flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showGenerateConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-active-plan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-surface border border-edge rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <h3 id="replace-active-plan-title" className="text-base font-bold text-ink">
              Replace Active Workout Plan?
            </h3>
            <p className="text-xs text-inkSecondary leading-relaxed">
              Generating a new routine will replace your currently active plan. Your current plan will remain accessible in history.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition cursor-pointer"
              >
                Confirm & Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!activePlan ? (
        <div className="bg-surface border border-edge rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center mx-auto">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-bold text-ink text-base">
            No Active Workout Routine
          </h3>
          <p className="text-xs text-inkSecondary max-w-md mx-auto leading-relaxed">
            You do not currently have an active 7-day routine. Click below to generate a tailored plan matching your saved training days, duration, and available equipment.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Generate Your First Routine</span>
          </button>
        </div>
      ) : (
        <>
          {/* 7-Day Calendar Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {activePlan.sessions.map((session) => {
              const isSelected = session.day_of_week_index === selectedDayIndex
              const dayShort = WEEKDAY_NAMES_MAP[session.day_of_week_index] || session.day_of_week_name.slice(0, 3)

              return (
                <button
                  key={session.id}
                  type="button"
                  aria-label={dayShort}
                  onClick={() => setSelectedDayIndex(session.day_of_week_index)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-brand bg-brand/10 ring-2 ring-brand/40 shadow-xs'
                      : 'border-edge bg-surface hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">
                      {dayShort}
                    </span>
                    <span className="text-[10px] text-inkSecondary font-mono">
                      {session.plan_date.slice(5)}
                    </span>
                  </div>

                  <div className="mt-3">
                    {session.is_rest_day ? (
                      <span className="inline-block text-[10px] font-medium text-inkSecondary bg-surfaceMuted border border-edge px-2 py-0.5 rounded-md">
                        Rest Day
                      </span>
                    ) : (
                      <div>
                        <span className="inline-block text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md">
                          {session.exercises.length} Exercises
                        </span>
                        <p className="text-[11px] font-medium text-ink mt-1 line-clamp-1">
                          {session.session_name}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active Session Content */}
          {selectedSession && (
            <div className="space-y-4">
              {/* Session Banner */}
              <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand">
                        {selectedSession.day_of_week_name}
                      </span>
                      <span className="text-xs text-inkMuted">•</span>
                      <span className="text-xs text-inkSecondary">{selectedSession.plan_date}</span>
                    </div>
                    <h3 className="text-lg font-bold text-ink mt-0.5">
                      {selectedSession.session_name}
                    </h3>
                    <p className="text-xs text-inkSecondary mt-0.5">
                      Focus: <span className="font-semibold text-ink">{selectedSession.session_focus}</span>
                    </p>
                  </div>

                  {!selectedSession.is_rest_day && (
                    <div className="flex items-center gap-2">
                      <span
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-surfaceMuted border border-edge text-inkSecondary flex items-center gap-1.5"
                        title={
                          selectedSession.requested_duration_minutes
                            ? `Estimated workload: ${selectedSession.estimated_duration_minutes} min (Target: ${selectedSession.requested_duration_minutes} min)`
                            : `Estimated workload: ${selectedSession.estimated_duration_minutes} min`
                        }
                      >
                        <svg className="w-3.5 h-3.5 text-inkMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>~{selectedSession.estimated_duration_minutes} min</span>
                        {selectedSession.requested_duration_minutes && (
                          <span className="text-[10px] text-inkMuted font-normal">
                            / {selectedSession.requested_duration_minutes}m target
                          </span>
                        )}
                      </span>

                      {onStartWorkoutSession && (
                        <button
                          type="button"
                          onClick={() => onStartWorkoutSession(selectedSession.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Start Workout</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Warm-up & Cool-down boxes */}
                {selectedSession.is_rest_day ? (
                  <div className="mt-5 p-4 rounded-xl bg-surfaceMuted border border-edge text-xs text-inkSecondary space-y-1">
                    <p className="font-bold text-ink">
                      Recovery & Adaptation Day
                    </p>
                    <p className="leading-relaxed">
                      Muscle protein synthesis and neuromuscular repair occur during rest. Prioritize hydration, 7–9 hours of sleep, and your targeted daily nutrition goals.
                    </p>
                    {selectedSession.warmup_notes && (
                      <p className="text-inkMuted text-[11px] pt-1">
                        Tip: {selectedSession.warmup_notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {selectedSession.warmup_notes && (
                      <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/20 text-ink">
                        <span className="font-bold text-[11px] text-brand uppercase tracking-wider block mb-0.5">
                          Warm-up Routine
                        </span>
                        <p className="text-[11px] text-inkSecondary leading-relaxed">
                          {selectedSession.warmup_notes}
                        </p>
                      </div>
                    )}
                    {selectedSession.cooldown_notes && (
                      <div className="p-3.5 rounded-xl bg-surfaceMuted border border-edge text-ink">
                        <span className="font-bold text-[11px] text-brand uppercase tracking-wider block mb-0.5">
                          Cool-down & Mobility
                        </span>
                        <p className="text-[11px] text-inkSecondary leading-relaxed">
                          {selectedSession.cooldown_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Planned Exercise Cards */}
              {!selectedSession.is_rest_day && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-inkSecondary px-1">
                    Prescribed Movements ({selectedSession.exercises.length})
                  </h4>

                  {selectedSession.exercises.map((plannedEx) => {
                    const isRegenerating = regeneratingExerciseId === plannedEx.id
                    return (
                      <div
                        key={plannedEx.id}
                        className="bg-surface border border-edge rounded-2xl p-5 shadow-xs transition hover:border-brand/40"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-brand/10 border border-brand/20 text-brand text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                              {plannedEx.order_in_session}
                            </span>
                            <div>
                              <h5 className="text-sm font-bold text-ink">
                                {plannedEx.exercise_name}
                              </h5>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                                <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-ink font-medium">
                                  {plannedEx.primary_muscle}
                                </span>
                                <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                                  {plannedEx.movement_category.replace(/_/g, ' ')}
                                </span>
                                <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                                  {plannedEx.equipment_required}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-start">
                            <button
                              type="button"
                              onClick={() => handleRegenerate(plannedEx.id)}
                              disabled={isRegenerating}
                              aria-label={`Regenerate ${plannedEx.exercise_name}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                              title="Regenerate this exercise slot with a compatible movement"
                            >
                              {isRegenerating ? (
                                <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5 text-inkSecondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                              <span>Regenerate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExerciseToReplace(plannedEx)}
                              aria-label={`Replace ${plannedEx.exercise_name}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-edge hover:bg-surfaceMuted text-ink transition flex items-center gap-1 cursor-pointer bg-surface"
                              title="Select a replacement exercise from catalogue"
                            >
                              <svg className="w-3.5 h-3.5 text-inkSecondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                              <span>Replace</span>
                            </button>
                          </div>
                        </div>

                        {/* Prescription Badges */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-edge text-center">
                          <div className="p-2.5 rounded-xl bg-surfaceMuted border border-edge">
                            <span className="text-[10px] text-inkSecondary font-semibold uppercase tracking-wider block">
                              Sets
                            </span>
                            <span className="text-sm font-bold text-ink">
                              {plannedEx.target_sets} Sets
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-surfaceMuted border border-edge">
                            <span className="text-[10px] text-inkSecondary font-semibold uppercase tracking-wider block">
                              Reps
                            </span>
                            <span className="text-sm font-bold text-ink">
                              {plannedEx.target_reps} Reps
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-surfaceMuted border border-edge">
                            <span className="text-[10px] text-inkSecondary font-semibold uppercase tracking-wider block">
                              Rest
                            </span>
                            <span className="text-sm font-bold text-ink">
                              {plannedEx.rest_seconds}s Rest
                            </span>
                          </div>
                        </div>

                        {/* Progression & Warm-up Notes */}
                        <div className="mt-3 space-y-2 text-[11px]">
                          {plannedEx.progression_notes && (
                            <div className="p-2.5 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-fg">
                              <span className="font-bold mr-1.5">Progression Cue:</span>
                              <span className="leading-relaxed">{plannedEx.progression_notes}</span>
                            </div>
                          )}

                          {plannedEx.warmup_guidance && (
                            <div className="p-2.5 rounded-xl bg-surfaceMuted border border-edge text-inkSecondary">
                              <span className="font-bold mr-1.5 text-ink">Warm-up:</span>
                              <span className="leading-relaxed">{plannedEx.warmup_guidance}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Non-medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-surface border border-edge text-xs text-inkSecondary flex items-start gap-3">
        <svg className="w-5 h-5 text-inkMuted shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="leading-relaxed text-[11px]">
          <span className="font-bold text-ink">Planning & Safety Notice:</span> Workout routines generated by this system are algorithmic recommendations based on standard progressive resistance training principles and your equipment inputs. They are not medical or physical therapy advice. Always execute movements with strict biomechanics, warm up appropriately, and adjust volume or loads if you experience sharp pain.
        </p>
      </div>

      {/* Replacement Modal */}
      {exerciseToReplace && activePlan && (
        <ExerciseReplaceModal
          planId={activePlan.id}
          plannedExercise={exerciseToReplace}
          onClose={() => setExerciseToReplace(null)}
          onSuccess={async () => {
            setExerciseToReplace(null)
            setSuccessMessage('Planned exercise replaced successfully!')
            setTimeout(() => setSuccessMessage(null), 3000)
            const refreshed = await workoutPlanService.getActivePlan()
            setActivePlan(refreshed)
          }}
        />
      )}
    </div>
  )
}
