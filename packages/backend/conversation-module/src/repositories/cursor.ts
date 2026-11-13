/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cursor opaco de paginação por `(created_at, id)` — mesmo desenho de
 * `notification-module/repositories/cursor.ts`: `id` desempata linhas com o mesmo timestamp.
 */

export type ConversationMessageCursor = {
  readonly createdAt: Date
  readonly id: string
}

export function encodeMessageCursor(row: ConversationMessageCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url')
}

export function decodeMessageCursor(cursor: string): ConversationMessageCursor | undefined {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    if (!iso || !id) return undefined
    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime())) return undefined
    return { createdAt, id }
  } catch {
    return undefined
  }
}
