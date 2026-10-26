import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NutritionBackupModal } from '../features/nutrition/NutritionBackupModal'
import { backupService } from '../services/backupService'
import type { SystemBackupV2 } from '../types/backup'

vi.mock('../services/backupService', () => ({
  backupService: {
    exportSystemBackup: vi.fn(),
    exportNutrition: vi.fn(),
    importBackup: vi.fn(),
    importNutrition: vi.fn(),
  },
}))

describe('NutritionBackupModal', () => {
  const mockOnDataRestored = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal with export and restore controls', () => {
    render(
      <NutritionBackupModal
        onDataRestored={mockOnDataRestored}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByRole('heading', { name: /System Backup & Restore/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Download Full System Backup/i })).toBeDefined()
    expect(screen.getByText(/Select a FitPulse backup JSON file/i)).toBeDefined()
  })

  it('triggers exportSystemBackup on export button click', async () => {
    const mockBackup = {
      format: 'fitpulse_backup',
      version: '2.0',
      exported_at: '2026-10-26T20:00:00Z',
      app_version: '0.1.0',
      profile: { name: 'Alex' },
      nutrition: { foods: [], meal_logs: [] },
      training: { custom_exercises: [], workout_plans: [], workout_session_logs: [] },
    }
    vi.mocked(backupService.exportSystemBackup).mockResolvedValue(mockBackup as unknown as SystemBackupV2)

    render(
      <NutritionBackupModal
        onDataRestored={mockOnDataRestored}
        onClose={mockOnClose}
      />
    )

    const exportBtn = screen.getByRole('button', { name: /Download Full System Backup/i })
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(backupService.exportSystemBackup).toHaveBeenCalledTimes(1)
    })
  })

  it('previews v2.0 backup file and executes restoration upon confirmation', async () => {
    vi.mocked(backupService.importBackup).mockResolvedValue({
      success: true,
      imported_foods: 5,
      imported_meal_logs: 10,
      imported_workout_plans: 1,
      imported_workout_sessions: 3,
      skipped_duplicates: 0,
      message: 'Successfully restored 5 foods, 10 meal logs, 1 workout plans, 3 workout session logs.',
    })

    const { container } = render(
      <NutritionBackupModal
        onDataRestored={mockOnDataRestored}
        onClose={mockOnClose}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDefined()

    const v2Backup = {
      format: 'fitpulse_backup',
      version: '2.0',
      profile: { name: 'Sam Taylor' },
      body_measurements: [{ weight_kg: 75.0 }],
      nutrition: {
        foods: [{ id: 1, name: 'Oats' }, { id: 2, name: 'Eggs' }],
        meal_logs: [{ id: 1, food_name: 'Oats' }],
        recipes: [{ id: 1, name: 'Protein Shake' }],
        meal_plans: [],
      },
      training: {
        custom_exercises: [{ slug: 'pause_squat', name: 'Pause Squat' }],
        saved_training_profiles: [],
        workout_plans: [{ id: 1, name: 'Push Pull Legs' }],
        workout_session_logs: [{ id: 1, session_name: 'Push Day 1' }],
      },
    }

    const file = new File([JSON.stringify(v2Backup)], 'fitpulse_backup.json', {
      type: 'application/json',
    })

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Verify preview card appears with v2.0 Complete badge and counts
    await waitFor(() => {
      expect(screen.getByText(/Backup Contents Preview/i)).toBeDefined()
      expect(screen.getByText('v2.0 Complete')).toBeDefined()
      expect(screen.getByText(/Profile: Sam Taylor/i)).toBeDefined()
      expect(screen.getByText(/• 1 body measurements/i)).toBeDefined()
      expect(screen.getByText(/• 2 foods/i)).toBeDefined()
      expect(screen.getByText(/• 1 logged meals/i)).toBeDefined()
      expect(screen.getByText(/• 1 custom exercises/i)).toBeDefined()
    })

    // Click confirm restore
    const confirmBtn = screen.getByRole('button', { name: /Confirm and Restore/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(backupService.importBackup).toHaveBeenCalledTimes(1)
      expect(mockOnDataRestored).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Successfully restored 5 foods/i)).toBeDefined()
    })
  })

  it('previews legacy v1.2 backup and restores cleanly', async () => {
    vi.mocked(backupService.importBackup).mockResolvedValue({
      success: true,
      imported_foods: 3,
      imported_meal_logs: 2,
      skipped_duplicates: 0,
      message: 'Successfully restored 3 foods, 2 meal logs.',
    })

    const { container } = render(
      <NutritionBackupModal
        onDataRestored={mockOnDataRestored}
        onClose={mockOnClose}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const legacyBackup = {
      version: '1.2',
      foods: [{ id: 1, name: 'Banana' }],
      meal_logs: [{ id: 1, food_name: 'Banana' }],
    }

    const file = new File([JSON.stringify(legacyBackup)], 'legacy_backup.json', {
      type: 'application/json',
    })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/v1.2 Legacy/i)).toBeDefined()
      expect(screen.getByText(/• 1 foods/i)).toBeDefined()
      expect(screen.getByText(/• 1 logged meals/i)).toBeDefined()
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm and Restore/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(backupService.importBackup).toHaveBeenCalledTimes(1)
      expect(mockOnDataRestored).toHaveBeenCalledTimes(1)
    })
  })

  it('displays error message when invalid JSON is uploaded', async () => {
    const { container } = render(
      <NutritionBackupModal
        onDataRestored={mockOnDataRestored}
        onClose={mockOnClose}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['this is not valid json!'], 'broken.json', {
      type: 'application/json',
    })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/not valid JSON/i)).toBeDefined()
    })
  })
})
