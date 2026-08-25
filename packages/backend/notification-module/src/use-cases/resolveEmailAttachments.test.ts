/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { TemplateVariableDefinition } from '@adatechnology/notification-contracts'

import { resolveEmailAttachments } from './resolveEmailAttachments'

const VARIABLES: readonly TemplateVariableDefinition[] = [
  { name: 'orderNumber', example: 'QC-1042', required: true },
  { name: 'nota', example: 'https://storage/nota.pdf', required: true, kind: 'attachment' },
]

const NOTA = { filename: 'nota.pdf', url: 'https://storage/nota.pdf', contentType: 'application/pdf' }

describe('resolveEmailAttachments', () => {
  it('pega so o que o catalogo declarou como anexo', () => {
    const attachments = resolveEmailAttachments({
      payload: { orderNumber: 'QC-1042', nota: NOTA },
      variables: VARIABLES,
    })

    expect(attachments).toEqual([NOTA])
  })

  /**
   * Farejar a estrutura transformaria qualquer objeto do payload num anexo por acidente, e o
   * acidente so apareceria na caixa de entrada de quem recebeu.
   */
  it('objeto com a forma de anexo, mas nao declarado, nao vira anexo', () => {
    const attachments = resolveEmailAttachments({
      payload: { comprovante: NOTA },
      variables: VARIABLES,
    })

    expect(attachments).toEqual([])
  })

  it('sem catalogo, nada e anexo', () => {
    expect(resolveEmailAttachments({ payload: { nota: NOTA }, variables: undefined })).toEqual([])
  })

  /** Trocar "e-mail sem PDF" por "e-mail nenhum" e pior: o aviso e o que nao pode faltar. */
  it('anexo declarado e ausente do payload e silencio, nao erro', () => {
    expect(resolveEmailAttachments({ payload: { orderNumber: 'QC-1042' }, variables: VARIABLES })).toEqual([])
  })

  it('valor com campo de tipo errado e descartado, nao remendado', () => {
    const attachments = resolveEmailAttachments({
      payload: { nota: { ...NOTA, filename: 42 } },
      variables: VARIABLES,
    })

    expect(attachments).toEqual([])
  })

  // Cada caso vem embrulhado: `it.each` espalha o item como argumentos, e um array vazio
  // espalharia para NENHUM argumento — a callback viraria um `done` e o teste ficaria pendurado.
  it.each([[null], ['https://storage/nota.pdf'], [7], [[]]])('valor que nao e objeto de anexo: %j', (value) => {
    expect(resolveEmailAttachments({ payload: { nota: value }, variables: VARIABLES })).toEqual([])
  })

  it('mais de um anexo sai na ordem do catalogo', () => {
    const variables: readonly TemplateVariableDefinition[] = [
      { name: 'nota', example: 'x', required: true, kind: 'attachment' },
      { name: 'boleto', example: 'y', required: false, kind: 'attachment' },
    ]
    const boleto = { filename: 'boleto.pdf', url: 'https://storage/b.pdf', contentType: 'application/pdf' }

    const attachments = resolveEmailAttachments({ payload: { boleto, nota: NOTA }, variables })

    expect(attachments).toEqual([NOTA, boleto])
  })
})
