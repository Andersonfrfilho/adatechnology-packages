/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Handler recebe contexto já validado e autenticado por `dispatchRoute` — daí não haver
 * `try/catch` nem checagem de escopo aqui dentro.
 */

import {
  AVATAR_REJECTION,
  AvatarRejectedError,
  confirmPasswordResetSchema,
  keycloakCallbackSchema,
  localCredentialsSchema,
  requestPasswordResetSchema,
  signUpSchema,
  updateProfileSchema,
  type ConfirmPasswordResetInput,
  type KeycloakCallbackInput,
  type LocalCredentials,
  type RequestPasswordResetInput,
  type SignUpInput,
  type UserSession,
  type UpdateProfileInput,
} from '@adatechnology/user-contracts'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'

import type { UserModule } from '../UserModule'
import {
  buildClearRefreshTokenCookie,
  buildRefreshTokenCookie,
  parseCookieHeader,
  parseRefreshCookieValue,
  type ParsedRefreshCookie,
} from './cookies'
import { requireUser } from './requireUser'

export function buildAuthRoutes(module: UserModule): ModuleRoute[] {
  const { useCases, refreshCookie } = module

  const readRefreshCookie = (cookieHeader: string | undefined): ParsedRefreshCookie | undefined => {
    const raw = parseCookieHeader(cookieHeader)[refreshCookie.name]
    return raw ? parseRefreshCookieValue(raw) : undefined
  }

  const buildSessionCookie = (
    session: Pick<UserSession, 'refreshToken' | 'refreshExpiresInSeconds'>,
    rememberMe?: boolean,
  ): string =>
    buildRefreshTokenCookie({
      token: session.refreshToken,
      maxAgeSeconds: session.refreshExpiresInSeconds,
      ...(rememberMe === undefined ? {} : { rememberMe }),
      sameSite: refreshCookie.sameSite,
      name: refreshCookie.name,
      path: refreshCookie.path,
    })

  /** Sem armazenamento plugado a rota nao existe — em vez de existir e responder erro no upload. */
  const avatarRoutes: ModuleRoute[] = module.hasAvatar
    ? [
        {
          method: 'PUT',
          path: '/auth/profile/avatar',
          scope: 'user',
          operationId: 'setOwnAvatar',
          summary: 'Troca a foto do usuario autenticado',
          handler: (context) => handleAvatarUpload({ context, module, userId: requireUser(context) }),
        },
      ]
    : []

  const keycloakRoutes: ModuleRoute[] = module.hasKeycloak
    ? [
        {
          method: 'POST',
          path: '/auth/keycloak/callback',
          scope: 'public',
          bodySchema: keycloakCallbackSchema,
          operationId: 'authenticateKeycloak',
          summary: 'Autentica via token Keycloak já emitido e devolve a sessão do módulo',
          async handler(context) {
            const body = context.body as KeycloakCallbackInput
            const session = await useCases.authenticateKeycloak.execute({
              accessToken: body.accessToken,
              ipAddress: context.ip,
            })
            return {
              kind: 'json',
              status: 200,
              body: { data: session },
              headers: {
                'Set-Cookie': buildSessionCookie(session),
              },
            }
          },
        },
      ]
    : []

  /**
   * Sem `config.passwordReset` o caso de uso lança `ConfigMissingError` — publicar a rota assim
   * seria oferecer um 500 público. Capacidade por ausência, mesma regra do Keycloak acima.
   */
  const passwordResetRoutes: ModuleRoute[] = module.hasPasswordReset
    ? [
        {
          method: 'POST',
          path: '/auth/password-reset/request',
          scope: 'public',
          bodySchema: requestPasswordResetSchema,
          operationId: 'requestPasswordReset',
          summary: 'Sempre responde 202 — não revela se o e-mail existe',
          async handler(context) {
            const body = context.body as RequestPasswordResetInput
            await useCases.requestPasswordReset.execute({ email: body.email, ipAddress: context.ip })
            return { kind: 'empty', status: 202 }
          },
        },

        {
          method: 'POST',
          path: '/auth/password-reset/confirm',
          scope: 'public',
          bodySchema: confirmPasswordResetSchema,
          operationId: 'confirmPasswordReset',
          summary: 'Confirma o reset de senha com o token recebido por e-mail',
          async handler(context) {
            const body = context.body as ConfirmPasswordResetInput
            await useCases.confirmPasswordReset.execute({ rawToken: body.token, newPassword: body.newPassword })
            return { kind: 'empty', status: 204 }
          },
        },
      ]
    : []

  /** Sem `config.signUp` a rota não existe — o cadastro público é opt-in. */
  const signUpRoutes: ModuleRoute[] = module.hasSignUp
    ? [
        {
          method: 'POST',
          path: '/auth/signup',
          scope: 'public',
          bodySchema: signUpSchema,
          operationId: 'signUp',
          summary: 'Cadastro público; o papel vem da configuração do host e a sessão já é aberta',
          async handler(context) {
            const body = context.body as SignUpInput
            const session = await useCases.signUp.execute({
              email: body.email,
              name: body.name,
              password: body.password,
              ipAddress: context.ip,
            })
            return {
              kind: 'json',
              status: 201,
              body: { data: session },
              headers: { 'Set-Cookie': buildSessionCookie(session) },
            }
          },
        },
      ]
    : []

  return [
    {
      method: 'POST',
      path: '/auth/login',
      scope: 'public',
      bodySchema: localCredentialsSchema,
      operationId: 'authenticateLocal',
      summary: 'Login local por e-mail e senha',
      async handler(context) {
        const body = context.body as LocalCredentials
        const session = await useCases.authenticateLocal.execute({
          email: body.email,
          password: body.password,
          ipAddress: context.ip,
          ...(body.rememberMe === undefined ? {} : { rememberMe: body.rememberMe }),
        })
        return {
          kind: 'json',
          status: 200,
          body: { data: session },
          headers: {
            'Set-Cookie': buildSessionCookie(session, session.rememberMe),
          },
        }
      },
    },

    ...signUpRoutes,

    ...keycloakRoutes,

    ...passwordResetRoutes,

    {
      method: 'POST',
      path: '/auth/refresh',
      scope: 'public',
      operationId: 'refreshSession',
      summary: 'Rotaciona o refresh token e emite um novo access token',
      async handler(context) {
        const presented = readRefreshCookie(context.headers['cookie'])
        if (!presented) return { kind: 'empty', status: 401 }

        const session = await useCases.refreshSession.execute({
          refreshToken: presented.token,
          ...(presented.rememberMe === undefined ? {} : { rememberMe: presented.rememberMe }),
        })
        return {
          kind: 'json',
          status: 200,
          body: { data: session },
          headers: {
            // O servidor sabe a escolha; o prefixo do cookie só vale para token anterior ao registro.
            'Set-Cookie': buildSessionCookie(session, session.rememberMe ?? presented.rememberMe),
          },
        }
      },
    },

    {
      method: 'POST',
      path: '/auth/logout',
      scope: 'user',
      operationId: 'signOut',
      summary: 'Revoga o refresh token da sessão atual',
      async handler(context) {
        const presented = readRefreshCookie(context.headers['cookie'])
        if (presented) await useCases.signOut.execute({ refreshToken: presented.token })
        return {
          kind: 'empty',
          status: 204,
          headers: { 'Set-Cookie': buildClearRefreshTokenCookie(refreshCookie.sameSite, refreshCookie) },
        }
      },
    },

    {
      method: 'GET',
      path: '/auth/me',
      scope: 'user',
      operationId: 'getProfile',
      summary: 'Perfil do usuário autenticado',
      async handler(context) {
        const userId = requireUser(context)
        const profile = await useCases.getProfile.execute({ id: userId, companyId: context.auth?.companyId })
        return { kind: 'json', status: 200, body: { data: profile } }
      },
    },

    {
      method: 'PATCH',
      path: '/auth/profile',
      scope: 'user',
      bodySchema: updateProfileSchema,
      operationId: 'updateProfile',
      summary: 'Atualiza o nome do usuário autenticado',
      async handler(context) {
        const userId = requireUser(context)
        const body = context.body as UpdateProfileInput
        const profile = await useCases.updateProfile.execute({
          id: userId,
          name: body.name ?? '',
          companyId: context.auth?.companyId,
        })
        return { kind: 'json', status: 200, body: { data: profile } }
      },
    },

    ...avatarRoutes,
  ]
}

/**
 * A foto chega como bytes crus, e nao como JSON com base64.
 *
 * Base64 infla 33%% e ainda passaria por um parse de JSON de megabytes so para ser desfeito em
 * seguida. `content-type` diz o formato, e a validacao roda sobre o que chegou.
 */
async function handleAvatarUpload(params: {
  readonly context: RequestContext
  readonly module: UserModule
  readonly userId: string
}): Promise<HttpResult> {
  const body = params.context.rawBody
  if (!body || body.byteLength === 0) throw new AvatarRejectedError(AVATAR_REJECTION.EMPTY)

  const profile = await params.module.useCases.setAvatar.execute({
    userId: params.userId,
    body,
    contentType: params.context.headers['content-type'] ?? '',
  })

  return { kind: 'json', status: 200, body: { data: profile } }
}
