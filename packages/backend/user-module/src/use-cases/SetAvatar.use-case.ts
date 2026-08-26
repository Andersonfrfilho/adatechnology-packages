/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Troca a foto de perfil: valida, grava no armazenamento do host e guarda a chave.
 */

import {
  AVATAR_REJECTION,
  AvatarRejectedError,
  UserNotFoundError,
  checkAvatar,
  type AvatarContentType,
  type UserProfile,
} from '@adatechnology/user-contracts'

import { toUserProfile } from '../shared/toContract'
import type { UserDependencies } from './userModule.types'

export type SetAvatarParams = {
  readonly userId: string
  readonly body: Uint8Array
  readonly contentType: string
}

export class SetAvatarUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: SetAvatarParams): Promise<UserProfile> {
    const storage = this.dependencies.avatar
    // Nao deveria chegar aqui sem armazenamento — a rota nem e publicada. Guarda para quem chama o
    // caso de uso direto, em vez de deixar o `undefined` estourar mais fundo.
    if (!storage) throw new AvatarRejectedError(AVATAR_REJECTION.UNSUPPORTED_TYPE)

    const rejection = checkAvatar({ contentType: params.contentType, byteLength: params.body.byteLength })
    if (rejection) throw new AvatarRejectedError(rejection)

    const current = await this.dependencies.users.findByIdUnscoped({ id: params.userId })
    if (!current) throw new UserNotFoundError()

    const key = await storage.put({
      userId: params.userId,
      body: params.body,
      contentType: params.contentType as AvatarContentType,
    })

    const updated = await this.dependencies.users.updateById({
      id: params.userId,
      values: { avatarKey: key, updatedAt: new Date() },
    })
    if (!updated) throw new UserNotFoundError()

    /*
      A foto antiga sai depois de a nova estar gravada e apontada. Na ordem inversa, uma falha no
      `put` deixaria o usuario sem foto nenhuma — e a antiga estava boa.

      Falhar aqui nao desfaz a troca: a nova foto ja e a verdade, e um objeto orfao no bucket custa
      centavos. Devolver erro faria a pessoa tentar de novo uma operacao que ja deu certo.
    */
    if (current.avatarKey && current.avatarKey !== key && storage.remove) {
      try {
        await storage.remove(current.avatarKey)
      } catch (error) {
        this.dependencies.logger?.warn('user.avatar_orphan', { userId: params.userId, error: String(error) })
      }
    }

    return toUserProfile(updated, await storage.sign(key))
  }
}
