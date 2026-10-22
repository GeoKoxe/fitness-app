import { useState, type ChangeEvent } from 'react'
import type { NutritionExportData } from '../../types/nutrition'
import { backupService } from '../../services/backupService'

interface NutritionBackupModalProps {
  onDataRestored: () => void
  onClose: () => void
}

export function NutritionBackupModal({
  onDataRestored,
  onClose,
}: NutritionBackupModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [importData, setImportData] = useState<NutritionExportData | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setStatusMessage(null)
    try {
      const data = await backupService.exportNutrition()
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `fitpulse_nutrition_backup_${today}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatusMessage({ type: 'success', text: 'Backup downloaded successfully.' })
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as NutritionExportData
        if (!parsed.version || !Array.isArray(parsed.foods) || !Array.isArray(parsed.meal_logs)) {
          throw new Error('Invalid backup file schema.')
        }
        setImportData(parsed)
      } catch (err: unknown) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Invalid JSON file.',
        })
        setImportData(null)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importData) return
    setIsImporting(true)
    setStatusMessage(null)
    try {
      const res = await backupService.importNutrition(importData)
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message })
        setImportData(null)
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-left">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="backup-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Nutrition Data Backup & Restore
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="mt-4 space-y-6">
          {/* Export Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Export Nutrition Data
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Download a complete JSON file with your food catalogue and historical meal logs.
            </p>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Download Backup File'}</span>
            </button>
          </div>

          {/* Import Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Restore from Backup
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Select a previously exported FitPulse JSON backup to restore.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />

            {importData && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Ready to Restore:
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  • {importData.foods.length} foods
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  • {importData.meal_logs.length} logged meals
                </div>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImport}
                  className="mt-2 w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  {isImporting ? 'Restoring...' : 'Confirm and Restore'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

