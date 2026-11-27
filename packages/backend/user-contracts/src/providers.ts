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
  { readonly from: keyof TClaims } | { readonly value: string }

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
  issue(params: {
    readonly userId: string
    readonly expiresInSeconds: number
    /** Escolha "lembrar de mim" a registrar no token; a rotação a herda. Ausente = sem escolha registrada. */
    readonly rememberMe?: boolean
    /** Início da sessão para o teto absoluto; a rotação repassa o do token antigo. Ausente = agora. */
    readonly sessionStartedAt?: Date
  }): Promise<string>
  rotate(params: {
    readonly tokenHash: string
    readonly newExpiresInSeconds: number
    /**
     * Validade por escolha registrada no token. Presente, a rotação usa `remember`/`session` conforme o
     * que o token guarda e deixa `newExpiresInSeconds` para o token sem escolha registrada.
     */
    readonly expiresInSecondsByChoice?: { readonly remember: number; readonly session: number }
    /**
     * Escolha vinda do cookie de um token emitido antes do registro no servidor. Só vale quando o token
     * não tem escolha registrada; a rotação a grava no token novo, e o cookie deixa de ser a fonte.
     */
    readonly rememberMeHint?: boolean
    /**
     * Teto absoluto de vida da sessão, em segundos desde o login que a iniciou. Passado o teto, a
     * rotação recusa (`null`) e a pessoa precisa entrar de novo; antes dele, o token novo nunca vive
     * além do teto. Ausente = sem teto.
     */
    readonly absoluteExpiresInSeconds?: number
    /**
     * Janela, em segundos, em que reapresentar um token já rotacionado é tratado como corrida
     * legítima (duas abas renovando juntas) e não como reuso. Ausente = o padrão da implementação.
     */
    readonly reuseGraceSeconds?: number
  }): Promise<RefreshRotationResult>
  revoke(params: { readonly tokenHash: string }): Promise<void>
  revokeAllForUser(params: { readonly userId: string }): Promise<void>
}

/**
 * - `{ token, userId }`: rotação feita.
 * - `{ reusedForUserId }`: o token já tinha sido rotacionado antes — alguém o reapresentou. A loja
 *   já revogou todas as sessões desse usuário; o caso de uso só avisa o host e recusa.
 * - `null`: token desconhecido, expirado ou dentro da janela de graça — recusa simples.
 *
 * Uma loja customizada que nunca detecta reuso pode seguir devolvendo só `{ token, userId } | null`.
 */
export type RefreshRotationResult =
  | {
      readonly token: string
      readonly userId: string
      /** Escolha registrada no token (a efetiva). Loja que não registra omite. */
      readonly rememberMe?: boolean
      /** Validade real do token novo, já limitada pelo teto absoluto. Loja que não calcula omite. */
      readonly expiresInSeconds?: number
    }
  | { readonly reusedForUserId: string }
  | null

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

/**
 * Canal de entrega do código de verificação (WhatsApp, SMS...). Cada provedor declara o seu `channel`
 * e o host escolhe a ordem de tentativa em `config.phoneVerification.channelOrder`: o primeiro que
 * devolve `sent` encerra; `invalid_target`/`retriable`/`permanent` passam ao próximo.
 *
 * O módulo gera, grava só o hash, expira e limita o código; o provedor só entrega o texto que recebe.
 */
export type VerificationCodeSenderPort = {
  readonly channel: string
  send(params: {
    readonly code: string
    readonly destination: string
    readonly channel: string
    readonly expiresInSeconds: number
    readonly userId: string
    readonly companyId?: string
  }): Promise<DeliveryAttemptResult>
}

/**
 * Métodos de verificação do telefone conhecidos. O id de um método de envio é o `channel` do provedor;
 * `whatsapp-inbound` é o gratuito (a pessoa envia o código) e não precisa de provedor de envio.
 * A escolha do método é do host/empresa (configuração), nunca fixa no código.
 */
