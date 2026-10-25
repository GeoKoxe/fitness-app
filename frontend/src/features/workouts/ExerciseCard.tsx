import type { Exercise } from '../../types/exercise'

interface ExerciseCardProps {
  exercise: Exercise
  onView: (exercise: Exercise) => void
  onEdit?: (exercise: Exercise) => void
  onDelete?: (exercise: Exercise) => void
}

function getDifficultyBadgeColor(difficulty: string): string {
  switch (difficulty) {
    case 'beginner':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
    case 'intermediate':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
    case 'advanced':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
}

function formatToken(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ExerciseCard({ exercise, onView, onEdit, onDelete }: ExerciseCardProps) {
  return (
    <div
      onClick={() => onView(exercise)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition text-sm sm:text-base leading-snug">
            {exercise.name}
          </h3>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
              exercise.is_built_in
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
            }`}
          >
            {exercise.is_built_in ? 'Built-in' : 'Custom'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {formatToken(exercise.primary_muscle)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {formatToken(exercise.equipment_required)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getDifficultyBadgeColor(exercise.difficulty_level)}`}>
            {formatToken(exercise.difficulty_level)}
          </span>
        </div>

        {exercise.instructions && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {exercise.instructions}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-500 dark:text-slate-400">
          {formatToken(exercise.movement_category)}
        </span>
        <div className="flex items-center gap-2">
          {!exercise.is_built_in && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(exercise)
              }}
              className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium px-1.5 py-0.5 rounded transition"
              title="Edit exercise"
            >
              Edit
            </button>
          )}
          {!exercise.is_built_in && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(exercise)
              }}
              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium px-1.5 py-0.5 rounded transition"
              title="Delete exercise"
            >
              Delete
            </button>
          )}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
            Details &rarr;
          </span>
        </div>
      </div>
    </div>
  )
}

