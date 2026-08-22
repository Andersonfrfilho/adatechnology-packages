/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tipos mínimos redeclarados — `user-ui` não depende de `@adatechnology/user-contracts`, mesma
 * decisão de `products-ui` para manter o bundle do browser livre de zod.
 */

export type UserProfile = {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly companyId?: string
  readonly isActive: boolean
  readonly lastSeenAt?: string
}

export type UserSession = {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly refreshToken: string
  readonly refreshExpiresInSeconds: number
  readonly user: UserProfile
}

export const SESSION_STATUS = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
} as const
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS]

export type SignInParams = {
  readonly email: string
  readonly password: string
}

export type UpdateProfileInput = {
  readonly name: string
}

export type ConfirmPasswordResetParams = {
  readonly token: string
  readonly newPassword: string
}

export type UserApi = {
  readonly signIn: (params: SignInParams) => Promise<UserSession>
  readonly signOut: () => Promise<void>
  readonly getProfile: () => Promise<UserProfile>
  readonly updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>
  readonly requestPasswordReset: (email: string) => Promise<void>
  readonly confirmPasswordReset: (params: ConfirmPasswordResetParams) => Promise<void>
}

export type UserConfig = {
  /** Se `false`, o `UserProvider` não chama `api.getProfile()` na montagem — o host decide quando. */
  readonly autoFetchProfile: boolean
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  autoFetchProfile: true,
}
