/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Troca o telefone: senha atual, número válido (regra do host) e único. O número fica NÃO verificado;
 * se há canal de verificação, um código sai para o número novo.
 */

import {
  PhoneAlreadyExistsError,
  PhoneInvalidError,
  USER_EVENT,
  UserNotFoundError,
  type UserProfile,
} from '@adatechnology/user-contracts'

import { issuePhoneVerification, type PhoneVerificationStart } from '../shared/phoneVerificationDelivery'
import { isUniqueViolation } from '../shared/databaseErrors'
import { normalizePhone } from '../shared/phone'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { assertCurrentPassword } from './assertCurrentPassword'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export type ChangePhoneResult = {
  readonly profile: UserProfile
  /** Presente com verificação configurada: `isSent` (canal de envio) e/ou `inbound` (mensagem pronta para o chat). */
  readonly verification?: PhoneVerificationStart
}

export class ChangePhoneUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly id: string
    readonly currentPassword: string
    readonly phone: string
    readonly companyId?: string
    /** Método de verificação escolhido pela empresa; ausente ou não configurado = o padrão. */
    readonly method?: string
  }): Promise<ChangePhoneResult> {
    const { dependencies } = this
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const existing = await dependencies.users.findById({ companyId, id: params.id })
    if (!existing) throw new UserNotFoundError()
    await assertCurrentPassword({ dependencies, row: existing, password: params.currentPassword })

    const phone = normalizePhone({ raw: params.phone, config: dependencies.config.phone })
    if (!phone) throw new PhoneInvalidError()
    if (phone === existing.phone) return { profile: toUserProfile(existing) }
    const owner = await dependencies.users.findByPhone({ companyId, phone })
    if (owner && owner.id !== existing.id) throw new PhoneAlreadyExistsError()

    const row = await dependencies.users
      .update({ companyId, id: existing.id, values: { phone, phoneVerifiedAt: null } })
      .catch((error: unknown) => {
        throw isUniqueViolation(error) ? new PhoneAlreadyExistsError() : error
      })
    if (!row) throw new UserNotFoundError()

    const verification = dependencies.config.phoneVerification
    const started = verification
      ? await issuePhoneVerification({
          dependencies,
          config: verification,
          row,
          phone,
          ...(params.method ? { method: params.method } : {}),
        })
      : undefined

    await runHook({
      dependencies,
      name: USER_EVENT.PHONE_CHANGED,
      run: () =>
        dependencies.hooks?.onPhoneChanged?.({
          type: USER_EVENT.PHONE_CHANGED,
          ...(companyId ? { companyId } : {}),
          occurredAt: nowOf(dependencies),
          userId: row.id,
          isVerificationStarted: started !== undefined,
        }),
    })
    return { profile: toUserProfile(row), ...(started ? { verification: started } : {}) }
  }
}
