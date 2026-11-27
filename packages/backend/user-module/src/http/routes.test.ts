/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As rotas montadas a partir de um módulo real (sem banco): o que é publicado, que cookie sai e de
 * qual cookie o refresh lê. Os casos de uso são substituídos — o foco aqui é o encanamento HTTP.
 */

import { describe, expect, it } from 'bun:test'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'
import type { UserModuleConfig, UserSession } from '@adatechnology/user-contracts'

import { createUserModule, type UserModule } from '../UserModule'
import type { UserDatabase } from '../database.types'
import { createUserRoutes } from './routes'

const BASE_CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'segredo-de-teste' },
}

const SESSION: UserSession = {
  accessToken: 'access',
  expiresInSeconds: 900,
  refreshToken: 'novo-refresh',
  refreshExpiresInSeconds: 3600,
  user: { id: 'u1', email: 'a@example.com', name: 'A', role: 'staff', isActive: true },
}

type Captured = {
  login?: Record<string, unknown>
  refresh?: Record<string, unknown>
  storedRememberMe?: boolean
}

async function buildRoutes(config: UserModuleConfig, captured: Captured = {}): Promise<readonly ModuleRoute[]> {
  const module = await createUserModule({ db: {} as unknown as UserDatabase, config })
  const stubbed: UserModule = {
    ...module,
    useCases: {
      ...module.useCases,
      refreshSession: {
        execute: async (params: Record<string, unknown>) => {
          captured.refresh = params
          // O servidor é quem diz a escolha: aqui, a do token que o dublê "guardou" ou a dica recebida.
          const rememberMe = captured.storedRememberMe ?? (params['rememberMe'] as boolean | undefined)
          return rememberMe === undefined ? SESSION : { ...SESSION, rememberMe }
        },
      } as unknown as UserModule['useCases']['refreshSession'],
      authenticateLocal: {
        execute: async (params: Record<string, unknown>) => {
          captured.login = params
          const rememberMe = params['rememberMe'] as boolean | undefined
          return rememberMe === undefined ? SESSION : { ...SESSION, rememberMe }
        },
      } as unknown as UserModule['useCases']['authenticateLocal'],
      signUp: { execute: async () => SESSION } as unknown as UserModule['useCases']['signUp'],
      signOut: { execute: async () => undefined } as unknown as UserModule['useCases']['signOut'],
    },
  }
  return createUserRoutes({ module: stubbed })
}

const find = (routes: readonly ModuleRoute[], method: string, path: string): ModuleRoute | undefined =>
  routes.find((route) => route.method === method && route.path === path)

const contextWith = (headers: Record<string, string>, body: unknown = undefined): RequestContext => ({
  params: {},
  query: {},
  body,
  headers,
  auth: { userId: 'u1', companyId: 'company-a', scopes: [] },
})

const setCookieOf = (result: HttpResult): string =>
  (result as { headers?: Record<string, string> }).headers?.['Set-Cookie'] ?? ''

describe('rotas publicadas', () => {
  it('cadastro público só existe com `signUp` configurado', async () => {
    expect(find(await buildRoutes(BASE_CONFIG), 'POST', '/auth/signup')).toBeUndefined()
    expect(find(await buildRoutes({ ...BASE_CONFIG, signUp: { role: 'guest' } }), 'POST', '/auth/signup')).toBeDefined()
  })

  it('a rota de cadastro é pública e o corpo não aceita papel', async () => {
    const route = find(await buildRoutes({ ...BASE_CONFIG, signUp: { role: 'guest' } }), 'POST', '/auth/signup')

    expect(route?.scope).toBe('public')
    const parsed = route?.bodySchema?.safeParse({
      email: 'a@example.com',
      name: 'A',
      password: 'senha-forte-123',
      role: 'admin',
    })
    expect(parsed?.success).toBe(true)
    expect(parsed?.success && 'role' in (parsed.data as object)).toBe(false)
  })

  it('cadastro responde 201 com a sessão e o cookie de refresh', async () => {
    const route = find(await buildRoutes({ ...BASE_CONFIG, signUp: { role: 'guest' } }), 'POST', '/auth/signup')

    const result = await route!.handler(
      contextWith({}, { email: 'a@example.com', name: 'A', password: 'senha-forte-123' }),
    )

    expect(result).toMatchObject({ kind: 'json', status: 201 })
    expect(setCookieOf(result)).toContain('user_refresh_token=novo-refresh')
  })

  it('PATCH /admin/users/:id exige o escopo administrativo e ao menos um campo', async () => {
    const route = find(await buildRoutes(BASE_CONFIG), 'PATCH', '/admin/users/:id')

    expect(route?.scope).toBe('admin')
    expect(route?.requiredScopes).toContain('user:admin')
    expect(route?.bodySchema?.safeParse({}).success).toBe(false)
    expect(route?.bodySchema?.safeParse({ isActive: false }).success).toBe(true)
    expect(route?.bodySchema?.safeParse({ role: 'manager' }).success).toBe(true)
    expect(route?.bodySchema?.safeParse({ unlock: true }).success).toBe(true)
  })

  it('não existe rota de apagar usuário', async () => {
    const routes = await buildRoutes(BASE_CONFIG)
    expect(routes.filter((route) => route.method === 'DELETE')).toEqual([])
  })
})

