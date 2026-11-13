import {
  createLogger,
  runWithContext,
  createContext,
  pushToTraceStack,
  popFromTraceStack,
  buildPrefix,
  getTraceStack,
  getContext,
} from '../src/index.js'

const logger = createLogger({ projectName: 'demo', version: '0.0.1', pretty: true })

function demoContext() {
  const ctx = createContext({ requestId: 'req-abc123' })
  return runWithContext(ctx, () => {
    pushToTraceStack('demo.service')
    pushToTraceStack('demo.method')

    logger.info('Processing request', { userId: 42 })
    logger.warn('Slow query detected', { queryMs: 1500 })
    logger.debug('Cache hit', { key: 'user:42' })

    const stk = getTraceStack()
    const prefix = buildPrefix()
    console.log(`\nTraceStack: ${stk.join(' > ')}`)
    console.log(`Prefix: ${prefix}`)
    console.log(`Context: requestId=${getContext()?.requestId}`)

    popFromTraceStack()
    popFromTraceStack()
  })
}

demoContext()
logger.info('Done — logger demo complete')
