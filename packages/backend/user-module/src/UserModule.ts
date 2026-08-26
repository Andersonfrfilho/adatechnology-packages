/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, ProviderMisconfiguredError } from '@adatechnology/user-contracts'
import type {
  AvatarStoragePort,
  ClockPort,
  EmailDriverPort,
  LoggerPort,
  RefreshTokenStorePort,
  UserHooks,
  UserModuleConfig,
} from '@adatechnology/user-contracts'

import type { UserDatabase } from './database.types'
import { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { UserRepository } from './repositories/UserRepository'
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
import { UpdateProfileUseCase } from './use-cases/UpdateProfile.use-case'
import type { UserDependencies } from './use-cases/userModule.types'

const RESET_TOKEN_PLACEHOLDER = '{token}'

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

  const keycloak = await resolveKeycloakVerifier(params)

  const tokenService = new TokenService({
    secret: params.config.accessToken.secret,
    expiresInSeconds: params.config.accessToken.expiresInSeconds,
    issuer: params.config.accessToken.issuer,
    audience: params.config.accessToken.audience,
  })

  const dependencies: UserDependencies = {
    users: new UserRepository(params.db),
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
  }
}
