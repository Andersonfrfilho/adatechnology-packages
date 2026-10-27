/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { describeDestructiveChanges, validateSettingsDraft } from './settingsDraft'
import type { DocumentDefinition, FieldDefinition } from '../providers/types'

const campo = (partial: Partial<FieldDefinition> & { name: string }): FieldDefinition => ({
  label: partial.name,
  type: 'text',
  required: false,
  ...partial,
})

const documento = (name: string): DocumentDefinition => ({ name, label: name, required: false, validator: 'none' })

const vazio = { fieldCatalog: [], documentCatalog: [] }

describe('rascunho da configuração', () => {
  it('recusa nome que não serve como chave de jsonb nem de índice', () => {
    const errors = validateSettingsDraft({ ...vazio, fieldCatalog: [campo({ name: 'Renda Mensal' })] })

    expect(errors).toHaveLength(1)
  })

  it('recusa a tentativa de injeção pelo nome do campo', () => {
    const errors = validateSettingsDraft({
      ...vazio,
      fieldCatalog: [campo({ name: 'renda"; DROP TABLE customers; --' })],
    })

    expect(errors).toHaveLength(1)
  })

  it('nome repetido entre CAMPO e DOCUMENTO também colide — a chave é a mesma', () => {
    const errors = validateSettingsDraft({
      fieldCatalog: [campo({ name: 'cpf' })],
      documentCatalog: [documento('cpf')],
    })

    expect(errors[0]?.message).toContain('Já existe')
  })

  it('cifrado e filtrável juntos são recusados: a busca não acharia nada, sem erro nenhum', () => {
    const errors = validateSettingsDraft({
      ...vazio,
      fieldCatalog: [campo({ name: 'renda', filterable: true, encrypted: true })],
    })

    expect(errors[0]?.message).toContain('cifrado')
  })

  it('seleção sem opção é recusada', () => {
    const errors = validateSettingsDraft({ ...vazio, fieldCatalog: [campo({ name: 'porte', type: 'select' })] })

    expect(errors[0]?.message).toContain('opção')
  })

  it('teto de campos filtráveis: cada um é um índice a manter na escrita', () => {
    const fieldCatalog = Array.from({ length: 9 }, (_, index) => campo({ name: `f${index}`, filterable: true }))

    expect(validateSettingsDraft({ ...vazio, fieldCatalog })).toHaveLength(1)
  })

  it('rascunho válido não gera erro', () => {
    expect(
      validateSettingsDraft({
        fieldCatalog: [campo({ name: 'renda_mensal', type: 'money', filterable: true })],
        documentCatalog: [documento('cpf')],
      }),
    ).toEqual([])
  })
})

describe('aviso do que a mudança quebra', () => {
  const current = {
    fieldCatalog: [campo({ name: 'renda', label: 'Renda', type: 'money' })],
    documentCatalog: [documento('cpf')],
  }

  it('avisa que apagar o campo esconde o que já foi preenchido', () => {
    const warnings = describeDestructiveChanges({ current, draft: { ...current, fieldCatalog: [] } })

    expect(warnings[0]).toContain('Renda')
  })

  it('avisa a troca de tipo, que pode tornar ilegível o valor gravado', () => {
    const warnings = describeDestructiveChanges({
      current,
      draft: { ...current, fieldCatalog: [campo({ name: 'renda', label: 'Renda', type: 'text' })] },
    })

    expect(warnings[0]).toContain('muda de tipo')
  })

  it('avisa a obrigatoriedade nova, que deixa fichas antigas incompletas', () => {
    const warnings = describeDestructiveChanges({
      current,
      draft: { ...current, fieldCatalog: [campo({ name: 'renda', label: 'Renda', type: 'money', required: true })] },
    })

    expect(warnings[0]).toContain('obrigatório')
  })

  it('mudança que só ACRESCENTA não avisa nada — aviso em toda edição vira ruído', () => {
    const warnings = describeDestructiveChanges({
      current,
      draft: { ...current, fieldCatalog: [...current.fieldCatalog, campo({ name: 'apelido' })] },
    })

    expect(warnings).toEqual([])
  })
})
