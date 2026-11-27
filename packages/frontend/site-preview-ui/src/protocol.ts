/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Mensagens trocadas entre o painel (host, dono do iframe) e o site visto na prévia (guest).
 * Tudo é validado dos dois lados: o que não tem o formato esperado é descartado.
 */

export const PREVIEW_PROTOCOL_VERSION = 1
export const DEFAULT_PREVIEW_CHANNEL = 'ada-site-preview'
export const PREVIEW_SECTION_ATTRIBUTE = 'data-preview-field'

export type HostMessage =
  | { readonly type: 'state'; readonly payload: unknown }
  | { readonly type: 'focus'; readonly key: string | undefined }
  | { readonly type: 'refresh' }
  | { readonly type: 'restore-scroll'; readonly top: number }

export type GuestMessage = { readonly type: 'ready' } | { readonly type: 'scroll'; readonly top: number }

type Envelope<TMessage> = {
  readonly source: string
  readonly version: typeof PREVIEW_PROTOCOL_VERSION
  readonly message: TMessage
}

export function hostSource(channel: string): string {
  return `${channel}:host`
}

export function guestSource(channel: string): string {
  return `${channel}:guest`
}

export function wrapHostMessage(channel: string, message: HostMessage): Envelope<HostMessage> {
  return { source: hostSource(channel), version: PREVIEW_PROTOCOL_VERSION, message }
}

export function wrapGuestMessage(channel: string, message: GuestMessage): Envelope<GuestMessage> {
  return { source: guestSource(channel), version: PREVIEW_PROTOCOL_VERSION, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(data: unknown, source: string): Record<string, unknown> | undefined {
  if (!isRecord(data) || data.source !== source || data.version !== PREVIEW_PROTOCOL_VERSION) return undefined
  return isRecord(data.message) ? data.message : undefined
}

export function parseHostMessage(data: unknown, channel: string): HostMessage | undefined {
  const message = unwrap(data, hostSource(channel))
  if (message === undefined) return undefined
  if (message.type === 'state') return { type: 'state', payload: message.payload }
  if (message.type === 'refresh') return { type: 'refresh' }
  if (message.type === 'focus' && (message.key === undefined || typeof message.key === 'string')) {
    return { type: 'focus', key: message.key }
  }
  if (message.type === 'restore-scroll' && typeof message.top === 'number' && Number.isFinite(message.top)) {
    return { type: 'restore-scroll', top: Math.max(0, message.top) }
  }
  return undefined
}

export function parseGuestMessage(data: unknown, channel: string): GuestMessage | undefined {
  const message = unwrap(data, guestSource(channel))
  if (message === undefined) return undefined
  if (message.type === 'ready') return { type: 'ready' }
  if (message.type === 'scroll' && typeof message.top === 'number' && Number.isFinite(message.top)) {
    return { type: 'scroll', top: Math.max(0, message.top) }
  }
  return undefined
}
