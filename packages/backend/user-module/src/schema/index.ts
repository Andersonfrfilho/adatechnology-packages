/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrypoint próprio (`@adatechnology/user-module/schema`) para o host referenciar os objetos
 * Drizzle de verdade — não só os tipos — em uma FK real de banco entre schemas
 * (`scheduling.schema.ts` → `"user".users`). Mudar o shape aqui é breaking change de major.
 */

export { userSchema, users, passwordResetTokens, refreshTokens, loginLockouts, accountChallenges } from './schema'
export type {
  UserRow,
  NewUserRow,
  PasswordResetTokenRow,
  NewPasswordResetTokenRow,
  RefreshTokenRow,
  NewRefreshTokenRow,
  AccountChallengeRow,
  NewAccountChallengeRow,
} from './schema'
