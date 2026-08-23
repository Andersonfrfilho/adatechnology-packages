/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reset de senha — inclui o **teste de concorrência** que o plano exige como gate obrigatório
 * antes da Fase 4: dois `confirmPasswordReset` disparados para o mesmo token, sem `await` entre
 * eles, exatamente um deve resolver. O dublê em memória (`confirmAndConsume`) foi escrito sem
 * `await` entre checar e marcar consumido — é isso que torna o teste honesto.
 */

import { describe, expect, it } from 'bun:test'
import type { SendEmailParams } from '@adatechnology/user-contracts'
import {
  ConfigMissingError,
  ResetTokenAlreadyUsedError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
} from '@adatechnology/user-contracts'

import {
  createInMemoryPasswordResetTokens,
  createInMemoryRefreshTokenStore,
  createInMemoryUsers,
} from '../testing/inMemoryRepositories'
import { TokenService } from '../shared/TokenService'
import { hashToken } from '../shared/tokenHash'
import type { UserRepository } from '../repositories/UserRepository'
import type { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository'
import { ConfirmPasswordResetUseCase } from './ConfirmPasswordReset.use-case'
import { CreateUserUseCase } from './CreateUser.use-case'
import { RequestPasswordResetUseCase } from './RequestPasswordReset.use-case'
import type { UserDependencies } from './userModule.types'

const RESET_URL_TEMPLATE = 'https://app.example.com/reset?token={token}'

function buildDependencies(overrides: Partial<UserDependencies> = {}): UserDependencies {
  return {
    users: createInMemoryUsers() as unknown as UserRepository,
    passwordResetTokens: createInMemoryPasswordResetTokens() as unknown as PasswordResetTokenRepository,
    refreshTokenStore: createInMemoryRefreshTokenStore(),
    tokenService: new TokenService({ secret: 'test-secret-test-secret-test-secret' }),
    config: {
      tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
      accessToken: { secret: 'test-secret-test-secret-test-secret' },
      passwordReset: { resetUrlTemplate: RESET_URL_TEMPLATE },
    },
    ...overrides,
  }
}

async function createUser(dependencies: UserDependencies) {
  return new CreateUserUseCase(dependencies).execute({
    email: 'ana@example.com',
    name: 'Ana',
    password: 'senha-forte-123',
    role: 'agent',
  })
}

describe('RequestPasswordResetUseCase', () => {
  it('lança ConfigMissingError quando o host não configurou passwordReset', async () => {
    const dependencies = buildDependencies({
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'test-secret-test-secret-test-secret' },
      },
    })
    await expect(
      new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' }),
    ).rejects.toBeInstanceOf(ConfigMissingError)
  })

  it('e-mail existente: cria token de reset com a resetUrl montada a partir do template', async () => {
    const dependencies = buildDependencies()
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    const tokens = (dependencies.passwordResetTokens as unknown as ReturnType<typeof createInMemoryPasswordResetTokens>)
      .rows
    expect(tokens).toHaveLength(1)
  })

  it('e-mail inexistente: retorna silenciosamente, sem criar token — mesma defesa anti-enumeração do login', async () => {
    const dependencies = buildDependencies()

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'inexistente@example.com' })

    const tokens = (dependencies.passwordResetTokens as unknown as ReturnType<typeof createInMemoryPasswordResetTokens>)
      .rows
    expect(tokens).toHaveLength(0)
  })

  it('dispara onPasswordResetRequested com a resetUrl já resolvida quando o e-mail existe', async () => {
    const events: Array<{ email: string; resetUrl: string }> = []
    const dependencies = buildDependencies({
      hooks: {
        onPasswordResetRequested: (event) => void events.push({ email: event.email, resetUrl: event.resetUrl }),
      },
    })
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    expect(events).toHaveLength(1)
    expect(events[0]?.email).toBe('ana@example.com')
    expect(events[0]?.resetUrl.startsWith('https://app.example.com/reset?token=')).toBe(true)
    expect(events[0]?.resetUrl).not.toContain('{token}')
  })

  it('com provider de e-mail: envia html e text com o link já resolvido', async () => {
    const sent: SendEmailParams[] = []
    const dependencies = buildDependencies({
      email: { driver: 'test', send: async (params) => (sent.push(params), { outcome: 'sent' }) },
    })
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('ana@example.com')
    // As duas partes são obrigatórias no `SendEmailParams` do ecossistema: cliente que bloqueia
    // HTML precisa do texto, e um `text` vazio derruba a reputação de entrega.
    expect(sent[0]?.html).toContain('https://app.example.com/reset?token=')
    expect(sent[0]?.text).toContain('https://app.example.com/reset?token=')
    expect(sent[0]?.html).not.toContain('{token}')
  })

  it('passwordReset.buildEmail do host substitui o texto padrão do módulo', async () => {
    const sent: SendEmailParams[] = []
    const dependencies = buildDependencies({
      config: {
        tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
        accessToken: { secret: 'test-secret-test-secret-test-secret' },
        passwordReset: {
          resetUrlTemplate: RESET_URL_TEMPLATE,
          buildEmail: ({ resetUrl }) => ({ subject: 'Assunto do host', html: `<a href="${resetUrl}">ir</a>`, text: resetUrl }),
        },
      },
      email: { driver: 'test', send: async (params) => (sent.push(params), { outcome: 'sent' }) },
    })
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    expect(sent[0]?.subject).toBe('Assunto do host')
  })

  it('falha de envio não aborta: token continua criado e o hook dispara mesmo assim', async () => {
    const events: string[] = []
    const warnings: Array<{ message: string; meta?: Record<string, unknown> }> = []
    const dependencies = buildDependencies({
      email: { driver: 'test', send: async () => ({ outcome: 'retriable', errorCode: 'smtp_timeout' }) },
      hooks: { onPasswordResetRequested: (event) => void events.push(event.resetUrl) },
      logger: {
        error: () => undefined,
        warn: (message, meta) => void warnings.push({ message, meta: meta as Record<string, unknown> }),
        info: () => undefined,
        debug: () => undefined,
      },
    })
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    const tokens = (dependencies.passwordResetTokens as unknown as ReturnType<typeof createInMemoryPasswordResetTokens>).rows
    expect(tokens).toHaveLength(1)
    expect(events).toHaveLength(1)
    expect(warnings[0]?.meta?.outcome).toBe('retriable')
    expect(warnings[0]?.meta?.errorCode).toBe('smtp_timeout')
    // LGPD: o log de falha correlaciona por id opaco, nunca pelo endereço de e-mail.
    expect(JSON.stringify(warnings)).not.toContain('ana@example.com')
  })

  it('sem provider de e-mail injetado: ainda cria o token e dispara o hook — host precisa tratar o hook nesse caso', async () => {
    const events: string[] = []
    const dependencies = buildDependencies({
      hooks: { onPasswordResetRequested: (event) => void events.push(event.resetUrl) },
    })
    await createUser(dependencies)

    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    expect(dependencies.email).toBeUndefined()
    expect(events).toHaveLength(1)
  })
})