describe('cookie de refresh configurável nas rotas', () => {
  const config: UserModuleConfig = {
    ...BASE_CONFIG,
    refreshToken: { cookieName: 'staff_refresh', cookiePath: '/staff' },
  }

  it('refresh lê o cookie configurado e ignora o de nome padrão', async () => {
    const route = find(await buildRoutes(config), 'POST', '/auth/refresh')

    const withDefaultName = await route!.handler(contextWith({ cookie: 'user_refresh_token=antigo' }))
    expect(withDefaultName).toMatchObject({ kind: 'empty', status: 401 })

    const result = await route!.handler(contextWith({ cookie: 'staff_refresh=antigo' }))
    expect(result).toMatchObject({ kind: 'json', status: 200 })
    expect(setCookieOf(result)).toStartWith('staff_refresh=novo-refresh; Path=/staff;')
  })

  it('logout limpa o cookie com o mesmo nome e caminho', async () => {
    const route = find(await buildRoutes(config), 'POST', '/auth/logout')

    const result = await route!.handler(contextWith({ cookie: 'staff_refresh=abc' }))

    expect(setCookieOf(result)).toStartWith('staff_refresh=; Path=/staff;')
  })

  it('sem configuração o cookie continua `user_refresh_token` em `/`', async () => {
    const route = find(await buildRoutes(BASE_CONFIG), 'POST', '/auth/refresh')

    const result = await route!.handler(contextWith({ cookie: 'user_refresh_token=antigo' }))

    expect(setCookieOf(result)).toStartWith('user_refresh_token=novo-refresh; Path=/;')
  })
})

describe('lembrar de mim nas rotas', () => {
  const credentials = { email: 'a@example.com', password: 'senha-forte-123' }

  it('login sem rememberMe: cookie idêntico ao de sempre e caso de uso sem o campo', async () => {
    const captured: Captured = {}
    const route = find(await buildRoutes(BASE_CONFIG, captured), 'POST', '/auth/login')

    const result = await route!.handler(contextWith({}, credentials))

    expect(setCookieOf(result)).toBe(
      'user_refresh_token=novo-refresh; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600',
    )
    expect(captured.login).not.toHaveProperty('rememberMe')
  })

  it('login com rememberMe true: cookie persistente', async () => {
    const captured: Captured = {}
    const route = find(await buildRoutes(BASE_CONFIG, captured), 'POST', '/auth/login')

    const result = await route!.handler(contextWith({}, { ...credentials, rememberMe: true }))

    expect(setCookieOf(result)).toStartWith('user_refresh_token=novo-refresh;')
    expect(setCookieOf(result)).toContain('Max-Age=3600')
    expect(captured.login).toMatchObject({ rememberMe: true })
  })

  it('login com rememberMe false: cookie de sessão, sem Max-Age', async () => {
    const route = find(await buildRoutes(BASE_CONFIG), 'POST', '/auth/login')

    const result = await route!.handler(contextWith({}, { ...credentials, rememberMe: false }))

    expect(setCookieOf(result)).toStartWith('user_refresh_token=novo-refresh;')
    expect(setCookieOf(result)).not.toContain('Max-Age')
  })

  it('refresh segue a escolha que o servidor devolve; o prefixo legado só serve de dica', async () => {
    const captured: Captured = {}
    const route = find(await buildRoutes(BASE_CONFIG, captured), 'POST', '/auth/refresh')

    // Cookie legado `m~`: o prefixo vira dica para o caso de uso e o cookie novo sai sem prefixo.
    const remembered = await route!.handler(contextWith({ cookie: 'user_refresh_token=m~antigo' }))
    expect(captured.refresh).toEqual({ refreshToken: 'antigo', rememberMe: true })
    expect(setCookieOf(remembered)).toStartWith('user_refresh_token=novo-refresh;')
    expect(setCookieOf(remembered)).toContain('Max-Age=3600')

    // Cookie novo (sem prefixo): quem decide é o token gravado no servidor.
    captured.storedRememberMe = false
    const sessionOnly = await route!.handler(contextWith({ cookie: 'user_refresh_token=antigo' }))
    expect(captured.refresh).toEqual({ refreshToken: 'antigo' })
    expect(setCookieOf(sessionOnly)).not.toContain('Max-Age')

    captured.storedRememberMe = true
    const persistent = await route!.handler(contextWith({ cookie: 'user_refresh_token=antigo' }))
    expect(setCookieOf(persistent)).toContain('Max-Age=3600')
  })
})

describe('rotas de autoatendimento da conta', () => {
  it('troca de senha e de telefone sempre existem; e-mail, verificação e recuperação só com a configuração', async () => {
    const base = await buildRoutes(BASE_CONFIG)
    expect(find(base, 'POST', '/auth/password/change')).toBeDefined()
    expect(find(base, 'POST', '/auth/phone/change')).toBeDefined()
    for (const path of [
      '/auth/email/change',
      '/auth/email/confirm',
      '/auth/phone/verification',
      '/auth/phone/verify',
    ]) {
      expect(find(base, 'POST', path)).toBeUndefined()
    }
    expect(find(base, 'POST', '/admin/users/:id/recovery')).toBeUndefined()

    const full = await buildRoutes({
      ...BASE_CONFIG,
      emailChange: { confirmUrlTemplate: 'https://x.test/c?token={token}' },
      passwordReset: { resetUrlTemplate: 'https://x.test/r?token={token}' },
      phoneVerification: { hashSecret: 'segredo-de-16-caracteres', inbound: {} },
    })
    for (const path of [
      '/auth/email/change',
      '/auth/email/confirm',
      '/auth/phone/verification',
      '/auth/phone/verify',
    ]) {
      expect(find(full, 'POST', path)).toBeDefined()
    }
    expect(find(full, 'POST', '/admin/users/:id/recovery')?.scope).toBe('admin')
    expect(find(full, 'POST', '/auth/email/confirm')?.scope).toBe('public')
  })
})
