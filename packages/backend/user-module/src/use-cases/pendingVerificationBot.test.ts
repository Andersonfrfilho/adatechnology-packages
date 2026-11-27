/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { USER_EVENT, type PhoneVerificationDeclinedEvent, type UserModuleConfig } from '@adatechnology/user-contracts'

import {
  PENDING_VERIFICATION_BUTTON,
  createPendingVerificationInterceptor,
  type PendingVerificationMessenger,
} from '../interceptors/pendingVerificationInterceptor'
import { createTwilioSmsGateway, createSmsVerificationSender } from '../senders/smsSender'
import {
  buildAuthenticationTemplateComponents,
  createWhatsappTemplateVerificationSender,
} from '../senders/whatsappTemplateSender'
import type { createInMemoryUsers } from '../testing/inMemoryRepositories'
import { ChangePhoneUseCase } from './ChangePhone.use-case'
import { ConfirmPendingVerificationUseCase } from './ConfirmPendingVerification.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { DeclinePendingVerificationUseCase } from './DeclinePendingVerification.use-case'
import { MatchInboundPhoneVerificationUseCase } from './MatchInboundPhoneVerification.use-case'
import { OfferPendingVerificationUseCase } from './OfferPendingVerification.use-case'
import { buildTestDependencies } from './testDependencies'
import type { UserDependencies } from './userModule.types'

const PASSWORD = 'senha-antiga-123'
const CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'test-secret-test-secret-test-secret' },
  phoneVerification: {
    hashSecret: 'segredo-de-teste-com-16-ou-mais',
    inbound: {},
    maxAttempts: 3,
    expiresInSeconds: 600,
  },
}

const rowsOf = (dependencies: UserDependencies) =>
  (dependencies.users as unknown as ReturnType<typeof createInMemoryUsers>).rows

async function setUp() {
  const clock = { current: new Date('2026-11-27T12:00:00Z') }
  const declined: PhoneVerificationDeclinedEvent[] = []
  const dependencies = buildTestDependencies({
    config: CONFIG,
    clock: { now: () => clock.current },
    hooks: { onPhoneVerificationDeclined: (event) => void declined.push(event) },
  })
  const user = await new CreateUserUseCase(dependencies).execute({
    email: 'maria@example.com',
    name: 'Maria da Silva',
    password: PASSWORD,
    role: 'guest',
  })
  const result = await new ChangePhoneUseCase(dependencies).execute({
    id: user.id,
    currentPassword: PASSWORD,
    phone: '5511999990000',
  })
  const sent: { to: string; text?: string; body?: string; buttons?: { id: string; title: string }[] }[] = []
  const messenger: PendingVerificationMessenger = {
    sendText: async (message) => void sent.push({ to: message.to, text: message.text }),
    sendButtons: async (message) =>
      void sent.push({ to: message.to, body: message.body, buttons: [...message.buttons] }),
  }
  const interceptor = createPendingVerificationInterceptor({
    useCases: {
      matchInboundPhoneVerification: new MatchInboundPhoneVerificationUseCase(dependencies),
      offerPendingVerification: new OfferPendingVerificationUseCase(dependencies),
      confirmPendingVerification: new ConfirmPendingVerificationUseCase(dependencies),
      declinePendingVerification: new DeclinePendingVerificationUseCase(dependencies),
    },
    messenger,
  })
  return { dependencies, clock, user, interceptor, sent, declined, code: result.verification?.inbound?.code ?? '' }
}

