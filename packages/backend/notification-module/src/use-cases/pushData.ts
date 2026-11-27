/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `data` do push: só identificador opaco e um caminho relativo do produto (`payload.link`), nunca
 * PII nem URL externa — o payload atravessa os servidores da Apple, Google e Mozilla.
 */

const RELATIVE_PATH = /^\/(?!\/)[^\s]*$/

export function buildPushData(params: {
  readonly notificationId: string
  readonly payload: Readonly<Record<string, unknown>>
}): Readonly<Record<string, string>> {
  const link = params.payload['link']
  return {
    notificationId: params.notificationId,
    ...(typeof link === 'string' && RELATIVE_PATH.test(link) ? { url: link } : {}),
  }
}
