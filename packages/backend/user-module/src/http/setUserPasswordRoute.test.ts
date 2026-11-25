/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `PUT /admin/users/:id/password` pelo despachante real: 401 sem identidade, 403 sem `user:admin`,
 * 204 com ele, e o caso de uso recebe quem trocou.
 */

import { describe, expect, it } from 'bun:test'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'
import type { AuthContext } from '@adatechnology/module-http'
import type { UserModuleConfig } from '@adatechnology/user-contracts'

import { createUserModule, type UserModule } from '../UserModule'
import type { UserDatabase } from '../database.types'
import type { SetUserPasswordParams } from '../use-cases/SetUserPassword.use-case'
import { createUserRoutes } from './routes'

const CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'segredo-de-teste' },
}

async function routerAs(auth: AuthContext | undefined, calls: SetUserPasswordParams[]) {
  const module = await createUserModule({ db: {} as unknown as UserDatabase, config: CONFIG })
  const stubbed: UserModule = {
    ...module,
    useCases: {
      ...module.useCases,
      setUserPassword: {
        execute: async (params: SetUserPasswordParams) => void calls.push(params),
      } as unknown as UserModule['useCases']['setUserPassword'],
    },
  }
  return createModuleFetchRouter({
    routes: createUserRoutes({ module: stubbed }),
    basePath: '/v1',
    authResolver: { resolve: async () => auth },
  })
}

const request = (password = 'senha-nova-456') =>
  new Request('http://localhost/v1/admin/users/u2/password', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })

describe('PUT /admin/users/:id/password', () => {
  it('401 sem identidade', async () => {
    const calls: SetUserPasswordParams[] = []
    expect((await (await routerAs(undefined, calls)).handle(request())).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('403 sem user:admin', async () => {
    const calls: SetUserPasswordParams[] = []
    const router = await routerAs({ companyId: 'company-a', userId: 'u1', scopes: ['user'] }, calls)
    expect((await router.handle(request())).status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('204 com user:admin, passando quem trocou', async () => {
    const calls: SetUserPasswordParams[] = []
    const router = await routerAs({ companyId: 'company-a', userId: 'admin-1', scopes: ['user:admin'] }, calls)

    expect((await router.handle(request())).status).toBe(204)
    expect(calls[0]).toMatchObject({ id: 'u2', password: 'senha-nova-456', actorUserId: 'admin-1' })
  })

  it('senha curta é 400', async () => {
    const router = await routerAs({ companyId: 'company-a', userId: 'admin-1', scopes: ['user:admin'] }, [])
    expect((await router.handle(request('curta'))).status).toBe(400)
  })
})
