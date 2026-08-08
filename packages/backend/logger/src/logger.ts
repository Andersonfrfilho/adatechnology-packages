import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LoggerConfig, LogLevel } from './types'
import { getContext } from './context'
import { buildPrefix, shouldLog } from './trace-stack'
import { redact, redactMeta } from './redact'
import { HttpTransport } from './http-transport'

export class Logger {
  private config: LoggerConfig
  private filePath: string | null = null
  private transport: HttpTransport | null = null

  constructor(config: LoggerConfig) {
    this.config = { logLevel: 'info', ...config }
    if (config.fileTransport) {
      this.filePath = config.fileTransport
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      if (!existsSync(this.filePath)) writeFileSync(this.filePath, '')
    }
    if (config.sinkUrl) this.transport = new HttpTransport({ sinkUrl: config.sinkUrl })
  }

  /**
   * A redação roda aqui, dentro do logger, antes de qualquer destino — nunca na disciplina de
   * quem chama `.info`/`.error`. É o que garante que stdout, arquivo e transporte HTTP nunca
   * veem PII, mesmo que o `meta` chegue sujo (regra de segurança §1).
   */
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const ctx = getContext()
    const prefix = buildPrefix()
    if (ctx && !shouldLog(level, ctx.logLevel)) return

    const redactedMessage = redact(message)
    const redactedMeta = meta ? redactMeta(meta) : undefined

    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      ...(ctx && { requestId: ctx.requestId, traceId: ctx.traceId }),
      message: prefix ? `${prefix} ${redactedMessage}` : redactedMessage,
      ...(redactedMeta && Object.keys(redactedMeta).length > 0 && { meta: redactedMeta }),
    }

    const output = this.config.pretty ? `[${entry.timestamp}] [${entry.level}] ${entry.message}` : JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'debug':
        console.debug(output)
        break
      default:
        console.log(output)
    }

    if (this.filePath) appendFileSync(this.filePath, output + '\n')
    this.transport?.enqueue(entry)
  }

  flush(): Promise<void> {
    return this.transport?.flush() ?? Promise.resolve()
  }

  stop(): void {
    this.transport?.stop()
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta)
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta)
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta)
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta)
  }
}

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config)
}
