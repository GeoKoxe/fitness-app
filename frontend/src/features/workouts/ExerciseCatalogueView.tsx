import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Exercise,
  ExerciseCreate,
  ExerciseFilterParams,
} from '../../types/exercise'
import {
  DIFFICULTY_OPTIONS,
  EQUIPMENT_OPTIONS,
  MOVEMENT_CATEGORIES,
  MUSCLE_GROUPS,
} from '../../types/exercise'
import { exerciseService } from '../../services/exerciseService'
import { ExerciseCard } from './ExerciseCard'
import { ExerciseDetailModal } from './ExerciseDetailModal'
import { ExerciseFormModal } from './ExerciseFormModal'

export function ExerciseCatalogueView() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedEquipment, setSelectedEquipment] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'builtin' | 'custom'>('all')

  // Modals
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState<Exercise | null>(null)
  const [exerciseToEdit, setExerciseToEdit] = useState<Exercise | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadExercises = useCallback(async () => {
    setLoading(true)
    try {
      const params: ExerciseFilterParams = {
        limit: 200,
      }
      if (searchQuery.trim()) params.q = searchQuery.trim()
      if (selectedMuscle !== 'all') params.primary_muscle = selectedMuscle
      if (selectedEquipment !== 'all') params.equipment = selectedEquipment
      if (selectedCategory !== 'all') params.movement_category = selectedCategory
      if (selectedDifficulty !== 'all') params.difficulty = selectedDifficulty

      const data = await exerciseService.getExercises(params)
      setExercises(data)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedCategory, selectedDifficulty])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadExercises()
    }, 200)
    return () => clearTimeout(timer)
  }, [loadExercises])

  const filteredExercises = useMemo(() => {
    if (typeFilter === 'all') return exercises
    if (typeFilter === 'builtin') return exercises.filter((e) => e.is_built_in)
    return exercises.filter((e) => !e.is_built_in)
  }, [exercises, typeFilter])

  const builtInCount = useMemo(() => exercises.filter((e) => e.is_built_in).length, [exercises])
  const customCount = useMemo(() => exercises.filter((e) => !e.is_built_in).length, [exercises])

  const handleCreateExercise = async (data: ExerciseCreate) => {
    await exerciseService.createExercise(data)
    await loadExercises()
  }

  const handleUpdateExercise = async (data: ExerciseCreate) => {
    if (!exerciseToEdit) return
    await exerciseService.updateExercise(exerciseToEdit.id, data)
    setExerciseToEdit(null)
    await loadExercises()
  }

  const handleDeleteExercise = async (exercise: Exercise) => {
    if (!confirm(`Are you sure you want to delete custom exercise "${exercise.name}"?`)) {
      return
    }
    try {
      await exerciseService.deleteExercise(exercise.id)
      if (selectedExerciseForDetail?.id === exercise.id) {
        setSelectedExerciseForDetail(null)
      }
      await loadExercises()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete exercise.')
    }
  }

  const resetFilters = () => {
    setSearchQuery('')
    setSelectedMuscle('all')
    setSelectedEquipment('all')
    setSelectedCategory('all')
    setSelectedDifficulty('all')
    setTypeFilter('all')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Exercise Catalogue</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
              {exercises.length} Exercises
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Standard multi-joint compounds, isolation movements, target muscles, and equipment requirements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-2xs shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Custom Exercise</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3.5">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by name, cues, or target muscles..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Muscle
            </label>
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs"
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Equipment
            </label>
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs"
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq.value} value={eq.value}>
                  {eq.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Movement
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs"
            >
              {MOVEMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Difficulty
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs"
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Pills / Counters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({exercises.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('builtin')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                typeFilter === 'builtin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Built-in ({builtInCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('custom')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                typeFilter === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Custom ({customCount})
            </button>
          </div>

          {(searchQuery || selectedMuscle !== 'all' || selectedEquipment !== 'all' || selectedCategory !== 'all' || selectedDifficulty !== 'all') && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 font-medium">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading exercises...</span>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-1">
            No matching exercises found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Try adjusting your search keywords, muscle group, or equipment filters, or add a custom exercise.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Exercises Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onView={(ex) => setSelectedExerciseForDetail(ex)}
              onEdit={(ex) => setExerciseToEdit(ex)}
              onDelete={(ex) => handleDeleteExercise(ex)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedExerciseForDetail && (
        <ExerciseDetailModal
          exercise={selectedExerciseForDetail}
          onClose={() => setSelectedExerciseForDetail(null)}
          onEdit={(ex) => {
            setSelectedExerciseForDetail(null)
            setExerciseToEdit(ex)
          }}
          onDelete={(ex) => handleDeleteExercise(ex)}
        />
      )}

      {showCreateModal && (
        <ExerciseFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateExercise}
        />
      )}

      {exerciseToEdit && (
        <ExerciseFormModal
          initialExercise={exerciseToEdit}
          onClose={() => setExerciseToEdit(null)}
          onSave={handleUpdateExercise}
        />
      )}
    </div>
  )
}
