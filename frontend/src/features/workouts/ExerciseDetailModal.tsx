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
  const secondaryList = exercise.secondary_muscles
    ? exercise.secondary_muscles.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const alternativeList = exercise.alternative_exercise_slugs
    ? exercise.alternative_exercise_slugs.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-lg"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="pr-8 mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                exercise.is_built_in
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
              }`}
            >
              {exercise.is_built_in ? 'Built-in Exercise' : 'Custom Exercise'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {formatToken(exercise.difficulty_level)}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {exercise.name}
          </h2>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-5 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Movement</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatToken(exercise.movement_category)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Target Muscle</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatToken(exercise.primary_muscle)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Equipment</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatToken(exercise.equipment_required)}
            </span>
          </div>
          {secondaryList.length > 0 && (
            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 block mb-1 font-medium">Secondary Muscles</span>
              <div className="flex flex-wrap gap-1">
                {secondaryList.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300"
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
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Execution Instructions & Technique Cues
          </h4>
          {exercise.instructions ? (
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed bg-slate-50/50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
              {exercise.instructions}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No instructions provided for this exercise.</p>
          )}
        </div>

        {/* Alternative Exercises */}
        {alternativeList.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Recommended Substitutions & Alternatives
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {alternativeList.map((altSlug) => (
                <span
                  key={altSlug}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 font-medium"
                >
                  {formatToken(altSlug)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            {!exercise.is_built_in ? (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(exercise)
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
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
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 transition"
                  >
                    Delete Exercise
                  </button>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Built-in exercises are standardized and cannot be edited.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

