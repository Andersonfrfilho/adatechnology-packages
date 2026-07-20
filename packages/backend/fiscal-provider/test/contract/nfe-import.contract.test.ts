/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { importarNfeXml } from '../../src/index'
import {
  buildAuthorizedNfeXml,
  buildBareNfeXml,
  buildNfeEventXml,
  CARRIER_CNPJ,
  ISSUER_CNPJ,
  NFE_ACCESS_KEY,
  RECIPIENT_CNPJ,
  SECOND_NFE_ACCESS_KEY,
} from '../fixtures/nfe-xml.fixture'

const originalFetch = globalThis.fetch
const MAX_XML_BYTES = 5 * 1024 * 1024

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('@adatechnology/fiscal-provider public NF-e XML import contract', () => {
  test('normalizes an authorized nfeProc without losing the legacy DFe summary', () => {
    const result = asRecord(importarNfeXml(buildAuthorizedNfeXml()))

    expect(result).toMatchObject({
      nsu: '',
      schema: 'xml-import',
      chaveNfe: NFE_ACCESS_KEY,
      mod: '55',
      emitenteCnpj: ISSUER_CNPJ,
      emitenteNome: 'EMITENTE TESTE LTDA',
      valorTotal: 260.8085,
      dataEmissao: '2026-07-20T12:00:00-03:00',
      situacao: '1',
    })
    expect(result['kind']).toBe('authorized-nfe')
    expect(result['document']).toMatchObject({
      accessKey: NFE_ACCESS_KEY,
      model: '55',
      number: '1',
      series: '1',
      issuedAt: '2026-07-20T12:00:00-03:00',
      operationNature: 'VENDA DE PRODUCAO DO ESTABELECIMENTO',
      operationType: '1',
      status: 'authorized',
      totals: {
        invoice: '260.8085',
        products: '250.3085',
        freight: '10.5000',
        insurance: '1.2500',
        discount: '2.0000',
        otherExpenses: '0.7500',
      },
      issuer: {
        taxId: ISSUER_CNPJ,
        name: 'EMITENTE TESTE LTDA',
        tradeName: 'EMITENTE FIXTURE',
        stateRegistration: '111111111111',
        address: {
          street: 'Rua Origem',
          number: '100',
          complement: 'Galpao A',
          district: 'Centro',
          cityCode: '3550308',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '01001000',
        },
      },
      recipient: {
        taxId: RECIPIENT_CNPJ,
        name: 'DESTINATARIO TESTE LTDA',
        stateRegistration: '222222222222',
        address: {
          street: 'Rua Destino',
          number: '200',
          district: 'Centro',
          cityCode: '3304557',
          city: 'Rio de Janeiro',
          state: 'RJ',
          postalCode: '20040002',
        },
      },
      carrier: {
        taxId: CARRIER_CNPJ,
        name: 'TRANSPORTADORA TESTE LTDA',
        stateRegistration: '333333333333',
        address: {
          street: 'Rodovia Teste 300',
          city: 'Sao Paulo',
          state: 'SP',
        },
      },
      products: [
        {
          lineNumber: '1',
          code: 'SKU-001',
          description: 'PRODUTO SINTETICO PARA TESTE',
          ncm: '84713012',
          cfop: '6101',
          commercialUnit: 'UN',
          commercialQuantity: '2.5000',
          unitValue: '100.1234',
          totalValue: '250.3085',
        },
      ],
      volumes: [
        {
          quantity: '2',
          species: 'CAIXA',
          brand: 'FIXTURE',
          numbering: '1-2',
          netWeight: '10.500',
          grossWeight: '12.750',
        },
      ],
      protocol: {
        number: '135260000000001',
        authorizedAt: '2026-07-20T12:05:00-03:00',
        statusCode: '100',
        reason: 'Autorizado o uso da NF-e',
      },
      additionalInformation: 'OBSERVACAO SINTETICA PARA CONTRATO',
      relatedCnpjs: [ISSUER_CNPJ, RECIPIENT_CNPJ, CARRIER_CNPJ],
    })
  })

  test('keeps every normalized fiscal decimal as a string', () => {
    const result = asRecord(importarNfeXml(buildAuthorizedNfeXml()))
    const document = asRecord(result['document'])
    const totals = asRecord(document['totals'])
    const product = asRecord(asArray(document['products'])[0])
    const volume = asRecord(asArray(document['volumes'])[0])

    expect(Object.values(totals).every((value) => typeof value === 'string')).toBe(true)
    expect(typeof product['commercialQuantity']).toBe('string')
    expect(typeof product['unitValue']).toBe('string')
    expect(typeof product['totalValue']).toBe('string')
    expect(typeof volume['netWeight']).toBe('string')
    expect(typeof volume['grossWeight']).toBe('string')
  })

  test('distinguishes a bare unsigned NFe from an authorized document', () => {
    const result = asRecord(importarNfeXml(buildBareNfeXml()))

    expect(result['chaveNfe']).toBe(NFE_ACCESS_KEY)
    expect(result['kind']).toBe('unsigned-nfe')
    expect(result['document']).toMatchObject({
      accessKey: NFE_ACCESS_KEY,
      status: 'unsigned',
    })
    expect(asRecord(result['document'])['protocol']).toBeUndefined()
  })

  test('normalizes procEventoNFe as an event instead of a document', () => {
    const result = asRecord(importarNfeXml(buildNfeEventXml()))

    expect(result).toMatchObject({
      chaveNfe: NFE_ACCESS_KEY,
      tipoEvento: '110111',
      descricaoEvento: 'Cancelamento',
      dataEvento: '2026-07-20T13:00:00-03:00',
    })
    expect(result['kind']).toBe('nfe-event')
    expect(result['event']).toMatchObject({
      accessKey: NFE_ACCESS_KEY,
      type: '110111',
      sequence: '1',
      occurredAt: '2026-07-20T13:00:00-03:00',
      description: 'Cancelamento',
      protocol: '135260000000002',
      statusCode: '135',
      reason: 'Evento registrado e vinculado a NF-e',
    })
    expect(result['document']).toBeUndefined()
  })

  test('never performs network I/O while importing local XML', () => {
    let called = false
    globalThis.fetch = (): Promise<Response> => {
      called = true
      throw new Error('network must not be called')
    }

    importarNfeXml(buildAuthorizedNfeXml())

    expect(called).toBe(false)
  })

  test('rejects DTD and ENTITY declarations before parsing content', () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE NFe [<!ENTITY fixtureSecret "sensitive-marker">]>',
      buildBareNfeXml().replace('<?xml version="1.0" encoding="UTF-8"?>', ''),
    ].join('')

    expectImportError(xml, 'NFE_XML_FORBIDDEN_DECLARATION')
  })

  test('rejects unsupported document roots with a stable safe code', () => {
    expectImportError(
      '<?xml version="1.0"?><cteProc><sensitive>payload-marker</sensitive></cteProc>',
      'NFE_XML_UNSUPPORTED_DOCUMENT',
    )
  })

  test('rejects invalid and mismatched access keys', () => {
    expectImportError(buildBareNfeXml({ accessKey: '123' }), 'NFE_XML_INVALID_ACCESS_KEY')
    expectImportError(
      buildAuthorizedNfeXml({ protocolAccessKey: SECOND_NFE_ACCESS_KEY }),
      'NFE_XML_ACCESS_KEY_MISMATCH',
    )
  })

  test('rejects XML above the public import limit before parsing', () => {
    const oversizedXml = `${buildBareNfeXml()}${' '.repeat(MAX_XML_BYTES)}`

    expectImportError(oversizedXml, 'NFE_XML_TOO_LARGE')
  })
})

function expectImportError(xml: string, expectedCode: string): void {
  let captured: unknown
  try {
    importarNfeXml(xml)
  } catch (error: unknown) {
    captured = error
  }

  expect(captured).toBeInstanceOf(Error)
  expect(asRecord(captured)).toMatchObject({
    name: 'NfeXmlImportError',
    code: expectedCode,
  })
  expect(String(asRecord(captured)['message'])).not.toContain(xml)
  expect(String(asRecord(captured)['message'])).not.toContain('sensitive-marker')
  expect(String(asRecord(captured)['message'])).not.toContain('payload-marker')
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected object in NF-e contract test')
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected array in NF-e contract test')
  }
  return value
}
