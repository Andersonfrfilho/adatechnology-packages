export interface Context {
  requestId: string
  traceId?: string
  projectName: string
  version: string
  logLevel: LogLevel
  stack: string[]
  extra: Record<string, unknown>
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerConfig {
  projectName: string
  version: string
  logLevel?: LogLevel
  pretty?: boolean
  fileTransport?: string
}
