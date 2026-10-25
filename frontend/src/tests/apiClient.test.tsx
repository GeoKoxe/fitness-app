import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError, request } from '../services/api'

describe('API Client Robustness', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses valid JSON response successfully', async () => {
    const mockData = { id: 1, name: 'Bench Press' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const result = await request<typeof mockData>('/exercises/1')
    expect(result).toEqual(mockData)
  })

  it('handles HTML 200 responses gracefully by throwing ApiError rather than JSON syntax error', async () => {
    const htmlSnippet = '<!doctype html><html><body>Error page</body></html>'
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(htmlSnippet, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    })

    await expect(request('/workouts/analytics/summary')).rejects.toThrow(ApiError)
    await expect(request('/workouts/analytics/summary')).rejects.toThrow(
      /Expected JSON response|received HTML/i
    )
  })

  it('extracts detail message from FastAPI HTTP error response', async () => {
    const errorBody = { detail: 'Limiting constraints: available equipment [barbell].' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    )

    try {
      await request('/workouts/plans/generate', { method: 'POST' })
      expect.fail('Should have thrown ApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).message).toBe(
        'Limiting constraints: available equipment [barbell].'
      )
      expect((err as ApiError).status).toBe(400)
    }
  })

  it('handles 204 No Content returning null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 })
    )

    const result = await request<void>('/workouts/profile/saved/1', {
      method: 'DELETE',
    })
    expect(result).toBeNull()
  })
})
