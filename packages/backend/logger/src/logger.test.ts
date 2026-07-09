import { describe, it, expect } from 'bun:test'
import {
  createLogger,
  createContext,
  runWithContext,
  pushToTraceStack,
  popFromTraceStack,
  getTraceStack,
  buildPrefix,
  getContext,
  getContextOrThrow,
  traceMethod,
} from '../src/index.js'

describe('logger', () => {
  it('creates logger and logs at different levels', () => {
    const logger = createLogger({ projectName: 'test', version: '0.0.1' })
    expect(() => logger.info('test')).not.toThrow()
    expect(() => logger.warn('test')).not.toThrow()
    expect(() => logger.error('test')).not.toThrow()
    expect(() => logger.debug('test')).not.toThrow()
  })

  it('pretty mode works', () => {
    const logger = createLogger({ projectName: 'test', version: '0.0.1', pretty: true })
    expect(() => logger.info('hello')).not.toThrow()
  })
})

describe('context', () => {
  it('creates context with defaults', () => {
    const ctx = createContext({ requestId: 'req-123' })
    expect(ctx.requestId).toBe('req-123')
    expect(ctx.projectName).toBe('unknown')
    expect(ctx.version).toBe('0.0.0')
    expect(ctx.logLevel).toBe('info')
    expect(ctx.stack).toEqual([])
    expect(ctx.extra).toEqual({})
  })

  it('propagates context via runWithContext', () => {
    const ctx = createContext({ projectName: 'my-app', version: '2.0.0' })
    runWithContext(ctx, () => {
      const current = getContext()
      expect(current?.projectName).toBe('my-app')
      expect(current?.version).toBe('2.0.0')
    })
  })

  it('getContext returns undefined outside runWithContext', () => {
    expect(getContext()).toBeUndefined()
  })

  it('getContextOrThrow throws outside context', () => {
    expect(() => getContextOrThrow()).toThrow()
  })
})

describe('traceStack', () => {
  it('push and pop work', () => {
    const ctx = createContext()
    runWithContext(ctx, () => {
      pushToTraceStack('a.b')
      pushToTraceStack('a.c')
      expect(getTraceStack()).toEqual(['a.b', 'a.c'])
      popFromTraceStack()
      expect(getTraceStack()).toEqual(['a.b'])
      popFromTraceStack()
      expect(getTraceStack()).toEqual([])
    })
  })

  it('buildPrefix builds correct prefix', () => {
    const ctx = createContext({ requestId: 'abcdefgh-1234', projectName: 'app', version: '1.0.0' })
    runWithContext(ctx, () => {
      pushToTraceStack('svc.method')
      const prefix = buildPrefix()
      expect(prefix).toContain('[abcdefgh]')
      expect(prefix).toContain('[app:1.0.0]')
      expect(prefix).toContain('[svc.method]')
    })
  })

  it('traceMethod wraps function with tracing', () => {
    const ctx = createContext()
    runWithContext(ctx, () => {
      const fn = traceMethod('MyService.doSomething', (x: number) => {
        expect(getTraceStack()).toContain('MyService.doSomething')
        return x * 2
      })
      const result = fn(5)
      expect(result).toBe(10)
      expect(getTraceStack()).toEqual([]) // stack should be popped after
    })
  })
})
