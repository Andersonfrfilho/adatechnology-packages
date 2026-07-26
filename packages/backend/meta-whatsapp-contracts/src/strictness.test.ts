/**
 * Guarda contra a regressão que motivou este arquivo: o tsconfig base do monorepo não declarava
 * `strict`, então o tsup emitia as declarações com strictNullChecks desligado. Nessa condição a
 * inferência do zod degrada e TODO campo obrigatório vira opcional no .d.ts publicado
 * (`body?: string` para um `z.ZodString`), quebrando qualquer consumidor strict — foi o que
 * impediu o QuickCart de compilar contra a 0.2.0-rc.1.
 *
 * O teste não roda o compilador: ele afirma em nível de tipo que os campos obrigatórios NÃO
 * aceitam undefined. Se as declarações voltarem a ser emitidas sem strict, estas asserções
 * param de compilar no `check` do pacote.
 */

import { describe, expect, it } from 'bun:test'
import { whatsAppMessageSchema, type WhatsAppMessage } from './webhook.types'

// Resolve para true só quando A e B são exatamente o mesmo tipo.
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function assertExact<T extends true>(): void {
  void 0 as unknown as T
}

describe('declarações do contracts sob strict', () => {
  it('mantém campos obrigatórios sem undefined', () => {
    assertExact<Exact<WhatsAppMessage['id'], string>>()
    assertExact<Exact<WhatsAppMessage['from'], string>>()
    assertExact<Exact<WhatsAppMessage['type'], string>>()
    assertExact<Exact<WhatsAppMessage['timestamp'], string>>()

    expect(true).toBe(true)
  })

  it('mantém obrigatórios os campos aninhados de um objeto opcional', () => {
    type TextBody = NonNullable<WhatsAppMessage['text']>['body']
    assertExact<Exact<TextBody, string>>()

    expect(true).toBe(true)
  })

  it('continua rejeitando em runtime um payload sem os obrigatórios', () => {
    const result = whatsAppMessageSchema.safeParse({ id: 'wamid.1', type: 'text' })
    expect(result.success).toBe(false)
  })
})
