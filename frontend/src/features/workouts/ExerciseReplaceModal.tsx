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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3
              id="replace-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            >
              <span>Replace Planned Exercise</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Replacing <span className="font-semibold text-slate-700 dark:text-slate-300">{plannedExercise.exercise_name}</span> with a compatible catalogue movement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close replace dialog"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Searching compatible catalogue alternatives...</p>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No compatible alternatives found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                No other exercises match this movement category and your configured equipment/exclusion constraints.
              </p>
            </div>
          ) : (
            <>
              {/* Search filter within alternatives */}
              <input
                type="text"
                placeholder="Filter compatible alternatives..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Eligible Movements ({filteredAlternatives.length})
                </span>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredAlternatives.map((alt) => {
                    const isSelected = selectedExerciseId === alt.id
                    return (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => setSelectedExerciseId(alt.id)}
                        className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {alt.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="capitalize">{alt.primary_muscle}</span>
                            <span>•</span>
                            <span className="capitalize">{alt.movement_category.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span className="capitalize">{alt.equipment_required}</span>
                          </div>
                        </div>

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !selectedExerciseId || alternatives.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Replacing...</span>
              </>
            ) : (
              <span>Confirm Replacement</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
