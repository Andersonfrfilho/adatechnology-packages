/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import {
  ConfirmationTokenInvalidError,
  CurrentPasswordInvalidError,
  EmailAlreadyExistsError,
  NotAuthenticatedError,
  PhoneAlreadyExistsError,
  PhoneInvalidError,
  USER_EVENT,
  VerificationCodeInvalidError,
  VerificationRateLimitedError,
  type AccountRecoveredEvent,
  type EmailChangedEvent,
  type EmailChangeRequestedEvent,
  type UserModuleConfig,
} from '@adatechnology/user-contracts'

import { listPhoneVerificationMethods } from '../shared/phoneVerificationMethods'
import { createInMemoryUsers } from '../testing/inMemoryRepositories'
import { createInMemoryVerificationSender } from '../testing/inMemoryVerificationSender'
import { AuthenticateLocalUseCase } from './AuthenticateLocal.use-case'
import { ChangePasswordUseCase } from './ChangePassword.use-case'
import { ChangePhoneUseCase } from './ChangePhone.use-case'
import { ConfirmEmailChangeUseCase } from './ConfirmEmailChange.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { MatchInboundPhoneVerificationUseCase } from './MatchInboundPhoneVerification.use-case'
import { RecoverAccountUseCase } from './RecoverAccount.use-case'
import { RefreshSessionUseCase } from './RefreshSession.use-case'
import { RequestEmailChangeUseCase } from './RequestEmailChange.use-case'
import { StartPhoneVerificationUseCase } from './StartPhoneVerification.use-case'
import { VerifyPhoneUseCase } from './VerifyPhone.use-case'
import { buildTestDependencies } from './testDependencies'
import type { UserDependencies } from './userModule.types'

const PASSWORD = 'senha-antiga-123'
const NEW_PASSWORD = 'senha-nova-456789'
const SECRET = 'segredo-de-teste-com-16-ou-mais'

const CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'test-secret-test-secret-test-secret' },
  lockout: { maxFailedAttempts: 3, lockMinutes: 15 },
  passwordReset: { resetUrlTemplate: 'https://app.test/reset?token={token}' },
  emailChange: { confirmUrlTemplate: 'https://app.test/confirm?token={token}' },
  phoneVerification: {
    hashSecret: SECRET,
    inbound: {},
    resendCooldownSeconds: 60,
    maxAttempts: 3,
    expiresInSeconds: 600,
  },
}

type Clock = { current: Date }

const rowsOf = (dependencies: UserDependencies) =>
  (dependencies.users as unknown as ReturnType<typeof createInMemoryUsers>).rows

async function setUp(
  overrides: Partial<UserDependencies> = {},
  extraHooks: NonNullable<UserDependencies['hooks']> = {},
) {
  const clock: Clock = { current: new Date('2026-11-27T12:00:00Z') }
  const requested: EmailChangeRequestedEvent[] = []
  const changed: EmailChangedEvent[] = []
  const recovered: AccountRecoveredEvent[] = []
  const events: string[] = []
  const dependencies = buildTestDependencies({
    config: CONFIG,
    clock: { now: () => clock.current },
    hooks: {
      onEmailChangeRequested: (event) => void requested.push(event),
      onEmailChanged: (event) => void changed.push(event),
      onAccountRecovered: (event) => void recovered.push(event),
      onPhoneChanged: (event) => void events.push(event.type),
      onPhoneVerified: (event) => void events.push(event.type),
      ...extraHooks,
    },
    ...overrides,
  })
  const created = await new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: PASSWORD,
    role: 'guest',
  })
  const other = await new CreateUserUseCase(dependencies).execute({
    email: 'bia@example.com',
    name: 'Bia',
    password: PASSWORD,
    role: 'guest',
  })
  return { dependencies, clock, created, other, requested, changed, recovered, events }
}

const tokenOf = (event: EmailChangeRequestedEvent | undefined): string =>
  new URL(event?.confirmUrl ?? 'https://x.test').searchParams.get('token') ?? ''