export const PHONE_VERIFICATION_METHOD = {
  WHATSAPP_INBOUND: 'whatsapp-inbound',
  WHATSAPP_TEMPLATE: 'whatsapp-template',
  SMS: 'sms',
} as const

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
  /**
   * Tela e api no MESMO site e sem navegação vinda de fora autenticada: o cookie não acompanha nem
   * o link clicado em outro site, então a primeira abertura por link externo chega sem sessão.
   */
  STRICT: 'strict',
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
  /**
   * Nome do cookie de refresh. Ausente = `user_refresh_token`.
   *
   * Duas instâncias do módulo na mesma origem (ex: uma por audiência) precisam de nomes diferentes,
   * ou uma sobrescreve a sessão da outra. Apenas caracteres de token HTTP (`A-Z a-z 0-9 _ -`).
   */
  readonly cookieName?: string
  /**
   * `Path` do cookie. Ausente = `/`. Deve começar com `/` e não conter `;`. Restringir ao prefixo
   * em que as rotas de autenticação da instância são montadas evita que o navegador envie o cookie
   * às demais rotas.
   */
  readonly cookiePath?: string
  /**
   * Segundos de tolerância para reapresentar um token recém-rotacionado antes de contar como reuso
   * (abas que renovam ao mesmo tempo). Ausente = 10. Use 0 para detecção estrita.
   */
  readonly reuseGraceSeconds?: number
  /** Validade do refresh de quem marcou "lembrar de mim". Ausente = `expiresInSeconds` (30 dias). */
  readonly rememberExpiresInSeconds?: number
  /**
   * Teto absoluto da sessão, em segundos desde o login: cada renovação rotaciona o token, mas a cadeia
   * inteira morre neste prazo, "lembrar de mim" ou não. Ausente = sem teto (a sessão se renova para
   * sempre enquanto a pessoa voltar dentro da validade de cada token).
   */
  readonly absoluteExpiresInSeconds?: number
  /**
   * Validade, no servidor, do refresh de quem entrou SEM "lembrar de mim" (o cookie some ao fechar o
   * navegador). Ausente = 24 h. Só vale quando o cliente envia `rememberMe: false`.
   */
  readonly sessionExpiresInSeconds?: number
}

export type EmailChangeEmailParams = {
  readonly confirmUrl: string
  readonly name: string
  readonly expiresInSeconds: number
}

/**
 * Troca de e-mail por confirmação no endereço novo. Ausente = a rota não é publicada.
 * A conta mantém o e-mail antigo até o link ser aberto.
 */
export type EmailChangeConfig = {
  readonly confirmUrlTemplate: string // must contain {token}
  readonly tokenExpiresInSeconds?: number
  readonly buildEmail?: (params: EmailChangeEmailParams) => PasswordResetEmailContent
}

/** Telefone da conta. `normalize` devolve o número canônico ou `undefined` se inválido (regra do país é do host). */
export type PhoneConfig = {
  readonly normalize?: (raw: string) => string | undefined
}

/**
 * Prova de posse do telefone por código de uso único. Ausente = o número é salvo como não verificado
 * e as rotas de verificação não são publicadas.
 */
