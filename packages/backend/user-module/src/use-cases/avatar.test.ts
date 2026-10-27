/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { AVATAR_MAX_BYTES, AVATAR_REJECTION } from '@adatechnology/user-contracts'

import { signAvatars } from '../shared/signAvatar'
import type { UserRow } from '../schema/schema'
import { SetAvatarUseCase } from './SetAvatar.use-case'
import type { UserDependencies } from './userModule.types'

const PNG = 'image/png'

function row(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u1',
    companyId: null,
    email: 'a@x.com',
    name: 'Ana',
    passwordHash: null,
    role: 'admin',
    providerId: 'local',
    externalId: null,
    avatarKey: null,
    isActive: true,
    lastSeenAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserRow
}

function build(params: {
  readonly current: UserRow
  readonly avatar?: Partial<UserDependencies['avatar']>
  readonly removed?: string[]
}): UserDependencies {
  return {
    users: {
      findByIdUnscoped: async () => params.current,
      updateById: async ({ values }: { values: Partial<UserRow> }) => row({ ...params.current, ...values }),
    },
    avatar: {
      put: async () => 'chave/nova',
      sign: async (key: string) => `https://assinada/${key}`,
      ...params.avatar,
    },
  } as unknown as UserDependencies
}

describe('SetAvatarUseCase', () => {
  it('recusa antes de tocar no armazenamento', async () => {
    let tocou = false
    const dependencies = build({
      current: row(),
      avatar: {
        put: async () => {
          tocou = true
          return 'x'
        },
      },
    })

    await expect(
      new SetAvatarUseCase(dependencies).execute({
        userId: 'u1',
        body: new Uint8Array(10),
        contentType: 'image/svg+xml',
      }),
    ).rejects.toMatchObject({ details: { reason: AVATAR_REJECTION.UNSUPPORTED_TYPE } })

    // Gravar primeiro e validar depois deixaria lixo no bucket a cada tentativa recusada.
    expect(tocou).toBe(false)
  })

  it('recusa o arquivo grande demais pelo motivo proprio', async () => {
    await expect(
      new SetAvatarUseCase(build({ current: row() })).execute({
        userId: 'u1',
        body: new Uint8Array(AVATAR_MAX_BYTES + 1),
        contentType: PNG,
      }),
    ).rejects.toMatchObject({ details: { reason: AVATAR_REJECTION.TOO_LARGE } })
  })

  it('apaga a foto anterior so depois de a nova estar apontada', async () => {
    const removidas: string[] = []
    const dependencies = build({
      current: row({ avatarKey: 'chave/velha' }),
      avatar: { remove: async (key: string) => void removidas.push(key) },
    })

    const perfil = await new SetAvatarUseCase(dependencies).execute({
      userId: 'u1',
      body: new Uint8Array(10),
      contentType: PNG,
    })

    expect(perfil.avatarUrl).toBe('https://assinada/chave/nova')
    expect(removidas).toEqual(['chave/velha'])
  })

  it('falha ao apagar a antiga nao desfaz a troca, que ja deu certo', async () => {
    const dependencies = build({
      current: row({ avatarKey: 'chave/velha' }),
      avatar: {
        remove: async () => {
          throw new Error('bucket fora')
        },
      },
    })

    const perfil = await new SetAvatarUseCase(dependencies).execute({
      userId: 'u1',
      body: new Uint8Array(10),
      contentType: PNG,
    })

    expect(perfil.avatarUrl).toBe('https://assinada/chave/nova')
  })
})

describe('signAvatars', () => {
  it('assina uma vez por chave distinta', async () => {
    const chamadas: string[] = []
    const dependencies = {
      avatar: {
        sign: async (key: string) => {
          chamadas.push(key)
          return `u/${key}`
        },
      },
    } as unknown as UserDependencies

    const urls = await signAvatars({
      dependencies,
      rows: [row({ avatarKey: 'k1' }), row({ avatarKey: 'k1' }), row({ avatarKey: 'k2' }), row()],
    })

    expect(chamadas.sort()).toEqual(['k1', 'k2'])
    expect(urls?.get('k1')).toBe('u/k1')
  })

  it('armazenamento fora do ar devolve lista sem URL, e nao erro', async () => {
    const dependencies = {
      avatar: {
        sign: async () => {
          throw new Error('fora')
        },
      },
    } as unknown as UserDependencies

    // Listar usuarios nao pode virar 500 porque a foto nao carregou.
    const urls = await signAvatars({ dependencies, rows: [row({ avatarKey: 'k1' })] })
    expect(urls?.size).toBe(0)
  })

  it('sem armazenamento plugado nao ha o que assinar', async () => {
    expect(await signAvatars({ dependencies: {} as UserDependencies, rows: [row({ avatarKey: 'k' })] })).toBeUndefined()
  })
})
