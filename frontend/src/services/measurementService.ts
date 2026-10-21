import { request } from './api'
import type {
  BodyMeasurement,
  BodyMeasurementCreate,
  BodyMeasurementListResponse,
} from '../types/measurement'

export interface ListMeasurementParams {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}

export const measurementService = {
  async listMeasurements(
    params: ListMeasurementParams = {}
  ): Promise<BodyMeasurementListResponse> {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', params.page.toString())
    if (params.pageSize) searchParams.set('page_size', params.pageSize.toString())
    if (params.startDate) searchParams.set('start_date', params.startDate)
    if (params.endDate) searchParams.set('end_date', params.endDate)

    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<BodyMeasurementListResponse>(`/measurements${query}`)
  },

  async getLatestMeasurement(): Promise<BodyMeasurement | null> {
    return request<BodyMeasurement | null>('/measurements/latest')
  },

  async getMeasurement(id: number): Promise<BodyMeasurement> {
    return request<BodyMeasurement>(`/measurements/${id}`)
  },

  async createMeasurement(
    data: BodyMeasurementCreate
  ): Promise<BodyMeasurement> {
    return request<BodyMeasurement>('/measurements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deleteMeasurement(id: number): Promise<void> {
    return request<void>(`/measurements/${id}`, {
      method: 'DELETE',
    })
  },
}

