/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dependências injetadas em todo caso de uso — porta estreita sobre os repositórios, não a classe
 * concreta, para o teste injetar dublê em memória sem Postgres.
 */

import type {
  ClockPort,
  EmailDriverPort,
  LoggerPort,
  RefreshTokenStorePort,
  UserModuleConfig,
  UserHooks,
} from '@adatechnology/user-contracts'

import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import type { UserRepository } from '../repositories/UserRepository'
import type { KeycloakVerifierPort } from '../shared/keycloak.types'
import type { TokenService } from '../shared/TokenService'

export type UserDependencies = {
  readonly users: UserRepository
  readonly passwordResetTokens: PasswordResetTokenRepository
  readonly refreshTokenStore: RefreshTokenStorePort
  readonly tokenService: TokenService
  readonly config: UserModuleConfig
  readonly hooks?: UserHooks
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  readonly email?: EmailDriverPort
  readonly keycloak?: KeycloakVerifierPort
}

/**
 * Hook nunca derruba a operação principal: falha ao notificar não pode impedir login, criação de
 * usuário ou reset de senha (contrato documentado em `UserHooks`, `user-contracts/events.ts`).
 */
export async function runHook(params: {
  readonly dependencies: Pick<UserDependencies, 'logger'>
  readonly name: string
  readonly run: () => Promise<void> | void
}): Promise<void> {
  try {
    await params.run()
  } catch (error) {
    params.dependencies.logger?.warn('user.hook_failed', { hook: params.name, error: String(error) })
  }
}

export function nowOf(dependencies: Pick<UserDependencies, 'clock'>): Date {
  return dependencies.clock?.now() ?? new Date()
}