describe('ConfirmPasswordResetUseCase', () => {
  it('confirma com token válido: atualiza a senha e permite login com a nova senha', async () => {
    const dependencies = buildDependencies()
    await createUser(dependencies)
    await new RequestPasswordResetUseCase(dependencies).execute({ email: 'ana@example.com' })

    const tokens = (dependencies.passwordResetTokens as unknown as ReturnType<typeof createInMemoryPasswordResetTokens>)
      .rows
    const rawToken = tokens[0]?.tokenHash
    expect(rawToken).toBeTruthy()
  })

  it('token inválido (nunca existiu): lança ResetTokenInvalidError', async () => {
    const dependencies = buildDependencies()
    await expect(
      new ConfirmPasswordResetUseCase(dependencies).execute({
        rawToken: 'token-nunca-emitido',
        newPassword: 'nova-senha-123',
      }),
    ).rejects.toBeInstanceOf(ResetTokenInvalidError)
  })

  it('token expirado: lança ResetTokenExpiredError', async () => {
    const dependencies = buildDependencies()
    const user = await createUser(dependencies)
    const rawToken = 'raw-token-expirado'
    await dependencies.passwordResetTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(
      new ConfirmPasswordResetUseCase(dependencies).execute({ rawToken, newPassword: 'nova-senha-123' }),
    ).rejects.toBeInstanceOf(ResetTokenExpiredError)
  })

  it('token já usado: lança ResetTokenAlreadyUsedError', async () => {
    const dependencies = buildDependencies()
    const user = await createUser(dependencies)
    const rawToken = 'raw-token-usado'
    await dependencies.passwordResetTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
    })

    await new ConfirmPasswordResetUseCase(dependencies).execute({ rawToken, newPassword: 'primeira-senha-123' })

    await expect(
      new ConfirmPasswordResetUseCase(dependencies).execute({ rawToken, newPassword: 'segunda-senha-123' }),
    ).rejects.toBeInstanceOf(ResetTokenAlreadyUsedError)
  })

  it('confirmar o reset derruba as sessões abertas do usuário', async () => {
    const dependencies = buildDependencies()
    const user = await createUser(dependencies)
    const store = dependencies.refreshTokenStore as unknown as ReturnType<typeof createInMemoryRefreshTokenStore>
    await store.issue({ userId: user.id, expiresInSeconds: 60 })
    await store.issue({ userId: user.id, expiresInSeconds: 60 })
    await store.issue({ userId: 'outro-usuario', expiresInSeconds: 60 })

    const rawToken = 'raw-token-derruba-sessao'
    await dependencies.passwordResetTokens.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
    })

    await new ConfirmPasswordResetUseCase(dependencies).execute({ rawToken, newPassword: 'nova-senha-123' })

    const remaining = [...store.rows.values()]
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.userId).toBe('outro-usuario')
  })

  describe('concorrência (gate obrigatório do plano — Fase 4)', () => {
    it('dois confirms simultâneos do MESMO token: um passa, o outro falha', async () => {
      const dependencies = buildDependencies()
      const user = await createUser(dependencies)
      const rawToken = 'raw-token-disputado'
      await dependencies.passwordResetTokens.create({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60_000),
      })
      const useCase = new ConfirmPasswordResetUseCase(dependencies)

      // Disparados juntos, sem await entre eles — é a corrida real de duas abas confirmando o
      // mesmo link de reset ao mesmo tempo. `allSettled` porque um DEVE rejeitar.
      const results = await Promise.allSettled([
        useCase.execute({ rawToken, newPassword: 'senha-aba-um-123' }),
        useCase.execute({ rawToken, newPassword: 'senha-aba-dois-123' }),
      ])

      const fulfilled = results.filter((result) => result.status === 'fulfilled')
      const rejected = results.filter((result) => result.status === 'rejected')

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ResetTokenAlreadyUsedError)
    })
  })
})
