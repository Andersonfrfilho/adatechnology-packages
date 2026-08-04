/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Forma mínima que o `admin.messaging()` do `firebase-admin` já satisfaz. Declarada por
 * estrutura — e não importada do pacote — para que os testes injetem um dublê sem carregar o SDK
 * real, e para o provider não amarrar a versão exata do `firebase-admin` do consumidor.
 */
export type FcmMessage = {
  readonly token: string
  readonly notification: { readonly title: string; readonly body: string }
  readonly data?: Readonly<Record<string, string>>
  readonly android?: { readonly notification?: { readonly notificationCount?: number } }
  readonly apns?: { readonly payload: { readonly aps: { readonly badge?: number } } }
  /** Presente só quando o token é de web push — o mesmo `send()` atende os três destinos. */
  readonly webpush?: { readonly notification?: { readonly title?: string; readonly body?: string } }
}

export type FcmError = {
  readonly code: string
  readonly message: string
}

export type FcmMessagingClient = {
  send(message: FcmMessage): Promise<string>
}

export function isFcmError(error: unknown): error is FcmError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as FcmError).code === 'string'
}