describe('bot: ativação pendente sem o código', () => {
  it('qualquer texto de um número com ativação pendente recebe a pergunta com nome e e-mail mascarados e dois botões', async () => {
    const { interceptor, sent } = await setUp()
    expect(await interceptor.handle({ senderPhone: '5511999990000', text: 'oi, boa tarde' })).toEqual({
      outcome: 'handled',
    })
    expect(sent[0]?.body).toContain('Maria S.')
    expect(sent[0]?.body).toContain('m***@e***.com')
    expect(sent[0]?.body).not.toContain('maria@example.com')
    expect(sent[0]?.buttons?.map((button) => button.title)).toEqual(['Sim, confirmar', 'Não fui eu'])
  })

  it('pergunta no máximo uma vez por código: a segunda mensagem segue o fluxo normal', async () => {
    const { interceptor } = await setUp()
    await interceptor.handle({ senderPhone: '5511999990000', text: 'oi' })
    expect(await interceptor.handle({ senderPhone: '5511999990000', text: 'oi de novo' })).toEqual({
      outcome: 'continue',
    })
  })

  it('Sim: o número é a prova; verifica, responde "Pronto" e o código não vale de novo', async () => {
    const { interceptor, sent, dependencies, user, code } = await setUp()
    await interceptor.handle({ senderPhone: '5511999990000', text: 'oi' })
    const yes = sent[0]?.buttons?.[0]?.id ?? ''
    expect(await interceptor.handle({ senderPhone: '5511999990000', buttonId: yes })).toEqual({
      outcome: 'handled',
      isConfirmed: true,
    })
    expect(sent[1]?.text).toBe('Pronto, seu número foi confirmado ✅')
    expect(rowsOf(dependencies).find((row) => row.id === user.id)?.phoneVerifiedAt).not.toBeNull()
    expect(await interceptor.handle({ senderPhone: '5511999990000', buttonId: yes })).toMatchObject({
      outcome: 'handled',
      isConfirmed: false,
    })
    expect(
      await interceptor.handle({ senderPhone: '5511999990000', text: `Confirmar meu número: ${code}` }),
    ).toMatchObject({ outcome: 'handled', isConfirmed: false })
  })

  it('Não fui eu: cancela o código, avisa o host sem dados pessoais e nada mais acontece', async () => {
    const { interceptor, sent, dependencies, user, declined, code } = await setUp()
    await interceptor.handle({ senderPhone: '5511999990000', text: 'oi' })
    const no = sent[0]?.buttons?.[1]?.id ?? ''
    expect(await interceptor.handle({ senderPhone: '5511999990000', buttonId: no })).toEqual({ outcome: 'handled' })
    expect(declined).toHaveLength(1)
    expect(declined[0]).toMatchObject({ type: USER_EVENT.PHONE_VERIFICATION_DECLINED, userId: user.id })
    expect(JSON.stringify(declined)).not.toContain('5511999990000')
    expect(rowsOf(dependencies).find((row) => row.id === user.id)?.phoneVerifiedAt).toBeNull()
    expect(
      await interceptor.handle({ senderPhone: '5511999990000', text: `Confirmar meu número: ${code}` }),
    ).toMatchObject({ outcome: 'handled', isConfirmed: false })
  })

  it('vencido, outro número e sem ativação pendente: segue o fluxo normal', async () => {
    const { interceptor, clock, sent } = await setUp()
    expect(await interceptor.handle({ senderPhone: '5511977776666', text: 'oi' })).toEqual({ outcome: 'continue' })
    expect(
      await interceptor.handle({ senderPhone: '5511977776666', buttonId: `${PENDING_VERIFICATION_BUTTON.YES}x` }),
    ).toMatchObject({ outcome: 'handled', isConfirmed: false })
    clock.current = new Date(clock.current.getTime() + 11 * 60_000)
    expect(await interceptor.handle({ senderPhone: '5511999990000', text: 'oi' })).toEqual({ outcome: 'continue' })
    expect(sent.some((message) => message.buttons)).toBe(false)
  })

  it('o código digitado continua funcionando como antes', async () => {
    const { interceptor, code, dependencies, user } = await setUp()
    expect(await interceptor.handle({ senderPhone: '5511999990000', text: `Confirmar meu número: ${code}` })).toEqual({
      outcome: 'handled',
      isConfirmed: true,
    })
    expect(rowsOf(dependencies).find((row) => row.id === user.id)?.phoneVerifiedAt).not.toBeNull()
  })
})

describe('envio de verdade: modelo de autenticação do WhatsApp e SMS', () => {
  it('whatsapp-template monta corpo e botão "copiar código" com o código e entrega só os dígitos', async () => {
    const calls: { to: string; templateName: string; languageCode: string; components: unknown }[] = []
    const sender = createWhatsappTemplateVerificationSender({
      templateName: 'codigo_verificacao',
      send: async (call) => void calls.push(call),
    })
    expect(sender.channel).toBe('whatsapp-template')
    expect(
      await sender.send({
        code: '482913',
        destination: '+55 11 99999-0000',
        channel: 'whatsapp-template',
        expiresInSeconds: 600,
        userId: 'u',
      }),
    ).toEqual({ outcome: 'sent' })
    expect(calls[0]).toEqual({
      to: '5511999990000',
      templateName: 'codigo_verificacao',
      languageCode: 'pt_BR',
      components: buildAuthenticationTemplateComponents('482913'),
    })
    const failing = createWhatsappTemplateVerificationSender({
      templateName: 't',
      send: async () => {
        throw new Error('boom')
      },
    })
    expect(
      await failing.send({ code: '1', destination: '5511999990000', channel: 'x', expiresInSeconds: 1, userId: 'u' }),
    ).toMatchObject({ outcome: 'permanent' })
  })

  it('sms via Twilio: sucesso, número inválido, limite e rede mapeados nos resultados do módulo', async () => {
    const respond = (status: number, body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
    const input = { code: '482913', destination: '5511999990000', channel: 'sms', expiresInSeconds: 600, userId: 'u' }
    const make = (fetchFn: typeof fetch) =>
      createSmsVerificationSender({
        gateway: createTwilioSmsGateway({ accountSid: 'AC1', authToken: 'tok', from: '+15550001111', fetchFn }),
      })
    expect(await make(respond(201, { sid: 'SM1' })).send(input)).toEqual({ outcome: 'sent', providerMessageId: 'SM1' })
    expect(await make(respond(400, { code: 21211 })).send(input)).toEqual({
      outcome: 'invalid_target',
      errorCode: '21211',
    })
    expect(await make(respond(429, {})).send(input)).toMatchObject({ outcome: 'retriable' })
    expect(
      await make((async () => {
        throw new Error('down')
      }) as unknown as typeof fetch).send(input),
    ).toMatchObject({ outcome: 'retriable' })
    let seenBody = ''
    await make((async (_url: string, init: RequestInit) => {
      seenBody = String(init.body)
      return new Response('{}', { status: 201 })
    }) as unknown as typeof fetch).send(input)
    expect(seenBody).toContain('To=%2B5511999990000')
    expect(seenBody).toContain('482913')
  })
})
