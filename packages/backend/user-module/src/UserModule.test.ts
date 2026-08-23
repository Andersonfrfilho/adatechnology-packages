/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `createUserModule` valida config na hora (falha no boot, não na primeira requisição) e expõe
 * capability-by-absence (`hasKeycloak`/`hasEmail`) — nenhuma dessas duas coisas é coberta pelos
 * testes de caso de uso, que já recebem `UserDependencies` pronto.
 */

import { describe, expect, it } from 'bun:test'
import { ConfigMissingError } from '@adatechnology/user-contracts'

import { createUserModule } from './UserModule'
import type { UserDatabase } from './database.types'
import type { KeycloakVerifierPort } from './shared/keycloak.types'

const FAKE_DB = {} as unknown as UserDatabase

describe('createUserModule — validação eager de config', () => {
  it('lança ConfigMissingError quando accessToken.secret está ausente', async () => {
    await expect(
      createUserModule({
        db: FAKE_DB,
        config: { tenancy: { mode: 'single', defaultCompanyId: 'company-a' }, accessToken: { secret: '' } },
      }),
    ).rejects.toBeInstanceOf(ConfigMissingError)
  })

  it('lança ConfigMissingError quando tenancy.mode é single sem defaultCompanyId', async () => {
    await expect(
      createUserModule({
        db: FAKE_DB,
        config: { tenancy: { mode: 'single', defaultCompanyId: '' }, accessToken: { secret: 'segredo-de-teste' } },
      }),
    ).rejects.toBeInstanceOf(ConfigMissingError)
  })

  it('não exige defaultCompanyId em modo multi', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: { tenancy: { mode: 'multi' }, accessToken: { secret: 'segredo-de-teste' } },
    })
    expect(userModule.hasKeycloak).toBe(false)
  })

  it('lança ConfigMissingError quando passwordReset.resetUrlTemplate não contém {token}', async () => {
    await expect(
      createUserModule({
        db: FAKE_DB,
        config: {
          tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
          accessToken: { secret: 'segredo-de-teste' },
          passwordReset: { resetUrlTemplate: 'https://app.example.com/reset-sem-placeholder' },
        },
      }),
    ).rejects.toBeInstanceOf(ConfigMissingError)
  })

  it('aceita passwordReset com {token} no template', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
        passwordReset: { resetUrlTemplate: 'https://app.example.com/reset?token={token}' },
      },
    })
    expect(userModule.useCases.requestPasswordReset).toBeTruthy()
  })
})

describe('createUserModule — capability por ausência', () => {
  it('sem providers.keycloak e sem config.keycloak: hasKeycloak é false, rota de callback não é elegível', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
      },
    })
    expect(userModule.hasKeycloak).toBe(false)
  })

  it('com providers.keycloak injetado diretamente: hasKeycloak é true, sem precisar do pacote @adatechnology/auth-keycloak instalado', async () => {
    const keycloak: KeycloakVerifierPort = { verify: async () => ({ sub: 'sub-1' }) }
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
      },
      providers: { keycloak },
    })
    expect(userModule.hasKeycloak).toBe(true)
  })

  it('sem providers.email: hasEmail é false', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
      },
    })
    expect(userModule.hasEmail).toBe(false)
  })

  it('com providers.email: hasEmail é true', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
      },
      providers: { email: { driver: 'test', send: async () => ({ outcome: 'sent' as const }) } },
    })
    expect(userModule.hasEmail).toBe(true)
  })
})

describe('createUserModule — todos os use-cases disponíveis', () => {
  it('expõe todos os dez use-cases documentados', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'segredo-de-teste' },
      },
    })
    expect(Object.keys(userModule.useCases).sort()).toEqual(
      [
        'authenticateLocal',
        'authenticateKeycloak',
        'createUser',
        'requestPasswordReset',
        'confirmPasswordReset',
        'updateProfile',
        'refreshSession',
        'signOut',
        'getProfile',
        'listUsers',
      ].sort(),
    )
  })
})
