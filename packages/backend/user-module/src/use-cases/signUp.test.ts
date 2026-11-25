/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { EmailAlreadyExistsError, ProviderDisabledError, type UserModuleConfig } from '@adatechnology/user-contracts'

import { buildTestDependencies } from './testDependencies'
import { SignUpUseCase } from './SignUp.use-case'

const BASE_CONFIG: UserModuleConfig = {
  tenancy: { mode: 'single', defaultCompanyId: 'company-a' },
  accessToken: { secret: 'test-secret-test-secret-test-secret' },
}

const INPUT = { email: 'nova@example.com', name: 'Nova', password: 'senha-forte-123' }

describe('SignUpUseCase', () => {
  it('cria o usuário com o papel da configuração e já devolve a sessão', async () => {
    const dependencies = buildTestDependencies({ config: { ...BASE_CONFIG, signUp: { role: 'member' } } })

    const session = await new SignUpUseCase(dependencies).execute(INPUT)

    expect(session.user.role).toBe('member')
    expect(session.user.email).toBe('nova@example.com')
    expect(session.refreshToken).toBeTruthy()
  })

  it('o papel nunca vem do corpo: campo extra `role` é ignorado', async () => {
    const dependencies = buildTestDependencies({ config: { ...BASE_CONFIG, signUp: { role: 'member' } } })

    const session = await new SignUpUseCase(dependencies).execute({ ...INPUT, role: 'admin' } as typeof INPUT)

    expect(session.user.role).toBe('member')
  })

  it('desligado por padrão: sem `signUp` na configuração lança ProviderDisabledError', async () => {
    const dependencies = buildTestDependencies({ config: BASE_CONFIG })

    await expect(new SignUpUseCase(dependencies).execute(INPUT)).rejects.toBeInstanceOf(ProviderDisabledError)
  })

  it('e-mail já cadastrado lança EmailAlreadyExistsError', async () => {
    const dependencies = buildTestDependencies({ config: { ...BASE_CONFIG, signUp: { role: 'member' } } })
    const signUp = new SignUpUseCase(dependencies)
    await signUp.execute(INPUT)

    await expect(signUp.execute(INPUT)).rejects.toBeInstanceOf(EmailAlreadyExistsError)
  })
})
