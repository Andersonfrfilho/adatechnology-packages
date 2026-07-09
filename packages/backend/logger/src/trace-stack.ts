import { getContext } from './context'
import type { LogLevel } from './types'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export function pushToTraceStack(label: string): void {
  const ctx = getContext()
  if (ctx) ctx.stack.push(label)
}

export function popFromTraceStack(): void {
  const ctx = getContext()
  if (ctx) ctx.stack.pop()
}

export function getTraceStack(): string[] {
  return getContext()?.stack ?? []
}

export function buildPrefix(): string {
  const ctx = getContext()
  if (!ctx) return ''
  const parts: string[] = []
  parts.push(`[${ctx.requestId.slice(0, 8)}]`)
  if (ctx.traceId) parts.push(`[${ctx.traceId.slice(0, 8)}]`)
  parts.push(`[${ctx.projectName}:${ctx.version}]`)
  const stack = ctx.stack.join('.')
  if (stack) parts.push(`[${stack}]`)
  return parts.join('')
}

export function shouldLog(level: LogLevel, configLevel: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configLevel]
}

export function traceMethod<Args extends unknown[], R>(tag: string, fn: (...args: Args) => R): (...args: Args) => R {
  return (...args: Args) => {
    pushToTraceStack(tag)
    try {
      return fn(...args)
    } finally {
      popFromTraceStack()
    }
  }
}
