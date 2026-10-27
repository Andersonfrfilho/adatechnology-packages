/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Textos internos dos componentes. O host sobrescreve qualquer chave por `messages` no provider;
 * o que não for sobrescrito segue em pt-BR.
 */

import ptBR from './pt-BR.json'

export type InfraMessages = typeof ptBR
export type InfraMessagesOverride = DeepPartial<InfraMessages>

type DeepPartial<TValue> = {
  readonly [TKey in keyof TValue]?: TValue[TKey] extends object ? DeepPartial<TValue[TKey]> : TValue[TKey]
}

export const DEFAULT_INFRA_MESSAGES: InfraMessages = ptBR

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) continue
    const baseValue = base[key]
    merged[key] =
      isPlainObject(baseValue) && isPlainObject(overrideValue) ? mergeRecords(baseValue, overrideValue) : overrideValue
  }
  return merged
}

export function mergeInfraMessages(override?: InfraMessagesOverride): InfraMessages {
  if (!override) return DEFAULT_INFRA_MESSAGES
  return mergeRecords(DEFAULT_INFRA_MESSAGES, override as Record<string, unknown>) as InfraMessages
}
