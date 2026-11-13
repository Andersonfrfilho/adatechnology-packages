/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Assina as chaves de foto — o único ponto do módulo que fala com o armazenamento para leitura.
 */

import type { UserRow } from '../schema/schema'
import type { UserDependencies } from '../use-cases/userModule.types'

export type SignAvatarParams = {
  readonly dependencies: Pick<UserDependencies, 'avatar' | 'logger'>
  readonly key: string | null
}

/**
 * Assinatura que falha devolve `undefined`, e não erro.
 *
 * A foto é enfeite: um bucket fora do ar não pode transformar "listar usuários" em erro 500. A tela
 * cai nas iniciais, que é o mesmo que ela faz para quem nunca subiu foto.
 */
export async function signAvatar(params: SignAvatarParams): Promise<string | undefined> {
  const { avatar, logger } = params.dependencies
  if (!avatar || !params.key) return undefined

  try {
    return await avatar.sign(params.key)
  } catch (error) {
    logger?.warn('user.avatar_sign_failed', { error: String(error) })
    return undefined
  }
}

export type SignAvatarsParams = {
  readonly dependencies: Pick<UserDependencies, 'avatar' | 'logger'>
  readonly rows: readonly UserRow[]
}

/**
 * Uma assinatura por chave distinta, em paralelo.
 *
 * Sequencial, uma página de vinte linhas somaria vinte idas ao armazenamento antes de responder —
 * e assinar é justamente a operação que não depende da anterior.
 */
export async function signAvatars(params: SignAvatarsParams): Promise<ReadonlyMap<string, string> | undefined> {
  if (!params.dependencies.avatar) return undefined

  const keys = [...new Set(params.rows.map((row) => row.avatarKey).filter((key): key is string => Boolean(key)))]
  if (keys.length === 0) return undefined

  const signed = await Promise.all(keys.map((key) => signAvatar({ dependencies: params.dependencies, key })))

  return new Map(
    keys.flatMap((key, index) => {
      const url = signed[index]
      return url ? [[key, url] as const] : []
    }),
  )
}
