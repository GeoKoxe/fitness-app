import { useState } from 'react'
import type {
  DifficultyLevel,
  Exercise,
  ExerciseCreate,
} from '../../types/exercise'
import {
  DIFFICULTY_OPTIONS,
  EQUIPMENT_OPTIONS,
  MOVEMENT_CATEGORIES,
  MUSCLE_GROUPS,
} from '../../types/exercise'

interface ExerciseFormModalProps {
  initialExercise?: Exercise | null
  onClose: () => void
  onSave: (data: ExerciseCreate) => Promise<void>
}

export function ExerciseFormModal({ initialExercise, onClose, onSave }: ExerciseFormModalProps) {
  const isEditing = Boolean(initialExercise)

  const [name, setName] = useState(initialExercise?.name || '')
  const [movementCategory, setMovementCategory] = useState(
    initialExercise?.movement_category || 'horizontal_push'
  )
  const [primaryMuscle, setPrimaryMuscle] = useState(
    initialExercise?.primary_muscle || 'chest'
  )
  const [secondaryMuscles, setSecondaryMuscles] = useState(
    initialExercise?.secondary_muscles || ''
  )
  const [equipmentRequired, setEquipmentRequired] = useState(
    initialExercise?.equipment_required || 'dumbbell'
  )
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(
    initialExercise?.difficulty_level || 'beginner'
  )
  const [instructions, setInstructions] = useState(
    initialExercise?.instructions || ''
  )
  const [alternativeExerciseSlugs, setAlternativeExerciseSlugs] = useState(
    initialExercise?.alternative_exercise_slugs || ''
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Exercise name is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        movement_category: movementCategory,
        primary_muscle: primaryMuscle,
        secondary_muscles: secondaryMuscles.trim() || undefined,
        equipment_required: equipmentRequired,
        difficulty_level: difficultyLevel,
        instructions: instructions.trim() || undefined,
        alternative_exercise_slugs: alternativeExerciseSlugs.trim() || undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
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

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          {isEditing ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Add your own specialized exercise variation with target muscles, equipment, and technique cues.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="ex-name" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Exercise Name *
            </label>
            <input
              id="ex-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deficit Reverse Lunge"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ex-category" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Movement Category *
              </label>
              <select
                id="ex-category"
                value={movementCategory}
                onChange={(e) => setMovementCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {MOVEMENT_CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ex-muscle" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Muscle Group *
              </label>
              <select
                id="ex-muscle"
                value={primaryMuscle}
                onChange={(e) => setPrimaryMuscle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {MUSCLE_GROUPS.filter((m) => m.value !== 'all').map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ex-equipment" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Equipment Required *
              </label>
              <select
                id="ex-equipment"
                value={equipmentRequired}
                onChange={(e) => setEquipmentRequired(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {EQUIPMENT_OPTIONS.filter((eq) => eq.value !== 'all').map((eq) => (
                  <option key={eq.value} value={eq.value}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ex-difficulty" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Difficulty Level *
              </label>
              <select
                id="ex-difficulty"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {DIFFICULTY_OPTIONS.filter((d) => d.value !== 'all').map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ex-secondary" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Secondary Muscles (Optional)
            </label>
            <input
              id="ex-secondary"
              type="text"
              value={secondaryMuscles}
              onChange={(e) => setSecondaryMuscles(e.target.value)}
              placeholder="e.g. glutes, hamstrings (comma-separated)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="ex-instructions" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Execution Instructions (Optional)
            </label>
            <textarea
              id="ex-instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="1. Setup and stance...&#10;2. Movement execution and breathing...&#10;3. Key safety and alignment cues..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="ex-alternatives" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alternative Exercises (Optional)
            </label>
            <input
              id="ex-alternatives"
              type="text"
              value={alternativeExerciseSlugs}
              onChange={(e) => setAlternativeExerciseSlugs(e.target.value)}
              placeholder="e.g. barbell_back_squat, leg_press (comma-separated slugs)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