describe('ChangePassword', () => {
  it('exige a senha atual, troca e encerra as outras sessões mantendo a atual', async () => {
    const { dependencies, created } = await setUp()
    const login = new AuthenticateLocalUseCase(dependencies)
    const otherSession = await login.execute({ email: 'ana@example.com', password: PASSWORD })
    const kept = await new ChangePasswordUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      keepSession: {},
    })
    expect(kept?.refreshToken).toBeDefined()
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: otherSession.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: kept?.refreshToken ?? '' }),
    ).resolves.toBeDefined()
    await expect(login.execute({ email: 'ana@example.com', password: NEW_PASSWORD })).resolves.toBeDefined()
    await expect(login.execute({ email: 'ana@example.com', password: PASSWORD })).rejects.toThrow()
  })

  it('senha atual errada é 403 e conta no bloqueio da conta (reuso do lockout)', async () => {
    const { dependencies, created } = await setUp()
    const change = new ChangePasswordUseCase(dependencies)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        change.execute({ id: created.id, currentPassword: 'errada-errada', newPassword: NEW_PASSWORD }),
      ).rejects.toBeInstanceOf(CurrentPasswordInvalidError)
    }
    await expect(
      change.execute({ id: created.id, currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(CurrentPasswordInvalidError)
    await expect(
      new AuthenticateLocalUseCase(dependencies).execute({ email: 'ana@example.com', password: PASSWORD }),
    ).rejects.toThrow()
  })
})

describe('troca de e-mail', () => {
  it('a conta mantém o e-mail antigo até o link ser aberto; o antigo é avisado por hook', async () => {
    const { dependencies, created, requested, changed } = await setUp()
    await new RequestEmailChangeUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      newEmail: 'nova@example.com',
    })
    expect(rowsOf(dependencies).find((row) => row.id === created.id)?.email).toBe('ana@example.com')
    expect(requested[0]).toMatchObject({ newEmail: 'nova@example.com', type: USER_EVENT.EMAIL_CHANGE_REQUESTED })

    const confirmed = await new ConfirmEmailChangeUseCase(dependencies).execute({ rawToken: tokenOf(requested[0]) })
    expect(confirmed).toMatchObject({ email: 'nova@example.com', emailVerified: true })
    expect(changed[0]).toMatchObject({ previousEmail: 'ana@example.com', newEmail: 'nova@example.com' })
    await expect(
      new AuthenticateLocalUseCase(dependencies).execute({ email: 'nova@example.com', password: PASSWORD }),
    ).resolves.toBeDefined()
  })

  it('o link vale uma vez, expira e um pedido novo invalida o anterior', async () => {
    const { dependencies, clock, created, requested } = await setUp()
    const request = new RequestEmailChangeUseCase(dependencies)
    const confirm = new ConfirmEmailChangeUseCase(dependencies)
    await request.execute({ id: created.id, currentPassword: PASSWORD, newEmail: 'um@example.com' })
    await request.execute({ id: created.id, currentPassword: PASSWORD, newEmail: 'dois@example.com' })
    await expect(confirm.execute({ rawToken: tokenOf(requested[0]) })).rejects.toBeInstanceOf(
      ConfirmationTokenInvalidError,
    )
    await confirm.execute({ rawToken: tokenOf(requested[1]) })
    await expect(confirm.execute({ rawToken: tokenOf(requested[1]) })).rejects.toBeInstanceOf(
      ConfirmationTokenInvalidError,
    )

    await request.execute({ id: created.id, currentPassword: PASSWORD, newEmail: 'tres@example.com' })
    clock.current = new Date(clock.current.getTime() + 25 * 3600 * 1000)
    await expect(confirm.execute({ rawToken: tokenOf(requested[2]) })).rejects.toBeInstanceOf(
      ConfirmationTokenInvalidError,
    )
  })

  it('recusa senha errada e e-mail já usado (409 com o campo)', async () => {
    const { dependencies, created } = await setUp()
    const request = new RequestEmailChangeUseCase(dependencies)
    await expect(
      request.execute({ id: created.id, currentPassword: 'errada-errada', newEmail: 'x@example.com' }),
    ).rejects.toBeInstanceOf(CurrentPasswordInvalidError)
    const error = await request
      .execute({ id: created.id, currentPassword: PASSWORD, newEmail: 'bia@example.com' })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(EmailAlreadyExistsError)
    expect((error as EmailAlreadyExistsError).details).toEqual({ field: 'email' })
  })

  it('se o endereço foi tomado enquanto o link esperava, a confirmação recusa', async () => {
    const { dependencies, created, requested } = await setUp()
    await new RequestEmailChangeUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      newEmail: 'corrida@example.com',
    })
    await new CreateUserUseCase(dependencies).execute({
      email: 'corrida@example.com',
      name: 'C',
      password: PASSWORD,
      role: 'guest',
    })
    await expect(
      new ConfirmEmailChangeUseCase(dependencies).execute({ rawToken: tokenOf(requested[0]) }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError)
  })
})

