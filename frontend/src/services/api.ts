/**
 * Production and Development API Base Configuration:
 * - In production (PROD), defaults to relative '/api' which works seamlessly with reverse proxies
 *   (e.g., Nginx, Caddy) routing /api/* requests directly to FastAPI without CORS overhead.
 * - Custom domains can be configured at build time by setting the VITE_API_URL environment variable.
 * - In local development (DEV), defaults to 'http://localhost:8000/api' or Vite's /api proxy.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api')

export class ApiError extends Error {
  status: number
  override message: string
  data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.message = message
    this.data = data
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint.startsWith('/api')
      ? endpoint.slice(4)
      : endpoint

  const cleanEndpoint = normalizedEndpoint.startsWith('/')
    ? normalizedEndpoint
    : `/${normalizedEndpoint}`

  const url = `${API_BASE_URL}${cleanEndpoint}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return null as T
  }

  const contentType = response.headers.get('content-type')
  const isJson = contentType && contentType.includes('application/json')

  let data: unknown
  if (isJson) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
      }
    } else if (typeof data === 'string' && data.includes('<!doctype html>')) {
      message = `Server returned HTML instead of JSON (Status ${response.status}). Check backend service status.`
    }
    throw new ApiError(response.status, message, data)
  }

  if (!isJson && typeof data === 'string' && data.trim().startsWith('<')) {
    throw new ApiError(
      response.status,
      `Expected JSON response from ${cleanEndpoint} but received HTML. Ensure backend server is reachable.`,
      data
    )
  }

  return data as T
}
