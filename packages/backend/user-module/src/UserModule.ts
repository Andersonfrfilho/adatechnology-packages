/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  ConfigMissingError,
  DEFAULT_USER_AUDIENCE,
  ProviderMisconfiguredError,
  REFRESH_COOKIE_SAME_SITE,
} from '@adatechnology/user-contracts'
import type {
  AvatarStoragePort,
  ClockPort,
  EmailDriverPort,
  LoggerPort,
  RefreshCookieSameSite,
  RefreshTokenStorePort,
  UserHooks,
  UserModuleConfig,
} from '@adatechnology/user-contracts'

import type { UserDatabase } from './database.types'
import { isValidRefreshCookieName, isValidRefreshCookiePath } from './http/cookies'
import { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
import { DEFAULT_REFRESH_COOKIE_NAME, DEFAULT_REFRESH_COOKIE_PATH } from './shared/constants'
import type { AccessTokenClaims } from './shared/TokenService'
import { TokenService } from './shared/TokenService'
import type { KeycloakVerifierPort } from './shared/keycloak.types'
import { AuthenticateKeycloakUseCase } from './use-cases/AuthenticateKeycloak.use-case'
import { AuthenticateLocalUseCase } from './use-cases/AuthenticateLocal.use-case'
import { ConfirmPasswordResetUseCase } from './use-cases/ConfirmPasswordReset.use-case'
import { CreateUserUseCase } from './use-cases/CreateUser.use-case'
import { GetProfileUseCase } from './use-cases/GetProfile.use-case'
import { ListUsersUseCase } from './use-cases/ListUsers.use-case'
import { RefreshSessionUseCase } from './use-cases/RefreshSession.use-case'
import { RequestPasswordResetUseCase } from './use-cases/RequestPasswordReset.use-case'
import { SetAvatarUseCase } from './use-cases/SetAvatar.use-case'
import { SignOutUseCase } from './use-cases/SignOut.use-case'
import { SignUpUseCase } from './use-cases/SignUp.use-case'
import { UpdateProfileUseCase } from './use-cases/UpdateProfile.use-case'
import { UpdateUserUseCase } from './use-cases/UpdateUser.use-case'
import { SetUserPasswordUseCase } from './use-cases/SetUserPassword.use-case'
import type { UserDependencies } from './use-cases/userModule.types'

const RESET_TOKEN_PLACEHOLDER = '{token}'
const AUDIENCE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

export type UserModuleProviders = {
  readonly refreshTokenStore?: RefreshTokenStorePort
  readonly email?: EmailDriverPort
  readonly keycloak?: KeycloakVerifierPort
  readonly avatar?: AvatarStoragePort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}

export type CreateUserModuleParams = {
  readonly db: UserDatabase
  readonly config: UserModuleConfig
  readonly providers?: UserModuleProviders
  readonly hooks?: UserHooks
}

export type UserModule = {
  readonly useCases: {
    readonly authenticateLocal: AuthenticateLocalUseCase
    readonly authenticateKeycloak: AuthenticateKeycloakUseCase
    readonly createUser: CreateUserUseCase
    readonly requestPasswordReset: RequestPasswordResetUseCase
    readonly confirmPasswordReset: ConfirmPasswordResetUseCase
    readonly updateProfile: UpdateProfileUseCase
    readonly updateUser: UpdateUserUseCase
    readonly setUserPassword: SetUserPasswordUseCase
    readonly signUp: SignUpUseCase
    readonly refreshSession: RefreshSessionUseCase
    readonly signOut: SignOutUseCase
    readonly getProfile: GetProfileUseCase
    readonly listUsers: ListUsersUseCase
    readonly setAvatar: SetAvatarUseCase
  }
  /** Exportado para o host montar seu próprio `AuthContextResolverPort` sem tocar em `jose`. */
  verifyAccessToken(accessToken: string): Promise<AccessTokenClaims | undefined>
  /** Capacidade por ausência: sem provedor Keycloak resolvido, a rota de callback não é publicada. */
  readonly hasKeycloak: boolean
  readonly hasEmail: boolean
  /** Sem armazenamento plugado a rota de foto nao e publicada: nao existe foto a oferecer. */
  readonly hasAvatar: boolean
  /** Sem `config.passwordReset` as rotas de reset não são publicadas — não existe reset a oferecer. */
  readonly hasPasswordReset: boolean
  /**
   * Política do cookie de refresh, já resolvida. As rotas emitem e limpam o cookie com ela, e o
   * host que serve a tela em outro site registrável declara `none` em `config.refreshToken`.
   */
  readonly refreshCookieSameSite: RefreshCookieSameSite
  /** Nome, caminho e `SameSite` do cookie de refresh, já resolvidos. */
  readonly refreshCookie: {
    readonly name: string
    readonly path: string
    readonly sameSite: RefreshCookieSameSite
  }
  /** Sem `config.signUp` a rota de cadastro não é publicada. */
  readonly hasSignUp: boolean
  readonly audience: string
}

async function resolveKeycloakVerifier(params: CreateUserModuleParams): Promise<KeycloakVerifierPort | undefined> {
  if (params.providers?.keycloak) return params.providers.keycloak
  if (!params.config.keycloak) return undefined

  const keycloakConfig = params.config.keycloak
  try {
    const { verifyToken } = await import('@adatechnology/auth-keycloak')
    return {
      async verify(accessToken: string) {
        const result = await verifyToken(accessToken, keycloakConfig)
        return result.valid && result.user ? { ...result.user } : undefined
      },
    }
  } catch (error) {
    throw new ProviderMisconfiguredError({
      reason: '@adatechnology/auth-keycloak não está instalado',
      error: String(error),
    })
  }
}

export async function createUserModule(params: CreateUserModuleParams): Promise<UserModule> {
  if (!params.config.accessToken?.secret) throw new ConfigMissingError('accessToken.secret')
  if (params.config.tenancy.mode === 'single' && !params.config.tenancy.defaultCompanyId) {
    throw new ConfigMissingError('tenancy.defaultCompanyId')
  }
  if (params.config.passwordReset && !params.config.passwordReset.resetUrlTemplate.includes(RESET_TOKEN_PLACEHOLDER)) {
    throw new ConfigMissingError('passwordReset.resetUrlTemplate')
  }

  // Papel é vocabulário do host (`pluggable-module.md`): sem a regra declarada, um usuário
  // provisionado pelo Keycloak nasceria com um papel que o host não conhece. Falha no boot, não no
  // primeiro login.
  if (params.config.keycloak && !params.config.keycloak.attributeMapping?.role) {
    throw new ConfigMissingError('keycloak.attributeMapping.role')
  }

  validateModuleConfig(params.config)

  const audience = params.config.audience ?? DEFAULT_USER_AUDIENCE
  const keycloak = await resolveKeycloakVerifier(params)

  const tokenService = new TokenService({
    secret: params.config.accessToken.secret,
    expiresInSeconds: params.config.accessToken.expiresInSeconds,
    issuer: params.config.accessToken.issuer,
    // Instância de outra audiência assina e exige `aud` próprio: o token de uma não vale na outra,
    // mesmo com segredo compartilhado.
    audience: params.config.accessToken.audience ?? (audience === DEFAULT_USER_AUDIENCE ? undefined : audience),
  })

  const sameSite = params.config.refreshToken?.sameSite ?? REFRESH_COOKIE_SAME_SITE.LAX

  const dependencies: UserDependencies = {
    users: new UserRepository(params.db, audience),
    passwordResetTokens: new PasswordResetTokenRepository(params.db),
    refreshTokenStore: params.providers?.refreshTokenStore ?? new RefreshTokenRepository(params.db),
    tokenService,
    config: params.config,
    hooks: params.hooks,
    clock: params.providers?.clock,
    logger: params.providers?.logger,
    email: params.providers?.email,
    keycloak,
    avatar: params.providers?.avatar,
  }

  return {
    useCases: {
      authenticateLocal: new AuthenticateLocalUseCase(dependencies),
      authenticateKeycloak: new AuthenticateKeycloakUseCase(dependencies),
      createUser: new CreateUserUseCase(dependencies),
      requestPasswordReset: new RequestPasswordResetUseCase(dependencies),
      confirmPasswordReset: new ConfirmPasswordResetUseCase(dependencies),
      updateProfile: new UpdateProfileUseCase(dependencies),
      updateUser: new UpdateUserUseCase(dependencies),
      setUserPassword: new SetUserPasswordUseCase(dependencies),
      signUp: new SignUpUseCase(dependencies),
      refreshSession: new RefreshSessionUseCase(dependencies),
      signOut: new SignOutUseCase(dependencies),
      getProfile: new GetProfileUseCase(dependencies),
      listUsers: new ListUsersUseCase(dependencies),
      setAvatar: new SetAvatarUseCase(dependencies),
    },
    verifyAccessToken: (accessToken: string) => tokenService.verify(accessToken),
    hasKeycloak: Boolean(keycloak),
    hasEmail: Boolean(dependencies.email),
    hasAvatar: Boolean(dependencies.avatar),
    hasPasswordReset: Boolean(params.config.passwordReset),
    refreshCookieSameSite: sameSite,
    refreshCookie: {
      name: params.config.refreshToken?.cookieName ?? DEFAULT_REFRESH_COOKIE_NAME,
      path: params.config.refreshToken?.cookiePath ?? DEFAULT_REFRESH_COOKIE_PATH,
      sameSite,
    },
    hasSignUp: Boolean(params.config.signUp),
    audience,
  }
}

/** Falha no boot, não no primeiro login: configuração inválida de segurança nunca deve ficar latente. */
function validateModuleConfig(config: UserModuleConfig): void {
  if (config.audience !== undefined && !AUDIENCE_PATTERN.test(config.audience)) {
    throw new ConfigMissingError('audience')
  }
  if (config.lockout) {
    const { maxFailedAttempts, lockMinutes } = config.lockout
    if (!Number.isInteger(maxFailedAttempts) || maxFailedAttempts < 1) {
      throw new ConfigMissingError('lockout.maxFailedAttempts')
    }
    if (!Number.isInteger(lockMinutes) || lockMinutes < 1) throw new ConfigMissingError('lockout.lockMinutes')
  }
  if (config.signUp) {
    if (!config.signUp.role) throw new ConfigMissingError('signUp.role')
    if (config.tenancy.mode === 'multi' && !config.signUp.companyId) throw new ConfigMissingError('signUp.companyId')
  }
  const refresh = config.refreshToken
  if (refresh?.cookieName !== undefined && !isValidRefreshCookieName(refresh.cookieName)) {
    throw new ConfigMissingError('refreshToken.cookieName')
  }
  if (refresh?.cookiePath !== undefined && !isValidRefreshCookiePath(refresh.cookiePath)) {
    throw new ConfigMissingError('refreshToken.cookiePath')
  }
  if (refresh?.reuseGraceSeconds !== undefined && !(refresh.reuseGraceSeconds >= 0)) {
    throw new ConfigMissingError('refreshToken.reuseGraceSeconds')
  }
  if (refresh?.rememberExpiresInSeconds !== undefined && !(refresh.rememberExpiresInSeconds > 0)) {
    throw new ConfigMissingError('refreshToken.rememberExpiresInSeconds')
  }
  if (refresh?.sessionExpiresInSeconds !== undefined && !(refresh.sessionExpiresInSeconds > 0)) {
    throw new ConfigMissingError('refreshToken.sessionExpiresInSeconds')
  }
  if (refresh?.absoluteExpiresInSeconds !== undefined && !(refresh.absoluteExpiresInSeconds > 0)) {
    throw new ConfigMissingError('refreshToken.absoluteExpiresInSeconds')
  }
}