describe('troca de telefone', () => {
  it('salva como não verificado, exige senha, número válido e único (409 com o campo)', async () => {
    const { dependencies, created, other, events } = await setUp()
    const change = new ChangePhoneUseCase(dependencies)
    await expect(
      change.execute({ id: created.id, currentPassword: 'errada-errada', phone: '5511999990000' }),
    ).rejects.toBeInstanceOf(CurrentPasswordInvalidError)
    await expect(change.execute({ id: created.id, currentPassword: PASSWORD, phone: '123' })).rejects.toBeInstanceOf(
      PhoneInvalidError,
    )
    const result = await change.execute({ id: created.id, currentPassword: PASSWORD, phone: '+55 (11) 99999-0000' })
    expect(result.profile).toMatchObject({ phone: '5511999990000', phoneVerified: false })
    expect(events).toContain(USER_EVENT.PHONE_CHANGED)
    const taken = await change
      .execute({ id: other.id, currentPassword: PASSWORD, phone: '5511999990000' })
      .catch((caught: unknown) => caught)
    expect(taken).toBeInstanceOf(PhoneAlreadyExistsError)
    expect((taken as PhoneAlreadyExistsError).details).toEqual({ field: 'phone' })
  })

  it('mudar o número volta a verificação para pendente', async () => {
    const { dependencies, created } = await setUp()
    const change = new ChangePhoneUseCase(dependencies)
    await change.execute({ id: created.id, currentPassword: PASSWORD, phone: '5511999990000' })
    const row = rowsOf(dependencies).find((candidate) => candidate.id === created.id)
    if (row) row.phoneVerifiedAt = new Date()
    const result = await change.execute({ id: created.id, currentPassword: PASSWORD, phone: '5511988887777' })
    expect(result.profile.phoneVerified).toBe(false)
  })
})

describe('verificação do telefone por canal de envio', () => {
  async function withSender(outcomes: ReturnType<typeof createInMemoryVerificationSender>[], channelOrder?: string[]) {
    const state = await setUp({
      config: {
        ...CONFIG,
        phoneVerification: {
          hashSecret: SECRET,
          resendCooldownSeconds: 60,
          maxAttempts: 3,
          ...(channelOrder ? { channelOrder } : {}),
        },
      },
      verificationSenders: outcomes,
    })
    return state
  }

  it('entrega o código, grava só o hash e confere com espaços e erro de digitação', async () => {
    const sender = createInMemoryVerificationSender()
    const { dependencies, created } = await withSender([sender])
    await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    const code = sender.sent[0]?.code ?? ''
    expect(code).toHaveLength(6)
    expect(JSON.stringify(dependencies.accountChallenges)).not.toContain(code)
    const verify = new VerifyPhoneUseCase(dependencies)
    await expect(
      verify.execute({ id: created.id, code: '000000' === code ? '111111' : '000000' }),
    ).rejects.toBeInstanceOf(VerificationCodeInvalidError)
    await expect(verify.execute({ id: created.id, code })).resolves.toMatchObject({ phoneVerified: true })
  })

  it('usa o próximo canal quando o primeiro falha, na ordem configurada', async () => {
    const whatsapp = createInMemoryVerificationSender({
      channel: 'whatsapp',
      outcome: { outcome: 'retriable', errorCode: 'down' },
    })
    const sms = createInMemoryVerificationSender({ channel: 'sms' })
    const { dependencies, created } = await withSender([sms, whatsapp], ['whatsapp', 'sms'])
    const result = await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    expect(result.verification?.isSent).toBe(true)
    expect(whatsapp.sent).toHaveLength(0)
    expect(sms.sent).toHaveLength(1)
  })

  it('reenvio respeita o intervalo mínimo e o código vence', async () => {
    const sender = createInMemoryVerificationSender()
    const { dependencies, clock, created } = await withSender([sender])
    await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    const start = new StartPhoneVerificationUseCase(dependencies)
    await expect(start.execute({ id: created.id })).rejects.toBeInstanceOf(VerificationRateLimitedError)
    clock.current = new Date(clock.current.getTime() + 61_000)
    await start.execute({ id: created.id })
    const latest = sender.sent[1]?.code ?? ''
    clock.current = new Date(clock.current.getTime() + 11 * 60_000)
    await expect(new VerifyPhoneUseCase(dependencies).execute({ id: created.id, code: latest })).rejects.toBeInstanceOf(
      VerificationCodeInvalidError,
    )
  })

  it('esgota as tentativas e invalida o código', async () => {
    const sender = createInMemoryVerificationSender()
    const { dependencies, created } = await withSender([sender])
    await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    const code = sender.sent[0]?.code ?? ''
    const wrong = code === '123456' ? '654321' : '123456'
    const verify = new VerifyPhoneUseCase(dependencies)
    for (let attempt = 0; attempt < 3; attempt += 1)
      await expect(verify.execute({ id: created.id, code: wrong })).rejects.toBeInstanceOf(VerificationCodeInvalidError)
    await expect(verify.execute({ id: created.id, code })).rejects.toBeInstanceOf(VerificationRateLimitedError)
    await expect(verify.execute({ id: created.id, code })).rejects.toBeInstanceOf(VerificationCodeInvalidError)
  })
})

