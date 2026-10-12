/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_ERROR_CODE } from '../constants/infra.constant'
import { DEFAULT_INFRA_MESSAGES as infraLocale } from '../locales'
import {
  INFRA_INTEGRATION_ERROR_CODE,
  INFRA_INTEGRATION_STATE,
  INFRA_INTEGRATION_TONE,
  INTEGRATION_TOKEN_ISSUE,
} from '../constants/infraIntegration.constant'
import {
  canSubmitIntegration,
  describeIntegrationAccess,
  describeIntegrationState,
  formatIntegrationUpdatedAt,
  isInformationalIntegrationError,
  normalizeToken,
  resolveIntegrationErrorMessage,
  validateTokenFormat,
} from './infraIntegration.util'

const BAIT_TOKEN = 'ISCA-TOKEN-0123456789'

class FakeApiError extends Error {
  constructor(readonly code: string) {
    super('texto cru do servidor com dados internos')
  }
}

function apiError(code: string): FakeApiError {
  return new FakeApiError(code)
}

describe('validateTokenFormat', () => {
  it('aceita a isca e um UUID', () => {
    expect(validateTokenFormat(BAIT_TOKEN)).toEqual({ isValid: true })
    expect(validateTokenFormat('123e4567-e89b-12d3-a456-426614174000')).toEqual({ isValid: true })
  })

  it('aceita nos limites de 16 e 128 caracteres', () => {
    expect(validateTokenFormat('a'.repeat(16)).isValid).toBe(true)
    expect(validateTokenFormat('a'.repeat(128)).isValid).toBe(true)
  })

  it('recusa vazio, curto e longo demais', () => {
    expect(validateTokenFormat('   ')).toEqual({ isValid: false, issue: INTEGRATION_TOKEN_ISSUE.EMPTY })
    expect(validateTokenFormat('a'.repeat(15))).toEqual({ isValid: false, issue: INTEGRATION_TOKEN_ISSUE.TOO_SHORT })
    expect(validateTokenFormat('a'.repeat(129))).toEqual({ isValid: false, issue: INTEGRATION_TOKEN_ISSUE.TOO_LONG })
  })

  it('recusa espaco no meio e caracteres fora de [A-Za-z0-9_-]', () => {
    expect(validateTokenFormat('ISCA-TOKEN 0123456789')).toEqual({
      isValid: false,
      issue: INTEGRATION_TOKEN_ISSUE.INVALID_CHARACTERS,
    })
    expect(validateTokenFormat('ISCA-TOKEN-0123456789!').isValid).toBe(false)
    expect(validateTokenFormat('ISCA-TOKEN-012345678é').isValid).toBe(false)
  })

  it('ignora espaco e quebra de linha nas pontas (cola)', () => {
    expect(validateTokenFormat(`  ${BAIT_TOKEN}\n`).isValid).toBe(true)
    expect(normalizeToken(`  ${BAIT_TOKEN}\n`)).toBe(BAIT_TOKEN)
  })

  it('nunca ecoa o valor nas mensagens de problema', () => {
    for (const message of Object.values(infraLocale.integration.form.tokenIssues)) {
      expect(message).not.toContain(BAIT_TOKEN)
    }
  })
})

describe('canSubmitIntegration', () => {
  const valid = { token: BAIT_TOKEN, password: 'senha', isPending: false }

  it('libera com token valido e senha preenchida', () => {
    expect(canSubmitIntegration(valid)).toBe(true)
  })

  it('bloqueia sem senha, com token invalido ou enquanto pendente', () => {
    expect(canSubmitIntegration({ ...valid, password: '' })).toBe(false)
    expect(canSubmitIntegration({ ...valid, token: 'curto' })).toBe(false)
    expect(canSubmitIntegration({ ...valid, isPending: true })).toBe(false)
  })
})

