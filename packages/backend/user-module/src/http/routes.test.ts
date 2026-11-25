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

async function buildRoutes(config: UserModuleConfig): Promise<readonly ModuleRoute[]> {
  const module = await createUserModule({ db: {} as unknown as UserDatabase, config })
  const stubbed: UserModule = {
    ...module,
    useCases: {
      ...module.useCases,
      refreshSession: { execute: async () => SESSION } as unknown as UserModule['useCases']['refreshSession'],
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