describe('verificação do telefone por mensagem recebida (inbound)', () => {
  async function started() {
    const state = await setUp()
    const result = await new ChangePhoneUseCase(state.dependencies).execute({
      id: state.created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    const code = result.verification?.inbound?.code ?? ''
    return {
      ...state,
      code,
      message: result.verification?.inbound?.message ?? '',
      match: new MatchInboundPhoneVerificationUseCase(state.dependencies),
    }
  }

  it('caminho feliz: o remetente é o número da conta; o código gasta e o telefone fica verificado', async () => {
    const { created, message, match, dependencies, events } = await started()
    expect(message).toStartWith('Confirmar meu número: ')
    await expect(match.execute({ text: message, senderPhone: '+55 11 99999-0000' })).resolves.toEqual({
      outcome: 'verified',
      userId: created.id,
    })
    expect(rowsOf(dependencies).find((row) => row.id === created.id)?.phoneVerifiedAt).not.toBeNull()
    expect(events).toContain(USER_EVENT.PHONE_VERIFIED)
    await expect(match.execute({ text: message, senderPhone: '5511999990000' })).resolves.toEqual({
      outcome: 'rejected',
    })
  })

  it('aceita o código com espaços, caixa e sem acento', async () => {
    const { code, match } = await started()
    const spaced = `CONFIRMAR MEU NUMERO:  ${code.slice(0, 3)} ${code.slice(3)}`
    await expect(match.execute({ text: spaced, senderPhone: '5511999990000' })).resolves.toMatchObject({
      outcome: 'verified',
    })
  })

  it('outro remetente é recusado, sem verificar nem gastar o código', async () => {
    const { message, match, dependencies, created } = await started()
    await expect(match.execute({ text: message, senderPhone: '5511977776666' })).resolves.toEqual({
      outcome: 'rejected',
    })
    expect(rowsOf(dependencies).find((row) => row.id === created.id)?.phoneVerifiedAt).toBeNull()
    await expect(match.execute({ text: message, senderPhone: '5511999990000' })).resolves.toMatchObject({
      outcome: 'verified',
    })
  })

  it('vencido, errado, tentativas e texto comum', async () => {
    const { code, clock, match } = await started()
    await expect(match.execute({ text: 'oi, quero reservar', senderPhone: '5511999990000' })).resolves.toEqual({
      outcome: 'ignored',
    })
    const wrong = code === '111111' ? '222222' : '111111'
    for (let attempt = 0; attempt < 3; attempt += 1)
      await expect(
        match.execute({ text: `Confirmar meu número: ${wrong}`, senderPhone: '5511999990000' }),
      ).resolves.toEqual({ outcome: 'rejected' })
    await expect(
      match.execute({ text: `Confirmar meu número: ${code}`, senderPhone: '5511999990000' }),
    ).resolves.toEqual({ outcome: 'rejected' })
    clock.current = new Date(clock.current.getTime() + 11 * 60_000)
    await expect(
      match.execute({ text: `Confirmar meu número: ${code}`, senderPhone: '5511999990000' }),
    ).resolves.toEqual({ outcome: 'rejected' })
  })
})

describe('recuperação assistida', () => {
  it('troca o e-mail, encerra as sessões, manda o link ao endereço novo e audita sem valores', async () => {
    const requestedResets: string[] = []
    const { dependencies, created, recovered } = await setUp(
      {},
      { onPasswordResetRequested: (event) => void requestedResets.push(event.email) },
    )
    const session = await new AuthenticateLocalUseCase(dependencies).execute({
      email: 'ana@example.com',
      password: PASSWORD,
    })
    await new RecoverAccountUseCase(dependencies).execute({
      id: created.id,
      email: 'perdi@example.com',
      actorUserId: 'staff-1',
    })
    expect(requestedResets).toEqual(['perdi@example.com'])
    await expect(
      new RefreshSessionUseCase(dependencies).execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(rowsOf(dependencies).find((row) => row.id === created.id)).toMatchObject({
      email: 'perdi@example.com',
      emailVerifiedAt: null,
    })
    expect(JSON.stringify(recovered)).not.toContain('perdi@example.com')
    expect(recovered[0]).toMatchObject({ actorUserId: 'staff-1', isEmailUpdated: true, isResetSent: true })
  })

  it('destrava sem mexer no e-mail e recusa e-mail já usado ou conta de outra empresa', async () => {
    const { dependencies, created } = await setUp()
    const row = rowsOf(dependencies).find((candidate) => candidate.id === created.id)
    if (row) row.lockedUntil = new Date('2099-01-01T00:00:00Z')
    const recover = new RecoverAccountUseCase(dependencies)
    await recover.execute({ id: created.id, unlock: true })
    expect(rowsOf(dependencies).find((candidate) => candidate.id === created.id)?.lockedUntil).toBeNull()
    await expect(recover.execute({ id: created.id, email: 'bia@example.com' })).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    )
    await expect(recover.execute({ id: '00000000-0000-0000-0000-000000000000', unlock: true })).rejects.toThrow()
  })
})

describe('método de verificação escolhido pela empresa', () => {
  const config = (selectMethod: () => string | undefined): UserModuleConfig => ({
    ...CONFIG,
    phoneVerification: { hashSecret: SECRET, inbound: {}, selectMethod },
  })

  it('usa o método da configuração quando o provedor existe', async () => {
    const sms = createInMemoryVerificationSender({ channel: 'sms' })
    const { dependencies, created } = await setUp({ config: config(() => 'sms'), verificationSenders: [sms] })
    const result = await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    expect(result.verification).toMatchObject({ method: 'sms', isSent: true })
    expect(result.verification?.inbound).toBeUndefined()
    expect(sms.sent).toHaveLength(1)
  })

  it('cai em whatsapp-inbound quando o método escolhido não está configurado', async () => {
    const { dependencies, created } = await setUp({ config: config(() => 'sms') })
    const result = await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    expect(result.verification).toMatchObject({ method: 'whatsapp-inbound', isFallback: true })
    expect(result.verification?.inbound?.message).toContain('Confirmar meu número:')
  })

  it('sem escolha, o padrão é whatsapp-inbound; a lista marca o que não está configurado', async () => {
    const { dependencies, created } = await setUp({ config: config(() => undefined) })
    const result = await new ChangePhoneUseCase(dependencies).execute({
      id: created.id,
      currentPassword: PASSWORD,
      phone: '5511999990000',
    })
    expect(result.verification?.method).toBe('whatsapp-inbound')
    const options = listPhoneVerificationMethods({ config: CONFIG.phoneVerification, senders: [] })
    expect(options.find((option) => option.id === 'sms')).toMatchObject({ isAvailable: false })
    expect(options.find((option) => option.id === 'whatsapp-inbound')).toMatchObject({ isAvailable: true })
  })
})
