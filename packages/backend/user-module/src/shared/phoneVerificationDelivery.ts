/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Emite um código de verificação e o entrega pelo primeiro canal que aceitar (ordem em
 * `phoneVerification.channelOrder`, senão a ordem dos provedores plugados).
 */

import {
  PHONE_VERIFICATION_METHOD,
  VerificationRateLimitedError,
  type PhoneVerificationConfig,
  type VerificationCodeSenderPort,
} from '@adatechnology/user-contracts'

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import type { UserRow } from '../schema/schema'
import { nowOf, type UserDependencies } from '../use-cases/userModule.types'
import { resolvePhoneVerificationMethod } from './phoneVerificationMethods'
import {
  DEFAULT_CODE_EXPIRES_IN_SECONDS,
  DEFAULT_CODE_LENGTH,
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  generateVerificationCode,
  hashVerificationCode,
} from './verificationCode'

export function orderSenders(params: {
  readonly senders: readonly VerificationCodeSenderPort[]
  readonly channelOrder: readonly string[] | undefined
}): VerificationCodeSenderPort[] {
  const { senders, channelOrder } = params
  if (!channelOrder) return [...senders]
  return channelOrder.flatMap((channel) => senders.filter((sender) => sender.channel === channel))
}

export const DEFAULT_INBOUND_PREFIX = 'Confirmar meu número:'

export type PhoneVerificationStart = {
  /** O método que valeu (o escolhido, ou o padrão quando o escolhido não está configurado). */
  readonly method?: string
  readonly isFallback?: boolean
  /** Algum canal de envio aceitou o código. */
  readonly isSent: boolean
  /** Presente com `phoneVerification.inbound`: o código e a mensagem pronta para a tela abrir no chat. */
  readonly inbound?: { readonly code: string; readonly message: string }
}

/**
 * Grava o código (o hash) e o entrega: pelo primeiro canal de envio que aceitar e/ou devolvendo a
 * mensagem pronta do modo "inbound". O código fica gravado mesmo se nenhum canal aceitou: o reenvio tenta de novo.
 */
export async function issuePhoneVerification(params: {
  readonly dependencies: UserDependencies
  readonly config: PhoneVerificationConfig
  readonly row: UserRow
  readonly phone: string
  /** Método escolhido pela empresa (`PHONE_VERIFICATION_METHOD` ou o `channel` de um provedor). Ausente = o padrão. */
  readonly method?: string
}): Promise<PhoneVerificationStart> {
  const { dependencies, config, row, phone } = params
  const now = nowOf(dependencies)
  const cooldown = config.resendCooldownSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS
  const previous = await dependencies.accountChallenges.findLatest({
    userId: row.id,
    kind: ACCOUNT_CHALLENGE_KIND.PHONE_CODE,
  })
  // O intervalo é do REENVIO para o mesmo número; um número novo é outro pedido (a senha atual já foi exigida).
  if (previous && previous.target === phone) {
    const waitedSeconds = (now.getTime() - previous.createdAt.getTime()) / 1000
    if (waitedSeconds < cooldown) throw new VerificationRateLimitedError(Math.ceil(cooldown - waitedSeconds))
  }

  const expiresInSeconds = config.expiresInSeconds ?? DEFAULT_CODE_EXPIRES_IN_SECONDS
  const code = generateVerificationCode(config.codeLength ?? DEFAULT_CODE_LENGTH)
  await dependencies.accountChallenges.issue({
    userId: row.id,
    kind: ACCOUNT_CHALLENGE_KIND.PHONE_CODE,
    secretHash: hashVerificationCode({ code, userId: row.id, phone, secret: config.hashSecret }),
    target: phone,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
    now,
  })

  const available = dependencies.verificationSenders ?? []
  const selected =
    params.method ?? (await config.selectMethod?.({ ...(row.companyId ? { companyId: row.companyId } : {}) }))
  const { method, isFallback } = resolvePhoneVerificationMethod({ selected, config, senders: available })
  const isInbound = method === PHONE_VERIFICATION_METHOD.WHATSAPP_INBOUND
  const inbound =
    isInbound && config.inbound
      ? { code, message: `${config.inbound.messagePrefix ?? DEFAULT_INBOUND_PREFIX} ${code}` }
      : undefined
  const meta = { ...(method ? { method } : {}), ...(isFallback ? { isFallback } : {}) }
  const ordered = orderSenders({ senders: available, channelOrder: config.channelOrder })
  const senders = isInbound
    ? []
    : [
        ...ordered.filter((sender) => sender.channel === method),
        ...ordered.filter((sender) => sender.channel !== method),
      ]
  for (const sender of senders) {
    const result = await sender
      .send({
        code,
        destination: phone,
        channel: sender.channel,
        expiresInSeconds,
        userId: row.id,
        ...(row.companyId ? { companyId: row.companyId } : {}),
      })
      .catch((error: unknown) => ({ outcome: 'permanent' as const, errorCode: String(error) }))
    if (result.outcome === 'sent') return { isSent: true, ...meta, ...(inbound ? { inbound } : {}) }
    dependencies.logger?.warn('user.verification_channel_failed', {
      userId: row.id,
      channel: sender.channel,
      outcome: result.outcome,
      errorCode: 'errorCode' in result ? result.errorCode : undefined,
    })
  }
  return { isSent: false, ...meta, ...(inbound ? { inbound } : {}) }
}
