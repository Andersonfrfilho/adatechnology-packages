/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Verificação gratuita por mensagem RECEBIDA. O host (webhook do WhatsApp, antes do robô) entrega o texto e o
 * número de quem enviou; o módulo acha a conta por esse número — então quem envia só confirma o PRÓPRIO
 * número —, confere o código (hash, validade, tentativas, uso único) e marca o telefone como verificado.
 *
 * - `ignored`: o texto não é uma confirmação; o host segue com o fluxo normal.
 * - `verified`: confirmado; o host responde "Pronto, seu número foi confirmado".
 * - `rejected`: parecia uma confirmação, mas não vale (código errado, vencido, já usado, outro remetente...).
 *   O host responde algo curto e genérico: nada do que existe na conta vaza.
 */

import { ConfigMissingError, USER_EVENT } from '@adatechnology/user-contracts'

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import { normalizePhone } from '../shared/phone'
import { DEFAULT_INBOUND_PREFIX } from '../shared/phoneVerificationDelivery'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { DEFAULT_CODE_MAX_ATTEMPTS, hashVerificationCode, isSameHash } from '../shared/verificationCode'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export type InboundVerificationOutcome = 'ignored' | 'verified' | 'rejected'

const PREFIX_WORD_SEPARATOR = '\\s+'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function accentTolerant(value: string): string {
  return value.replace(/[úu]/gi, '[uú]').replace(/[áa]/gi, '[aá]').replace(/[éeê]/gi, '[eéê]').replace(/[óo]/gi, '[oó]')
}

/** `Confirmar meu número: 482 913` / `confirmar meu numero 482913` / `CONFIRMAR MEU NÚMERO:482913` casam; o grupo 1 é o código. */
export function buildInboundPattern(prefix: string = DEFAULT_INBOUND_PREFIX): RegExp {
  const words = prefix
    .trim()
    .replace(/:\s*$/, '')
    .split(/\s+/)
    .map((word) => accentTolerant(escapeRegExp(word)))
  return new RegExp(`${words.join(PREFIX_WORD_SEPARATOR)}\\s*:?\\s*([0-9][0-9\\s.-]{2,14})`, 'i')
}

export class MatchInboundPhoneVerificationUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly text: string
    readonly senderPhone: string
    readonly companyId?: string
  }): Promise<{ readonly outcome: InboundVerificationOutcome; readonly userId?: string }> {
    const { dependencies } = this
    const config = dependencies.config.phoneVerification
    if (!config?.inbound) throw new ConfigMissingError('phoneVerification.inbound')

    const pattern = config.inbound.pattern ?? buildInboundPattern(config.inbound.messagePrefix)
    const matched = pattern.exec(params.text)
    if (!matched?.[1]) return { outcome: 'ignored' }
    const code = matched[1].replace(/\D/g, '')

    const sender = normalizePhone({ raw: params.senderPhone, config: dependencies.config.phone })
    if (!sender) return { outcome: 'rejected' }
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const row = await dependencies.users.findByPhone({ companyId, phone: sender })
    if (!row?.phone || row.phoneVerifiedAt) return { outcome: 'rejected' }

    const now = nowOf(dependencies)
    const challenge = await dependencies.accountChallenges.findLatest({
      userId: row.id,
      kind: ACCOUNT_CHALLENGE_KIND.PHONE_CODE,
    })
    const isUsable = challenge && !challenge.consumedAt && challenge.expiresAt > now && challenge.target === row.phone
    if (!isUsable) return { outcome: 'rejected' }

    const attempts = await dependencies.accountChallenges.registerAttempt({ id: challenge.id })
    const maxAttempts = config.maxAttempts ?? DEFAULT_CODE_MAX_ATTEMPTS
    if (attempts === undefined) return { outcome: 'rejected' }
    if (attempts > maxAttempts) {
      await dependencies.accountChallenges.consume({ id: challenge.id, now })
      return { outcome: 'rejected' }
    }
    const expected = hashVerificationCode({ code, userId: row.id, phone: row.phone, secret: config.hashSecret })
    if (!isSameHash(expected, challenge.secretHash)) return { outcome: 'rejected' }
    if (!(await dependencies.accountChallenges.consume({ id: challenge.id, now }))) return { outcome: 'rejected' }

    const updated = await dependencies.users.update({ companyId, id: row.id, values: { phoneVerifiedAt: now } })
    if (!updated) return { outcome: 'rejected' }
    await runHook({
      dependencies,
      name: USER_EVENT.PHONE_VERIFIED,
      run: () =>
        dependencies.hooks?.onPhoneVerified?.({
          type: USER_EVENT.PHONE_VERIFIED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: row.id,
        }),
    })
    return { outcome: 'verified', userId: row.id }
  }
}
