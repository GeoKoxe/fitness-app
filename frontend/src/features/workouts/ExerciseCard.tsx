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
      return 'bg-status-success-bg text-status-success-fg border border-status-success-border'
    case 'intermediate':
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
    case 'advanced':
      return 'bg-status-danger-bg text-status-danger-fg border border-status-danger-border'
    default:
      return 'bg-surfaceMuted text-inkSecondary border border-edge'
  }
}

function formatToken(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ExerciseCard({ exercise, onView, onEdit, onDelete }: ExerciseCardProps) {
  return (
    <div
      onClick={() => onView(exercise)}
      role="article"
      aria-label={`Exercise ${exercise.name}`}
      className="bg-surface border border-edge rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-brand/50 transition cursor-pointer flex flex-col justify-between group text-left"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <h3 className="font-bold text-ink group-hover:text-brand transition text-base leading-snug">
            {exercise.name}
          </h3>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 border ${
              exercise.is_built_in
                ? 'bg-surfaceMuted text-inkSecondary border-edge'
                : 'bg-brand/10 text-brand border-brand/20'
            }`}
          >
            {exercise.is_built_in ? 'Built-in' : 'Custom'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3.5">
          <span className="text-xs px-2.5 py-0.5 rounded-lg font-medium bg-surfaceMuted text-ink border border-edge">
            {formatToken(exercise.primary_muscle)}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-lg font-medium bg-surfaceMuted text-inkSecondary border border-edge">
            {formatToken(exercise.equipment_required)}
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded-lg font-medium ${getDifficultyBadgeColor(exercise.difficulty_level)}`}>
            {formatToken(exercise.difficulty_level)}
          </span>
        </div>

        {exercise.instructions && (
          <p className="text-xs text-inkSecondary line-clamp-2 leading-relaxed mb-3">
            {exercise.instructions}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-edge flex items-center justify-between text-xs text-inkSecondary">
        <span className="font-medium text-inkSecondary">
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
              className="text-inkSecondary hover:text-brand font-medium px-2 py-1 rounded-md hover:bg-surfaceMuted transition"
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
              className="text-inkSecondary hover:text-status-danger-fg font-medium px-2 py-1 rounded-md hover:bg-status-danger-bg transition"
              title="Delete exercise"
            >
              Delete
            </button>
          )}
          <span className="text-brand font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
            Details &rarr;
          </span>
        </div>
      </div>
    </div>
  )
}
