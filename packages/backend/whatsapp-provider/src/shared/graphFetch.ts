import { WhatsAppConnectionError, WhatsAppRejectionError, WhatsAppTimeoutError } from '../errors/WhatsAppError'

const GRAPH_BASE_URL = 'https://graph.facebook.com'
const DEFAULT_API_VERSION = 'v21.0'
const DEFAULT_TIMEOUT_MS = 10_000

export function buildGraphUrl(apiVersion: string | undefined, path: string): string {
  return `${GRAPH_BASE_URL}/${apiVersion ?? DEFAULT_API_VERSION}/${path}`
}

export type GraphFetchParams = {
  readonly url: string
  readonly accessToken: string
  readonly method?: 'GET' | 'POST' | 'DELETE'
  readonly jsonBody?: Record<string, unknown>
  readonly formBody?: FormData
  readonly timeoutMs?: number
}

export async function graphFetch(params: GraphFetchParams): Promise<unknown> {
  const { url, accessToken, method = 'GET', jsonBody, formBody, timeoutMs = DEFAULT_TIMEOUT_MS } = params

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
  let body: BodyInit | undefined
  if (jsonBody) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(jsonBody)
  } else if (formBody) {
    body = formBody
  }

  const response = await performRequest({ url, method, headers, body, timeoutMs })

  if (!response.ok) {
    const rawText = await response.text().catch(() => '')
    const rawResponse = parseJsonSafely(rawText)
    const errorCode = extractGraphErrorCode(rawResponse) ?? String(response.status)
    const errorMessage = extractGraphErrorMessage(rawResponse) ?? rawText.slice(0, 300)
    throw new WhatsAppRejectionError(errorCode, errorMessage, rawResponse)
  }

  const rawText = await response.text().catch(() => '')
  return parseJsonSafely(rawText)
}

type PerformRequestParams = {
  readonly url: string
  readonly method: 'GET' | 'POST' | 'DELETE'
  readonly headers: Record<string, string>
  readonly body: BodyInit | undefined
  readonly timeoutMs: number
}

async function performRequest(params: PerformRequestParams): Promise<Response> {
  try {
    return await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
      signal: AbortSignal.timeout(params.timeoutMs),
    })
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new WhatsAppTimeoutError(params.url)
    }
    throw new WhatsAppConnectionError(error instanceof Error ? error.message : 'unknown error')
  }
}

function parseJsonSafely(text: string): unknown {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export function extractGraphErrorCode(rawResponse: unknown): string | undefined {
  if (typeof rawResponse !== 'object' || rawResponse === null) return undefined
  const error = (rawResponse as { error?: { code?: number } }).error
  return error?.code !== undefined ? String(error.code) : undefined
}

export function extractGraphErrorMessage(rawResponse: unknown): string | undefined {
  if (typeof rawResponse !== 'object' || rawResponse === null) return undefined
  const error = (rawResponse as { error?: { message?: string } }).error
  return error?.message
}
