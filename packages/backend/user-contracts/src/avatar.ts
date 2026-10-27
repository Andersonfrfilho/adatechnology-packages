/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A foto de perfil: porta de armazenamento e a validação que roda antes de qualquer rede.
 */

/** 2 MB. Foto de perfil é exibida em 40px numa tabela; o que passa disso é desperdício de banda. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/**
 * Lista fechada, e não `image/*`: `image/svg+xml` é um documento com script dentro, e servido do
 * mesmo domínio viraria XSS. Nenhum destes três executa nada.
 */
export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number]

export const AVATAR_REJECTION = {
  TOO_LARGE: 'avatar_too_large',
  UNSUPPORTED_TYPE: 'avatar_unsupported_type',
  EMPTY: 'avatar_empty',
} as const
export type AvatarRejection = (typeof AVATAR_REJECTION)[keyof typeof AVATAR_REJECTION]

export type CheckAvatarParams = {
  readonly contentType: string
  readonly byteLength: number
}

/**
 * Devolve o motivo, e não um booleano: quem chama precisa dizer à pessoa se o arquivo é grande
 * demais ou se é do tipo errado — são duas correções diferentes.
 */
export function checkAvatar(params: CheckAvatarParams): AvatarRejection | undefined {
  if (params.byteLength <= 0) return AVATAR_REJECTION.EMPTY
  if (params.byteLength > AVATAR_MAX_BYTES) return AVATAR_REJECTION.TOO_LARGE
  if (!AVATAR_CONTENT_TYPES.includes(params.contentType as AvatarContentType)) {
    return AVATAR_REJECTION.UNSUPPORTED_TYPE
  }
  return undefined
}

export type PutAvatarParams = {
  readonly userId: string
  readonly body: Uint8Array
  readonly contentType: AvatarContentType
}

/**
 * O host pluga o armazenamento; o módulo não sabe se é S3, disco ou memória.
 *
 * Sem esta porta o módulo não publica as rotas de foto — capacidade por ausência. Um produto sem
 * bucket não tem uma foto quebrada: não tem foto.
 */
export type AvatarStoragePort = {
  /** Grava e devolve a chave opaca a guardar na linha do usuário. */
  put(params: PutAvatarParams): Promise<string>
  /**
   * URL de leitura de vida curta.
   *
   * Assinada, e não pública: um rosto de funcionário não é o logo da empresa, e bucket aberto
   * indexa. Curta porque ela viaja na resposta da listagem, que passa por log e por cache.
   */
  sign(key: string): Promise<string>
  /** Remove a foto anterior; falhar aqui não pode derrubar a troca (o lixo é varrido depois). */
  remove?(key: string): Promise<void>
}
