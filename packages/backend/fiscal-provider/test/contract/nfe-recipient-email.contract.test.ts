/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { importarNfeXml } from '../../src/providers/NfeXmlImporter.service'
import type { NfeXmlDocument } from '../../src/types'
import { buildBareNfeXml } from '../fixtures/nfe-xml.fixture'

function importDocument(recipientEmail?: string): NfeXmlDocument {
  const imported = importarNfeXml(buildBareNfeXml(recipientEmail === undefined ? {} : { recipientEmail }))
  if (!imported.document) throw new Error(`importação não devolveu documento: kind=${imported.kind}`)
  return imported.document
}

describe('e-mail do destinatário da NF-e (<dest><email>)', () => {
  test('a tag preenchida sai em recipient.email', () => {
    expect(importDocument('financeiro@destino.com.br').recipient?.email).toBe('financeiro@destino.com.br')
  })

  test('espaços ao redor são aparados', () => {
    expect(importDocument('  financeiro@destino.com.br \n').recipient?.email).toBe('financeiro@destino.com.br')
  })

  test('sem a tag, o campo fica ausente', () => {
    const recipient = importDocument().recipient

    expect(recipient).toBeDefined()
    expect(recipient?.email).toBeUndefined()
  })

  test('tag vazia ou só com espaços deixa o campo ausente', () => {
    for (const blank of ['', '   ']) {
      const recipient = importDocument(blank).recipient

      expect(recipient).toBeDefined()
      expect(recipient?.email).toBeUndefined()
    }
  })

  test('o emitente não tem <email> no layout 4.00 e o campo fica ausente', () => {
    expect(importDocument('financeiro@destino.com.br').issuer.email).toBeUndefined()
  })
})
