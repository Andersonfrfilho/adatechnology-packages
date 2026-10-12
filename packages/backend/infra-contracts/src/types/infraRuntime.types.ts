/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type InfraLogger = {
  info(message: string, meta: Readonly<Record<string, unknown>>): void
  error(message: string, meta: Readonly<Record<string, unknown>>): void
}

export type InfraSleep = (milliseconds: number) => Promise<void>
