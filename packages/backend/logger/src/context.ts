import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { Context } from './types'

const storage = new AsyncLocalStorage<Context>()

export function getContext(): Context | undefined {
  return storage.getStore()
}

export function getContextOrThrow(): Context {
  const ctx = storage.getStore()
  if (!ctx) throw new Error('No context — call runWithContext() first')
  return ctx
}

export function runWithContext<T>(ctx: Context, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function createContext(partial: Partial<Context> = {}): Context {
  return {
    requestId: partial.requestId ?? randomUUID(),
    traceId: partial.traceId,
    projectName: partial.projectName ?? 'unknown',
    version: partial.version ?? '0.0.0',
    logLevel: partial.logLevel ?? 'info',
    stack: partial.stack ?? [],
    extra: partial.extra ?? {},
  }
}
