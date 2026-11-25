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
  it('expõe todos os catorze use-cases documentados', async () => {
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
        'setAvatar',
        'confirmPasswordReset',
        'updateProfile',
        'updateUser',
        'setUserPassword',
        'signUp',
        'refreshSession',
        'signOut',
        'getProfile',
        'listUsers',
      ].sort(),
    )
  })
})

const BASE_CONFIG = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'segredo-de-teste' },
} as const

describe('createUserModule — novas opções', () => {
  it('padrões inalterados: cookie `user_refresh_token` em `/`, audiência `default`, sem cadastro público', async () => {
    const userModule = await createUserModule({ db: FAKE_DB, config: BASE_CONFIG })

    expect(userModule.refreshCookie).toEqual({ name: 'user_refresh_token', path: '/', sameSite: 'lax' })
    expect(userModule.audience).toBe('default')
    expect(userModule.hasSignUp).toBe(false)
  })

  it('resolve cookie, audiência e cadastro público declarados', async () => {
    const userModule = await createUserModule({
      db: FAKE_DB,
      config: {
        ...BASE_CONFIG,
        audience: 'customers',
        signUp: { role: 'guest' },
        refreshToken: { cookieName: 'customer_refresh', cookiePath: '/customers' },
      },
    })

    expect(userModule.refreshCookie.name).toBe('customer_refresh')
    expect(userModule.refreshCookie.path).toBe('/customers')
    expect(userModule.audience).toBe('customers')
    expect(userModule.hasSignUp).toBe(true)
  })

  it('o JWT de uma audiência não vale na outra, mesmo com segredo compartilhado', async () => {
    const staff = await createUserModule({ db: FAKE_DB, config: { ...BASE_CONFIG, audience: 'staff' } })
    const customers = await createUserModule({ db: FAKE_DB, config: { ...BASE_CONFIG, audience: 'customers' } })
    const { TokenService } = await import('./shared/TokenService')
    const signer = new TokenService({ secret: 'segredo-de-teste', audience: 'staff' })
    const { accessToken } = await signer.sign({
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
      role: 'admin',
      isActive: true,
    })

    expect(await staff.verifyAccessToken(accessToken)).toBeDefined()
    expect(await customers.verifyAccessToken(accessToken)).toBeUndefined()
  })

  const invalidConfigs: Record<string, Record<string, unknown>> = {
    'lockout.maxFailedAttempts zero': { lockout: { maxFailedAttempts: 0, lockMinutes: 15 } },
    'lockout.lockMinutes fracionado': { lockout: { maxFailedAttempts: 3, lockMinutes: 1.5 } },
    'signUp sem papel': { signUp: { role: '' } },
    'refreshToken.cookieName com atributo embutido': { refreshToken: { cookieName: 'a; Domain=x' } },
    'refreshToken.cookiePath sem barra': { refreshToken: { cookiePath: 'staff' } },
    'audience com espaço': { audience: 'a b' },
  }

  for (const [name, extra] of Object.entries(invalidConfigs)) {
    it(`falha no boot com ${name}`, async () => {
      await expect(
        createUserModule({ db: FAKE_DB, config: { ...BASE_CONFIG, ...extra } as never }),
      ).rejects.toBeInstanceOf(ConfigMissingError)
    })
  }

  it('cadastro público em modo multi exige signUp.companyId — a rota é pública e não tem de onde ler a empresa', async () => {
    await expect(
      createUserModule({
        db: FAKE_DB,
        config: { tenancy: { mode: 'multi' }, accessToken: { secret: 'segredo-de-teste' }, signUp: { role: 'guest' } },
      }),
    ).rejects.toBeInstanceOf(ConfigMissingError)
  })
})
