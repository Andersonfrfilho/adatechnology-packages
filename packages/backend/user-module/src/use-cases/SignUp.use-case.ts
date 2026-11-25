/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Cadastro público. O papel vem de `config.signUp`, nunca do corpo da requisição.
 */

import { ProviderDisabledError, type UserSession } from '@adatechnology/user-contracts'

import { resolveScopeCompanyId } from '../shared/tenancy'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import type { UserDependencies } from './userModule.types'

export class SignUpUseCase {
  private readonly createUser: CreateUserUseCase
  private readonly authenticateLocal: AuthenticateLocalUseCase

  constructor(private readonly dependencies: UserDependencies) {
    this.createUser = new CreateUserUseCase(dependencies)
    this.authenticateLocal = new AuthenticateLocalUseCase(dependencies)
  }

  async execute(params: {
    readonly email: string
    readonly name: string
    readonly password: string
    readonly ipAddress?: string
  }): Promise<UserSession> {
    const signUp = this.dependencies.config.signUp
    if (!signUp) throw new ProviderDisabledError()

    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: signUp.companyId })

    await this.createUser.execute({
      email: params.email,
      name: params.name,
      password: params.password,
      role: signUp.role,
      ...(companyId ? { companyId } : {}),
    })

    // Entra direto: o mesmo caminho do login, com seus ganchos e regras (conta ativa, bloqueio).
    return this.authenticateLocal.execute({
      email: params.email,
      password: params.password,
      ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      ...(companyId ? { companyId } : {}),
    })
  }
}
