/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createLoginLockout, type LoginLockout, LockoutPolicyError } from '@adatechnology/login-lockout'
import { createDrizzleLockoutStore } from '@adatechnology/login-lockout/drizzle'
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
  VerificationCodeSenderPort,
  UserModuleConfig,
} from '@adatechnology/user-contracts'

import type { UserDatabase } from './database.types'
import { isValidRefreshCookieName, isValidRefreshCookiePath } from './http/cookies'
import { AccountChallengeRepository } from './repositories/AccountChallengeRepository'
import { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
import { loginLockouts } from './schema/schema'
import { resolveUserLockoutPolicy } from './shared/lockoutPolicy'
import { DEFAULT_REFRESH_COOKIE_NAME, DEFAULT_REFRESH_COOKIE_PATH } from './shared/constants'
import type { AccessTokenClaims } from './shared/TokenService'
import { TokenService } from './shared/TokenService'
import type { KeycloakVerifierPort } from './shared/keycloak.types'
import { AuthenticateKeycloakUseCase } from './use-cases/AuthenticateKeycloak.use-case'
import { AuthenticateLocalUseCase } from './use-cases/AuthenticateLocal.use-case'
import { ChangePasswordUseCase } from './use-cases/ChangePassword.use-case'
import { ChangePhoneUseCase } from './use-cases/ChangePhone.use-case'
import { ConfirmEmailChangeUseCase } from './use-cases/ConfirmEmailChange.use-case'
import { ConfirmPendingVerificationUseCase } from './use-cases/ConfirmPendingVerification.use-case'
import { DeclinePendingVerificationUseCase } from './use-cases/DeclinePendingVerification.use-case'
import { OfferPendingVerificationUseCase } from './use-cases/OfferPendingVerification.use-case'
import { MatchInboundPhoneVerificationUseCase } from './use-cases/MatchInboundPhoneVerification.use-case'
import { RecoverAccountUseCase } from './use-cases/RecoverAccount.use-case'
import { RequestEmailChangeUseCase } from './use-cases/RequestEmailChange.use-case'
import { StartPhoneVerificationUseCase } from './use-cases/StartPhoneVerification.use-case'
import { VerifyPhoneUseCase } from './use-cases/VerifyPhone.use-case'
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
  /** Canais de entrega do código de verificação do telefone; vazio = só o modo `inbound`, ou nenhuma verificação. */
  readonly verificationSenders?: readonly VerificationCodeSenderPort[]
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
    readonly changePassword: ChangePasswordUseCase
    readonly requestEmailChange: RequestEmailChangeUseCase
    readonly confirmEmailChange: ConfirmEmailChangeUseCase
    readonly changePhone: ChangePhoneUseCase
    readonly startPhoneVerification: StartPhoneVerificationUseCase
    readonly verifyPhone: VerifyPhoneUseCase
    readonly matchInboundPhoneVerification: MatchInboundPhoneVerificationUseCase
    readonly recoverAccount: RecoverAccountUseCase
    readonly offerPendingVerification: OfferPendingVerificationUseCase
    readonly confirmPendingVerification: ConfirmPendingVerificationUseCase
    readonly declinePendingVerification: DeclinePendingVerificationUseCase
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
  /** Sem `config.emailChange` as rotas de troca de e-mail não são publicadas. */
  readonly hasEmailChange: boolean
  /** Sem `config.phoneVerification` o telefone é salvo como não verificado e as rotas de verificação não existem. */
  readonly hasPhoneVerification: boolean
  /** Sem `config.passwordReset` a recuperação assistida não tem como mandar o link: a rota não é publicada. */
  readonly hasAccountRecovery: boolean
  /** Sem `config.signUp` a rota de cadastro não é publicada. */
  readonly hasSignUp: boolean
  readonly audience: string
}

const MIN_IDENTIFIER_SECRET_LENGTH = 16

function buildUnknownIdentifierLockout(params: {
  readonly config: UserModuleConfig
  readonly db: UserDatabase
  readonly clock: ClockPort | undefined
}): LoginLockout | undefined {
  const lockout = params.config.lockout
  if (!lockout?.identifierSecret) return undefined
  return createLoginLockout({
    store: createDrizzleLockoutStore({ database: params.db, table: loginLockouts }),
    secret: lockout.identifierSecret,
    policy: resolveUserLockoutPolicy(lockout),
    ...(params.clock ? { now: () => params.clock!.now() } : {}),
  })
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
  if (params.config.emailChange && !params.config.emailChange.confirmUrlTemplate.includes(RESET_TOKEN_PLACEHOLDER)) {
    throw new ConfigMissingError('emailChange.confirmUrlTemplate')
  }
  if (
    params.config.phoneVerification &&
    params.config.phoneVerification.hashSecret.length < MIN_IDENTIFIER_SECRET_LENGTH
  ) {
    throw new ConfigMissingError('phoneVerification.hashSecret')
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
    accountChallenges: new AccountChallengeRepository(params.db),
    refreshTokenStore: params.providers?.refreshTokenStore ?? new RefreshTokenRepository(params.db),
    tokenService,
    config: params.config,
    hooks: params.hooks,
    clock: params.providers?.clock,
    logger: params.providers?.logger,
    email: params.providers?.email,
    keycloak,
    avatar: params.providers?.avatar,
    verificationSenders: params.providers?.verificationSenders,
    unknownIdentifierLockout: buildUnknownIdentifierLockout({
      config: params.config,
      db: params.db,
      clock: params.providers?.clock,
    }),
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
      changePassword: new ChangePasswordUseCase(dependencies),
      requestEmailChange: new RequestEmailChangeUseCase(dependencies),
      confirmEmailChange: new ConfirmEmailChangeUseCase(dependencies),
      changePhone: new ChangePhoneUseCase(dependencies),
      startPhoneVerification: new StartPhoneVerificationUseCase(dependencies),
      verifyPhone: new VerifyPhoneUseCase(dependencies),
      matchInboundPhoneVerification: new MatchInboundPhoneVerificationUseCase(dependencies),
      recoverAccount: new RecoverAccountUseCase(dependencies),
      offerPendingVerification: new OfferPendingVerificationUseCase(dependencies),
      confirmPendingVerification: new ConfirmPendingVerificationUseCase(dependencies),
      declinePendingVerification: new DeclinePendingVerificationUseCase(dependencies),
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
    hasEmailChange: Boolean(params.config.emailChange),
    hasPhoneVerification: Boolean(params.config.phoneVerification),
    hasAccountRecovery: Boolean(params.config.passwordReset),
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
    const { maxFailedAttempts, lockMinutes, identifierSecret } = config.lockout
    if (!Number.isInteger(maxFailedAttempts) || maxFailedAttempts < 1) {
      throw new ConfigMissingError('lockout.maxFailedAttempts')
    }
    if (!Number.isInteger(lockMinutes) || lockMinutes < 1) throw new ConfigMissingError('lockout.lockMinutes')
    if (identifierSecret !== undefined && identifierSecret.length < MIN_IDENTIFIER_SECRET_LENGTH) {
      throw new ConfigMissingError('lockout.identifierSecret')
    }
    try {
      resolveUserLockoutPolicy(config.lockout)
    } catch (error) {
      if (error instanceof LockoutPolicyError)
        throw new ConfigMissingError('lockout.multiplier/maxLockMinutes/forgiveAfterMinutes')
      throw error
    }
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
