import type { NutritionExportData, NutritionImportResult } from '../types/nutrition'
import { request } from './api'

export const backupService = {
  exportNutrition: (): Promise<NutritionExportData> =>
    request<NutritionExportData>('/nutrition/export'),

  importNutrition: (data: NutritionExportData): Promise<NutritionImportResult> =>
    request<NutritionImportResult>('/nutrition/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

