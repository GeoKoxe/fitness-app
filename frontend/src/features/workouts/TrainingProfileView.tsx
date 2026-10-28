import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Exercise } from '../../types/exercise'
import {
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
} from '../../types/exercise'
import type {
  ExperienceLevel,
  SavedTrainingProfile,
  TrainingProfile,
  Weekday,
} from '../../types/trainingProfile'
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  EXPERIENCE_LEVELS,
  TRAINING_GOALS,
  WEEKDAYS,
} from '../../types/trainingProfile'
import { exerciseService } from '../../services/exerciseService'
import { trainingProfileService } from '../../services/trainingProfileService'

const DRAFT_STORAGE_KEY = 'fitness_app_training_profile_draft'

interface DraftData {
  experienceLevel: ExperienceLevel
  trainingGoals: string[]
  availableDays: string[]
  durationMinutes: number
  availableEquipment: string[]
  excludedMuscles: string[]
  excludedExercises: string[]
  considerations: string
}

export function TrainingProfileView() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Exercise Catalogue for exclusions
  const [catalogueExercises, setCatalogueExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')

  // Original saved state from backend for diffing
  const [initialProfile, setInitialProfile] = useState<TrainingProfile | null>(null)

  // Saved named profile configurations
  const [savedConfigs, setSavedConfigs] = useState<SavedTrainingProfile[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState<number | null>(null)
  const [savedActionLoading, setSavedActionLoading] = useState(false)

  // Modals for saved configurations
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newConfigName, setNewConfigName] = useState('')
  const [newConfigDesc, setNewConfigDesc] = useState('')

  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameConfigName, setRenameConfigName] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Form Fields
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner')
  const [trainingGoals, setTrainingGoals] = useState<string[]>(['general_fitness'])
  const [availableDays, setAvailableDays] = useState<string[]>(['monday', 'wednesday', 'friday'])
  const [durationMinutes, setDurationMinutes] = useState<number>(60)
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(['bodyweight', 'dumbbell'])
  const [excludedMuscles, setExcludedMuscles] = useState<string[]>([])
  const [excludedExercises, setExcludedExercises] = useState<string[]>([])
  const [considerations, setConsiderations] = useState<string>('')

  // Escape key handler for open modals
  useEffect(() => {
    if (!showSaveModal && !showRenameModal && !showDeleteModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveModal(false)
        setShowRenameModal(false)
        setShowDeleteModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSaveModal, showRenameModal, showDeleteModal])

  // Helper to load draft from sessionStorage
  const getStoredDraft = (): DraftData | null => {
    try {
      const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  // Load Saved Configurations
  const loadSavedConfigs = useCallback(async () => {
    try {
      const configs = await trainingProfileService.listSavedConfigs()
      setSavedConfigs(configs)
    } catch {
      // Saved configs non-fatal
    }
  }, [])

  // Load Profile & Exercises on mount
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileData, exercisesData] = await Promise.all([
        trainingProfileService.getProfile(),
        exerciseService.getExercises({ limit: 300 }),
      ])

      setInitialProfile(profileData)
      setCatalogueExercises(exercisesData)

      // Check if uncommitted draft exists in session storage
      const draft = getStoredDraft()
      if (draft) {
        setExperienceLevel(draft.experienceLevel)
        setTrainingGoals(draft.trainingGoals)
        setAvailableDays(draft.availableDays)
        setDurationMinutes(draft.durationMinutes)
        setAvailableEquipment(draft.availableEquipment)
        setExcludedMuscles(draft.excludedMuscles)
        setExcludedExercises(draft.excludedExercises)
        setConsiderations(draft.considerations)
      } else {
        setExperienceLevel(profileData.experience_level || 'beginner')
        setTrainingGoals(profileData.training_goals?.length ? profileData.training_goals : ['general_fitness'])
        setAvailableDays(profileData.available_days?.length ? profileData.available_days : ['monday', 'wednesday', 'friday'])
        setDurationMinutes(profileData.preferred_duration_minutes || 60)
        setAvailableEquipment(profileData.available_equipment?.length ? profileData.available_equipment : ['bodyweight', 'dumbbell'])
        setExcludedMuscles(profileData.excluded_muscle_groups || [])
        setExcludedExercises(profileData.excluded_exercises || [])
        setConsiderations(profileData.training_considerations || '')
      }

      await loadSavedConfigs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load training profile.')
    } finally {
      setLoading(false)
    }
  }, [loadSavedConfigs])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Check if current form is dirty relative to initial saved state
  const hasUnsavedChanges = useMemo(() => {
    if (!initialProfile) return false

    const initialGoals = initialProfile.training_goals || ['general_fitness']
    const initialDays = initialProfile.available_days || ['monday', 'wednesday', 'friday']
    const initialDuration = initialProfile.preferred_duration_minutes || 60
    const initialEquip = initialProfile.available_equipment || ['bodyweight', 'dumbbell']
    const initialExMuscles = initialProfile.excluded_muscle_groups || []
    const initialExEx = initialProfile.excluded_exercises || []
    const initialNotes = initialProfile.training_considerations || ''

    if ((initialProfile.experience_level || 'beginner') !== experienceLevel) return true
    if (initialDuration !== durationMinutes) return true
    if (initialNotes !== considerations) return true

    const sortedGoals = [...trainingGoals].sort()
    const sortedInitGoals = [...initialGoals].sort()
    if (JSON.stringify(sortedGoals) !== JSON.stringify(sortedInitGoals)) return true

    const sortedDays = [...availableDays].sort()
    const sortedInitDays = [...initialDays].sort()
    if (JSON.stringify(sortedDays) !== JSON.stringify(sortedInitDays)) return true

    const sortedEquip = [...availableEquipment].sort()
    const sortedInitEquip = [...initialEquip].sort()
    if (JSON.stringify(sortedEquip) !== JSON.stringify(sortedInitEquip)) return true

    const sortedExMuscles = [...excludedMuscles].sort()
    const sortedInitExMuscles = [...initialExMuscles].sort()
    if (JSON.stringify(sortedExMuscles) !== JSON.stringify(sortedInitExMuscles)) return true

    const sortedExEx = [...excludedExercises].sort()
    const sortedInitExEx = [...initialExEx].sort()
    if (JSON.stringify(sortedExEx) !== JSON.stringify(sortedInitExEx)) return true

    return false
  }, [
    initialProfile,
    experienceLevel,
    trainingGoals,
    availableDays,
    durationMinutes,
    availableEquipment,
    excludedMuscles,
    excludedExercises,
    considerations,
  ])

  // Sync draft to sessionStorage on changes
  useEffect(() => {
    if (!initialProfile) return
    if (hasUnsavedChanges) {
      const draft: DraftData = {
        experienceLevel,
        trainingGoals,
        availableDays,
        durationMinutes,
        availableEquipment,
        excludedMuscles,
        excludedExercises,
        considerations,
      }
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      } catch {
        // Storage fail non-fatal
      }
    } else {
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY)
      } catch {
        // Ignore
      }
    }
  }, [
    hasUnsavedChanges,
    initialProfile,
    experienceLevel,
    trainingGoals,
    availableDays,
    durationMinutes,
    availableEquipment,
    excludedMuscles,
    excludedExercises,
    considerations,
  ])

  // Discard edits and revert to initial saved state
  const handleDiscardChanges = () => {
    if (!initialProfile) return
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // Ignore
    }
    setExperienceLevel(initialProfile.experience_level || 'beginner')
    setTrainingGoals(initialProfile.training_goals?.length ? initialProfile.training_goals : ['general_fitness'])
    setAvailableDays(initialProfile.available_days?.length ? initialProfile.available_days : ['monday', 'wednesday', 'friday'])
    setDurationMinutes(initialProfile.preferred_duration_minutes || 60)
    setAvailableEquipment(initialProfile.available_equipment?.length ? initialProfile.available_equipment : ['bodyweight', 'dumbbell'])
    setExcludedMuscles(initialProfile.excluded_muscle_groups || [])
    setExcludedExercises(initialProfile.excluded_exercises || [])
    setConsiderations(initialProfile.training_considerations || '')
    setError(null)
    setSuccessMessage('Profile reset to last saved state.')
    setTimeout(() => setSuccessMessage(null), 3500)
  }

  // Toggles
  const toggleGoal = (goalVal: string) => {
    if (trainingGoals.includes(goalVal)) {
      if (trainingGoals.length <= 1) {
        setError('At least one training goal must be selected.')
        return
      }
      setTrainingGoals(trainingGoals.filter((g) => g !== goalVal))
    } else {
      setError(null)
      setTrainingGoals([...trainingGoals, goalVal])
    }
  }

  const toggleDay = (dayVal: Weekday) => {
    if (availableDays.includes(dayVal)) {
      if (availableDays.length <= 1) {
        setError('At least one workout day must be selected.')
        return
      }
      setAvailableDays(availableDays.filter((d) => d !== dayVal))
    } else {
      setError(null)
      setAvailableDays([...availableDays, dayVal])
    }
  }

  const toggleEquipment = (eqVal: string) => {
    if (availableEquipment.includes(eqVal)) {
      setAvailableEquipment(availableEquipment.filter((e) => e !== eqVal))
    } else {
      setAvailableEquipment([...availableEquipment, eqVal])
    }
  }

  const toggleExcludedMuscle = (muscleVal: string) => {
    if (excludedMuscles.includes(muscleVal)) {
      setExcludedMuscles(excludedMuscles.filter((m) => m !== muscleVal))
    } else {
      setExcludedMuscles([...excludedMuscles, muscleVal])
    }
  }

  const addExcludedExercise = (slug: string) => {
    if (!excludedExercises.includes(slug)) {
      setExcludedExercises([...excludedExercises, slug])
    }
    setExerciseSearch('')
  }

  const removeExcludedExercise = (slug: string) => {
    setExcludedExercises(excludedExercises.filter((s) => s !== slug))
  }

  // Exercises available for exclusion matching search query
  const availableExercisesForExclusion = useMemo(() => {
    if (!exerciseSearch.trim()) return []
    const q = exerciseSearch.toLowerCase()
    return catalogueExercises.filter(
      (e) =>
        !excludedExercises.includes(e.slug) &&
        (e.name.toLowerCase().includes(q) ||
          e.slug.toLowerCase().includes(q) ||
          e.primary_muscle.toLowerCase().includes(q))
    )
  }, [catalogueExercises, excludedExercises, exerciseSearch])

  // Filter valid equipment (excluding 'all')
  const validEquipmentOptions = useMemo(
    () => EQUIPMENT_OPTIONS.filter((e) => e.value !== 'all'),
    []
  )

  // Filter valid muscle groups (excluding 'all')
  const validMuscleGroups = useMemo(
    () => MUSCLE_GROUPS.filter((m) => m.value !== 'all'),
    []
  )

  // Save handler for active profile
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (trainingGoals.length === 0) {
      setError('Please select at least one training goal.')
      return
    }

    if (availableDays.length === 0) {
      setError('Please select at least one available training day.')
      return
    }

    if (durationMinutes < 15 || durationMinutes > 180) {
      setError('Preferred session duration must be between 15 and 180 minutes.')
      return
    }

    if (durationMinutes % 15 !== 0) {
      setError('Preferred session duration must be a multiple of 15 minutes.')
      return
    }

    setSaving(true)
    try {
      const updated = await trainingProfileService.updateProfile({
        experience_level: experienceLevel,
        training_goals: trainingGoals,
        available_days: availableDays,
        preferred_duration_minutes: durationMinutes,
        available_equipment: availableEquipment,
        excluded_exercises: excludedExercises,
        excluded_muscle_groups: excludedMuscles,
        training_considerations: considerations.trim() ? considerations.trim() : null,
      })

      setInitialProfile(updated)
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY)
      } catch {
        // Ignore
      }
      setSuccessMessage('Training profile and preferences saved successfully!')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save training profile.')
    } finally {
      setSaving(false)
    }
  }

  // Saved Config Handlers
  const handleCreateSavedConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newConfigName.trim()) {
      setError('Please provide a name for this saved configuration.')
      return
    }

    setSavedActionLoading(true)
    setError(null)
    try {
      const created = await trainingProfileService.createSavedConfig({
        name: newConfigName.trim(),
        description: newConfigDesc.trim() || null,
        experience_level: experienceLevel,
        training_goals: trainingGoals,
        available_days: availableDays,
        preferred_duration_minutes: durationMinutes,
        available_equipment: availableEquipment,
        excluded_exercises: excludedExercises,
        excluded_muscle_groups: excludedMuscles,
        training_considerations: considerations.trim() || null,
      })

      setSavedConfigs((prev) => [...prev, created])
      setSelectedSavedId(created.id)
      setShowSaveModal(false)
      setNewConfigName('')
      setNewConfigDesc('')
      setSuccessMessage(`Saved configuration "${created.name}" created successfully!`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration.')
    } finally {
      setSavedActionLoading(false)
    }
  }

  const handleLoadSavedConfigIntoEditor = (config: SavedTrainingProfile) => {
    setExperienceLevel(config.experience_level)
    setTrainingGoals(config.training_goals?.length ? config.training_goals : ['general_fitness'])
    setAvailableDays(config.available_days?.length ? config.available_days : ['monday', 'wednesday', 'friday'])
    setDurationMinutes(config.preferred_duration_minutes || 60)
    setAvailableEquipment(config.available_equipment || [])
    setExcludedMuscles(config.excluded_muscle_groups || [])
    setExcludedExercises(config.excluded_exercises || [])
    setConsiderations(config.training_considerations || '')
    setSuccessMessage(`Loaded "${config.name}" into editor. Click Save Configuration to commit as active.`)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const handleApplySavedConfigDirectly = async (configId: number) => {
    setSavedActionLoading(true)
    setError(null)
    try {
      const updated = await trainingProfileService.applySavedConfig(configId)
      setInitialProfile(updated)
      setExperienceLevel(updated.experience_level)
      setTrainingGoals(updated.training_goals)
      setAvailableDays(updated.available_days)
      setDurationMinutes(updated.preferred_duration_minutes)
      setAvailableEquipment(updated.available_equipment)
      setExcludedMuscles(updated.excluded_muscle_groups)
      setExcludedExercises(updated.excluded_exercises)
      setConsiderations(updated.training_considerations || '')
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY)
      } catch {
        // Ignore
      }
      const applied = savedConfigs.find((c) => c.id === configId)
      setSuccessMessage(`Applied "${applied?.name || 'configuration'}" to active training profile!`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply configuration.')
    } finally {
      setSavedActionLoading(false)
    }
  }

  const handleRenameSavedConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSavedId || !renameConfigName.trim()) return

    setSavedActionLoading(true)
    setError(null)
    try {
      const updated = await trainingProfileService.updateSavedConfig(selectedSavedId, {
        name: renameConfigName.trim(),
      })
      setSavedConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setShowRenameModal(false)
      setSuccessMessage(`Renamed configuration to "${updated.name}"!`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename configuration.')
    } finally {
      setSavedActionLoading(false)
    }
  }

  const handleDeleteSavedConfig = async () => {
    if (!selectedSavedId) return

    setSavedActionLoading(true)
    setError(null)
    try {
      await trainingProfileService.deleteSavedConfig(selectedSavedId)
      const deleted = savedConfigs.find((c) => c.id === selectedSavedId)
      setSavedConfigs((prev) => prev.filter((c) => c.id !== selectedSavedId))
      setSelectedSavedId(null)
      setShowDeleteModal(false)
      setSuccessMessage(`Deleted configuration "${deleted?.name || ''}"!`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration.')
    } finally {
      setSavedActionLoading(false)
    }
  }

  const selectedConfig = useMemo(
    () => savedConfigs.find((c) => c.id === selectedSavedId) || null,
    [savedConfigs, selectedSavedId]
  )

  if (loading) {
    return (
      <div className="bg-surface border border-edge rounded-2xl p-10 text-center space-y-4">
        <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-inkSecondary">Loading training profile and equipment settings...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 text-left">
      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="bg-status-warning-bg border border-status-warning-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-warning-fg animate-pulse shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-status-warning-fg">
                You have unsaved changes to this profile
              </p>
              <p className="text-[11px] text-inkSecondary">
                Edits are preserved across tabs. Commit changes to update routine generation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-status-warning-border text-status-warning-fg hover:bg-surface transition cursor-pointer"
            >
              Discard Edits
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Training Profile & Equipment
            </h2>
            <p className="text-xs text-inkSecondary mt-1 max-w-2xl leading-relaxed">
              Define your lifting experience, weekly availability, gear access, and exercise exclusions. These parameters drive weekly workout routines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving || !hasUnsavedChanges}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted transition disabled:opacity-50 cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div role="alert" className="mt-4 p-3 bg-status-danger-bg border border-status-danger-border rounded-xl text-xs text-status-danger-fg flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div role="status" className="mt-4 p-3 bg-status-success-bg border border-status-success-border rounded-xl text-xs text-status-success-fg flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Saved Named Profile Configurations Toolbar */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>Saved Training Profile Presets</span>
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Save named setups (e.g. Travel Bodyweight, Gym Strength, Home 30-min) and switch instantly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewConfigName('')
              setNewConfigDesc('')
              setShowSaveModal(true)
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Save as New Profile</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            id="saved-config-select"
            name="saved-config-select"
            aria-label="Select saved configuration"
            value={selectedSavedId ?? ''}
            onChange={(e) => setSelectedSavedId(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-xs bg-surface border border-edge text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
          >
            <option value="">Select a saved configuration...</option>
            {savedConfigs.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.name} ({cfg.preferred_duration_minutes} min, {cfg.available_days.length} days)
              </option>
            ))}
          </select>

          {selectedConfig && (
            <>
              <button
                type="button"
                onClick={() => handleLoadSavedConfigIntoEditor(selectedConfig)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surfaceMuted border border-edge text-ink hover:bg-surfaceRaised transition cursor-pointer"
              >
                Load into Form
              </button>
              <button
                type="button"
                onClick={() => handleApplySavedConfigDirectly(selectedConfig.id)}
                disabled={savedActionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                Apply to Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenameConfigName(selectedConfig.name)
                  setShowRenameModal(true)
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted transition cursor-pointer"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-status-danger-border text-status-danger-fg hover:bg-status-danger-bg transition cursor-pointer"
              >
                Delete
              </button>
            </>
          )}
        </div>

        {selectedConfig?.description && (
          <p className="text-xs text-inkSecondary italic">
            "{selectedConfig.description}"
          </p>
        )}
      </div>

      {/* 1. Experience Level Selection */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <span>1. Experience Level</span>
            <span className="text-[10px] text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full font-medium">
              Required
            </span>
          </h3>
          <p className="text-xs text-inkSecondary mt-0.5">
            Select your resistance training background to set baseline exercise complexity and progressive overload schemes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {EXPERIENCE_LEVELS.map((lvl) => {
            const isSelected = experienceLevel === lvl.value
            return (
              <button
                key={lvl.value}
                type="button"
                aria-label={lvl.label}
                onClick={() => setExperienceLevel(lvl.value)}
                className={`text-left p-4 rounded-xl border transition relative flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-brand bg-brand/10 ring-1 ring-brand'
                    : 'border-edge hover:border-brand/40 bg-surface'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-ink">
                      {lvl.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                      isSelected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surfaceMuted text-inkSecondary border-edge'
                    }`}>
                      {lvl.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-inkSecondary mt-2 leading-relaxed">
                    {lvl.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-edge flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                  {isSelected ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Active Selection</span>
                    </>
                  ) : (
                    <span className="text-inkMuted font-normal">Click to select</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Training Goals */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <span>2. Primary Training Goals</span>
            <span className="text-[10px] text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full font-medium">
              Multiple Allowed
            </span>
          </h3>
          <p className="text-xs text-inkSecondary mt-0.5">
            Choose one or more objectives to optimize rep ranges, rest intervals, and volume density.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRAINING_GOALS.map((goal) => {
            const isSelected = trainingGoals.includes(goal.value)
            return (
              <button
                key={goal.value}
                type="button"
                aria-label={goal.label}
                onClick={() => toggleGoal(goal.value)}
                className={`text-left p-3.5 rounded-xl border transition flex items-start gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-brand bg-brand/10 ring-1 ring-brand'
                    : 'border-edge hover:border-brand/40 bg-surface'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-brand border-brand text-white'
                      : 'border-edge bg-surface'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="font-bold text-xs text-ink block">
                    {goal.label}
                  </span>
                  <span className="text-[11px] text-inkSecondary mt-0.5 block leading-normal">
                    {goal.description}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Weekly Availability & Preferred Duration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Training Days */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">
                3. Available Workout Days
              </h3>
              <p className="text-xs text-inkSecondary mt-0.5">
                Explicit weekdays you can commit to exercising.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-brand/10 text-brand border border-brand/20">
              {availableDays.length} {availableDays.length === 1 ? 'day' : 'days'} / wk
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {WEEKDAYS.map((day) => {
              const isSelected = availableDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-label={day.label}
                  onClick={() => toggleDay(day.value)}
                  className={`py-3 px-1 rounded-xl text-center border transition flex flex-col items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'border-brand bg-brand text-white font-bold shadow-xs'
                      : 'border-edge bg-surface text-inkSecondary hover:bg-surfaceMuted'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider">{day.short}</span>
                  <span className="text-[9px] opacity-80">{isSelected ? '✓' : '—'}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px] text-inkSecondary">
            <span>Quick split presets:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAvailableDays(['monday', 'wednesday', 'friday'])}
                className="px-2 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink transition cursor-pointer"
              >
                3-Day (M/W/F)
              </button>
              <button
                type="button"
                onClick={() => setAvailableDays(['monday', 'tuesday', 'thursday', 'friday'])}
                className="px-2 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink transition cursor-pointer"
              >
                4-Day Upper/Lower
              </button>
              <button
                type="button"
                onClick={() => setAvailableDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])}
                className="px-2 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink transition cursor-pointer"
              >
                5-Day Split
              </button>
            </div>
          </div>
        </div>

        {/* Preferred Workout Duration with strict 15-minute steps */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">
                4. Preferred Session Duration
              </h3>
              <p className="text-xs text-inkSecondary mt-0.5">
                Target workout time per session (15 – 180 min, in 15-min increments).
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-ink">
                {durationMinutes}
              </span>
              <span className="text-xs text-inkSecondary ml-1">minutes</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <input
              id="training-duration-range"
              name="training-duration-range"
              type="range"
              aria-label="Preferred workout duration in minutes"
              min={15}
              max={180}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full accent-brand h-2 bg-surfaceMuted border border-edge rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-inkSecondary">
              <span>15m</span>
              <span>45m</span>
              <span>60m</span>
              <span>90m</span>
              <span>120m</span>
              <span>150m</span>
              <span>180m</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px] text-inkSecondary">
            <span>Duration presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60, 75, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMinutes(m)}
                  className={`px-2.5 py-1 rounded-lg transition text-xs font-semibold cursor-pointer border ${
                    durationMinutes === m
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : 'bg-surfaceMuted border-edge text-ink hover:bg-surfaceRaised'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Equipment Configuration */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span>5. Available Equipment</span>
              <span className="text-[10px] text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full font-medium">
                {availableEquipment.length} Selected
              </span>
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Check all equipment you have access to. If none selected, bodyweight movements are automatically used.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setAvailableEquipment(validEquipmentOptions.map((e) => e.value))}
              className="px-2.5 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink font-medium transition cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setAvailableEquipment(['bodyweight'])}
              className="px-2.5 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink font-medium transition cursor-pointer"
            >
              Bodyweight Only
            </button>
            <button
              type="button"
              onClick={() => setAvailableEquipment(DEFAULT_AVAILABLE_EQUIPMENT)}
              className="px-2.5 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink font-medium transition cursor-pointer"
            >
              Standard Gym
            </button>
            <button
              type="button"
              onClick={() => setAvailableEquipment([])}
              className="px-2.5 py-1 rounded-lg bg-surfaceMuted hover:bg-surfaceRaised border border-edge text-ink font-medium transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
          {validEquipmentOptions.map((eq) => {
            const isSelected = availableEquipment.includes(eq.value)
            return (
              <button
                key={eq.value}
                type="button"
                aria-label={eq.label}
                onClick={() => toggleEquipment(eq.value)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-brand bg-brand/10 text-ink ring-1 ring-brand'
                    : 'border-edge hover:border-brand/40 bg-surface text-inkSecondary'
                }`}
              >
                <span className="text-xs font-semibold">{eq.label}</span>
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-brand border-brand text-white'
                      : 'border-edge bg-surface'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 5. Exclusions (Muscle Groups & Specific Exercises) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Muscle Group Exclusions */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span>6. Excluded Muscle Groups</span>
              {excludedMuscles.length > 0 && (
                <span className="text-[10px] text-status-warning-fg bg-status-warning-bg border border-status-warning-border px-2 py-0.5 rounded-full font-medium">
                  {excludedMuscles.length} Excluded
                </span>
              )}
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Select muscle groups to avoid due to acute injury, rehab, or joint limitations.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {validMuscleGroups.map((m) => {
              const isExcluded = excludedMuscles.includes(m.value)
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleExcludedMuscle(m.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    isExcluded
                      ? 'bg-status-warning-bg border-status-warning-border text-status-warning-fg'
                      : 'border-edge bg-surfaceMuted text-ink hover:bg-surfaceRaised'
                  }`}
                >
                  {isExcluded ? `✕ ${m.label}` : m.label}
                </button>
              )
            })}
          </div>
          {excludedMuscles.length > 0 && (
            <button
              type="button"
              onClick={() => setExcludedMuscles([])}
              className="text-[11px] text-inkSecondary hover:text-ink underline block cursor-pointer"
            >
              Clear all muscle exclusions
            </button>
          )}
        </div>

        {/* Specific Exercise Exclusions */}
        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span>7. Excluded Specific Exercises</span>
              {excludedExercises.length > 0 && (
                <span className="text-[10px] text-status-warning-fg bg-status-warning-bg border border-status-warning-border px-2 py-0.5 rounded-full font-medium">
                  {excludedExercises.length} Excluded
                </span>
              )}
            </h3>
            <p className="text-xs text-inkSecondary mt-0.5">
              Exclude specific movements you cannot perform or wish to avoid.
            </p>
          </div>

          {/* Active excluded exercise pills */}
          {excludedExercises.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-edge rounded-xl bg-surfaceMuted">
              {excludedExercises.map((slug) => {
                const ex = catalogueExercises.find((e) => e.slug === slug)
                const displayName = ex ? ex.name : slug.replace(/_/g, ' ')
                return (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-status-danger-bg border border-status-danger-border text-status-danger-fg"
                  >
                    <span>{displayName}</span>
                    <button
                      type="button"
                      onClick={() => removeExcludedExercise(slug)}
                      className="hover:opacity-75 cursor-pointer font-bold"
                      aria-label={`Remove ${displayName} from exclusions`}
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-inkSecondary italic">No specific exercises excluded.</p>
          )}

          {/* Search to exclude exercise */}
          <div className="space-y-2">
            <div className="relative">
              <input
                id="exclude-exercise-search"
                name="exclude-exercise-search"
                type="text"
                placeholder="Search exercise to exclude..."
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
                aria-label="Search exercise to exclude"
                className="w-full px-3 py-2 pl-9 rounded-xl text-xs bg-surface border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-inkMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {exerciseSearch.trim() && (
              <div className="max-h-36 overflow-y-auto border border-edge rounded-xl bg-surface divide-y divide-edge shadow-sm text-xs">
                {availableExercisesForExclusion.length === 0 ? (
                  <div className="p-3 text-inkSecondary text-center">No matching exercises found</div>
                ) : (
                  availableExercisesForExclusion.slice(0, 10).map((ex) => (
                    <button
                      key={ex.slug}
                      type="button"
                      onClick={() => addExcludedExercise(ex.slug)}
                      className="w-full text-left px-3.5 py-2 hover:bg-surfaceMuted flex items-center justify-between text-ink transition cursor-pointer"
                    >
                      <span className="font-medium text-ink">{ex.name}</span>
                      <span className="text-[10px] text-inkSecondary capitalize">{ex.primary_muscle}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Training Considerations & Limitations */}
      <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink">
            8. Training Considerations & Physical Limitations
          </h3>
          <p className="text-xs text-inkSecondary mt-0.5">
            Add any relevant orthopedic history, joint pain, mobility constraints, or notes for your training routines.
          </p>
        </div>

        <textarea
          id="training-considerations"
          name="training-considerations"
          rows={3}
          value={considerations}
          onChange={(e) => setConsiderations(e.target.value)}
          placeholder="E.g. Mild right rotator cuff discomfort on overhead pressing; prefer neutral grip dumbbell bench; avoiding heavy axial spinal loading..."
          aria-label="Training considerations and physical limitations"
          className="w-full p-3 rounded-xl text-xs bg-surface border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand leading-relaxed"
        />
      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleDiscardChanges}
          disabled={saving || !hasUnsavedChanges}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink hover:bg-surfaceMuted transition disabled:opacity-50 cursor-pointer"
        >
          Reset Changes
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Training Profile...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Training Profile</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL: Save as New Profile */}
      {showSaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-profile-preset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-surface rounded-2xl border border-edge p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
            <h3 id="save-profile-preset-title" className="text-base font-bold text-ink">
              Save as New Profile Configuration
            </h3>
            <p className="text-xs text-inkSecondary">
              Save the current settings (duration, split, equipment, exclusions) as a reusable named preset.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="new-preset-name" className="text-xs font-semibold text-ink uppercase tracking-wider block mb-1">
                  Configuration Name *
                </label>
                <input
                  id="new-preset-name"
                  type="text"
                  placeholder="e.g. Travel Bodyweight Routine"
                  value={newConfigName}
                  onChange={(e) => setNewConfigName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-surface border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="new-preset-desc" className="text-xs font-semibold text-ink uppercase tracking-wider block mb-1">
                  Description (optional)
                </label>
                <input
                  id="new-preset-desc"
                  type="text"
                  placeholder="e.g. 30-min quick hotel room sessions"
                  value={newConfigDesc}
                  onChange={(e) => setNewConfigDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-surface border border-edge text-ink placeholder:text-inkMuted focus:outline-hidden focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSavedConfig}
                disabled={savedActionLoading || !newConfigName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {savedActionLoading ? 'Saving...' : 'Save Profile Preset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Rename Saved Configuration */}
      {showRenameModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-profile-preset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-surface rounded-2xl border border-edge p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
            <h3 id="rename-profile-preset-title" className="text-base font-bold text-ink">
              Rename Profile Configuration
            </h3>
            <div>
              <label htmlFor="rename-preset-name" className="text-xs font-semibold text-ink uppercase tracking-wider block mb-1">
                New Name *
              </label>
              <input
                id="rename-preset-name"
                type="text"
                value={renameConfigName}
                onChange={(e) => setRenameConfigName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-surface border border-edge text-ink focus:outline-hidden focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameSavedConfig}
                disabled={savedActionLoading || !renameConfigName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brandHover text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {savedActionLoading ? 'Saving...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Saved Configuration Confirmation */}
      {showDeleteModal && selectedConfig && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-profile-preset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-surface rounded-2xl border border-edge p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
            <h3 id="delete-profile-preset-title" className="text-base font-bold text-status-danger-fg">
              Delete Configuration
            </h3>
            <p className="text-xs text-inkSecondary leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-ink">"{selectedConfig.name}"</span>? This configuration preset will be permanently removed.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-edge text-inkSecondary hover:text-ink bg-surfaceMuted hover:bg-surfaceRaised transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSavedConfig}
                disabled={savedActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-status-danger-bg hover:opacity-90 border border-status-danger-border text-status-danger-fg transition disabled:opacity-50 cursor-pointer"
              >
                {savedActionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
