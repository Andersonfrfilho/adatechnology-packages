import type { HttpClientOptions, HttpResponse } from './types'
import { HttpError } from './types'

let getContextFn: (() => { requestId?: string; traceId?: string } | undefined) | null | undefined = undefined
async function loadContext() {
  if (getContextFn !== undefined) return
  try {
    const mod = await import('@adatechnology/logger')
    getContextFn = mod.getContext ?? null
  } catch {
    getContextFn = null
  }
}

export class HttpClient {
  private baseUrl: string
  private timeoutMs: number
  private retries: number
  private retryDelayMs: number
  private defaultHeaders: Record<string, string>

  constructor(opts: HttpClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? ''
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retries = opts.retries ?? 0
    this.retryDelayMs = opts.retryDelayMs ?? 500
    this.defaultHeaders = opts.headers ?? {}
  }

  private buildUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `${this.baseUrl}${path}`
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: RequestInit = {},
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path)
    const headers = new Headers(this.defaultHeaders)
    Object.entries(opts.headers || {}).forEach(([k, v]) => headers.set(k, v as string))
    if (body !== undefined && method !== 'GET') {
      headers.set('Content-Type', 'application/json')
    }

    await loadContext()
    const ctx = getContextFn?.()
    if (ctx?.requestId) headers.set('x-request-id', ctx.requestId)
    if (ctx?.traceId) headers.set('x-trace-id', ctx.traceId)

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        const res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          ...opts,
        })
        clearTimeout(timer)

        const contentType = res.headers.get('content-type') || ''
        const data = contentType.includes('application/json') ? await res.json() : await res.text()

        if (!res.ok) {
          throw new HttpError(`HTTP ${res.status}`, res.status, data)
        }

        return { status: res.status, data: data as T, headers: res.headers }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (err instanceof HttpError && err.status < 500) throw err
        if (attempt < this.retries) {
          await new Promise((r) => setTimeout(r, this.retryDelayMs * (attempt + 1)))
        }
      }
    }

    throw lastError ?? new Error('Request failed')
  }

  async get<T>(path: string, opts?: RequestInit): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, undefined, opts)
  }

  async post<T>(path: string, body?: unknown, opts?: RequestInit): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, body, opts)
  }

  async put<T>(path: string, body?: unknown, opts?: RequestInit): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, body, opts)
  }

  async patch<T>(path: string, body?: unknown, opts?: RequestInit): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', path, body, opts)
  }

  async delete<T>(path: string, opts?: RequestInit): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, undefined, opts)
  }
}

export function createHttpClient(opts?: HttpClientOptions): HttpClient {
  return new HttpClient(opts)
}
