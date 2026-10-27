import { useEffect } from 'react'
import type { Exercise } from '../../types/exercise'

interface ExerciseDetailModalProps {
  exercise: Exercise
  onClose: () => void
  onEdit?: (exercise: Exercise) => void
  onDelete?: (exercise: Exercise) => void
}

function formatToken(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ExerciseDetailModal({ exercise, onClose, onEdit, onDelete }: ExerciseDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const secondaryList = exercise.secondary_muscles
    ? exercise.secondary_muscles.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const alternativeList = exercise.alternative_exercise_slugs
    ? exercise.alternative_exercise_slugs.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-detail-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-surface border border-edge rounded-2xl max-w-xl w-full p-6 shadow-xl relative my-8 animate-in fade-in zoom-in-95 duration-150 text-left">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-inkSecondary hover:text-ink transition p-1.5 rounded-lg hover:bg-surfaceMuted cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="pr-8 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                exercise.is_built_in
                  ? 'bg-surfaceMuted text-inkSecondary border-edge'
                  : 'bg-brand/10 text-brand border-brand/20'
              }`}
            >
              {exercise.is_built_in ? 'Built-in Exercise' : 'Custom Exercise'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surfaceMuted text-inkSecondary border border-edge">
              {formatToken(exercise.difficulty_level)}
            </span>
          </div>
          <h2 id="exercise-detail-title" className="text-xl font-bold text-ink">
            {exercise.name}
          </h2>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-surfaceMuted border border-edge mb-5 text-xs">
          <div>
            <span className="text-inkSecondary block mb-0.5 font-medium">Movement</span>
            <span className="font-semibold text-ink">
              {formatToken(exercise.movement_category)}
            </span>
          </div>
          <div>
            <span className="text-inkSecondary block mb-0.5 font-medium">Target Muscle</span>
            <span className="font-semibold text-brand">
              {formatToken(exercise.primary_muscle)}
            </span>
          </div>
          <div>
            <span className="text-inkSecondary block mb-0.5 font-medium">Equipment</span>
            <span className="font-semibold text-ink">
              {formatToken(exercise.equipment_required)}
            </span>
          </div>
          {secondaryList.length > 0 && (
            <div className="col-span-2 sm:col-span-3 pt-2 border-t border-edge">
              <span className="text-inkSecondary block mb-1 font-medium">Secondary Muscles</span>
              <div className="flex flex-wrap gap-1.5">
                {secondaryList.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-md bg-surface border border-edge font-medium text-ink"
                  >
                    {formatToken(m)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Execution Instructions & Technique Cues
          </h3>
          {exercise.instructions ? (
            <div className="text-xs sm:text-sm text-ink whitespace-pre-line leading-relaxed bg-surfaceMuted p-4 rounded-xl border border-edge">
              {exercise.instructions}
            </div>
          ) : (
            <p className="text-xs text-inkSecondary italic">No instructions provided for this exercise.</p>
          )}
        </div>

        {/* Alternative Exercises */}
        {alternativeList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
              Recommended Substitutions & Alternatives
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {alternativeList.map((altSlug) => (
                <span
                  key={altSlug}
                  className="text-xs px-2.5 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 font-medium"
                >
                  {formatToken(altSlug)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-edge">
          <div>
            {!exercise.is_built_in ? (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(exercise)
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink transition cursor-pointer"
                  >
                    Edit Exercise
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(exercise)
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-status-danger-bg hover:opacity-90 text-status-danger-fg border border-status-danger-border transition cursor-pointer"
                  >
                    Delete Exercise
                  </button>
                )}
              </div>
            ) : (
              <span className="text-xs text-inkSecondary italic">
                Built-in exercises are standardized and cannot be edited.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