export type PhoneVerificationConfig = {
  /**
   * Verificação por mensagem RECEBIDA (padrão gratuito): a tela abre o chat do host com um texto pronto
   * ("Confirmar meu número: 482913") e a pessoa só envia. O host chama `matchInboundPhoneVerification`
   * ao receber a mensagem. Ausente = só os canais de envio (`verificationSenders`).
   */
  /**
   * Método da empresa, lido a cada envio (ex.: de uma configuração por empresa). Devolve um id de
   * `PHONE_VERIFICATION_METHOD` ou o `channel` de um provedor. Ausente, ou método não configurado,
   * cai em `whatsapp-inbound` (se ligado) e depois no primeiro canal de envio.
   */
  readonly selectMethod?: (params: { readonly companyId?: string }) => Promise<string | undefined> | string | undefined
  readonly inbound?: {
    /** Texto antes do código, na mensagem pronta. Ausente = `Confirmar meu número:`. */
    readonly messagePrefix?: string
    /** Reconhece a mensagem; o grupo 1 é o código. Ausente = o padrão do prefixo (aceita espaços, caixa e acento). */
    readonly pattern?: RegExp
  }
  /** Ordem de tentativa dos canais (`channel` dos provedores). Ausente = a ordem em que os provedores foram plugados. */
  readonly channelOrder?: readonly string[]
  readonly codeLength?: number
  readonly expiresInSeconds?: number
  /** Tentativas de digitar o código antes de ele ser invalidado. */
  readonly maxAttempts?: number
  /** Intervalo mínimo entre dois envios para a mesma conta. */
  readonly resendCooldownSeconds?: number
  /** Chave do HMAC que protege o hash do código (mín. 16 caracteres). */
  readonly hashSecret: string
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

/** Audiência usada quando `UserModuleConfig.audience` não é declarada — e a das linhas já existentes. */
export const DEFAULT_USER_AUDIENCE = 'default'

/**
 * Bloqueio de conta por tentativas de login falhas. Ausente = desligado (comportamento de sempre).
 *
 * O contador e o bloqueio são gravados com um único `UPDATE ... RETURNING`, sem ler antes de
 * escrever, então tentativas concorrentes não furam o limite.
 */
export type LockoutConfig = {
  /** Falhas consecutivas que travam a conta. Inteiro >= 1. */
  readonly maxFailedAttempts: number
  /** Minutos do primeiro bloqueio. Inteiro >= 1. Passado o prazo, o contador recomeça do zero. */
  readonly lockMinutes: number
  /**
   * Cada bloqueio novo dura `multiplier` vezes o anterior (`lockMinutes * multiplier^nivel`). Padrão `1`: duração fixa,
   * como sempre foi. Use `2` para 15, 30, 60... minutos. Número >= 1.
   */
  readonly lockMultiplier?: number
  /** Teto de um bloqueio, em minutos. Padrão: o maior entre `lockMinutes` e 1440 (24 h). */
  readonly maxLockMinutes?: number
  /** Sem falha por este tempo (minutos, padrão 1440), contador e nível de escalada recomeçam. */
  readonly forgiveAfterMinutes?: number
  /**
   * Chave HMAC (mín. 16 caracteres). Quando presente, e-mail que NÃO existe também é bloqueado — grava-se só o
   * HMAC do e-mail, nunca o e-mail — e o login recusa com o mesmo erro genérico de credencial inválida. Sem ela, só
   * conta existente é bloqueada, e quem erra o e-mail nunca esbarra no limite.
   */
  readonly identifierSecret?: string
}

/**
 * Cadastro público (auto-serviço). Ausente = desligado: a rota nem é publicada.
 *
 * O papel e a empresa vêm daqui, nunca do corpo da requisição — quem se cadastra não escolhe o
 * próprio nível de acesso.
 */
export type SignUpConfig = {
  readonly role: string
  /** Obrigatório em `tenancy.mode = 'multi'`: a rota é pública e não tem `AuthContext` de onde ler. */
  readonly companyId?: string
}

export type UserModuleConfig = {
  readonly tenancy: TenancyConfig
  /**
   * Audiência desta instância. Ausente = `default`.
   *
   * Duas instâncias com audiências diferentes sobre o mesmo banco têm populações separadas: o mesmo
   * e-mail pode existir nas duas, e uma sessão de uma não vale na outra. Sem `accessToken.audience`
   * explícito, uma audiência diferente de `default` passa a ser também a `aud` do JWT.
   */
  readonly audience?: string
  readonly lockout?: LockoutConfig
  readonly signUp?: SignUpConfig
  readonly accessToken: AccessTokenConfig
  readonly refreshToken?: RefreshTokenConfig
  readonly passwordReset?: PasswordResetConfig
  readonly emailChange?: EmailChangeConfig
  readonly phone?: PhoneConfig
  readonly phoneVerification?: PhoneVerificationConfig
  readonly keycloak?: KeycloakConfig
}

/**
 * `keycloak` não entra aqui: a verificação de token é plumbing específico do módulo (ver
 * `KeycloakVerifierPort` em `user-module`), não um contrato genérico reutilizável por outro host.
 */
export type UserModuleProviders = {
  readonly refreshTokenStore?: RefreshTokenStorePort
  readonly email?: EmailDriverPort
  readonly verificationSenders?: readonly VerificationCodeSenderPort[]
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}
