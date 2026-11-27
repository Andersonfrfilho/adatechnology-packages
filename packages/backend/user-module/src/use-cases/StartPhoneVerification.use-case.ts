/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Envia (ou reenvia, respeitando o intervalo mínimo) o código de verificação do telefone da conta.
 */

import { ConfigMissingError, UserNotFoundError } from '@adatechnology/user-contracts'

import { issuePhoneVerification, type PhoneVerificationStart } from '../shared/phoneVerificationDelivery'
import { resolveScopeCompanyId } from '../shared/tenancy'
import type { UserDependencies } from './userModule.types'

export class StartPhoneVerificationUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly id: string
    readonly companyId?: string
    readonly method?: string
  }): Promise<PhoneVerificationStart> {
    const { dependencies } = this
    const config = dependencies.config.phoneVerification
    if (!config) throw new ConfigMissingError('phoneVerification')
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const row = await dependencies.users.findById({ companyId, id: params.id })
    if (!row?.phone || row.phoneVerifiedAt) throw new UserNotFoundError()
    return issuePhoneVerification({
      dependencies,
      config,
      row,
      phone: row.phone,
      ...(params.method ? { method: params.method } : {}),
    })
  }
}
