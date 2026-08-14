/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { importarNfeXml } from '../../src/providers/NfeXmlImporter.service'
import { parseIcpBrasilSubject } from '../../src/sefaz/CertificateValidator'
import { isCnpjValid } from '../../src/sefaz/SefazTaxId'
import type { NfeXmlDocument } from '../../src/types'
import { buildAuthorizedNfeXml, buildBareNfeXml, ISSUER_CNPJ } from '../fixtures/nfe-xml.fixture'

/**
 * A importação é o lado de entrada: a NF-e chega pronta, emitida por um contribuinte que já pode
 * ter CNPJ alfanumérico. Antes da spec 037 o `collectRelatedCnpjs` filtrava por `/^\d{14}$/` e o
 * emitente com letra **sumia da lista de relacionados** — sem erro, sem log. Quem consome essa lista
 * para decidir de quem é a nota simplesmente não a via.
 */

const ISSUER = '12ABC34501DE35'
const RECIPIENT = '45XY6789ZW0165'
const CARRIER = '55GHI333000108'
const ACCESS_KEY = '35260712ABC34501DE35550010000000011000000014'

function importDocument(xml: string): NfeXmlDocument {
  const imported = importarNfeXml(xml)
  if (!imported.document) throw new Error(`importação não devolveu documento: kind=${imported.kind}`)
  return imported.document
}

function importAlphanumericNfe(): NfeXmlDocument {
  return importDocument(
    buildBareNfeXml({
      accessKey: ACCESS_KEY,
      issuerCnpj: ISSUER,
      recipientCnpj: RECIPIENT,
      carrierCnpj: CARRIER,
    }),
  )
}

describe('os três CNPJs do caso são válidos pela regra da RFB', () => {
  test('o DV fecha com a tabela alfanumérica', () => {
    expect(isCnpjValid(ISSUER)).toBe(true)
    expect(isCnpjValid(RECIPIENT)).toBe(true)
    expect(isCnpjValid(CARRIER)).toBe(true)
  })
})

describe('importação de NF-e com participantes alfanuméricos', () => {
  test('a chave alfanumérica é aceita e sai íntegra', () => {
    const document = importAlphanumericNfe()

    expect(document.accessKey).toBe(ACCESS_KEY)
    expect(document.accessKey.slice(6, 20)).toBe(ISSUER)
  })

  test('emitente, destinatário e transportadora saem íntegros', () => {
    const document = importAlphanumericNfe()

    expect(document.issuer?.taxId).toBe(ISSUER)
    expect(document.recipient?.taxId).toBe(RECIPIENT)
    expect(document.carrier?.taxId).toBe(CARRIER)
  })

  test('os três entram em relatedCnpjs — é a lista que diz de quem é a nota', () => {
    const document = importAlphanumericNfe()

    expect(document.relatedCnpjs).toContain(ISSUER)
    expect(document.relatedCnpjs).toContain(RECIPIENT)
    expect(document.relatedCnpjs).toContain(CARRIER)
  })

  test('a nota autorizada com protocolo segue o mesmo caminho', () => {
    const document = importDocument(
      buildAuthorizedNfeXml({
        accessKey: ACCESS_KEY,
        issuerCnpj: ISSUER,
        recipientCnpj: RECIPIENT,
        carrierCnpj: CARRIER,
      }),
    )

    // A chave do protNFe é conferida contra a do infNFe pelo importador: chegar aqui já prova que
    // a chave alfanumérica atravessou essa checagem de coerência
    expect(document.relatedCnpjs).toContain(ISSUER)
    expect(document.accessKey).toBe(ACCESS_KEY)
    expect(document.protocol?.statusCode).toBe('100')
  })
})

describe('a nota numérica não muda de comportamento', () => {
  test('o emitente numérico continua em relatedCnpjs', () => {
    const document = importDocument(buildBareNfeXml())

    expect(document.relatedCnpjs).toContain(ISSUER_CNPJ)
  })
})

/**
 * O certificado A1 do contribuinte alfanumérico traz o CNPJ com letra no CN e no OU. Com a regex
 * antiga (`\d{14}`) nada casava e a titularidade saía `undefined` — o certificado deixava de ser
 * conferido contra o emitente, em silêncio.
 */
describe('sujeito do certificado ICP-Brasil', () => {
  test('CNPJ alfanumérico é lido do CN', () => {
    expect(
      parseIcpBrasilSubject({ commonName: `TRANSPORTADORA TESTE LTDA:${ISSUER}`, organizationalUnits: [] }),
    ).toEqual({ cnpj: ISSUER, cpf: undefined })
  })

  test('CNPJ alfanumérico é lido do OU quando o CN não traz sufixo', () => {
    expect(
      parseIcpBrasilSubject({ commonName: 'TRANSPORTADORA TESTE LTDA', organizationalUnits: ['AC SOLUTI', ISSUER] }),
    ).toEqual({
      cnpj: ISSUER,
      cpf: undefined,
    })
  })

  test('CNPJ numérico continua sendo lido pelos dois caminhos', () => {
    expect(parseIcpBrasilSubject({ commonName: `EMPRESA LTDA:${ISSUER_CNPJ}`, organizationalUnits: [] }).cnpj).toBe(
      ISSUER_CNPJ,
    )
    expect(parseIcpBrasilSubject({ organizationalUnits: [ISSUER_CNPJ] }).cnpj).toBe(ISSUER_CNPJ)
  })

  test('CPF continua discriminado pelo tamanho, não pela ausência de letra', () => {
    expect(parseIcpBrasilSubject({ commonName: 'FULANO DE TAL:12345678901', organizationalUnits: [] })).toEqual({
      cnpj: undefined,
      cpf: '12345678901',
    })
    expect(parseIcpBrasilSubject({ organizationalUnits: ['12345678901'] }).cpf).toBe('12345678901')
  })
})
