import type { BackupImportResult, LegacyNutritionBackup, SystemBackupV2 } from '../types/backup'
import { request } from './api'

export const backupService = {
  /**
   * Export complete v2.0 system backup covering profile, measurements, nutrition, and workouts.
   */
  exportSystemBackup: (): Promise<SystemBackupV2> =>
    request<SystemBackupV2>('/backup/export'),

  /**
   * Export legacy nutrition backup (v1.2) for backward compatibility.
   */
  exportNutrition: (): Promise<LegacyNutritionBackup> =>
    request<LegacyNutritionBackup>('/nutrition/export'),

  /**
   * Restore application data from a versioned JSON backup (supports both v2.0 and legacy v1.x).
   */
  importBackup: (data: unknown): Promise<BackupImportResult> =>
    request<BackupImportResult>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Legacy nutrition import endpoint (automatically handles legacy v1.x and v2.0).
   */
  importNutrition: (data: unknown): Promise<BackupImportResult> =>
    request<BackupImportResult>('/nutrition/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
