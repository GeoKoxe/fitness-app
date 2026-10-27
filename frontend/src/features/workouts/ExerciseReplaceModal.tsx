import { useEffect, useState } from 'react'
import type { Exercise } from '../../types/exercise'
import type { PlannedExercise } from '../../types/workoutPlan'
import { workoutPlanService } from '../../services/workoutPlanService'

interface ExerciseReplaceModalProps {
  planId: number
  plannedExercise: PlannedExercise
  onClose: () => void
  onSuccess: () => void
}

export function ExerciseReplaceModal({
  planId,
  plannedExercise,
  onClose,
  onSuccess,
}: ExerciseReplaceModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alternatives, setAlternatives] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    async function loadAlternatives() {
      setLoading(true)
      setError(null)
      try {
        const resp = await workoutPlanService.getAlternatives(
          planId,
          plannedExercise.id
        )
        setAlternatives(resp.compatible_alternatives)
        const first = resp.compatible_alternatives[0]
        if (first) {
          setSelectedExerciseId(first.id)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load compatible alternatives'
        )
      } finally {
        setLoading(false)
      }
    }
    void loadAlternatives()
  }, [planId, plannedExercise.id])

  const handleConfirm = async () => {
    if (!selectedExerciseId) return
    setSaving(true)
    setError(null)
    try {
      await workoutPlanService.replaceExercise(
        planId,
        plannedExercise.id,
        selectedExerciseId
      )
      onSuccess()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to replace exercise'
      )
      setSaving(false)
    }
  }

  const filteredAlternatives = alternatives.filter(
    (ex) =>
      ex.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      ex.primary_muscle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      ex.equipment_required.toLowerCase().includes(filterQuery.toLowerCase())
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="bg-surface border border-edge rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left">
        {/* Header */}
        <div className="p-5 border-b border-edge flex items-center justify-between">
          <div>
            <h3
              id="replace-modal-title"
              className="text-base font-bold text-ink flex items-center gap-2"
            >
              <span>Replace Planned Exercise</span>
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Replacing <span className="font-semibold text-ink">{plannedExercise.exercise_name}</span> with a compatible catalogue movement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-inkSecondary hover:text-ink transition p-1.5 rounded-lg hover:bg-surfaceMuted cursor-pointer"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="m-4 p-3 bg-status-danger-bg border border-status-danger-border text-xs text-status-danger-fg rounded-xl">
            {error}
          </div>
        )}

        {/* Search Filter */}
        <div className="p-4 border-b border-edge bg-surfaceMuted">
          <input
            type="text"
            placeholder="Filter compatible alternatives..."
            aria-label="Filter compatible alternatives"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-surface border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
          />
        </div>

        {/* Alternatives List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-inkSecondary flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <span>Finding biomechanically compatible alternatives...</span>
            </div>
          ) : filteredAlternatives.length === 0 ? (
            <div className="py-8 text-center text-xs text-inkSecondary">
              No compatible alternatives found matching your equipment or search.
            </div>
          ) : (
            filteredAlternatives.map((alt) => {
              const isSelected = selectedExerciseId === alt.id
              return (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => setSelectedExerciseId(alt.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-brand bg-brand/10 ring-1 ring-brand'
                      : 'border-edge hover:border-brand/40 bg-surface'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-ink">
                      {alt.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                      <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-ink font-medium">
                        {alt.primary_muscle}
                      </span>
                      <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                        {alt.movement_category.replace(/_/g, ' ')}
                      </span>
                      <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                        {alt.equipment_required}
                      </span>
                      <span className="capitalize px-2 py-0.5 rounded-md bg-surfaceMuted border border-edge text-inkSecondary font-medium">
                        {alt.difficulty_level}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-brand bg-brand text-white'
                          : 'border-edge bg-surface'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-edge flex items-center justify-end gap-2.5 bg-surfaceMuted">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surface hover:bg-surfaceRaised transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !selectedExerciseId || loading}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Replacing...' : 'Confirm Replacement'}
          </button>
        </div>
      </div>
    </div>
  )
}
