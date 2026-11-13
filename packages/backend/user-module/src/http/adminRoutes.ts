/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createUserSchema, type CreateUserInput } from '@adatechnology/user-contracts'
import { AVATAR_REJECTION, AvatarRejectedError } from '@adatechnology/user-contracts'
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

  const avatarRoutes: ModuleRoute[] = module.hasAvatar
    ? [
        {
          method: 'PUT',
          path: '/admin/users/:id/avatar',
          scope: 'admin',
          requiredScopes: [USER_ADMIN_SCOPE],
          operationId: 'setUserAvatar',
          summary: 'Troca a foto de um usuario, escopo administrativo',
          async handler(context) {
            const body = context.rawBody
            if (!body || body.byteLength === 0) throw new AvatarRejectedError(AVATAR_REJECTION.EMPTY)

            const profile = await useCases.setAvatar.execute({
              userId: context.params.id ?? '',
              body,
              contentType: context.headers['content-type'] ?? '',
            })
            return { kind: 'json', status: 200, body: { data: profile } }
          },
        },
      ]
    : []

  /*
    Duas capacidades, nao uma: sem `passwordReset` nao ha token para gerar, e sem e-mail o token
    seria gerado e morreria sem chegar a ninguem — um botao que parece funcionar e nao faz nada.
  */
  const passwordResetRoutes: ModuleRoute[] =
    module.hasPasswordReset && module.hasEmail
      ? [
          {
            method: 'POST',
            path: '/admin/users/:id/password-reset',
            scope: 'admin',
            requiredScopes: [USER_ADMIN_SCOPE],
            operationId: 'sendUserPasswordReset',
            summary: 'Envia e-mail de redefinicao de senha a um usuario, escopo administrativo',
            async handler(context) {
              const profile = await useCases.getProfile.execute({
                id: context.params.id ?? '',
                ...(context.auth?.companyId ? { companyId: context.auth.companyId } : {}),
              })

              /*
              Aqui o 404 e legitimo, ao contrario da rota publica de reset, que responde igual para
              e-mail existente e inexistente para nao virar um oraculo de cadastro. Quem chama esta
              ja esta autenticado como administrador e ja enxerga a lista inteira.
            */
              await useCases.requestPasswordReset.execute({
                email: profile.email,
                ...(context.auth?.companyId ? { companyId: context.auth.companyId } : {}),
                ...(context.ip ? { ipAddress: context.ip } : {}),
              })

              // 202: o envio e assincrono, e a resposta nao promete que a caixa de entrada recebeu.
              return { kind: 'empty', status: 202 }
            },
          },
        ]
      : []

  return [
    ...avatarRoutes,
    ...passwordResetRoutes,
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
