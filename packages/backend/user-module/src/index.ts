/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Autenticação local + Keycloak, sessão, reset de senha e perfil.
 * Adaptadores em entrypoints próprios: `./schema`, `./http/fetch`, `./http/uws`, `./openapi`.
 */

export type { UserDatabase, DrizzleMigrateFunction } from './database.types'

export { userSchema, users, passwordResetTokens, refreshTokens, accountChallenges } from './schema/schema'
export type {
  UserRow,
  NewUserRow,
  PasswordResetTokenRow,
  NewPasswordResetTokenRow,
  RefreshTokenRow,
  NewRefreshTokenRow,
  AccountChallengeRow,
  NewAccountChallengeRow,
} from './schema/schema'

export { runUserMigrations, userMigrationsFolder, USER_MIGRATIONS_TABLE } from './runMigrations'
export type { RunUserMigrationsParams } from './runMigrations'

export type { UserScope } from './repositories/conditions'
export {
  userScopeCondition,
  userOwnedByCondition,
  userListCondition,
  userByEmailCondition,
  userByProviderExternalCondition,
  userByIdInAudienceCondition,
} from './repositories/conditions'

export { UserRepository } from './repositories/UserRepository'
export type {
  ListUsersQuery,
  ListUsersPage,
  RegisterFailedLoginParams,
  RegisterFailedLoginResult,
} from './repositories/UserRepository'

export { AccountChallengeRepository, ACCOUNT_CHALLENGE_KIND } from './repositories/AccountChallengeRepository'
export { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository'
export { RefreshTokenRepository } from './repositories/RefreshTokenRepository'

export { createUserModule } from './UserModule'
export type { UserModule, CreateUserModuleParams, UserModuleProviders } from './UserModule'

export { AuthenticateLocalUseCase } from './use-cases/AuthenticateLocal.use-case'
export { AuthenticateKeycloakUseCase } from './use-cases/AuthenticateKeycloak.use-case'
export { CreateUserUseCase } from './use-cases/CreateUser.use-case'
export { RequestPasswordResetUseCase } from './use-cases/RequestPasswordReset.use-case'
export { ConfirmPasswordResetUseCase } from './use-cases/ConfirmPasswordReset.use-case'
export { UpdateProfileUseCase } from './use-cases/UpdateProfile.use-case'
export { RefreshSessionUseCase } from './use-cases/RefreshSession.use-case'
export { UpdateUserUseCase } from './use-cases/UpdateUser.use-case'
export { SetUserPasswordUseCase } from './use-cases/SetUserPassword.use-case'
export type { SetUserPasswordParams } from './use-cases/SetUserPassword.use-case'
export type { UpdateUserParams } from './use-cases/UpdateUser.use-case'
export { ChangePasswordUseCase } from './use-cases/ChangePassword.use-case'
export { RequestEmailChangeUseCase } from './use-cases/RequestEmailChange.use-case'
export { ConfirmEmailChangeUseCase } from './use-cases/ConfirmEmailChange.use-case'
export { ChangePhoneUseCase } from './use-cases/ChangePhone.use-case'
export { StartPhoneVerificationUseCase } from './use-cases/StartPhoneVerification.use-case'
export { VerifyPhoneUseCase } from './use-cases/VerifyPhone.use-case'
export {
  MatchInboundPhoneVerificationUseCase,
  buildInboundPattern,
} from './use-cases/MatchInboundPhoneVerification.use-case'
export type { InboundVerificationOutcome } from './use-cases/MatchInboundPhoneVerification.use-case'
export { RecoverAccountUseCase } from './use-cases/RecoverAccount.use-case'
export type { RecoverAccountParams } from './use-cases/RecoverAccount.use-case'
export { listPhoneVerificationMethods, resolvePhoneVerificationMethod } from './shared/phoneVerificationMethods'
export type { PhoneVerificationMethodOption } from './shared/phoneVerificationMethods'
export { createInMemoryVerificationSender } from './testing/inMemoryVerificationSender'
export type { PhoneVerificationStart } from './shared/phoneVerificationDelivery'
export { SignUpUseCase } from './use-cases/SignUp.use-case'
export { SignOutUseCase } from './use-cases/SignOut.use-case'
export { GetProfileUseCase } from './use-cases/GetProfile.use-case'
export { ListUsersUseCase } from './use-cases/ListUsers.use-case'
export type { UserDependencies } from './use-cases/userModule.types'

export { TokenService } from './shared/TokenService'
export type { AccessTokenClaims } from './shared/TokenService'
export { generateRawToken, hashToken } from './shared/tokenHash'
export { resolveScopeCompanyId } from './shared/tenancy'
export { toUserProfile, toPaginatedUsers } from './shared/toContract'
export { applyAttributeMapping, DEFAULT_KEYCLOAK_ATTRIBUTE_MAPPING } from './shared/attributeMapping'
export type { KeycloakVerifierPort } from './shared/keycloak.types'
export {
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
  DEFAULT_RESET_TOKEN_EXPIRES_IN_SECONDS,
  DEFAULT_REFRESH_COOKIE_NAME,
  DEFAULT_REFRESH_COOKIE_PATH,
  DEFAULT_REFRESH_REUSE_GRACE_SECONDS,
  LOCAL_PROVIDER_ID,
  KEYCLOAK_PROVIDER_ID,
} from './shared/constants'

export { createUserRoutes } from './http/routes'
export { requireUser } from './http/requireUser'
export {
  REFRESH_TOKEN_COOKIE_NAME,
  parseCookieHeader,
  parseRefreshCookieValue,
  buildRefreshTokenCookie,
  buildClearRefreshTokenCookie,
  isValidRefreshCookieName,
  isValidRefreshCookiePath,
} from './http/cookies'
export type { ParsedRefreshCookie, RefreshCookieNaming } from './http/cookies'
