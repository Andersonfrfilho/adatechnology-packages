/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import type { UserSession } from './user.types'

export const AUTH_PROVIDER_TYPE = {
  LOCAL: 'local',
  OAUTH2: 'oauth2',
  OIDC: 'oidc',
} as const

export type AuthProviderType = (typeof AUTH_PROVIDER_TYPE)[keyof typeof AUTH_PROVIDER_TYPE]

export type AuthProviderInterface<TCredentials = unknown> = {
  readonly id: string
  readonly type: AuthProviderType
  authenticate(params: { readonly credentials: TCredentials; readonly ipAddress?: string }): Promise<UserSession>
}

export type AttributeMappingRule<TClaims extends Record<string, unknown>> =
  | { readonly from: keyof TClaims }
  | { readonly value: string }

export type AttributeMapping<TClaims extends Record<string, unknown>> = {
  readonly email: AttributeMappingRule<TClaims>
  readonly name?: AttributeMappingRule<TClaims>
  readonly role?: AttributeMappingRule<TClaims>
}

/**
 * `issue` devolve o token cru; `rotate`/`revoke` recebem o **sha256 hex** dele — o token cru nunca
 * chega ao armazenamento, então um dump do Redis ou da tabela não vale sessão.
 *
 * `revokeAllForUser` é o que faz uma troca de senha realmente encerrar as sessões abertas. Sem ela,
 * a sessão comprometida sobrevive à redefinição feita justamente para matá-la — por isso é
 * obrigatória no contrato, e não uma capacidade opcional.
 */
export type RefreshTokenStorePort = {
  issue(params: { readonly userId: string; readonly expiresInSeconds: number }): Promise<string>
  rotate(params: {
    readonly tokenHash: string
    readonly newExpiresInSeconds: number
  }): Promise<{ readonly token: string; readonly userId: string } | null>
  revoke(params: { readonly tokenHash: string }): Promise<void>
  revokeAllForUser(params: { readonly userId: string }): Promise<void>
}

/**
 * Forma **idêntica** à de `@adatechnology/notification-contracts` — redeclarada, e não importada,
 * só para um pacote de contratos não arrastar outro domínio de runtime junto. Como o TypeScript é
 * estrutural, qualquer driver de `@adatechnology/email-provider` (`createSmtpEmailProvider`,
 * `createResendEmailProvider`, `createSesEmailProvider`) entra direto em `providers.email`, sem
 * adapter no host.
 *
 * Divergir daqui é o que quebra essa troca: a redeclaração só serve se as duas formas forem a
 * mesma, e nada no build de um pacote isolado avisa quando deixam de ser.
 */
export type SendEmailParams = {
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
  readonly idempotencyKey?: string
}

/**
 * União discriminada, não `{ success: boolean }`: quem chama precisa separar endereço inválido
 * (suprimir, nunca reenviar) de falha temporária (reagendar com backoff) de falha definitiva.
 * Colapsar isso num booleano joga fora justamente a informação que decide a ação seguinte.
 */
export type DeliveryAttemptResult =
  | { readonly outcome: 'sent'; readonly providerMessageId?: string }
  | { readonly outcome: 'invalid_target'; readonly errorCode: string }
  | { readonly outcome: 'retriable'; readonly errorCode: string; readonly retryAfterSeconds?: number }
  | { readonly outcome: 'permanent'; readonly errorCode: string }

export type EmailDriverPort = {
  readonly driver: string
  send(params: SendEmailParams): Promise<DeliveryAttemptResult>
}

export type ClockPort = {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

/** Mesma forma do `LoggerPort` dos outros contratos do ecossistema — o host escreve um adapter só. */
export type LoggerPort = {
  error(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  debug(message: string, meta?: LogMeta): void
}

export type TenancyConfig = { readonly mode: 'single'; readonly defaultCompanyId: string } | { readonly mode: 'multi' }

/**
 * `issuer`/`audience` são opcionais, mas quando declarados valem na assinatura **e** na
 * verificação: um token emitido para outra plateia é recusado. Um host que já emite JWT por conta
 * própria (migração gradual, dois emissores sobre o mesmo segredo) precisa declarar os mesmos
 * valores aqui, ou os dois lados não reconhecem o token um do outro.
 */
export type AccessTokenConfig = {
  readonly secret: string
  readonly expiresInSeconds?: number
  readonly issuer?: string
  readonly audience?: string
}

/**
 * `Lax` não é enviado em requisição cross-site — e `fetch` nunca conta como navegação de topo.
 *
 * Cross-site aqui é decidido pelo site registrável (eTLD+1), não pelo domínio pai: dois serviços em
 * `*.up.railway.app` são cross-site entre si, porque `railway.app` está na Public Suffix List. Web e
 * api em subdomínios de um domínio próprio (`app.` e `api.` de `exemplo.com.br`) são same-site, e aí
 * `lax` é o certo.
 */
export const REFRESH_COOKIE_SAME_SITE = {
  /** Padrão. A api e a tela compartilham o site registrável. */
  LAX: 'lax',
  /** A tela vive em outro site. Exige HTTPS — o cookie já sai `Secure` sempre. */
  NONE: 'none',
} as const

export type RefreshCookieSameSite = (typeof REFRESH_COOKIE_SAME_SITE)[keyof typeof REFRESH_COOKIE_SAME_SITE]

export type RefreshTokenConfig = {
  readonly expiresInSeconds?: number
  /**
   * Ausente = `lax`, que é o comportamento de sempre.
   *
   * `none` só quando a tela estiver em outro site registrável: ele permite que qualquer origem
   * inicie requisição com o cookie anexado, e a defesa contra CSRF passa a ser inteiramente do CORS
   * e da checagem de origem do host.
   */
  readonly sameSite?: RefreshCookieSameSite
}

export type PasswordResetEmailContent = {
  readonly subject: string
  readonly html: string
  readonly text: string
}

export type PasswordResetEmailParams = {
  readonly resetUrl: string
  readonly name: string
  readonly expiresInSeconds: number
}

export type PasswordResetConfig = {
  readonly resetUrlTemplate: string // must contain {token}
  readonly tokenExpiresInSeconds?: number
  /**
   * Texto do e-mail de redefinição. O módulo traz um padrão neutro, sem nome de produto e sem
   * marca — copy é vocabulário do host (`pluggable-module.md`), e cinco produtos consomem este
   * pacote. Quem quiser template versionado e pré-visualizável monta aqui em cima de
   * `renderTemplate` do `@adatechnology/notification-contracts`.
   */
  readonly buildEmail?: (params: PasswordResetEmailParams) => PasswordResetEmailContent
}

export type KeycloakConfig = {
  readonly realm: string
  readonly authServerUrl: string
  readonly clientId: string
  readonly clientSecret?: string
  readonly attributeMapping?: AttributeMapping<Record<string, unknown>>
}

export type UserModuleConfig = {
  readonly tenancy: TenancyConfig
  readonly accessToken: AccessTokenConfig
  readonly refreshToken?: RefreshTokenConfig
  readonly passwordReset?: PasswordResetConfig
  readonly keycloak?: KeycloakConfig
}

/**
 * `keycloak` não entra aqui: a verificação de token é plumbing específico do módulo (ver
 * `KeycloakVerifierPort` em `user-module`), não um contrato genérico reutilizável por outro host.
 */
export type UserModuleProviders = {
  readonly refreshTokenStore?: RefreshTokenStorePort
  readonly email?: EmailDriverPort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}
