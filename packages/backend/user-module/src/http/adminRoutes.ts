/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createUserSchema, type CreateUserInput } from '@adatechnology/user-contracts'
import type { ModuleRoute } from '@adatechnology/module-http'
import { z } from 'zod'

import type { UserModule } from '../UserModule'

const USER_ADMIN_SCOPE = 'user:admin'

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
})

export function buildAdminRoutes(module: UserModule): ModuleRoute[] {
  const { useCases } = module

  return [
    {
      method: 'GET',
      path: '/admin/users',
      scope: 'admin',
      requiredScopes: [USER_ADMIN_SCOPE],
      querySchema: listUsersQuerySchema,
      operationId: 'listUsers',
      summary: 'Lista usuários paginada, escopo administrativo',
      async handler(context) {
        const query = context.query as z.infer<typeof listUsersQuerySchema>
        const result = await useCases.listUsers.execute({
          page: query.page,
          perPage: query.perPage,
          companyId: context.auth?.companyId,
        })
        return { kind: 'json', status: 200, body: result }
      },
    },

    {
      method: 'POST',
      path: '/admin/users',
      scope: 'admin',
      requiredScopes: [USER_ADMIN_SCOPE],
      bodySchema: createUserSchema,
      operationId: 'createUser',
      summary: 'Cria usuário local, escopo administrativo',
      async handler(context) {
        const body = context.body as CreateUserInput
        const profile = await useCases.createUser.execute({
          email: body.email,
          name: body.name,
          password: body.password,
          role: body.role,
          companyId: context.auth?.companyId,
        })
        return { kind: 'json', status: 201, body: { data: profile } }
      },
    },
  ]
}