describe('resolveIntegrationErrorMessage', () => {
  it('traduz cada codigo de dominio da integracao', () => {
    for (const code of Object.values(INFRA_INTEGRATION_ERROR_CODE)) {
      const message = resolveIntegrationErrorMessage(apiError(code))

      expect(message).not.toBe(infraLocale.errors.UNKNOWN)
      expect(message).not.toContain('servidor com dados internos')
    }
  })

  it('o bloqueio explica os 15 minutos e o login de novo', () => {
    const message = resolveIntegrationErrorMessage(apiError(INFRA_INTEGRATION_ERROR_CODE.LOCKED))

    expect(message).toContain('15 minutos')
    expect(message).toContain('entrar de novo')
  })

  it('usa a mensagem generica para limite de taxa e falha do provedor', () => {
    expect(resolveIntegrationErrorMessage(apiError(INFRA_ERROR_CODE.RATE_LIMITED))).toBe(
      infraLocale.errors.RATE_LIMITED,
    )
    expect(resolveIntegrationErrorMessage(apiError(INFRA_ERROR_CODE.INFRA_PROVIDER_REQUEST_FAILED))).toBe(
      infraLocale.errors.INFRA_PROVIDER_REQUEST_FAILED,
    )
  })

  it('codigo desconhecido e erro que nao e da API caem no generico, sem a mensagem do servidor', () => {
    expect(resolveIntegrationErrorMessage(apiError('OUTRO_CODIGO'))).toBe(infraLocale.errors.UNKNOWN)
    expect(resolveIntegrationErrorMessage(new Error(BAIT_TOKEN))).toBe(infraLocale.errors.UNKNOWN)
  })

  it('so o erro de producao e informativo', () => {
    expect(isInformationalIntegrationError(apiError(INFRA_INTEGRATION_ERROR_CODE.PRODUCTION_ONLY))).toBe(true)
    expect(isInformationalIntegrationError(apiError(INFRA_INTEGRATION_ERROR_CODE.LOCKED))).toBe(false)
    expect(isInformationalIntegrationError(new Error('x'))).toBe(false)
  })
})

describe('describeIntegrationState', () => {
  it('descreve cada estado com titulo e o que fazer', () => {
    for (const state of Object.values(INFRA_INTEGRATION_STATE)) {
      const description = describeIntegrationState(state)

      expect(description.title.length).toBeGreaterThan(0)
      expect(description.action.length).toBeGreaterThan(0)
    }
  })

  it('chave ausente e chave trocada dizem o que fazer', () => {
    expect(describeIntegrationState(INFRA_INTEGRATION_STATE.KEY_MISSING).action).toContain(
      'A chave de cifra não está configurada no servidor',
    )
    expect(describeIntegrationState(INFRA_INTEGRATION_STATE.KEY_MISMATCH).action).toContain('Informe o token de novo')
  })

  it('so o configurado e ok; nenhum estado de falha e ok', () => {
    expect(describeIntegrationState(INFRA_INTEGRATION_STATE.CONFIGURED).tone).toBe(INFRA_INTEGRATION_TONE.OK)
    expect(describeIntegrationState(INFRA_INTEGRATION_STATE.KEY_MISSING).tone).toBe(INFRA_INTEGRATION_TONE.ERROR)
    expect(describeIntegrationState(INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE).tone).toBe(
      INFRA_INTEGRATION_TONE.WARNING,
    )
  })
})

describe('describeIntegrationAccess', () => {
  it('sem verificacao e neutro, nunca ok', () => {
    expect(describeIntegrationAccess(undefined).tone).toBe(INFRA_INTEGRATION_TONE.NEUTRAL)
  })

  it('mapeia cada acesso para um selo com texto', () => {
    expect(describeIntegrationAccess('ok')).toEqual({ tone: INFRA_INTEGRATION_TONE.OK, label: 'Acesso confirmado' })
    expect(describeIntegrationAccess('token_invalid').tone).toBe(INFRA_INTEGRATION_TONE.ERROR)
    expect(describeIntegrationAccess('billing_unavailable').tone).toBe(INFRA_INTEGRATION_TONE.WARNING)
    expect(describeIntegrationAccess('unavailable').tone).toBe(INFRA_INTEGRATION_TONE.WARNING)
  })
})

describe('formatIntegrationUpdatedAt', () => {
  it('formata no fuso de Brasilia', () => {
    expect(formatIntegrationUpdatedAt('2026-10-09T15:30:00.000Z')).toBe('09/10/2026 12:30')
  })

  it('vira a data certa na virada do dia em Brasilia', () => {
    expect(formatIntegrationUpdatedAt('2026-10-09T02:15:00.000Z')).toBe('08/10/2026 23:15')
  })

  it('devolve undefined para data invalida', () => {
    expect(formatIntegrationUpdatedAt('nao-e-data')).toBeUndefined()
  })
})
