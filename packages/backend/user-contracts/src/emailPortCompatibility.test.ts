/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `EmailDriverPort` é **redeclarado** aqui em vez de importado de
 * `@adatechnology/notification-contracts`, para um pacote de contratos não arrastar outro domínio
 * de runtime junto. O preço dessa escolha é que nada avisa quando as duas formas divergem — e foi
 * exatamente assim que a `0.1.0-rc.1` saiu com um contrato incompatível com todos os drivers de
 * `@adatechnology/email-provider`.
 *
 * Esta é a asserção que faltava: falha na compilação, no `check`, antes do publish.
 */

import { describe, expect, it } from 'bun:test'
import type { EmailDriverPort as CanonicalEmailDriverPort, SendEmailParams as CanonicalSendEmailParams } from '@adatechnology/notification-contracts'

import type { EmailDriverPort, SendEmailParams } from './providers'

type MutuallyAssignable<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false
type Assert<TCondition extends true> = TCondition

type _ParamsMatch = Assert<MutuallyAssignable<SendEmailParams, CanonicalSendEmailParams>>
type _PortMatch = Assert<MutuallyAssignable<EmailDriverPort, CanonicalEmailDriverPort>>

describe('EmailDriverPort', () => {
  it('é intercambiável com o de notification-contracts — a asserção real é de tipo, acima', () => {
    const driver: EmailDriverPort = { driver: 'noop', send: async () => ({ outcome: 'sent' }) }
    const canonical: CanonicalEmailDriverPort = driver
    expect(canonical.driver).toBe('noop')
  })
})
