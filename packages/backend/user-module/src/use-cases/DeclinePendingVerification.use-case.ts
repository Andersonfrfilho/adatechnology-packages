/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * "Não fui eu" ao bot: alguém usou o número de outra pessoa numa ativação. Cancela o código e avisa o host
 * (`onPhoneVerificationDeclined`, para a trilha de auditoria e o aviso à equipe) e, com driver de e-mail, o dono da conta.
 * Nada além do que o bot já mostrou (nome e e-mail mascarados) sai daqui.
 */

import { USER_EVENT } from '@adatechnology/user-contracts'

import { loadPendingVerification } from '../shared/loadPendingVerification'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class DeclinePendingVerificationUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly senderPhone: string
    readonly challengeId: string
    readonly companyId?: string
  }): Promise<{ readonly outcome: 'declined' | 'rejected'; readonly userId?: string }> {
    const { dependencies } = this
    const pending = await loadPendingVerification({ dependencies, ...params })
    if (!pending) return { outcome: 'rejected' }
    const now = nowOf(dependencies)
    if (!(await dependencies.accountChallenges.consume({ id: pending.challenge.id, now })))
      return { outcome: 'rejected' }

    const companyId = pending.user.companyId ?? undefined
    if (dependencies.email && pending.user.email) {
      const result = await dependencies.email.send({
        to: pending.user.email,
        subject: 'Alguém tentou ativar sua conta com este número',
        text: 'Alguém usou o seu número para ativar uma conta e respondeu que não era a pessoa. Cancelamos a verificação. Se não foi você, ignore; se foi, peça um novo código na sua conta.',
        html: '<p>Alguém usou o seu número para ativar uma conta e respondeu que não era a pessoa. Cancelamos a verificação.</p><p>Se não foi você, ignore; se foi, peça um novo código na sua conta.</p>',
      })
      if (result.outcome !== 'sent') {
        dependencies.logger?.warn('user.verification_declined_email_failed', {
          userId: pending.user.id,
          outcome: result.outcome,
          errorCode: result.errorCode,
        })
      }
    }
    await runHook({
      dependencies,
      name: USER_EVENT.PHONE_VERIFICATION_DECLINED,
      run: () =>
        dependencies.hooks?.onPhoneVerificationDeclined?.({
          type: USER_EVENT.PHONE_VERIFICATION_DECLINED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: pending.user.id,
        }),
    })
    return { outcome: 'declined', userId: pending.user.id }
  }
}
