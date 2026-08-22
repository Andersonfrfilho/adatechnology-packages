/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { DEFAULT_USER_LABELS as labels } from './labels'

describe('DEFAULT_USER_LABELS', () => {
  it('não confirma que o e-mail existe ao pedir redefinição', () => {
    // `requestPasswordReset` responde igual para e-mail conhecido e desconhecido; um texto do tipo
    // "enviamos para o seu e-mail" desfaria essa defesa na tela, que é onde o atacante olha.
    expect(labels.forgotPasswordRequestedMessage).toMatch(/se o e-?mail existir/i)
  })

  it('erro de login não diz qual metade estava errada', () => {
    // Distinguir "e-mail não existe" de "senha errada" transforma a tela de login num verificador
    // de contas — a mesma razão de `InvalidCredentialsError` não carregar contexto.
    expect(labels.signInGenericError).not.toMatch(/e-?mail|senha|usuári/i)
  })

  it('nenhum rótulo nasce vazio', () => {
    // Rótulo vazio vira botão sem texto, e só aparece em produção.
    const empty = Object.entries(labels).filter(([, value]) => value.trim() === '')
    expect(empty).toEqual([])
  })

  it('override parcial troca só o que foi declarado', () => {
    const overridden = { ...labels, signInTitle: 'Acessar o painel' }

    expect(overridden.signInTitle).toBe('Acessar o painel')
    expect(overridden.signInSubmit).toBe(labels.signInSubmit)
  })
})
