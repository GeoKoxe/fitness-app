import { useEffect, useState, type ChangeEvent } from 'react'
import type { AnyBackupPayload, SystemBackupV2, LegacyNutritionBackup } from '../../types/backup'
import { backupService } from '../../services/backupService'

interface NutritionBackupModalProps {
  onDataRestored: () => void
  onClose: () => void
}

interface BackupPreviewStats {
  version: string
  isV2: boolean
  profileName?: string | undefined
  measurementsCount: number
  foodsCount: number
  mealLogsCount: number
  recipesCount: number
  mealPlansCount: number
  customExercisesCount: number
  savedProfilesCount: number
  workoutPlansCount: number
  workoutSessionsCount: number
}

export function NutritionBackupModal({
  onDataRestored,
  onClose,
}: NutritionBackupModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [importData, setImportData] = useState<AnyBackupPayload | null>(null)
  const [previewStats, setPreviewStats] = useState<BackupPreviewStats | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleExport = async () => {
    setIsExporting(true)
    setStatusMessage(null)
    try {
      const data = await backupService.exportSystemBackup()
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `fitpulse_backup_${today}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatusMessage({ type: 'success', text: 'Complete system backup (v2.0) downloaded successfully.' })
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null)
    setImportData(null)
    setPreviewStats(null)

    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string) as Record<string, unknown>
        const version = String(raw.version ?? '')
        const format = String(raw.format ?? '')

        if (!version && !format) {
          throw new Error('Invalid backup file: Missing version or format specification.')
        }

        const isV2 = version === '2.0' || format === 'fitpulse_backup' || version.startsWith('2.')
        const isLegacy = version.startsWith('1.')

        if (!isV2 && !isLegacy) {
          throw new Error(`Unsupported backup version: '${version}'. Expected 1.x or 2.0.`)
        }

        if (isV2) {
          const v2 = raw as unknown as SystemBackupV2
          setPreviewStats({
            version: version || '2.0',
            isV2: true,
            profileName: v2.profile?.name ?? undefined,
            measurementsCount: v2.body_measurements?.length ?? 0,
            foodsCount: v2.nutrition?.foods?.length ?? 0,
            mealLogsCount: v2.nutrition?.meal_logs?.length ?? 0,
            recipesCount: v2.nutrition?.recipes?.length ?? 0,
            mealPlansCount: v2.nutrition?.meal_plans?.length ?? 0,
            customExercisesCount: v2.training?.custom_exercises?.length ?? 0,
            savedProfilesCount: v2.training?.saved_training_profiles?.length ?? 0,
            workoutPlansCount: v2.training?.workout_plans?.length ?? 0,
            workoutSessionsCount: v2.training?.workout_session_logs?.length ?? 0,
          })
        } else {
          const v1 = raw as unknown as LegacyNutritionBackup
          setPreviewStats({
            version,
            isV2: false,
            measurementsCount: 0,
            foodsCount: Array.isArray(v1.foods) ? v1.foods.length : 0,
            mealLogsCount: Array.isArray(v1.meal_logs) ? v1.meal_logs.length : 0,
            recipesCount: Array.isArray(v1.recipes) ? v1.recipes.length : 0,
            mealPlansCount: Array.isArray(v1.meal_plans) ? v1.meal_plans.length : 0,
            customExercisesCount: 0,
            savedProfilesCount: 0,
            workoutPlansCount: 0,
            workoutSessionsCount: 0,
          })
        }

        setImportData(raw)
      } catch (err: unknown) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Invalid JSON file.',
        })
        setImportData(null)
        setPreviewStats(null)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importData) return
    setIsImporting(true)
    setStatusMessage(null)
    try {
      const res = await backupService.importBackup(importData)
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message })
        setImportData(null)
        setPreviewStats(null)
        onDataRestored()
      } else {
        setStatusMessage({ type: 'error', text: res.message })
      }
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity motion-reduce:transition-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-left transition-colors motion-reduce:transition-none"
      >
        <div className="flex justify-between items-center pb-4 border-b border-sand dark:border-darkBorder">
          <div>
            <h2 id="backup-title" className="text-lg font-bold text-ink dark:text-darkInk">
              System Backup &amp; Restore
            </h2>
            <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
              Export and restore complete FitPulse nutrition, measurements, and workout data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk p-1.5 rounded-xl hover:bg-mist/40 dark:hover:bg-darkMist/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={`mt-4 p-3.5 rounded-xl text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-status-success dark:bg-darkSurface text-status-success-fg dark:text-emerald-400 border-border-card'
                : 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border-border-card'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="mt-4 space-y-6">
          {/* Export Section */}
          <div className="p-4 bg-canvas/60 dark:bg-darkCanvas/60 border border-sand dark:border-darkBorder rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-ink dark:text-darkInk">
              Export Complete Backup (v2.0)
            </h3>
            <p className="text-xs text-inkSecondary dark:text-darkInkSecondary leading-relaxed">
              Download a single versioned JSON file containing your user profile, body measurements, food catalogue, meal diary, recipes, custom exercises, routines, and workout history.
            </p>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Download Full System Backup'}</span>
            </button>
          </div>

          {/* Import Section */}
          <div className="pt-4 border-t border-sand dark:border-darkBorder space-y-2">
            <h3 className="text-sm font-bold text-ink dark:text-darkInk">
              Restore from Backup
            </h3>
            <p className="text-xs text-inkSecondary dark:text-darkInkSecondary leading-relaxed">
              Select a FitPulse backup JSON file (v2.0 complete backup or legacy v1.x nutrition backup). Existing records are safely preserved without creating duplicates.
            </p>
            <input
              id="nutrition-restore-file"
              name="nutrition-restore-file"
              type="file"
              accept=".json"
              aria-label="Upload FitPulse backup JSON file"
              onChange={handleFileChange}
              className="w-full text-xs text-inkSecondary dark:text-darkInkSecondary file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-sand dark:file:border-darkBorder file:text-xs file:font-semibold file:bg-canvas dark:file:bg-darkCanvas file:text-ink dark:file:text-darkInk hover:file:bg-mist/50 cursor-pointer pt-1"
            />

            {previewStats && (
              <div className="mt-3 p-4 bg-canvas/70 dark:bg-darkCanvas/70 rounded-2xl text-xs space-y-3 border border-sand dark:border-darkBorder">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink dark:text-darkInk">
                    Backup Contents Preview
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
                    {previewStats.isV2 ? `v${previewStats.version} Complete` : `v${previewStats.version} Legacy`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-inkSecondary dark:text-darkInkSecondary">
                  {previewStats.profileName && (
                    <div className="col-span-2 font-semibold text-ink dark:text-darkInk">
                      Profile: {previewStats.profileName}
                    </div>
                  )}
                  {previewStats.measurementsCount > 0 && (
                    <div>• {previewStats.measurementsCount} body measurements</div>
                  )}
                  <div>• {previewStats.foodsCount} foods</div>
                  <div>• {previewStats.mealLogsCount} logged meals</div>
                  {previewStats.recipesCount > 0 && (
                    <div>• {previewStats.recipesCount} recipes</div>
                  )}
                  {previewStats.mealPlansCount > 0 && (
                    <div>• {previewStats.mealPlansCount} meal plans</div>
                  )}
                  {previewStats.customExercisesCount > 0 && (
                    <div>• {previewStats.customExercisesCount} custom exercises</div>
                  )}
                  {previewStats.savedProfilesCount > 0 && (
                    <div>• {previewStats.savedProfilesCount} saved routines</div>
                  )}
                  {previewStats.workoutPlansCount > 0 && (
                    <div>• {previewStats.workoutPlansCount} workout plans</div>
                  )}
                  {previewStats.workoutSessionsCount > 0 && (
                    <div>• {previewStats.workoutSessionsCount} workout sessions</div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImport}
                  className="mt-3 w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-midnight text-white hover:opacity-95 dark:bg-darkMidnight dark:text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isImporting ? 'Restoring System Data...' : 'Confirm and Restore'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-sand dark:border-darkBorder text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
