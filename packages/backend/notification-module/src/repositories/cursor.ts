/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cursor opaco de paginação: `createdAt` sozinho empata sempre que dois envios acontecem no
 * mesmo milissegundo (comum em fan-out de fila), perdendo ou duplicando linhas entre páginas.
 * `id` como desempate garante ordem total mesmo com timestamps iguais.
 */

export type NotificationCursor = {
  readonly createdAt: Date
  readonly id: string
}

export function encodeNotificationCursor(row: NotificationCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url')
}

export function decodeNotificationCursor(cursor: string): NotificationCursor | undefined {
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
