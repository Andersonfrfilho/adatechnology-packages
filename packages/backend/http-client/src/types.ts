export interface HttpClientOptions {
  baseUrl?: string
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  headers?: Record<string, string>
}

export interface HttpResponse<T = unknown> {
  status: number
  data: T
  headers: Headers
}

export class HttpError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}
