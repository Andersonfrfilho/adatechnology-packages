/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A mesma regra roda na validação do `upsert` e no aviso do editor. Se estes testes afrouxarem, a
 * tela passa a aprovar o que a rota recusa.
 */

import { describe, expect, it } from 'bun:test'

import { buildPreviewPayload, diffTemplateVariables } from './templateVariables'
import type { TemplateVariableDefinition } from './templateVariables'

const CATALOG: readonly TemplateVariableDefinition[] = [
  { name: 'orderNumber', example: 'QC-1042', required: true },
  { name: 'customerName', example: 'Ana', required: true },
  { name: 'pickupCode', example: '4417', required: false },
]

describe('diffTemplateVariables', () => {
  it('acusa a variável que o texto usa e o catálogo não declara', () => {
    const diff = diffTemplateVariables({
      body: 'Olá {{nomeCliente}}, pedido {{orderNumber}}',
      variables: CATALOG,
    })

    expect(diff.unknown).toEqual(['nomeCliente'])
  })

  it('acusa todas as desconhecidas de uma vez, não a primeira', () => {
    const diff = diffTemplateVariables({ body: '{{a}} {{b}} {{orderNumber}}', variables: CATALOG })

    expect(diff.unknown).toEqual(['a', 'b'])
  })

  it('lê o assunto junto com o corpo — variável errada no subject conta igual', () => {
    const diff = diffTemplateVariables({ subject: 'Pedido {{numeroPedido}}', body: 'x', variables: CATALOG })

    expect(diff.unknown).toEqual(['numeroPedido'])
  })

  it('lista a obrigatória que ficou de fora, sem transformar isso em erro', () => {
    const diff = diffTemplateVariables({ body: 'Pedido {{orderNumber}} pronto', variables: CATALOG })

    expect(diff.missingRequired).toEqual(['customerName'])
    expect(diff.unknown).toEqual([])
  })

  it('catálogo ausente não é catálogo vazio: nada é desconhecido', () => {
    const diff = diffTemplateVariables({ body: '{{qualquerCoisa}}' })

    expect(diff.unknown).toEqual([])
    expect(diff.missingRequired).toEqual([])
    expect(diff.used).toEqual(['qualquerCoisa'])
  })

  it('catálogo vazio declarado recusa tudo — a diferença com o ausente é deliberada', () => {
    const diff = diffTemplateVariables({ body: '{{orderNumber}}', variables: [] })

    expect(diff.unknown).toEqual(['orderNumber'])
  })
})

describe('buildPreviewPayload', () => {
  it('monta o payload do preview a partir dos exemplos do catálogo', () => {
    expect(buildPreviewPayload(CATALOG)).toEqual({
      orderNumber: 'QC-1042',
      customerName: 'Ana',
      pickupCode: '4417',
    })
  })

  it('sem catálogo, o preview mostra os campos vazios — que é o que o destinatário veria', () => {
    expect(buildPreviewPayload(undefined)).toEqual({})
  })
})

describe('variavel de anexo', () => {
  const CATALOGO: readonly TemplateVariableDefinition[] = [
    { name: 'orderNumber', example: 'QC-1042', required: true },
    { name: 'nota', example: 'https://storage/nota.pdf', required: true, kind: 'attachment' },
  ]

  /** O anexo viaja AO LADO da mensagem: cobrar a presenca dele no corpo seria cobrar o impossivel. */
  it('anexo obrigatorio ausente do texto nao entra em missingRequired', () => {
    const diff = diffTemplateVariables({ body: 'Pedido {{orderNumber}} faturado.', variables: CATALOGO })

    expect(diff.missingRequired).toEqual([])
  })

  it('variavel de TEXTO obrigatoria ausente continua cobrada', () => {
    const diff = diffTemplateVariables({ body: 'Sem nada.', variables: CATALOGO })

    expect(diff.missingRequired).toEqual(['orderNumber'])
  })

  /** `{{nota}}` no corpo renderiza a URL crua no meio da frase, e nao anexa nada. */
  it('anexo usado dentro do texto vira aviso proprio', () => {
    const diff = diffTemplateVariables({ body: 'Veja {{nota}}', variables: CATALOGO })

    expect(diff.attachmentsInText).toEqual(['nota'])
    expect(diff.unknown).toEqual([])
  })

  it('anexo fica de fora do payload de preview', () => {
    expect(buildPreviewPayload(CATALOGO)).toEqual({ orderNumber: 'QC-1042' })
  })

  it('catalogo sem `kind` continua valendo como texto', () => {
    const antigo: readonly TemplateVariableDefinition[] = [{ name: 'nome', example: 'Ana', required: true }]

    expect(diffTemplateVariables({ body: 'Ola.', variables: antigo }).missingRequired).toEqual(['nome'])
  })
})
