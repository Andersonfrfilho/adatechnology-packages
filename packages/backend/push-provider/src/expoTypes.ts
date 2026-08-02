/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type ExpoPushMessage = {
  readonly to: string
  readonly title: string
  readonly body: string
  readonly data?: Readonly<Record<string, string>>
  readonly badge?: number
}

export type ExpoPushTicket =
  | { readonly status: 'ok'; readonly id: string }
  | { readonly status: 'error'; readonly message: string; readonly details?: { readonly error?: string } }

export type ExpoPushResponse = {
  readonly data: readonly ExpoPushTicket[]
}
