import { randomUUID } from 'node:crypto'
import { runWithContext, createContext } from './context'
import { pushToTraceStack, popFromTraceStack } from './trace-stack'
import type { LoggerConfig } from './types'

export interface UwsRequest {
  getHeader(name: string): string
  getUrl(): string
  getMethod(): string
  getQuery(): string
}

export function createUwsMiddleware(config: LoggerConfig) {
  const projectTag = `${config.projectName}:${config.version}`
  return {
    handle: async (req: UwsRequest, handler: () => Promise<unknown> | unknown): Promise<unknown> => {
      const requestId = req.getHeader('x-request-id') || randomUUID()
      const traceId = req.getHeader('x-trace-id')
      const ctx = createContext({
        requestId,
        traceId,
        projectName: config.projectName,
        version: config.version,
        logLevel: config.logLevel ?? 'info',
        extra: { method: req.getMethod(), url: req.getUrl() },
      })
      pushToTraceStack(projectTag)
      try {
        return await runWithContext(ctx, handler)
      } finally {
        popFromTraceStack()
      }
    },
  }
}

export function createHttpHandler(
  handler: (req: Request) => Response | Promise<Response>,
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void
    error: (msg: string, meta?: Record<string, unknown>) => void
  },
) {
  return async (req: Request): Promise<Response> => {
    const requestId = req.headers.get('x-request-id') || randomUUID()
    const traceId = req.headers.get('x-trace-id') || undefined
    const ctx = createContext({ requestId, traceId })
    pushToTraceStack('http')
    const start = Date.now()
    try {
      const result = await runWithContext(ctx, () => handler(req))
      const duration = Date.now() - start
      const status = result instanceof Response ? result.status : 200
      logger.info(`${req.method} ${req.url}`, { status, durationMs: duration })
      if (result instanceof Response) {
        result.headers.set('x-request-id', requestId)
        if (traceId) result.headers.set('x-trace-id', traceId)
        return result
      }
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          ...(traceId && { 'x-trace-id': traceId }),
        },
      })
    } catch (err) {
      const duration = Date.now() - start
      logger.error(`${req.method} ${req.url}`, {
        error: err instanceof Error ? err.message : 'unknown',
        durationMs: duration,
      })
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    } finally {
      popFromTraceStack()
    }
  }
}
